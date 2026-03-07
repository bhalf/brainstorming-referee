// ============================================
// Metrics Computation for Brainstorming Analysis
// ============================================

import { TranscriptSegment, MetricSnapshot, SpeakingTimeDistribution, ExperimentConfig } from '../types';
import {
  getOrFetchEmbeddings,
  computeEmbeddingRepetition,
  computeEmbeddingDiversity,
  cosineSimilarity,
} from './embeddingCache';
import { computeParticipationMetrics } from './participation';
import { computeSemanticDynamicsMetrics, computeSemanticDynamicsFallback } from './semanticDynamics';

// --- Utility: Generate unique ID ---
const generateId = (): string => {
  return `metric-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// --- Utility: Detect system activity markers like [speaking] ---
const isActivityMarker = (seg: TranscriptSegment) => /^\[.*\]$/.test(seg.text.trim());

// Number of recent segments used for repetition / diversity computation.
// Must match MAX_PAIRWISE_SEGMENTS in embeddingCache.ts so the Jaccard fallback
// and the embedding path look at the same slice of the transcript.
const REPETITION_WINDOW_SEGMENTS = 30;

// --- Speaking Time Distribution ---
// Uses text length as proxy for speaking time

export function computeSpeakingTimeDistribution(
  segments: TranscriptSegment[]
): SpeakingTimeDistribution {
  const distribution: SpeakingTimeDistribution = {};

  for (const segment of segments) {
    if (!segment.isFinal) continue; // Only count final segments
    if (isActivityMarker(segment)) continue; // Skip [speaking] markers

    const speaker = segment.speaker;
    const textLength = segment.text.trim().length;

    distribution[speaker] = (distribution[speaker] || 0) + textLength;
  }

  return distribution;
}

// --- Participation Imbalance ---
// Returns 0-1, where 0 = perfectly balanced, 1 = completely imbalanced
// Uses Gini coefficient approach

export function computeParticipationImbalance(
  distribution: SpeakingTimeDistribution,
  knownParticipantCount?: number,
): number {
  const values = Object.values(distribution);

  if (values.length === 0) return 0;

  // Single speaker: if we know there's only 1 participant, there's no imbalance.
  // If we know there are more participants who aren't speaking, that IS imbalance.
  if (values.length === 1) {
    if (knownParticipantCount && knownParticipantCount <= 1) return 0;
    return knownParticipantCount && knownParticipantCount > 1 ? 1 : 0.5; // Neutral if unknown
  }

  const total = values.reduce((sum, v) => sum + v, 0);
  if (total === 0) return 0;

  // Calculate relative shares
  const shares = values.map(v => v / total);

  // Perfect equality would be 1/n for each participant
  const perfectShare = 1 / values.length;

  // Calculate deviation from perfect equality
  const deviationSum = shares.reduce((sum, share) => {
    return sum + Math.abs(share - perfectShare);
  }, 0);

  // Normalize to 0-1 range
  // Maximum deviation is 2 * (1 - 1/n) when one person speaks everything
  const maxDeviation = 2 * (1 - perfectShare);

  return maxDeviation > 0 ? deviationSum / maxDeviation : 0;
}

// Stopwords for Jaccard-based metrics (prevents common function words from inflating similarity)
const STOPWORDS = new Set([
  // English
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was',
  'one', 'our', 'out', 'has', 'have', 'that', 'this', 'with', 'they', 'from', 'been',
  'will', 'also', 'just', 'more', 'some', 'than', 'them', 'then', 'very', 'what', 'when',
  'who', 'how', 'its', 'let', 'into', 'about', 'would', 'could', 'should', 'there',
  'their', 'which', 'other', 'were', 'does', 'done', 'being', 'these', 'those',
  // German
  'der', 'die', 'das', 'und', 'ist', 'ein', 'eine', 'für', 'von', 'mit', 'auf', 'den',
  'dem', 'des', 'sich', 'als', 'auch', 'nach', 'wie', 'über', 'nicht', 'noch', 'bei',
  'aber', 'aus', 'dass', 'hat', 'ich', 'wir', 'sie', 'man', 'mir', 'uns', 'was', 'war',
  'wird', 'haben', 'sind', 'oder', 'nur', 'schon', 'dann', 'eben', 'also', 'wenn',
  'doch', 'kann', 'hier', 'gibt', 'zum', 'zur', 'einen', 'einer', 'einem', 'eines',
]);

// --- Semantic Repetition Rate ---
// Uses Jaccard similarity between recent segments

export function computeSemanticRepetitionRate(
  segments: TranscriptSegment[],
  windowSize: number = 10
): number {
  // Exclude system activity markers ([speaking], etc.) — they have identical text
  // across segments and would artificially inflate the Jaccard repetition rate.
  const finalSegments = segments.filter(s => s.isFinal && !/^\[.*\]$/.test(s.text.trim()));

  if (finalSegments.length < 2) return 0;

  // Get last N segments
  const recentSegments = finalSegments.slice(-windowSize);

  // Extract word sets from each segment (with stopword removal)
  const wordSets = recentSegments.map(segment => {
    const words = segment.text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOPWORDS.has(w));
    return new Set(words);
  });

  if (wordSets.length < 2) return 0;

  // Calculate average Jaccard similarity between consecutive pairs
  let totalSimilarity = 0;
  let pairCount = 0;

  for (let i = 1; i < wordSets.length; i++) {
    const setA = wordSets[i - 1];
    const setB = wordSets[i];

    if (setA.size === 0 || setB.size === 0) continue;

    // Jaccard similarity
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);

    const similarity = union.size > 0 ? intersection.size / union.size : 0;
    totalSimilarity += similarity;
    pairCount++;
  }

  return pairCount > 0 ? totalSimilarity / pairCount : 0;
}

// --- Stagnation Duration ---
// Time since last "new" content was introduced

export function computeStagnationDuration(
  segments: TranscriptSegment[],
  currentTime: number = Date.now()
): number {
  const finalSegments = segments.filter(s => s.isFinal && !isActivityMarker(s));

  if (finalSegments.length === 0) return 0;

  // Find the last segment that introduced new content
  // For simplicity, we use the timestamp of the last segment
  const lastSegment = finalSegments[finalSegments.length - 1];
  const timeSinceLastSegment = (currentTime - lastSegment.timestamp) / 1000;

  return Math.max(0, timeSinceLastSegment);
}

// --- Semantic Stagnation Duration ---
// Uses embeddings to determine if recent segments introduce novel content.
// Only resets stagnation when a segment falls below the novelty threshold.

const NOVELTY_THRESHOLD = 0.85; // Cosine similarity threshold: > 0.85 = repetitive

export function computeStagnationDurationSemantic(
  segments: TranscriptSegment[],
  embeddings: Map<string, number[]>,
  currentTime: number = Date.now()
): number {
  // Exclude system activity markers — their embeddings are near-identical, which
  // would make the novelty walk conclude "no novel content" even during active speech.
  const allFinal = segments.filter(s => s.isFinal && s.text.trim().length > 3 && !/^\[.*\]$/.test(s.text.trim()));

  if (allFinal.length === 0) return 0;
  if (allFinal.length === 1) return 0; // First segment is novel

  // Cap at 30 most recent segments to keep the backward walk O(30²) = O(900) worst-case
  const finalSegments = allFinal.slice(-30);

  // Walk backwards to find the last segment that was truly novel
  for (let i = finalSegments.length - 1; i >= 1; i--) {
    const currentEmb = embeddings.get(finalSegments[i].id);
    if (!currentEmb) continue;

    // Compare with all previous segments in the capped window
    // Use maxSim (not avgSim) — a segment is only novel if it's dissimilar
    // to ALL previous segments, not just on average.
    let maxSim = 0;
    let count = 0;
    for (let j = 0; j < i; j++) {
      const prevEmb = embeddings.get(finalSegments[j].id);
      if (prevEmb) {
        const sim = cosineSimilarity(currentEmb, prevEmb);
        maxSim = Math.max(maxSim, sim);
        count++;
      }
    }

    if (count === 0) continue;

    if (maxSim < NOVELTY_THRESHOLD) {
      // This segment introduced novel content
      const timeSince = (currentTime - finalSegments[i].timestamp) / 1000;
      return Math.max(0, timeSince);
    }
  }

  // No novel content found in capped window — stagnation since oldest kept segment
  const timeSince = (currentTime - finalSegments[0].timestamp) / 1000;
  return Math.max(0, timeSince);
}

// --- Diversity Development ---
// Measures how diverse the vocabulary is over time (0-1).
// Uses MATTR (Moving Average Type-Token Ratio) to avoid Heap's Law bias
// where raw TTR naturally declines as text grows.

const MATTR_WINDOW = 50; // Words per sliding window

export function computeDiversityDevelopment(
  segments: TranscriptSegment[]
): number {
  const finalSegments = segments.filter(s => s.isFinal && !isActivityMarker(s));

  if (finalSegments.length === 0) return 0.5; // Neutral — insufficient data

  // Collect all words
  const allWords: string[] = [];

  for (const segment of finalSegments) {
    const words = segment.text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2);

    for (const word of words) {
      allWords.push(word);
    }
  }

  if (allWords.length === 0) return 0.5; // Neutral

  // For short texts, use standard TTR (Heap's Law doesn't bite yet)
  if (allWords.length <= MATTR_WINDOW) {
    const uniqueWords = new Set(allWords);
    return uniqueWords.size / allWords.length;
  }

  // MATTR: average TTR across all sliding windows of fixed size
  // This is length-independent and a standard measure in computational linguistics
  let totalTTR = 0;
  let windowCount = 0;

  for (let i = 0; i <= allWords.length - MATTR_WINDOW; i++) {
    const windowWords = allWords.slice(i, i + MATTR_WINDOW);
    const windowUnique = new Set(windowWords);
    totalTTR += windowUnique.size / MATTR_WINDOW;
    windowCount++;
  }

  return windowCount > 0 ? totalTTR / windowCount : 0.5;
}

// --- Main Metrics Computation ---

export function computeMetrics(
  segments: TranscriptSegment[],
  config: ExperimentConfig,
  currentTime: number = Date.now()
): MetricSnapshot {
  // Filter segments within the analysis window
  const windowStart = currentTime - config.WINDOW_SECONDS * 1000;
  const windowedSegments = segments.filter(s => s.timestamp >= windowStart);

  const speakingTimeDistribution = computeSpeakingTimeDistribution(windowedSegments);
  const participationImbalance = computeParticipationImbalance(speakingTimeDistribution);
  const semanticRepetitionRate = computeSemanticRepetitionRate(windowedSegments);
  const stagnationDuration = computeStagnationDuration(windowedSegments, currentTime);
  const diversityDevelopment = computeDiversityDevelopment(windowedSegments);

  return {
    id: generateId(),
    timestamp: currentTime,
    speakingTimeDistribution,
    participationImbalance,
    semanticRepetitionRate,
    stagnationDuration,
    diversityDevelopment,
    windowStart,
    windowEnd: currentTime,
  };
}

// --- Threshold Checks ---

export interface ThresholdBreaches {
  imbalance: boolean;
  repetition: boolean;
  stagnation: boolean;
  any: boolean;
}

export function checkThresholds(
  metrics: MetricSnapshot,
  config: ExperimentConfig
): ThresholdBreaches {
  const imbalance = metrics.participationImbalance >= config.THRESHOLD_IMBALANCE;
  const repetition = metrics.semanticRepetitionRate >= config.THRESHOLD_REPETITION;
  const stagnation = metrics.stagnationDuration >= config.THRESHOLD_STAGNATION_SECONDS;

  return {
    imbalance,
    repetition,
    stagnation,
    any: imbalance || repetition || stagnation,
  };
}

// --- Determine Primary Trigger ---

export type TriggerType = 'imbalance' | 'repetition' | 'stagnation' | null;

export function determinePrimaryTrigger(
  metrics: MetricSnapshot,
  config: ExperimentConfig
): TriggerType {
  const breaches = checkThresholds(metrics, config);

  // Priority: imbalance > stagnation > repetition
  if (breaches.imbalance) return 'imbalance';
  if (breaches.stagnation) return 'stagnation';
  if (breaches.repetition) return 'repetition';

  return null;
}

// --- Async Metrics with Embeddings ---

/**
 * Async variant of computeMetrics that uses OpenAI embeddings
 * for semantic repetition and diversity. Falls back to Jaccard
 * if embeddings are unavailable.
 */
export async function computeMetricsAsync(
  segments: TranscriptSegment[],
  config: ExperimentConfig,
  currentTime: number = Date.now(),
  audioSpeakingTimes?: Map<string, number>,
  previousSnapshots?: MetricSnapshot[],
  knownParticipantCount?: number,
): Promise<MetricSnapshot> {
  const windowStart = currentTime - config.WINDOW_SECONDS * 1000;
  const windowedSegments = segments.filter(s => s.timestamp >= windowStart);

  // Use audio-level speaking times if available, else fall back to text-length proxy
  let speakingTimeDistribution: SpeakingTimeDistribution;
  if (audioSpeakingTimes && audioSpeakingTimes.size > 0) {
    speakingTimeDistribution = {};
    for (const [speaker, seconds] of audioSpeakingTimes.entries()) {
      speakingTimeDistribution[speaker] = seconds;
    }
  } else {
    speakingTimeDistribution = computeSpeakingTimeDistribution(windowedSegments);
  }
  const participationImbalance = computeParticipationImbalance(speakingTimeDistribution, knownParticipantCount);

  // Try embeddings for repetition + diversity + semantic stagnation
  let semanticRepetitionRate: number;
  let diversityDevelopment: number;
  let stagnationDuration: number;

  // Exclude system activity markers ([speaking], etc.) from embedding analysis —
  // near-identical embeddings would produce false repetition and stagnation signals.
  const finalSegments = windowedSegments.filter(
    s => s.isFinal && s.text.trim().length > 3 && !/^\[.*\]$/.test(s.text.trim())
  );

  if (finalSegments.length >= 2) {
    try {
      const embeddings = await getOrFetchEmbeddings(
        finalSegments.map(s => ({ id: s.id, text: s.text }))
      );

      // Check if we got enough embeddings back
      const embeddingCount = finalSegments.filter(s => embeddings.has(s.id)).length;

      if (embeddingCount >= 2) {
        const segmentIds = finalSegments.map(s => s.id);
        semanticRepetitionRate = computeEmbeddingRepetition(embeddings, segmentIds);
        diversityDevelopment = computeEmbeddingDiversity(embeddings, segmentIds);
        // Semantic stagnation: uses embedding novelty
        stagnationDuration = computeStagnationDurationSemantic(
          windowedSegments, embeddings, currentTime
        );
      } else {
        // Fallback to Jaccard + time-based stagnation
        semanticRepetitionRate = computeSemanticRepetitionRate(windowedSegments, REPETITION_WINDOW_SEGMENTS);
        diversityDevelopment = computeDiversityDevelopment(windowedSegments);
        stagnationDuration = computeStagnationDuration(windowedSegments, currentTime);
      }
    } catch {
      // Fallback to Jaccard on error
      semanticRepetitionRate = computeSemanticRepetitionRate(windowedSegments, REPETITION_WINDOW_SEGMENTS);
      diversityDevelopment = computeDiversityDevelopment(windowedSegments);
      stagnationDuration = computeStagnationDuration(windowedSegments, currentTime);
    }
  } else {
    semanticRepetitionRate = computeSemanticRepetitionRate(windowedSegments, REPETITION_WINDOW_SEGMENTS);
    diversityDevelopment = computeDiversityDevelopment(windowedSegments);
    stagnationDuration = computeStagnationDuration(windowedSegments, currentTime);
  }

  // --- v2: Compute new participation metrics ---
  const participation = computeParticipationMetrics(
    windowedSegments,
    config,
    participationImbalance,
    knownParticipantCount,
  );

  // --- v2: Compute new semantic dynamics metrics ---
  let semanticDynamicsResult;
  if (finalSegments.length >= 2) {
    try {
      // Reuse the embedding fetch path (cache will serve from memory if already fetched above)
      const embeddingsForDynamics = await getOrFetchEmbeddings(
        finalSegments.map(s => ({ id: s.id, text: s.text }))
      );
      const embCount = finalSegments.filter(s => embeddingsForDynamics.has(s.id)).length;

      if (embCount >= 2) {
        semanticDynamicsResult = computeSemanticDynamicsMetrics(
          windowedSegments,
          embeddingsForDynamics,
          previousSnapshots ?? [],
        );
      } else {
        semanticDynamicsResult = computeSemanticDynamicsFallback(
          windowedSegments,
          previousSnapshots ?? [],
        );
      }
    } catch {
      semanticDynamicsResult = computeSemanticDynamicsFallback(
        windowedSegments,
        previousSnapshots ?? [],
      );
    }
  } else {
    semanticDynamicsResult = computeSemanticDynamicsFallback(
      windowedSegments,
      previousSnapshots ?? [],
    );
  }

  return {
    id: generateId(),
    timestamp: currentTime,
    speakingTimeDistribution,
    participationImbalance,
    semanticRepetitionRate,
    stagnationDuration,
    diversityDevelopment,
    windowStart,
    windowEnd: currentTime,
    participation,
    semanticDynamics: semanticDynamicsResult,
    // inferredState is attached by the hook after metrics computation
  };
}
