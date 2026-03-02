// ============================================
// Decision Engine - Intervention Logic
// ============================================

import {
  MetricSnapshot,
  ExperimentConfig,
  DecisionEngineState,
  Scenario,
  InterventionTrigger,
} from '../types';
import { checkThresholds, determinePrimaryTrigger } from '../metrics/computeMetrics';

// --- Decision Result ---

export interface DecisionResult {
  shouldIntervene: boolean;
  interventionType: 'moderator' | 'ally' | null;
  trigger: InterventionTrigger | null;
  reason: string;
  nextState: DecisionEngineState; // Intended next state if intervention succeeds
  stateUpdateOnly: Partial<DecisionEngineState> | null; // Safe state updates to apply immediately (like timers)
}

// --- Improvement Check ---

/**
 * Check if the triggering metric specifically improved after an intervention.
 * Scoping improvement to the trigger metric prevents a transient signal in an
 * unrelated metric (e.g. stagnation timer resetting after new speech) from
 * masking a persistent problem (e.g. imbalance still at 0.8).
 */
export function checkImprovement(
  current: MetricSnapshot,
  old: MetricSnapshot | null,
  trigger: InterventionTrigger | null
): boolean {
  if (!old) return true; // No baseline → assume improved to prevent escalation loops

  switch (trigger) {
    case 'imbalance':
      return (old.participationImbalance - current.participationImbalance) >= 0.05;
    case 'repetition':
      return (old.semanticRepetitionRate - current.semanticRepetitionRate) >= 0.05;
    case 'stagnation':
      return current.stagnationDuration < old.stagnationDuration;
    default:
      // Escalation or unknown: require any single metric improvement
      return (
        (old.participationImbalance - current.participationImbalance) >= 0.05 ||
        (old.semanticRepetitionRate - current.semanticRepetitionRate) >= 0.05 ||
        current.stagnationDuration < old.stagnationDuration
      );
  }
}

// --- State Machine Logic ---

export function evaluateDecision(
  metrics: MetricSnapshot,
  metricsHistory: MetricSnapshot[],
  currentState: DecisionEngineState,
  config: ExperimentConfig,
  scenario: Scenario,
  currentTime: number = Date.now()
): DecisionResult {
  // Baseline scenario: no interventions
  if (scenario === 'baseline') {
    return {
      shouldIntervene: false,
      interventionType: null,
      trigger: null,
      reason: 'Baseline scenario - no interventions',
      nextState: currentState,
      stateUpdateOnly: null,
    };
  }

  // Check intervention rate limit
  if (currentState.interventionCount >= config.MAX_INTERVENTIONS_PER_10MIN) {
    return {
      shouldIntervene: false,
      interventionType: null,
      trigger: null,
      reason: `Rate limit reached (${config.MAX_INTERVENTIONS_PER_10MIN} per 10 min)`,
      nextState: currentState,
      stateUpdateOnly: null,
    };
  }

  // Check cooldown
  if (currentState.cooldownUntil && currentTime < currentState.cooldownUntil) {
    const remainingSeconds = Math.ceil((currentState.cooldownUntil - currentTime) / 1000);
    return {
      shouldIntervene: false,
      interventionType: null,
      trigger: null,
      reason: `In cooldown (${remainingSeconds}s remaining)`,
      nextState: currentState,
      stateUpdateOnly: null,
    };
  }

  const breaches = checkThresholds(metrics, config);
  const primaryTrigger = determinePrimaryTrigger(metrics, config);

  // --- State Machine ---
  switch (currentState.currentState) {
    case 'OBSERVATION':
      return handleObservationState(
        breaches.any,
        primaryTrigger,
        metrics,
        metricsHistory,
        currentState,
        config,
        currentTime
      );

    case 'STABILIZATION':
      return handleStabilizationState(
        breaches.any,
        primaryTrigger,
        metrics,
        currentState,
        config,
        scenario,
        currentTime
      );

    case 'ESCALATION':
      return handleEscalationState(
        currentState,
        config,
        currentTime
      );

    default:
      return {
        shouldIntervene: false,
        interventionType: null,
        trigger: null,
        reason: 'Unknown state',
        nextState: currentState,
        stateUpdateOnly: null,
      };
  }
}

// --- Observation State Handler ---

function handleObservationState(
  hasBreaches: boolean,
  primaryTrigger: InterventionTrigger | null,
  currentMetrics: MetricSnapshot,
  metricsHistory: MetricSnapshot[],
  currentState: DecisionEngineState,
  config: ExperimentConfig,
  currentTime: number
): DecisionResult {
  if (!hasBreaches) {
    return {
      shouldIntervene: false,
      interventionType: null,
      trigger: null,
      reason: 'All metrics within thresholds',
      nextState: { ...currentState, persistenceStartTime: null },
      stateUpdateOnly: { persistenceStartTime: null },
    };
  }

  if (!currentState.persistenceStartTime) {
    return {
      shouldIntervene: false,
      interventionType: null,
      trigger: null,
      reason: 'Threshold breach detected, starting timer',
      nextState: { ...currentState, persistenceStartTime: currentTime },
      stateUpdateOnly: { persistenceStartTime: currentTime },
    };
  }

  const persistenceDuration = (currentTime - currentState.persistenceStartTime) / 1000;

  if (persistenceDuration < config.PERSISTENCE_SECONDS) {
    return {
      shouldIntervene: false,
      interventionType: null,
      trigger: null,
      reason: `Waiting for persistence (${persistenceDuration.toFixed(1)}s / ${config.PERSISTENCE_SECONDS}s)`,
      nextState: currentState,
      stateUpdateOnly: null,
    };
  }

  // Robust Persistence Check: Use sliding window over last PERSISTENCE_SECONDS
  const windowStart = currentTime - (config.PERSISTENCE_SECONDS * 1000);
  const snapshotsInWindow = metricsHistory.filter(m => m.timestamp >= windowStart);

  // Require at least 75% of snapshots in the window to be breached to count as continuous
  const breachCount = snapshotsInWindow.filter(m => checkThresholds(m, config).any).length;
  const requiredBreaches = Math.max(1, Math.floor(snapshotsInWindow.length * 0.75));

  if (breachCount < requiredBreaches && snapshotsInWindow.length > 0) {
    return {
      shouldIntervene: false,
      interventionType: null,
      trigger: null,
      reason: `Fluctuations detected (${breachCount}/${snapshotsInWindow.length} breached), resetting timer`,
      nextState: { ...currentState, persistenceStartTime: currentTime },
      stateUpdateOnly: { persistenceStartTime: currentTime },
    };
  }

  const firingTrigger = primaryTrigger || 'imbalance';

  // Persistence met - trigger moderator intervention
  return {
    shouldIntervene: true,
    interventionType: 'moderator',
    trigger: firingTrigger,
    reason: `Persistence threshold met for ${firingTrigger}`,
    // Intended state after successful API call — store the trigger for targeted improvement check
    nextState: {
      ...currentState,
      currentState: 'STABILIZATION',
      persistenceStartTime: null,
      postCheckStartTime: currentTime,
      cooldownUntil: currentTime + config.COOLDOWN_SECONDS * 1000,
      metricsAtIntervention: currentMetrics,
      triggerAtIntervention: firingTrigger,
    },
    stateUpdateOnly: null,
  };
}

// --- Stabilization State Handler ---

function handleStabilizationState(
  hasBreaches: boolean,
  primaryTrigger: InterventionTrigger | null,
  currentMetrics: MetricSnapshot,
  currentState: DecisionEngineState,
  config: ExperimentConfig,
  scenario: Scenario,
  currentTime: number
): DecisionResult {
  if (!currentState.postCheckStartTime) {
    return {
      shouldIntervene: false,
      interventionType: null,
      trigger: null,
      reason: 'Post-check start time not set',
      nextState: { ...currentState, postCheckStartTime: currentTime },
      stateUpdateOnly: { postCheckStartTime: currentTime },
    };
  }

  const postCheckDuration = (currentTime - currentState.postCheckStartTime) / 1000;

  if (postCheckDuration < config.POST_CHECK_SECONDS) {
    return {
      shouldIntervene: false,
      interventionType: null,
      trigger: null,
      reason: `Post-check in progress (${postCheckDuration.toFixed(1)}s / ${config.POST_CHECK_SECONDS}s)`,
      nextState: currentState,
      stateUpdateOnly: null,
    };
  }

  // Post-check complete — check improvement on the specific metric that triggered
  const improved = checkImprovement(
    currentMetrics,
    currentState.metricsAtIntervention,
    currentState.triggerAtIntervention
  );

  if (improved || !hasBreaches) {
    return {
      shouldIntervene: false,
      interventionType: null,
      trigger: null,
      reason: improved ? 'Metrics improved after intervention' : 'All metrics within thresholds',
      nextState: {
        ...currentState,
        currentState: 'OBSERVATION',
        postCheckStartTime: null,
        metricsAtIntervention: null,
        triggerAtIntervention: null,
      },
      stateUpdateOnly: {
        currentState: 'OBSERVATION',
        postCheckStartTime: null,
        metricsAtIntervention: null,
        triggerAtIntervention: null,
      },
    };
  }

  // No improvement on the triggering metric
  if (scenario === 'B') {
    return {
      shouldIntervene: true,
      interventionType: 'ally',
      trigger: 'escalation',
      reason: 'No improvement after moderator - escalating to ally',
      nextState: {
        ...currentState,
        currentState: 'ESCALATION',
        postCheckStartTime: null,
        cooldownUntil: currentTime + config.COOLDOWN_SECONDS * 1000,
        metricsAtIntervention: currentMetrics,
        triggerAtIntervention: null,
      },
      stateUpdateOnly: null,
    };
  } else {
    // Scenario A: return to observation, no ally
    return {
      shouldIntervene: false,
      interventionType: null,
      trigger: null,
      reason: 'No improvement, but Scenario A - returning to observation',
      nextState: {
        ...currentState,
        currentState: 'OBSERVATION',
        postCheckStartTime: null,
        metricsAtIntervention: null,
        triggerAtIntervention: null,
        persistenceStartTime: currentTime,
      },
      stateUpdateOnly: {
        currentState: 'OBSERVATION',
        postCheckStartTime: null,
        metricsAtIntervention: null,
        triggerAtIntervention: null,
        persistenceStartTime: currentTime,
      },
    };
  }
}

// --- Escalation State Handler ---

function handleEscalationState(
  currentState: DecisionEngineState,
  config: ExperimentConfig,
  currentTime: number
): DecisionResult {
  if (currentState.cooldownUntil && currentTime < currentState.cooldownUntil) {
    const remainingSeconds = Math.ceil((currentState.cooldownUntil - currentTime) / 1000);
    return {
      shouldIntervene: false,
      interventionType: null,
      trigger: null,
      reason: `Post-escalation cooldown (${remainingSeconds}s remaining)`,
      nextState: currentState,
      stateUpdateOnly: null,
    };
  }

  // Return to observation
  return {
    shouldIntervene: false,
    interventionType: null,
    trigger: null,
    reason: 'Escalation complete, returning to observation',
    nextState: {
      ...currentState,
      currentState: 'OBSERVATION',
      persistenceStartTime: null,
      postCheckStartTime: null,
      metricsAtIntervention: null,
      triggerAtIntervention: null,
    },
    stateUpdateOnly: {
      currentState: 'OBSERVATION',
      persistenceStartTime: null,
      postCheckStartTime: null,
      metricsAtIntervention: null,
      triggerAtIntervention: null,
    },
  };
}

// --- Helper: Reset Intervention Count ---

export function resetInterventionCountIfNeeded(
  currentState: DecisionEngineState,
  lastResetTime: number,
  currentTime: number = Date.now()
): { state: DecisionEngineState; newResetTime: number } {
  const tenMinutes = 10 * 60 * 1000;

  if (currentTime - lastResetTime >= tenMinutes) {
    return {
      state: {
        ...currentState,
        interventionCount: 0,
      },
      newResetTime: currentTime,
    };
  }

  return {
    state: currentState,
    newResetTime: lastResetTime,
  };
}

// --- Generate Intervention Prompt Context ---

export interface InterventionContext {
  trigger: InterventionTrigger;
  metrics: MetricSnapshot;
  speakerDistribution: string;
}

export function generateInterventionContext(
  trigger: InterventionTrigger,
  metrics: MetricSnapshot
): InterventionContext {
  const distribution = Object.entries(metrics.speakingTimeDistribution)
    .map(([speaker, chars]) => {
      const total = Object.values(metrics.speakingTimeDistribution).reduce((a, b) => a + b, 0);
      const percent = total > 0 ? ((chars / total) * 100).toFixed(0) : '0';
      return `${speaker}: ${percent}%`;
    })
    .join(', ');

  return {
    trigger,
    metrics,
    speakerDistribution: distribution || 'No data',
  };
}
