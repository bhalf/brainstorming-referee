// ============================================
// Post-Check — State-Aware Recovery Evaluation
// ============================================

import { MetricSnapshot, InterventionIntent } from '../types';

// --- Recovery Criteria Result ---

export interface RecoveryCriteriaDetail {
  before: number;
  after: number;
  improved: boolean;
}

export interface RecoveryCriteria {
  recovered: boolean;
  partial: boolean;
  score: number; // 0-1
  details: Record<string, RecoveryCriteriaDetail>;
}

// --- Recovery Evaluator ---

export function evaluateRecovery(
  intent: InterventionIntent | null,
  currentMetrics: MetricSnapshot,
  metricsAtIntervention: MetricSnapshot | null,
): RecoveryCriteria {
  // No baseline to compare against
  if (!metricsAtIntervention || !intent) {
    return { recovered: true, partial: true, score: 1, details: {} };
  }

  switch (intent) {
    case 'PARTICIPATION_REBALANCING':
      return evaluateParticipationRecovery(currentMetrics, metricsAtIntervention);
    case 'PERSPECTIVE_BROADENING':
      return evaluatePerspectiveRecovery(currentMetrics, metricsAtIntervention);
    case 'REACTIVATION':
      return evaluateReactivationRecovery(currentMetrics, metricsAtIntervention);
    case 'ALLY_IMPULSE':
      // Ally is the final escalation; always mark as partial recovery if any improvement
      return evaluateAllyRecovery(currentMetrics, metricsAtIntervention);
    default:
      return { recovered: true, partial: true, score: 1, details: {} };
  }
}

// --- PARTICIPATION_REBALANCING ---

function evaluateParticipationRecovery(
  current: MetricSnapshot,
  atIntervention: MetricSnapshot,
): RecoveryCriteria {
  const details: Record<string, RecoveryCriteriaDetail> = {};

  // Participation risk score
  const prevRisk = atIntervention.participation?.participationRiskScore ?? 0;
  const currRisk = current.participation?.participationRiskScore ?? 0;
  const riskDelta = prevRisk > 0 ? (prevRisk - currRisk) / prevRisk : 0;
  const riskImproved = riskDelta >= 0.15;
  details.participationRiskScore = { before: prevRisk, after: currRisk, improved: riskImproved };

  // Silent participant ratio
  const prevSilent = atIntervention.participation?.silentParticipantRatio ?? 0;
  const currSilent = current.participation?.silentParticipantRatio ?? 0;
  const silentImproved = (prevSilent - currSilent >= 0.1) || currSilent === 0;
  details.silentParticipantRatio = { before: prevSilent, after: currSilent, improved: silentImproved };

  // Turn distribution (Gini on turnShare)
  const prevImbalance = atIntervention.participationImbalance;
  const currImbalance = current.participationImbalance;
  const turnImproved = prevImbalance - currImbalance >= 0.05;
  details.participationImbalance = { before: prevImbalance, after: currImbalance, improved: turnImproved };

  const recovered = riskImproved && (silentImproved || turnImproved);
  const partial = riskImproved || silentImproved || turnImproved;

  // Score: weighted delta
  const score = Math.max(0, Math.min(1,
    0.6 * Math.max(0, riskDelta) +
    0.4 * Math.max(0, (prevSilent - currSilent) / Math.max(prevSilent, 0.01)),
  ));

  return { recovered, partial, score, details };
}

// --- PERSPECTIVE_BROADENING ---

function evaluatePerspectiveRecovery(
  current: MetricSnapshot,
  atIntervention: MetricSnapshot,
): RecoveryCriteria {
  const details: Record<string, RecoveryCriteriaDetail> = {};

  const prevNovelty = atIntervention.semanticDynamics?.noveltyRate ?? 0;
  const currNovelty = current.semanticDynamics?.noveltyRate ?? 0;
  const noveltyImproved = currNovelty - prevNovelty >= 0.10;
  details.noveltyRate = { before: prevNovelty, after: currNovelty, improved: noveltyImproved };

  const prevConcentration = atIntervention.semanticDynamics?.clusterConcentration ?? 0;
  const currConcentration = current.semanticDynamics?.clusterConcentration ?? 0;
  const concentrationImproved = prevConcentration - currConcentration >= 0.08;
  details.clusterConcentration = { before: prevConcentration, after: currConcentration, improved: concentrationImproved };

  const prevExpansion = atIntervention.semanticDynamics?.semanticExpansionScore ?? 0;
  const currExpansion = current.semanticDynamics?.semanticExpansionScore ?? 0;
  const expansionImproved = currExpansion > 0 || (currExpansion - prevExpansion >= 0.15);
  details.semanticExpansionScore = { before: prevExpansion, after: currExpansion, improved: expansionImproved };

  const recovered = noveltyImproved && concentrationImproved;
  const partial = noveltyImproved || concentrationImproved || expansionImproved;

  const score = Math.max(0, Math.min(1,
    0.5 * Math.max(0, (currNovelty - prevNovelty) / Math.max(1 - prevNovelty, 0.01)) +
    0.5 * Math.max(0, (prevConcentration - currConcentration) / Math.max(prevConcentration, 0.01)),
  ));

  return { recovered, partial, score, details };
}

// --- REACTIVATION ---

function evaluateReactivationRecovery(
  current: MetricSnapshot,
  atIntervention: MetricSnapshot,
): RecoveryCriteria {
  const details: Record<string, RecoveryCriteriaDetail> = {};

  const prevNovelty = atIntervention.semanticDynamics?.noveltyRate ?? 0;
  const currNovelty = current.semanticDynamics?.noveltyRate ?? 0;
  const noveltyImproved = currNovelty - prevNovelty >= 0.10;
  details.noveltyRate = { before: prevNovelty, after: currNovelty, improved: noveltyImproved };

  const prevExpansion = atIntervention.semanticDynamics?.semanticExpansionScore ?? 0;
  const currExpansion = current.semanticDynamics?.semanticExpansionScore ?? 0;
  const expansionImproved = currExpansion > 0 || (currExpansion - prevExpansion >= 0.20);
  details.semanticExpansionScore = { before: prevExpansion, after: currExpansion, improved: expansionImproved };

  const prevStagnation = atIntervention.stagnationDuration;
  const currStagnation = current.stagnationDuration;
  const stagnationImproved = prevStagnation - currStagnation >= 30;
  details.stagnationDuration = { before: prevStagnation, after: currStagnation, improved: stagnationImproved };

  const recovered = noveltyImproved && (expansionImproved || stagnationImproved);
  const partial = noveltyImproved || expansionImproved || stagnationImproved;

  const score = Math.max(0, Math.min(1,
    0.5 * Math.max(0, (currNovelty - prevNovelty) / 0.3) +
    0.5 * Math.max(0, (currExpansion - prevExpansion) / 0.5),
  ));

  return { recovered, partial, score, details };
}

// --- ALLY_IMPULSE ---

function evaluateAllyRecovery(
  current: MetricSnapshot,
  atIntervention: MetricSnapshot,
): RecoveryCriteria {
  // Ally is the final escalation: check broad improvement across all metrics
  const details: Record<string, RecoveryCriteriaDetail> = {};

  const prevNovelty = atIntervention.semanticDynamics?.noveltyRate ?? 0;
  const currNovelty = current.semanticDynamics?.noveltyRate ?? 0;
  const noveltyImproved = currNovelty - prevNovelty >= 0.05;
  details.noveltyRate = { before: prevNovelty, after: currNovelty, improved: noveltyImproved };

  const prevRisk = atIntervention.participation?.participationRiskScore ?? 0;
  const currRisk = current.participation?.participationRiskScore ?? 0;
  const riskImproved = prevRisk - currRisk >= 0.05;
  details.participationRiskScore = { before: prevRisk, after: currRisk, improved: riskImproved };

  const prevStagnation = atIntervention.stagnationDuration;
  const currStagnation = current.stagnationDuration;
  const stagnationImproved = prevStagnation - currStagnation >= 15;
  details.stagnationDuration = { before: prevStagnation, after: currStagnation, improved: stagnationImproved };

  const recovered = noveltyImproved || riskImproved || stagnationImproved;
  const partial = recovered;

  const improvements = [noveltyImproved, riskImproved, stagnationImproved].filter(Boolean).length;
  const score = improvements / 3;

  return { recovered, partial, score, details };
}
