/**
 * Participation Metrics -- Composite Diagnostics
 *
 * Computes participation balance metrics from transcript segments:
 *   - Volume share (word count per speaker)
 *   - Turn share (segments per speaker, excluding backchannels)
 *   - Silent participant ratio
 *   - Dominance streak score (consecutive turns by one speaker)
 *   - Hoover index (normalized inequality measure)
 *   - Composite participation risk score
 *
 * These metrics feed into the conversation state inference engine
 * to detect DOMINANCE_RISK and gate HEALTHY_* states.
 *
 * @module participation
 */

import { TranscriptSegment, ParticipationMetrics, ExperimentConfig } from '../types';
import { isActivityMarker } from '../utils/transcript';

/** Maximum number of recent segments to analyze (sliding window). */
const MAX_SEGMENTS = 30;

/**
 * Backchannel words -- short confirmatory/reactive utterances (e.g. "ja", "mhm")
 * that are real speech but should not count as substantive turns for participation
 * metrics. Covers German, Swiss German, and English backchannels commonly seen
 * in brainstorming contexts.
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
 * Determine if a transcript segment is a backchannel (short confirmatory utterance).
 *
 * A segment is a backchannel if it has at most MAX_BACKCHANNEL_WORDS words and
 * every word is in the BACKCHANNEL_WORDS set. Backchannels remain in the transcript
 * but are excluded from turn-based participation metrics.
 *
 * @param segment - Transcript segment to evaluate.
 * @returns True if the segment is a backchannel.
 */
export function isBackchannel(segment: TranscriptSegment): boolean {
  const text = segment.text.trim().toLowerCase().replace(/[.!?,;:…]+$/g, '');
  const words = text.split(/\s+/).filter(w => w.length > 0);

  if (words.length === 0) return true;
  if (words.length > MAX_BACKCHANNEL_WORDS) return false;

  return words.every(w => BACKCHANNEL_WORDS.has(w));
}

/** Filter to finalized segments, excluding activity markers (join/leave events). */
function getFinalSegments(segments: TranscriptSegment[]): TranscriptSegment[] {
  return segments.filter(s => s.isFinal && !isActivityMarker(s));
}

/** Filter to finalized, non-backchannel, non-marker segments (substantive speech only). */
function getSubstantiveSegments(segments: TranscriptSegment[]): TranscriptSegment[] {
  return segments.filter(s => s.isFinal && !isActivityMarker(s) && !isBackchannel(s));
}

/**
 * Compute volume share: word count per speaker, normalized to fractions summing to 1.
 *
 * @param segments - Transcript segments to analyze.
 * @returns Map of speaker name to their fraction of total words.
 */
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

/**
 * Compute turn share: fraction of substantive segments per speaker.
 * Excludes backchannels so that "ja"/"mhm" do not inflate turn counts.
 *
 * @param segments - Transcript segments to analyze.
 * @returns Map of speaker name to their fraction of total turns.
 */
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

/**
 * Compute the fraction of participants who are silent or near-silent.
 *
 * A participant is considered silent if their volume share is below the threshold.
 * Accepts an optional knownParticipantCount from LiveKit to account for participants
 * who never spoke (invisible to transcript-only analysis).
 *
 * @param volumeShare - Map of speaker name to volume fraction.
 * @param threshold - Volume share below which a speaker is "silent" (default 0.05 = 5%).
 * @param knownParticipantCount - Total participants in the room (from LiveKit).
 * @returns Fraction [0, 1] of participants who are silent.
 */
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

/**
 * Measure how much one speaker controls consecutive turns (dominance streak).
 *
 * Finds the longest consecutive run by any single speaker, then normalizes
 * against the expected run length for a balanced conversation:
 *   score = (maxRun/total - 1/speakerCount) / (1 - 1/speakerCount)
 *
 * @param segments - Transcript segments to analyze (uses last MAX_SEGMENTS substantive).
 * @param knownParticipantCount - Total participants (to detect single-speaker dominance).
 * @returns Score in [0, 1] where 0 = no dominance, 1 = complete dominance.
 */
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

/**
 * Compute the normalized Hoover index (aka Pietra index) for a distribution.
 *
 * Measures inequality on a [0, 1] scale:
 *   0 = perfectly equal distribution
 *   1 = maximally unequal (all value in one entry)
 *
 * Formula: sum(|share_i - 1/n|) / (2 * (1 - 1/n))
 *
 * Note: this is NOT the Gini coefficient. The Hoover index is simpler and
 * sufficient for participation imbalance detection.
 *
 * @param values - Raw values (e.g. word counts) for each participant.
 * @returns Normalized Hoover index in [0, 1].
 */
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

/**
 * Compute the composite participation risk score from sub-metrics.
 *
 * Weighted sum: w0*hooverImbalance + w1*silentRatio + w2*streakScore + w3*turnHoover
 * Default weights: [0.35, 0.25, 0.25, 0.15].
 *
 * @param hooverImbalance - Hoover index of volume (word count) distribution.
 * @param silentParticipantRatio - Fraction of silent participants.
 * @param dominanceStreakScore - Consecutive-turn dominance score.
 * @param turnShare - Map of speaker name to turn fraction.
 * @param weights - 4-element weight vector for the sub-metrics.
 * @returns Composite risk score clamped to [0, 1].
 */
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

/**
 * Compute all participation metrics for a set of transcript segments.
 *
 * Orchestrates the individual sub-metric functions and assembles the
 * final ParticipationMetrics object. Also computes a cumulative (long-window)
 * participation imbalance when cumulativeSegments are provided.
 *
 * @param segments - Recent transcript segments (short analysis window).
 * @param config - Experiment configuration (thresholds, weights).
 * @param hooverImbalance - Pre-computed Hoover index from the caller's volume data.
 * @param knownParticipantCount - Total participants from LiveKit (optional).
 * @param cumulativeSegments - All segments since session start for long-window imbalance.
 * @returns Complete ParticipationMetrics object.
 */
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
