// ============================================
// Participation Metrics — Composite Diagnostics
// ============================================

import { TranscriptSegment, ParticipationMetrics, ExperimentConfig } from '../types';

const MAX_SEGMENTS = 30;

const isActivityMarker = (seg: TranscriptSegment) => /^\[.*\]$/.test(seg.text.trim());

function getFinalSegments(segments: TranscriptSegment[]): TranscriptSegment[] {
  return segments.filter(s => s.isFinal && !isActivityMarker(s));
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
  const finalSegs = getFinalSegments(segments);
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
  const finalSegs = getFinalSegments(segments).slice(-MAX_SEGMENTS);
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

// --- Gini coefficient for any distribution ---
// Reusable helper: 0 = perfectly equal, 1 = maximally unequal.

export function computeGini(values: number[]): number {
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
  giniImbalance: number,
  silentParticipantRatio: number,
  dominanceStreakScore: number,
  turnShare: Record<string, number>,
): number {
  const turnGini = computeGini(Object.values(turnShare));

  const score =
    0.35 * giniImbalance +
    0.25 * silentParticipantRatio +
    0.25 * dominanceStreakScore +
    0.15 * turnGini;

  return Math.max(0, Math.min(1, score));
}

// --- Main Orchestrator ---

export function computeParticipationMetrics(
  segments: TranscriptSegment[],
  config: ExperimentConfig,
  giniImbalance: number,
  knownParticipantCount?: number,
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
    giniImbalance,
    silentParticipantRatio,
    dominanceStreakScore,
    turnShare,
  );

  return {
    volumeShare,
    turnShare,
    silentParticipantRatio,
    dominanceStreakScore,
    participationRiskScore,
  };
}
