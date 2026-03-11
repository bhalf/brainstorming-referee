/**
 * Deterministic Conversation State Inference
 *
 * Classifies the current brainstorming conversation into one of 5 states
 * based on participation and semantic dynamics metrics. Each state has a
 * weighted confidence formula, and the highest-confidence state wins.
 *
 * Key mechanisms:
 *   - **Weighted confidence formulas**: each state has its own multi-factor
 *     formula combining participation risk, novelty rate, cluster concentration, etc.
 *   - **Tiebreaking**: when two states are within TIEBREAK_MARGIN (0.03),
 *     risk states are preferred over healthy states to err on the side of caution.
 *   - **Hysteresis**: a state change requires at least HYSTERESIS_MARGIN (0.08)
 *     improvement over the previous state's confidence to prevent flickering.
 *   - **Persistence tracking**: the enteredAt timestamp records when a state
 *     was first entered, enabling duration-based policy decisions upstream.
 *
 * @module inferConversationState
 */

import {
  MetricSnapshot,
  ConversationStateName,
  ConversationStateInference,
} from '../types';

/**
 * Minimum confidence margin required to switch away from the previous state.
 * Prevents rapid oscillation between states with similar confidence scores.
 */
const HYSTERESIS_MARGIN = 0.08;

/**
 * When two candidate states are within this margin, tiebreaking rules
 * (risk > healthy, then priority order) determine the winner.
 */
const TIEBREAK_MARGIN = 0.03;

/** Clamp a numeric value between min and max (inclusive). */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// --- Individual State Confidence Computations ---
// Each function computes a [0, 1] confidence score for its state.
// Weights in each formula sum to 1.0 before any multiplicative penalty.

/**
 * HEALTHY_EXPLORATION: multiple voices contributing new, diverse ideas.
 *
 * Formula: 0.25*(1-riskScore) + 0.30*noveltyRate + 0.20*expansion + 0.25*explorationRatio
 * Gated on balanced participation (riskScore <= 0.5).
 * Penalized by stagnation duration (linear ramp over 120s).
 */
function computeHealthyExplorationConfidence(m: MetricSnapshot): number {
  const p = m.participation;
  const sd = m.semanticDynamics;
  if (!p || !sd) return 0.5;

  // Hard gate: exploration cannot be "healthy" with severe imbalance
  if (p.participationRiskScore > 0.5) return 0;

  // Stagnation penalty: linearly ramps from 0 (0s) to 1 (120s+)
  const stagnationPenalty = clamp(m.stagnationDuration / 120, 0, 1);

  return (
    (0.25 * (1 - p.participationRiskScore) +
      0.30 * sd.noveltyRate +
      0.20 * clamp(sd.semanticExpansionScore + 0.5, 0, 1) +
      0.25 * sd.explorationElaborationRatio) *
    (1 - stagnationPenalty)
  );
}

/**
 * HEALTHY_ELABORATION: productive deepening of existing ideas.
 *
 * Formula: 0.20*(1-riskScore) + 0.25*(1-novelty) + 0.25*(1-explorationRatio)
 *          + 0.15*(1-concentration) + 0.15*expansionBonus
 * Gated on balanced participation (riskScore <= 0.5).
 *
 * Distinguishes from CONVERGENCE_RISK by requiring low cluster concentration
 * (ideas spread across sub-themes) and non-negative expansion (space not contracting).
 */
function computeHealthyElaborationConfidence(m: MetricSnapshot): number {
  const p = m.participation;
  const sd = m.semanticDynamics;
  if (!p || !sd) return 0;

  if (p.participationRiskScore > 0.5) return 0;

  const stagnationPenalty = clamp(m.stagnationDuration / 120, 0, 1);

  // Low concentration = ideas spread across clusters (healthy deepening)
  const concentrationPenalty = clamp(sd.clusterConcentration, 0, 1);
  // Positive expansion = idea space is stable or growing (not collapsing)
  const expansionBonus = clamp(sd.semanticExpansionScore + 0.3, 0, 1);

  return (
    (0.20 * (1 - p.participationRiskScore) +
      0.25 * (1 - sd.noveltyRate) +
      0.25 * (1 - sd.explorationElaborationRatio) +
      0.15 * (1 - concentrationPenalty) +
      0.15 * expansionBonus) *
    (1 - stagnationPenalty)
  );
}

/**
 * DOMINANCE_RISK: one or few speakers monopolizing the conversation.
 *
 * Formula: 0.30*riskScore + 0.25*silentRatio + 0.20*streakScore + 0.25*cumulativeImbalance
 * Uses the cumulative (long-window) imbalance to avoid "dominance amnesia"
 * where recent balance masks earlier imbalance.
 */
function computeDominanceRiskConfidence(m: MetricSnapshot): number {
  const p = m.participation;
  if (!p) return 0;

  const longTermImbalance = p.cumulativeParticipationImbalance;

  return (
    0.30 * p.participationRiskScore +
    0.25 * p.silentParticipantRatio +
    0.20 * p.dominanceStreakScore +
    0.25 * longTermImbalance
  );
}

/**
 * CONVERGENCE_RISK: ideas narrowing around few themes, low novelty.
 *
 * Formula: 0.25*clusterConcentration + 0.20*(1-novelty) + 0.20*(1-explorationRatio)
 *          + 0.35*clamp(-expansionScore)
 *
 * The strongest signal (0.35 weight) is a contracting semantic space
 * (negative expansion score), distinguishing convergence from healthy elaboration.
 */
function computeConvergenceRiskConfidence(m: MetricSnapshot): number {
  const sd = m.semanticDynamics;
  if (!sd) return 0;

  return (
    0.25 * sd.clusterConcentration +
    0.20 * (1 - sd.noveltyRate) +
    0.20 * (1 - sd.explorationElaborationRatio) +
    0.35 * clamp(-sd.semanticExpansionScore, 0, 1)
  );
}

/**
 * STALLED_DISCUSSION: no new content, semantically static.
 *
 * Formula: 0.20*(1-novelty) + 0.25*(stagnation/180) + 0.20*clamp(-expansion)
 *          + 0.15*(1-diversity) + 0.20*fluencyPenalty
 *
 * Ideational fluency penalty normalizes turns/min to [0,1]:
 *   rate=0 (silence) -> penalty=1.0, rate>=6 (healthy) -> penalty=0.0.
 */
function computeStalledDiscussionConfidence(m: MetricSnapshot): number {
  const sd = m.semanticDynamics;
  if (!sd) return 0;

  // Fluency penalty: inverse-linear from 6 turns/min (healthy) to 0 (silence)
  const fluencyPenalty = clamp(1 - sd.ideationalFluencyRate / 6, 0, 1);

  return (
    0.20 * (1 - sd.noveltyRate) +
    0.25 * clamp(m.stagnationDuration / 180, 0, 1) +
    0.20 * clamp(-sd.semanticExpansionScore, 0, 1) +
    0.15 * (1 - m.diversityDevelopment) +
    0.20 * fluencyPenalty
  );
}

/** All 5 candidate states, iterated during confidence computation. */
const ALL_STATES: ConversationStateName[] = [
  'HEALTHY_EXPLORATION',
  'HEALTHY_ELABORATION',
  'DOMINANCE_RISK',
  'CONVERGENCE_RISK',
  'STALLED_DISCUSSION',
];

/** Risk states win tiebreaks against healthy states to err on the side of caution. */
const RISK_STATES = new Set<ConversationStateName>([
  'STALLED_DISCUSSION',
  'DOMINANCE_RISK',
  'CONVERGENCE_RISK',
]);

/**
 * Full priority order for tiebreaking within the same risk/healthy category.
 * Risk states come first (most urgent first), then healthy states.
 */
const TIEBREAK_PRIORITY: ConversationStateName[] = [
  'STALLED_DISCUSSION',
  'DOMINANCE_RISK',
  'CONVERGENCE_RISK',
  'HEALTHY_EXPLORATION',
  'HEALTHY_ELABORATION',
];

type ConfidenceComputer = (m: MetricSnapshot) => number;

/** Maps each state to its confidence computation function. */
const CONFIDENCE_COMPUTERS: Record<ConversationStateName, ConfidenceComputer> = {
  HEALTHY_EXPLORATION: computeHealthyExplorationConfidence,
  HEALTHY_ELABORATION: computeHealthyElaborationConfidence,
  DOMINANCE_RISK: computeDominanceRiskConfidence,
  CONVERGENCE_RISK: computeConvergenceRiskConfidence,
  STALLED_DISCUSSION: computeStalledDiscussionConfidence,
};

/**
 * Infer the current conversation state from a metric snapshot.
 *
 * Computes confidence scores for all 5 candidate states, applies
 * tiebreaking (risk > healthy), hysteresis (require HYSTERESIS_MARGIN
 * to switch), and builds a criteria snapshot for research logging.
 *
 * @param metrics - Current metric snapshot with participation and semantic dynamics.
 * @param previousInference - Previous inference result (for hysteresis and persistence tracking).
 * @param currentTime - Reference timestamp in epoch-ms (defaults to now).
 * @returns A ConversationStateInference with primary/secondary states, confidence scores,
 *          persistence timing, and a full criteria snapshot for debugging.
 */
export function inferConversationState(
  metrics: MetricSnapshot,
  previousInference: ConversationStateInference | null,
  currentTime: number = Date.now(),
): ConversationStateInference {
  // Early return with low confidence when metrics are not yet available
  if (!metrics.participation || !metrics.semanticDynamics) {
    return {
      state: previousInference?.state ?? 'HEALTHY_EXPLORATION',
      confidence: 0.2,
      secondaryState: null,
      secondaryConfidence: 0,
      enteredAt: previousInference?.enteredAt ?? currentTime,
      durationMs: previousInference ? currentTime - previousInference.enteredAt : 0,
      criteriaSnapshot: { insufficientData: 1 },
    };
  }

  // Step 1: Compute confidence for all 5 candidate states
  const confidences: { state: ConversationStateName; confidence: number }[] = ALL_STATES.map(
    state => ({
      state,
      confidence: CONFIDENCE_COMPUTERS[state](metrics),
    }),
  );

  // Step 2: Sort by confidence descending with tiebreak rules
  confidences.sort((a, b) => {
    const diff = b.confidence - a.confidence;
    if (Math.abs(diff) < TIEBREAK_MARGIN) {
      // Within tiebreak margin: prefer risk states over healthy states
      const aIsRisk = RISK_STATES.has(a.state);
      const bIsRisk = RISK_STATES.has(b.state);
      if (aIsRisk && !bIsRisk) return -1;
      if (!aIsRisk && bIsRisk) return 1;
      // Same category: use explicit priority order
      return TIEBREAK_PRIORITY.indexOf(a.state) - TIEBREAK_PRIORITY.indexOf(b.state);
    }
    return diff;
  });

  let primaryState = confidences[0].state;
  let primaryConfidence = confidences[0].confidence;
  // Secondary state only reported if its confidence exceeds 0.3
  const secondaryState = confidences[1].confidence > 0.3 ? confidences[1].state : null;
  const secondaryConfidence = confidences[1].confidence;

  // Step 3: Hysteresis — require a minimum margin to switch states
  if (previousInference && primaryState !== previousInference.state) {
    const previousConfidence = confidences.find(c => c.state === previousInference.state)?.confidence ?? 0;
    const margin = primaryConfidence - previousConfidence;

    if (margin < HYSTERESIS_MARGIN) {
      primaryState = previousInference.state;
      primaryConfidence = previousConfidence;
    }
  }

  // Step 4: Persistence tracking — preserve enteredAt if state unchanged
  const enteredAt =
    previousInference && primaryState === previousInference.state
      ? previousInference.enteredAt
      : currentTime;

  // Step 5: Build criteria snapshot for research logging
  const confidenceMap: Record<string, number> = {};
  for (const c of confidences) {
    confidenceMap[`conf_${c.state}`] = c.confidence;
  }

  const criteriaSnapshot: Record<string, number> = {
    participationRiskScore: metrics.participation.participationRiskScore,
    silentParticipantRatio: metrics.participation.silentParticipantRatio,
    dominanceStreakScore: metrics.participation.dominanceStreakScore,
    cumulativeImbalance: metrics.participation.cumulativeParticipationImbalance,
    noveltyRate: metrics.semanticDynamics.noveltyRate,
    clusterConcentration: metrics.semanticDynamics.clusterConcentration,
    explorationRatio: metrics.semanticDynamics.explorationElaborationRatio,
    expansionScore: metrics.semanticDynamics.semanticExpansionScore,
    ideationalFluencyRate: metrics.semanticDynamics.ideationalFluencyRate,
    piggybackingScore: metrics.semanticDynamics.piggybackingScore,
    stagnationDuration: metrics.stagnationDuration,
    diversity: metrics.diversityDevelopment,
    imbalance: metrics.participationImbalance,
    ...confidenceMap,
  };

  return {
    state: primaryState,
    confidence: primaryConfidence,
    secondaryState,
    secondaryConfidence,
    enteredAt,
    durationMs: currentTime - enteredAt,
    criteriaSnapshot,
  };
}
