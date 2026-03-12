// ============================================
// Metrics Computation for Brainstorming Analysis
// ============================================

import { TranscriptSegment, MetricSnapshot, SpeakingTimeDistribution, ExperimentConfig, SpeakingTimeDelta } from '../types';
import {
  getOrFetchEmbeddings,
  computeEmbeddingRepetition,
  computeEmbeddingDiversity,
  cosineSimilarity,
} from './embeddingCache';
import { computeParticipationMetrics } from './participation';
import { computeSemanticDynamicsMetrics, computeSemanticDynamicsFallback } from './semanticDynamics';
import { isActivityMarker } from '../utils/transcript';
import { STOPWORDS } from '../utils/stopwords';
import { generateId } from '../utils/generateId';



// Number of recent segments used for repetition / diversity computation.
// Must match MAX_PAIRWISE_SEGMENTS in embeddingCache.ts so the Jaccard fallback
// and the embedding path look at the same slice of the transcript.
const REPETITION_WINDOW_SEGMENTS = 50;

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
// Uses Hoover index (normalized sum of absolute deviations from 1/n)

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

// Stopwords imported from shared utils (lib/utils/stopwords.ts)

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
  currentTime: number = Date.now(),
  allSegments?: TranscriptSegment[],
): number {
  const finalSegments = segments.filter(s => s.isFinal && !isActivityMarker(s));

  if (finalSegments.length === 0) {
    // No segments in current window — check full history for silence duration
    if (allSegments) {
      const allFinal = allSegments.filter(s => s.isFinal && !isActivityMarker(s));
      if (allFinal.length > 0) {
        return Math.max(0, (currentTime - allFinal[allFinal.length - 1].timestamp) / 1000);
      }
    }
    return 0;
  }

  // Find the last segment that introduced new content
  // For simplicity, we use the timestamp of the last segment
  const lastSegment = finalSegments[finalSegments.length - 1];
  const timeSinceLastSegment = (currentTime - lastSegment.timestamp) / 1000;

  return Math.max(0, timeSinceLastSegment);
}

// --- Semantic Stagnation Duration ---
// Uses embeddings to determine if recent segments introduce novel content.
// Only resets stagnation when a segment falls below the novelty threshold.

export function computeStagnationDurationSemantic(
  segments: TranscriptSegment[],
  embeddings: Map<string, number[]>,
  currentTime: number = Date.now(),
  stagnationNoveltyThreshold: number = 0.85,
  allSegments?: TranscriptSegment[],
): number {
  // Exclude system activity markers — their embeddings are near-identical, which
  // would make the novelty walk conclude "no novel content" even during active speech.
  const allFinal = segments.filter(s => s.isFinal && s.text.trim().length > 3 && !/^\[.*\]$/.test(s.text.trim()));

  if (allFinal.length === 0) {
    // No segments in current window — check if there were ANY segments ever
    // (from the full unwindowed list). If so, stagnation = time since last segment.
    if (allSegments) {
      const allFinalEver = allSegments.filter(s => s.isFinal && s.text.trim().length > 3 && !/^\[.*\]$/.test(s.text.trim()));
      if (allFinalEver.length > 0) {
        return Math.max(0, (currentTime - allFinalEver[allFinalEver.length - 1].timestamp) / 1000);
      }
    }
    return 0;
  }
  if (allFinal.length === 1) return 0; // First segment is novel

  // Cap at 50 most recent segments to keep the backward walk O(50²) = O(2500) worst-case
  const finalSegments = allFinal.slice(-50);

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

    if (maxSim < stagnationNoveltyThreshold) {
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
  // Optimised O(n) sliding window with a frequency map instead of O(n * MATTR_WINDOW)
  const freq = new Map<string, number>();
  let uniqueCount = 0;

  // Initialise the frequency map with the first window
  for (let j = 0; j < MATTR_WINDOW; j++) {
    const word = allWords[j];
    const count = freq.get(word) ?? 0;
    if (count === 0) uniqueCount++;
    freq.set(word, count + 1);
  }

  let totalTTR = uniqueCount / MATTR_WINDOW;
  let windowCount = 1;

  // Slide the window one word at a time
  for (let i = 1; i <= allWords.length - MATTR_WINDOW; i++) {
    // Remove the word leaving the window (leftmost word of previous window)
    const outWord = allWords[i - 1];
    const outCount = freq.get(outWord)! - 1;
    if (outCount === 0) {
      freq.delete(outWord);
      uniqueCount--;
    } else {
      freq.set(outWord, outCount);
    }

    // Add the word entering the window (rightmost word of new window)
    const inWord = allWords[i + MATTR_WINDOW - 1];
    const inCount = freq.get(inWord) ?? 0;
    if (inCount === 0) uniqueCount++;
    freq.set(inWord, inCount + 1);

    totalTTR += uniqueCount / MATTR_WINDOW;
    windowCount++;
  }

  return totalTTR / windowCount;
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
  audioSpeakingDeltas?: SpeakingTimeDelta[],
  previousSnapshots?: MetricSnapshot[],
  knownParticipantCount?: number,
): Promise<MetricSnapshot> {
  const windowStart = currentTime - config.WINDOW_SECONDS * 1000;
  const windowedSegments = segments.filter(s => s.timestamp >= windowStart);

  // Use audio-level speaking times if available, else fall back to text-length proxy.
  // Audio deltas are windowed to WINDOW_SECONDS to match the text-based fallback.
  let speakingTimeDistribution: SpeakingTimeDistribution;
  if (audioSpeakingDeltas && audioSpeakingDeltas.length > 0) {
    speakingTimeDistribution = {};
    for (const delta of audioSpeakingDeltas) {
      if (delta.timestamp >= windowStart) {
        speakingTimeDistribution[delta.speaker] = (speakingTimeDistribution[delta.speaker] || 0) + delta.seconds;
      }
    }
    // Fall back to text if no deltas within the window
    if (Object.keys(speakingTimeDistribution).length === 0) {
      speakingTimeDistribution = computeSpeakingTimeDistribution(windowedSegments);
    }
  } else {
    speakingTimeDistribution = computeSpeakingTimeDistribution(windowedSegments);
  }
  const participationImbalance = computeParticipationImbalance(speakingTimeDistribution, knownParticipantCount);

  // Try embeddings for repetition + diversity + semantic stagnation + semantic dynamics
  // IMPORTANT: Fetch embeddings ONCE and reuse for all embedding-based computations.
  let semanticRepetitionRate: number;
  let diversityDevelopment: number;
  let stagnationDuration: number;
  let semanticDynamicsResult;
  let metricsMethod: 'embedding' | 'fallback' = 'fallback';

  // Exclude system activity markers ([speaking], etc.) from embedding analysis —
  // near-identical embeddings would produce false repetition and stagnation signals.
  const finalSegments = windowedSegments.filter(
    s => s.isFinal && s.text.trim().length > 3 && !isActivityMarker(s)
  );

  // --- v2: Compute new participation metrics ---
  // Use a longer cumulative window for participation to avoid "dominance amnesia"
  const cumulativeWindowStart = currentTime - config.CUMULATIVE_WINDOW_SECONDS * 1000;
  const cumulativeSegments = segments.filter(s => s.timestamp >= cumulativeWindowStart);

  const participation = computeParticipationMetrics(
    windowedSegments,
    config,
    participationImbalance,
    knownParticipantCount,
    cumulativeSegments,
  );

  if (finalSegments.length >= 2) {
    try {
      // Single embedding fetch — reused for repetition, diversity, stagnation AND semantic dynamics
      const embeddings = await getOrFetchEmbeddings(
        finalSegments.map(s => ({ id: s.id, text: s.text }))
      );

      const embeddingCount = finalSegments.filter(s => embeddings.has(s.id)).length;

      if (embeddingCount >= 2) {
        metricsMethod = 'embedding';
        const segmentIds = finalSegments.map(s => s.id);
        semanticRepetitionRate = computeEmbeddingRepetition(embeddings, segmentIds);
        diversityDevelopment = computeEmbeddingDiversity(embeddings, segmentIds);
        stagnationDuration = computeStagnationDurationSemantic(
          windowedSegments, embeddings, currentTime, config.STAGNATION_NOVELTY_THRESHOLD, segments,
        );
        // Reuse same embeddings for semantic dynamics
        semanticDynamicsResult = computeSemanticDynamicsMetrics(
          windowedSegments,
          embeddings,
          previousSnapshots ?? [],
          config,
        );
      } else {
        // Fallback to Jaccard + time-based stagnation
        semanticRepetitionRate = computeSemanticRepetitionRate(windowedSegments, REPETITION_WINDOW_SEGMENTS);
        diversityDevelopment = computeDiversityDevelopment(windowedSegments);
        stagnationDuration = computeStagnationDuration(windowedSegments, currentTime, segments);
        semanticDynamicsResult = computeSemanticDynamicsFallback(
          windowedSegments,
          previousSnapshots ?? [],
        );
      }
    } catch {
      // Fallback to Jaccard on error
      semanticRepetitionRate = computeSemanticRepetitionRate(windowedSegments, REPETITION_WINDOW_SEGMENTS);
      diversityDevelopment = computeDiversityDevelopment(windowedSegments);
      stagnationDuration = computeStagnationDuration(windowedSegments, currentTime, segments);
      semanticDynamicsResult = computeSemanticDynamicsFallback(
        windowedSegments,
        previousSnapshots ?? [],
      );
    }
  } else {
    semanticRepetitionRate = computeSemanticRepetitionRate(windowedSegments, REPETITION_WINDOW_SEGMENTS);
    diversityDevelopment = computeDiversityDevelopment(windowedSegments);
    stagnationDuration = computeStagnationDuration(windowedSegments, currentTime, segments);
    semanticDynamicsResult = computeSemanticDynamicsFallback(
      windowedSegments,
      previousSnapshots ?? [],
    );
  }

  return {
    id: generateId('metric'),
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
    metricsMethod,
    // inferredState is attached by the hook after metrics computation
  };
}
