// ============================================
// Conversation State Inference — Deterministic
// ============================================

import {
  MetricSnapshot,
  ConversationStateName,
  ConversationStateInference,
} from '../types';

const HYSTERESIS_MARGIN = 0.08;
const TIEBREAK_MARGIN = 0.03;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// --- Individual State Confidence Computations ---

function computeHealthyExplorationConfidence(m: MetricSnapshot): number {
  const p = m.participation;
  const sd = m.semanticDynamics;
  if (!p || !sd) return 0.5;

  return (
    0.25 * (1 - p.participationRiskScore) +
    0.30 * sd.noveltyRate +
    0.20 * clamp(sd.semanticExpansionScore + 0.5, 0, 1) +
    0.25 * sd.explorationElaborationRatio
  );
}

function computeHealthyElaborationConfidence(m: MetricSnapshot): number {
  const p = m.participation;
  const sd = m.semanticDynamics;
  if (!p || !sd) return 0;

  // Gate: elaboration is only "healthy" when participation is balanced
  // High participation risk disqualifies this state
  if (p.participationRiskScore > 0.5) return 0;

  const stagnationPenalty = clamp(m.stagnationDuration / 120, 0, 1);

  // Key differentiator from CONVERGENCE_RISK:
  // - Requires low cluster concentration (ideas spread across multiple sub-themes)
  // - Expansion score must be non-negative (idea space not contracting)
  const concentrationPenalty = clamp(sd.clusterConcentration, 0, 1);
  const expansionBonus = clamp(sd.semanticExpansionScore + 0.3, 0, 1); // Rewards stable/growing space

  return (
    (0.20 * (1 - p.participationRiskScore) +
     0.25 * (1 - sd.noveltyRate) +
     0.25 * (1 - sd.explorationElaborationRatio) +
     0.15 * (1 - concentrationPenalty) +
     0.15 * expansionBonus) *
    (1 - stagnationPenalty)
  );
}

function computeDominanceRiskConfidence(m: MetricSnapshot): number {
  const p = m.participation;
  if (!p) return 0;

  return (
    0.35 * p.participationRiskScore +
    0.25 * p.silentParticipantRatio +
    0.20 * p.dominanceStreakScore +
    0.20 * m.participationImbalance
  );
}

function computeConvergenceRiskConfidence(m: MetricSnapshot): number {
  const sd = m.semanticDynamics;
  if (!sd) return 0;

  // Key differentiator from HEALTHY_ELABORATION:
  // Convergence = high concentration AND idea space is contracting (negative expansion)
  return (
    0.25 * sd.clusterConcentration +
    0.20 * (1 - sd.noveltyRate) +
    0.20 * (1 - sd.explorationElaborationRatio) +
    0.35 * clamp(-sd.semanticExpansionScore, 0, 1) // Strongest signal: contracting space
  );
}

function computeStalledDiscussionConfidence(m: MetricSnapshot): number {
  const sd = m.semanticDynamics;
  if (!sd) return 0;

  return (
    0.25 * (1 - sd.noveltyRate) +
    0.30 * clamp(m.stagnationDuration / 180, 0, 1) +
    0.25 * clamp(-sd.semanticExpansionScore, 0, 1) +
    0.20 * (1 - m.diversityDevelopment)
  );
}

// --- State Names (ordered for iteration) ---

const ALL_STATES: ConversationStateName[] = [
  'HEALTHY_EXPLORATION',
  'HEALTHY_ELABORATION',
  'DOMINANCE_RISK',
  'CONVERGENCE_RISK',
  'STALLED_DISCUSSION',
];

// Risk states that should win tiebreaks against healthy states
const RISK_STATES = new Set<ConversationStateName>([
  'STALLED_DISCUSSION',
  'DOMINANCE_RISK',
  'CONVERGENCE_RISK',
]);

// Full priority order for tiebreaking within the same category
// Risk states first (more urgent first), then healthy states
const TIEBREAK_PRIORITY: ConversationStateName[] = [
  'STALLED_DISCUSSION',
  'DOMINANCE_RISK',
  'CONVERGENCE_RISK',
  'HEALTHY_EXPLORATION',
  'HEALTHY_ELABORATION',
];

type ConfidenceComputer = (m: MetricSnapshot) => number;

const CONFIDENCE_COMPUTERS: Record<ConversationStateName, ConfidenceComputer> = {
  HEALTHY_EXPLORATION: computeHealthyExplorationConfidence,
  HEALTHY_ELABORATION: computeHealthyElaborationConfidence,
  DOMINANCE_RISK: computeDominanceRiskConfidence,
  CONVERGENCE_RISK: computeConvergenceRiskConfidence,
  STALLED_DISCUSSION: computeStalledDiscussionConfidence,
};

// --- Main Inference Function ---

export function inferConversationState(
  metrics: MetricSnapshot,
  previousInference: ConversationStateInference | null,
  currentTime: number = Date.now(),
): ConversationStateInference {
  // Guard: if new metric fields aren't available yet, return low-confidence default.
  // Using low confidence (0.2) signals to the UI and decision engine that
  // the state inference is unreliable due to insufficient data.
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

  // Compute confidence for each state
  const confidences: { state: ConversationStateName; confidence: number }[] = ALL_STATES.map(
    state => ({
      state,
      confidence: CONFIDENCE_COMPUTERS[state](metrics),
    }),
  );

  // Sort by confidence descending, with tiebreaker: risk states win over healthy states
  // when margin is within TIEBREAK_MARGIN (0.03)
  confidences.sort((a, b) => {
    const diff = b.confidence - a.confidence;
    if (Math.abs(diff) < TIEBREAK_MARGIN) {
      // Within tiebreak margin: prefer risk states over healthy states
      const aIsRisk = RISK_STATES.has(a.state);
      const bIsRisk = RISK_STATES.has(b.state);
      if (aIsRisk && !bIsRisk) return -1; // a (risk) should come first
      if (!aIsRisk && bIsRisk) return 1;  // b (risk) should come first
      // Both same category: use priority order
      return TIEBREAK_PRIORITY.indexOf(a.state) - TIEBREAK_PRIORITY.indexOf(b.state);
    }
    return diff;
  });

  let primaryState = confidences[0].state;
  let primaryConfidence = confidences[0].confidence;
  const secondaryState = confidences[1].confidence > 0.3 ? confidences[1].state : null;
  const secondaryConfidence = confidences[1].confidence;

  // Hysteresis: prevent flickering between states
  if (previousInference && primaryState !== previousInference.state) {
    const previousConfidence = confidences.find(c => c.state === previousInference.state)?.confidence ?? 0;
    const margin = primaryConfidence - previousConfidence;

    if (margin < HYSTERESIS_MARGIN) {
      // Not enough margin to switch — keep previous state
      primaryState = previousInference.state;
      primaryConfidence = previousConfidence;
    }
  }

  // Persistence tracking
  const enteredAt =
    previousInference && primaryState === previousInference.state
      ? previousInference.enteredAt
      : currentTime;

  // Build criteria snapshot for logging — includes all 5 candidate confidences
  // so researchers can see exactly why a state was chosen
  const confidenceMap: Record<string, number> = {};
  for (const c of confidences) {
    confidenceMap[`conf_${c.state}`] = c.confidence;
  }

  const criteriaSnapshot: Record<string, number> = {
    // Input metrics
    participationRiskScore: metrics.participation.participationRiskScore,
    silentParticipantRatio: metrics.participation.silentParticipantRatio,
    dominanceStreakScore: metrics.participation.dominanceStreakScore,
    noveltyRate: metrics.semanticDynamics.noveltyRate,
    clusterConcentration: metrics.semanticDynamics.clusterConcentration,
    explorationRatio: metrics.semanticDynamics.explorationElaborationRatio,
    expansionScore: metrics.semanticDynamics.semanticExpansionScore,
    stagnationDuration: metrics.stagnationDuration,
    diversity: metrics.diversityDevelopment,
    imbalance: metrics.participationImbalance,
    // All candidate confidences (for debugging/research)
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
