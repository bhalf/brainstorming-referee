// ============================================
// Participation Metrics — Composite Diagnostics
// ============================================

import { TranscriptSegment, ParticipationMetrics, ExperimentConfig } from '../types';
import { isActivityMarker } from '../utils/transcript';

const MAX_SEGMENTS = 30;

/**
 * Backchannel words — short confirmatory/reactive utterances that are real speech
 * but should not count as substantive turns for participation metrics.
 * Unlike hallucination filler words, this list is focused on conversational
 * backchannels commonly seen in brainstorming contexts.
 */
const BACKCHANNEL_WORDS = new Set([
  // German
  'ja', 'nein', 'genau', 'stimmt', 'ok', 'okay', 'mhm', 'aha', 'richtig',
  'klar', 'gut', 'hm', 'hmm', 'jap', 'nö', 'ne', 'jo', 'achso', 'ach',
  'sicher', 'tja', 'doch', 'naja', 'alles', 'super', 'cool', 'toll',
  // Swiss German
  'gell', 'gäll', 'voll', 'ähm', 'also', 'halt', 'eben', 'oder', 'weisch',
  'scho', 'moll', 'gopf', 'auso', 'gnau', 'aso',
  // English
  'yes', 'no', 'yeah', 'yep', 'nope', 'right', 'sure', 'true',
  'mhm', 'uh-huh', 'wow', 'oh', 'ah', 'hm', 'hmm',
  'exactly', 'agreed', 'indeed', 'absolutely', 'totally', 'definitely',
]);

/** Maximum word count for a segment to be considered a backchannel */
const MAX_BACKCHANNEL_WORDS = 3;

/**
 * Check if a segment is a backchannel (short confirmatory utterance).
 * Backchannels are real speech that should remain in the transcript,
 * but should not count as substantive turns for participation metrics.
 */
export function isBackchannel(segment: TranscriptSegment): boolean {
  const text = segment.text.trim().toLowerCase().replace(/[.!?,;:…]+$/g, '');
  const words = text.split(/\s+/).filter(w => w.length > 0);

  if (words.length === 0) return true;
  if (words.length > MAX_BACKCHANNEL_WORDS) return false;

  return words.every(w => BACKCHANNEL_WORDS.has(w));
}

function getFinalSegments(segments: TranscriptSegment[]): TranscriptSegment[] {
  return segments.filter(s => s.isFinal && !isActivityMarker(s));
}

/** Final segments excluding backchannels — used for turn-based metrics */
function getSubstantiveSegments(segments: TranscriptSegment[]): TranscriptSegment[] {
  return segments.filter(s => s.isFinal && !isActivityMarker(s) && !isBackchannel(s));
}

// --- Volume Share ---
// Word count per speaker, normalized to fractions summing to 1.

export function computeVolumeShare(segments: TranscriptSegment[]): Record<string, number> {
  const finalSegs = getFinalSegments(segments);
  const wordCounts: Record<string, number> = {};
  let total = 0;

  for (const seg of finalSegs) {
    const words = seg.text.trim().split(/\s+/).filter(w => w.length > 0);
    const count = words.length;
    wordCounts[seg.speaker] = (wordCounts[seg.speaker] || 0) + count;
    total += count;
  }

  if (total === 0) return wordCounts;

  const shares: Record<string, number> = {};
  for (const [speaker, count] of Object.entries(wordCounts)) {
    shares[speaker] = count / total;
  }
  return shares;
}

// --- Turn Share ---
// Fraction of final segments per speaker.

export function computeTurnShare(segments: TranscriptSegment[]): Record<string, number> {
  const finalSegs = getSubstantiveSegments(segments);
  const turnCounts: Record<string, number> = {};

  for (const seg of finalSegs) {
    turnCounts[seg.speaker] = (turnCounts[seg.speaker] || 0) + 1;
  }

  const total = finalSegs.length;
  if (total === 0) return turnCounts;

  const shares: Record<string, number> = {};
  for (const [speaker, count] of Object.entries(turnCounts)) {
    shares[speaker] = count / total;
  }
  return shares;
}

// --- Silent Participant Ratio ---
// Fraction of participants with volumeShare below threshold.
// Accepts optional knownParticipantCount from LiveKit to detect
// participants who never spoke (invisible to transcript-only analysis).

export function computeSilentParticipantRatio(
  volumeShare: Record<string, number>,
  threshold: number = 0.05,
  knownParticipantCount?: number,
): number {
  const speakersInTranscript = Object.keys(volumeShare);
  const totalParticipants = knownParticipantCount
    ? Math.max(knownParticipantCount, speakersInTranscript.length)
    : speakersInTranscript.length;

  if (totalParticipants <= 1) return 0;

  // Count speakers with volume below threshold
  const silentSpeakers = speakersInTranscript.filter(s => volumeShare[s] < threshold).length;
  // Count participants who never spoke at all
  const neverSpoke = Math.max(0, totalParticipants - speakersInTranscript.length);

  return (silentSpeakers + neverSpoke) / totalParticipants;
}

// --- Dominance Streak Score ---
// Measures how much one speaker controls consecutive turns.

export function computeDominanceStreakScore(
  segments: TranscriptSegment[],
  knownParticipantCount?: number,
): number {
  const finalSegs = getSubstantiveSegments(segments).slice(-MAX_SEGMENTS);
  if (finalSegs.length < 3) return 0;

  const speakers = new Set(finalSegs.map(s => s.speaker));
  const speakerCount = speakers.size;

  // Single speaker: only a dominance issue if we know there are more participants
  if (speakerCount <= 1) {
    return (knownParticipantCount && knownParticipantCount > 1) ? 1 : 0;
  }

  // Find the longest consecutive run by any single speaker
  let maxRun = 1;
  let currentRun = 1;
  for (let i = 1; i < finalSegs.length; i++) {
    if (finalSegs[i].speaker === finalSegs[i - 1].speaker) {
      currentRun++;
      maxRun = Math.max(maxRun, currentRun);
    } else {
      currentRun = 1;
    }
  }

  const rawStreak = maxRun / finalSegs.length;
  const expectedStreak = 1 / speakerCount;
  const denominator = 1 - expectedStreak;

  if (denominator <= 0) return 0;
  return Math.max(0, Math.min(1, (rawStreak - expectedStreak) / denominator));
}

// --- Hoover Index (aka Pietra Index) for any distribution ---
// Reusable helper: 0 = perfectly equal, 1 = maximally unequal.
// Note: This computes the normalized Hoover index (sum of |share - 1/n| / max_deviation),
// NOT the Gini coefficient (which would be sum_i sum_j |x_i - x_j| / (2n * sum(x))).
// The Hoover index is simpler and sufficient for participation imbalance detection.

export function computeHooverIndex(values: number[]): number {
  if (values.length <= 1) return 0; // No inequality possible with 0 or 1 values

  const total = values.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;

  const shares = values.map(v => v / total);
  const perfectShare = 1 / values.length;
  const deviationSum = shares.reduce((sum, share) => sum + Math.abs(share - perfectShare), 0);
  const maxDeviation = 2 * (1 - perfectShare);

  return maxDeviation > 0 ? deviationSum / maxDeviation : 0;
}

// --- Participation Risk Score ---
// Weighted composite of all participation sub-metrics.

export function computeParticipationRiskScore(
  hooverImbalance: number,
  silentParticipantRatio: number,
  dominanceStreakScore: number,
  turnShare: Record<string, number>,
  weights: [number, number, number, number] = [0.35, 0.25, 0.25, 0.15],
): number {
  const turnHoover = computeHooverIndex(Object.values(turnShare));

  const score =
    weights[0] * hooverImbalance +
    weights[1] * silentParticipantRatio +
    weights[2] * dominanceStreakScore +
    weights[3] * turnHoover;

  return Math.max(0, Math.min(1, score));
}

// --- Main Orchestrator ---

export function computeParticipationMetrics(
  segments: TranscriptSegment[],
  config: ExperimentConfig,
  hooverImbalance: number,
  knownParticipantCount?: number,
  cumulativeSegments?: TranscriptSegment[],
): ParticipationMetrics {
  const volumeShare = computeVolumeShare(segments);
  const turnShare = computeTurnShare(segments);
  const silentParticipantRatio = computeSilentParticipantRatio(
    volumeShare,
    config.THRESHOLD_SILENT_PARTICIPANT,
    knownParticipantCount,
  );
  const dominanceStreakScore = computeDominanceStreakScore(segments, knownParticipantCount);
  const participationRiskScore = computeParticipationRiskScore(
    hooverImbalance,
    silentParticipantRatio,
    dominanceStreakScore,
    turnShare,
    config.PARTICIPATION_RISK_WEIGHTS,
  );

  // Cumulative participation imbalance over longer window (default: 600s)
  // Falls back to the short-window Hoover index if no cumulative segments are provided.
  // Uses word counts (not shares) so Hoover can compute deviations correctly.
  let cumulativeParticipationImbalance = hooverImbalance;
  if (cumulativeSegments && cumulativeSegments.length > 0) {
    const cumulativeVolume = computeVolumeShare(cumulativeSegments);
    // volumeShare returns fractions summing to 1 — Hoover needs raw magnitudes,
    // but since Hoover normalizes internally, shares work identically.
    cumulativeParticipationImbalance = computeHooverIndex(Object.values(cumulativeVolume));
  }

  return {
    volumeShare,
    turnShare,
    silentParticipantRatio,
    dominanceStreakScore,
    participationRiskScore,
    cumulativeParticipationImbalance,
  };
}
