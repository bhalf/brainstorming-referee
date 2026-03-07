// ============================================
// Intervention Policy — State-to-Intervention Mapping
// ============================================

import {
  MetricSnapshot,
  ExperimentConfig,
  DecisionEngineState,
  Scenario,
  ConversationStateName,
  ConversationStateInference,
  InterventionIntent,
  InterventionTrigger,
} from '../types';
import { evaluateRecovery } from './postCheck';

// --- Policy Decision Result ---

export interface PolicyDecision {
  shouldIntervene: boolean;
  intent: InterventionIntent | null;
  role: 'moderator' | 'ally';
  triggeringState: ConversationStateName | null;
  stateConfidence: number;
  reason: string;
  nextEngineState: DecisionEngineState;
  stateUpdateOnly: Partial<DecisionEngineState> | null;
  // Recovery info (populated after post-check)
  recoveryResult?: 'pending' | 'recovered' | 'not_recovered' | 'partial';
  recoveryScore?: number;
}

// --- Risk States that can trigger interventions ---

const RISK_STATES: ConversationStateName[] = [
  'DOMINANCE_RISK',
  'CONVERGENCE_RISK',
  'STALLED_DISCUSSION',
];

// --- State → Intent Mapping ---

const STATE_TO_INTENT: Record<string, InterventionIntent> = {
  DOMINANCE_RISK: 'PARTICIPATION_REBALANCING',
  CONVERGENCE_RISK: 'PERSPECTIVE_BROADENING',
  STALLED_DISCUSSION: 'REACTIVATION',
};

// --- Intent → Legacy Trigger Mapping ---

export function intentToTrigger(intent: InterventionIntent): InterventionTrigger {
  switch (intent) {
    case 'PARTICIPATION_REBALANCING': return 'imbalance';
    case 'PERSPECTIVE_BROADENING': return 'repetition';
    case 'REACTIVATION': return 'stagnation';
    case 'ALLY_IMPULSE': return 'escalation';
  }
}

// --- Phase Helpers ---

function phaseToLegacyState(phase: string): 'OBSERVATION' | 'STABILIZATION' | 'ESCALATION' {
  switch (phase) {
    case 'MONITORING':
    case 'CONFIRMING':
      return 'OBSERVATION';
    case 'POST_CHECK':
      return 'STABILIZATION';
    case 'COOLDOWN':
      return 'ESCALATION';
    default:
      return 'OBSERVATION';
  }
}

function getPhase(state: DecisionEngineState): string {
  return state.phase ?? 'MONITORING';
}

// --- Minimum Confidence to Consider a State Actionable ---

const MIN_CONFIDENCE = 0.45;

// --- Main Policy Evaluation ---

export function evaluatePolicy(
  inferredState: ConversationStateInference | null | undefined,
  metrics: MetricSnapshot,
  metricsHistory: MetricSnapshot[],
  engineState: DecisionEngineState,
  config: ExperimentConfig,
  scenario: Scenario,
  currentTime: number = Date.now(),
): PolicyDecision {
  const phase = getPhase(engineState);

  // Baseline: no interventions
  if (scenario === 'baseline') {
    return noIntervention(engineState, 'Baseline scenario — no interventions');
  }

  // Rate limit
  if (engineState.interventionCount >= config.MAX_INTERVENTIONS_PER_10MIN) {
    return noIntervention(engineState, `Rate limit reached (${config.MAX_INTERVENTIONS_PER_10MIN} per 10 min)`);
  }

  // Cooldown guard
  if (engineState.cooldownUntil && currentTime < engineState.cooldownUntil) {
    const remaining = Math.ceil((engineState.cooldownUntil - currentTime) / 1000);
    return noIntervention(engineState, `In cooldown (${remaining}s remaining)`);
  }

  switch (phase) {
    case 'MONITORING':
    case 'CONFIRMING':
      return handleMonitoring(inferredState, metrics, metricsHistory, engineState, config, currentTime);

    case 'POST_CHECK':
      return handlePostCheck(inferredState, metrics, engineState, config, scenario, currentTime);

    case 'COOLDOWN':
      return handleCooldown(engineState, currentTime);

    default:
      return noIntervention(engineState, 'Unknown phase');
  }
}

// --- MONITORING / CONFIRMING Phase ---

function handleMonitoring(
  inferredState: ConversationStateInference | null | undefined,
  metrics: MetricSnapshot,
  metricsHistory: MetricSnapshot[],
  engineState: DecisionEngineState,
  config: ExperimentConfig,
  currentTime: number,
): PolicyDecision {
  const currentStateName = inferredState?.state ?? 'HEALTHY_EXPLORATION';
  const confidence = inferredState?.confidence ?? 0;
  const isRisk = RISK_STATES.includes(currentStateName) && confidence >= MIN_CONFIDENCE;

  if (!isRisk) {
    // No risk detected: reset confirmation timer
    if (engineState.confirmingSince) {
      return {
        ...noIntervention(engineState, 'Conversation healthy — monitoring'),
        stateUpdateOnly: {
          confirmingSince: null,
          confirmingState: null,
          phase: 'MONITORING' as const,
          currentState: 'OBSERVATION',
          persistenceStartTime: null,
        },
      };
    }
    return noIntervention(engineState, 'Conversation healthy — monitoring');
  }

  // Risk state detected
  const confirmingState = engineState.confirmingState;
  const confirmingSince = engineState.confirmingSince;

  // If we're not confirming yet, or confirming a different state, start/restart confirmation
  if (!confirmingSince || confirmingState !== currentStateName) {
    return {
      ...noIntervention(engineState, `${currentStateName} detected (confidence ${(confidence * 100).toFixed(0)}%) — starting confirmation`),
      stateUpdateOnly: {
        confirmingSince: currentTime,
        confirmingState: currentStateName,
        phase: 'CONFIRMING' as const,
        currentState: 'OBSERVATION',
        persistenceStartTime: currentTime,
      },
    };
  }

  // Confirmation in progress — check if enough time has passed
  const confirmationDuration = (currentTime - confirmingSince) / 1000;
  if (confirmationDuration < config.CONFIRMATION_SECONDS) {
    return noIntervention(
      engineState,
      `Confirming ${currentStateName} (${confirmationDuration.toFixed(0)}s / ${config.CONFIRMATION_SECONDS}s)`,
    );
  }

  // Persistence check: ≥70% of snapshots in confirmation window must have same inferred state
  const windowStart = currentTime - config.CONFIRMATION_SECONDS * 1000;
  const snapshotsInWindow = metricsHistory.filter(m => m.timestamp >= windowStart);

  if (snapshotsInWindow.length > 0) {
    const matchCount = snapshotsInWindow.filter(
      m => m.inferredState?.state === currentStateName,
    ).length;
    const ratio = matchCount / snapshotsInWindow.length;

    if (ratio < 0.70) {
      return {
        ...noIntervention(engineState, `State fluctuating (${(ratio * 100).toFixed(0)}% persistence) — resetting`),
        stateUpdateOnly: {
          confirmingSince: currentTime,
          confirmingState: currentStateName,
          phase: 'CONFIRMING' as const,
          currentState: 'OBSERVATION',
          persistenceStartTime: currentTime,
        },
      };
    }
  }

  // Confirmed — fire intervention
  const intent = STATE_TO_INTENT[currentStateName];
  if (!intent) {
    return noIntervention(engineState, `No intent mapping for ${currentStateName}`);
  }

  const trigger = intentToTrigger(intent);

  return {
    shouldIntervene: true,
    intent,
    role: 'moderator',
    triggeringState: currentStateName,
    stateConfidence: confidence,
    reason: `${currentStateName} confirmed — firing ${intent}`,
    nextEngineState: {
      ...engineState,
      currentState: 'STABILIZATION',
      phase: 'POST_CHECK' as const,
      confirmingSince: null,
      confirmingState: null,
      persistenceStartTime: null,
      postCheckStartTime: currentTime,
      postCheckIntent: intent,
      cooldownUntil: currentTime + config.COOLDOWN_SECONDS * 1000,
      metricsAtIntervention: metrics,
      triggerAtIntervention: trigger,
    },
    stateUpdateOnly: null,
  };
}

// --- POST_CHECK Phase ---

function handlePostCheck(
  inferredState: ConversationStateInference | null | undefined,
  metrics: MetricSnapshot,
  engineState: DecisionEngineState,
  config: ExperimentConfig,
  scenario: Scenario,
  currentTime: number,
): PolicyDecision {
  const postCheckStart = engineState.postCheckStartTime;

  if (!postCheckStart) {
    return {
      ...noIntervention(engineState, 'Post-check timer not set'),
      stateUpdateOnly: {
        postCheckStartTime: currentTime,
        phase: 'POST_CHECK' as const,
        currentState: 'STABILIZATION',
      },
    };
  }

  const elapsed = (currentTime - postCheckStart) / 1000;
  if (elapsed < config.POST_CHECK_SECONDS) {
    return noIntervention(
      engineState,
      `Post-check in progress (${elapsed.toFixed(0)}s / ${config.POST_CHECK_SECONDS}s)`,
    );
  }

  // Post-check window complete — evaluate recovery
  const intent = engineState.postCheckIntent ?? null;
  const recovery = evaluateRecovery(intent, metrics, engineState.metricsAtIntervention);

  if (recovery.recovered || recovery.score >= config.RECOVERY_IMPROVEMENT_THRESHOLD) {
    return {
      shouldIntervene: false,
      intent: null,
      role: 'moderator',
      triggeringState: null,
      stateConfidence: inferredState?.confidence ?? 0,
      reason: `Recovery detected (score: ${recovery.score.toFixed(2)})`,
      nextEngineState: {
        ...engineState,
        currentState: 'OBSERVATION',
        phase: 'MONITORING' as const,
        postCheckStartTime: null,
        postCheckIntent: null,
        metricsAtIntervention: null,
        triggerAtIntervention: null,
        confirmingSince: null,
        confirmingState: null,
        persistenceStartTime: null,
      },
      stateUpdateOnly: null,
      recoveryResult: 'recovered',
      recoveryScore: recovery.score,
    };
  }

  if (recovery.partial && recovery.score >= 0.05) {
    return {
      shouldIntervene: false,
      intent: null,
      role: 'moderator',
      triggeringState: null,
      stateConfidence: inferredState?.confidence ?? 0,
      reason: `Partial recovery (score: ${recovery.score.toFixed(2)})`,
      nextEngineState: {
        ...engineState,
        currentState: 'OBSERVATION',
        phase: 'MONITORING' as const,
        postCheckStartTime: null,
        postCheckIntent: null,
        metricsAtIntervention: null,
        triggerAtIntervention: null,
        confirmingSince: null,
        confirmingState: null,
        persistenceStartTime: null,
      },
      stateUpdateOnly: null,
      recoveryResult: 'partial',
      recoveryScore: recovery.score,
    };
  }

  // No recovery
  if (scenario === 'B') {
    // Escalate to ally
    return {
      shouldIntervene: true,
      intent: 'ALLY_IMPULSE',
      role: 'ally',
      triggeringState: inferredState?.state ?? null,
      stateConfidence: inferredState?.confidence ?? 0,
      reason: `No recovery (score: ${recovery.score.toFixed(2)}) — escalating to ally`,
      nextEngineState: {
        ...engineState,
        currentState: 'ESCALATION',
        phase: 'COOLDOWN' as const,
        postCheckStartTime: null,
        postCheckIntent: null,
        cooldownUntil: currentTime + config.COOLDOWN_SECONDS * 1000,
        metricsAtIntervention: metrics,
        triggerAtIntervention: 'escalation',
        confirmingSince: null,
        confirmingState: null,
        persistenceStartTime: null,
      },
      stateUpdateOnly: null,
      recoveryResult: 'not_recovered',
      recoveryScore: recovery.score,
    };
  }

  // Scenario A: return to monitoring
  return {
    shouldIntervene: false,
    intent: null,
    role: 'moderator',
    triggeringState: null,
    stateConfidence: inferredState?.confidence ?? 0,
    reason: `No recovery (score: ${recovery.score.toFixed(2)}) — Scenario A, returning to monitoring`,
    nextEngineState: {
      ...engineState,
      currentState: 'OBSERVATION',
      phase: 'MONITORING' as const,
      postCheckStartTime: null,
      postCheckIntent: null,
      metricsAtIntervention: null,
      triggerAtIntervention: null,
      confirmingSince: null,
      confirmingState: null,
      persistenceStartTime: currentTime,
    },
    stateUpdateOnly: null,
    recoveryResult: 'not_recovered',
    recoveryScore: recovery.score,
  };
}

// --- COOLDOWN Phase ---

function handleCooldown(
  engineState: DecisionEngineState,
  currentTime: number,
): PolicyDecision {
  if (engineState.cooldownUntil && currentTime < engineState.cooldownUntil) {
    const remaining = Math.ceil((engineState.cooldownUntil - currentTime) / 1000);
    return noIntervention(engineState, `Post-escalation cooldown (${remaining}s remaining)`);
  }

  // Cooldown expired — return to monitoring
  return {
    shouldIntervene: false,
    intent: null,
    role: 'moderator',
    triggeringState: null,
    stateConfidence: 0,
    reason: 'Cooldown complete — returning to monitoring',
    nextEngineState: {
      ...engineState,
      currentState: 'OBSERVATION',
      phase: 'MONITORING' as const,
      persistenceStartTime: null,
      postCheckStartTime: null,
      postCheckIntent: null,
      metricsAtIntervention: null,
      triggerAtIntervention: null,
      confirmingSince: null,
      confirmingState: null,
    },
    stateUpdateOnly: {
      currentState: 'OBSERVATION',
      phase: 'MONITORING' as const,
      persistenceStartTime: null,
      postCheckStartTime: null,
      postCheckIntent: null,
      metricsAtIntervention: null,
      triggerAtIntervention: null,
      confirmingSince: null,
      confirmingState: null,
    },
  };
}

// --- Helper: No Intervention ---

function noIntervention(
  engineState: DecisionEngineState,
  reason: string,
): PolicyDecision {
  return {
    shouldIntervene: false,
    intent: null,
    role: 'moderator',
    triggeringState: null,
    stateConfidence: 0,
    reason,
    nextEngineState: engineState,
    stateUpdateOnly: null,
  };
}
