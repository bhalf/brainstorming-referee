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
  Intervention,
  EnginePhase,
} from '../types';
import { evaluateRecovery } from './postCheck';
import type { RuleViolationResult } from './ruleViolationChecker';

// --- Helper: Sliding Window Rate Limit ---

const TEN_MINUTES_MS = 10 * 60 * 1000;

/**
 * Check if an intervention can be fired within the sliding-window rate limit.
 * Returns the count of interventions in the last 10 minutes.
 */
export function countRecentInterventions(
  timestamps: number[],
  currentTime: number = Date.now(),
): number {
  const windowStart = currentTime - TEN_MINUTES_MS;
  return timestamps.filter(t => t >= windowStart).length;
}

/**
 * Prune old timestamps outside the 10-minute window.
 */
export function pruneInterventionTimestamps(
  timestamps: number[],
  currentTime: number = Date.now(),
): number[] {
  const windowStart = currentTime - TEN_MINUTES_MS;
  return timestamps.filter(t => t >= windowStart);
}

/** @deprecated Use countRecentInterventions + interventionTimestamps instead */
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
  metrics: MetricSnapshot | null;
  speakerDistribution: string;
}

export function generateInterventionContext(
  trigger: InterventionTrigger,
  metrics: MetricSnapshot | null
): InterventionContext {
  if (!metrics) {
    return {
      trigger,
      metrics,
      speakerDistribution: 'No data (analyzing)',
    };
  }

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

// --- Intervention History Analysis ---

export interface InterventionHistoryAnalysis {
  /** Number of consecutive not_recovered interventions (any intent) */
  consecutiveFailures: number;
  /** Number of consecutive failures for the same intent as proposed */
  consecutiveFailuresForIntent: number;
  /** Whether fatigue mode is active (>=2 consecutive failures) */
  fatigueActive: boolean;
  /** Confirmation time multiplier based on history */
  confirmationMultiplier: number;
  /** Cooldown multiplier based on history */
  cooldownMultiplier: number;
  /** Last recovery result for the proposed intent */
  lastRecoveryForIntent: 'recovered' | 'not_recovered' | 'partial' | 'pending' | null;
}

/**
 * Analyze recent intervention history to inform policy decisions.
 * Derives fatigue multipliers from consecutive failures — no extra engine state needed.
 */
export function analyzeInterventionHistory(
  recentInterventions: Intervention[],
  proposedIntent: InterventionIntent | null,
): InterventionHistoryAnalysis {
  // Count consecutive failures from the end (any intent)
  let consecutiveFailures = 0;
  for (let i = recentInterventions.length - 1; i >= 0; i--) {
    const r = recentInterventions[i].recoveryResult;
    if (r === 'not_recovered') {
      consecutiveFailures++;
    } else {
      break;
    }
  }

  // Count consecutive failures for the specific proposed intent
  let consecutiveFailuresForIntent = 0;
  let lastRecoveryForIntent: InterventionHistoryAnalysis['lastRecoveryForIntent'] = null;

  for (let i = recentInterventions.length - 1; i >= 0; i--) {
    const intervention = recentInterventions[i];
    if (intervention.intent === proposedIntent) {
      if (lastRecoveryForIntent === null) {
        lastRecoveryForIntent = intervention.recoveryResult ?? null;
      }
      if (intervention.recoveryResult === 'not_recovered') {
        consecutiveFailuresForIntent++;
      } else {
        break;
      }
    }
  }

  const fatigueActive = consecutiveFailures >= 2;

  // Fatigue multipliers: 0 failures → 1x, 1 failure → 1.5x, 2+ failures → 2x
  const confirmationMultiplier = consecutiveFailures === 0 ? 1
    : consecutiveFailures === 1 ? 1.5
      : 2;

  const cooldownMultiplier = consecutiveFailures === 0 ? 1
    : consecutiveFailures === 1 ? 1.5
      : 2;

  return {
    consecutiveFailures,
    consecutiveFailuresForIntent,
    fatigueActive,
    confirmationMultiplier,
    cooldownMultiplier,
    lastRecoveryForIntent,
  };
}

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
  // Combined rule violation info (when rule + metric co-occur)
  ruleViolation?: RuleViolationResult | null;
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
    case 'NORM_REINFORCEMENT': return 'rule_violation';
  }
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
  recentInterventions: Intervention[] = [],
): PolicyDecision {
  const phase = engineState.phase;

  // Baseline: log state transitions but never intervene
  if (scenario === 'baseline') {
    return noIntervention(engineState, 'Baseline scenario — logging only');
  }

  // Rate limit (sliding window)
  const recentCount = countRecentInterventions(engineState.interventionTimestamps ?? [], currentTime);
  if (recentCount >= config.MAX_INTERVENTIONS_PER_10MIN) {
    return noIntervention(engineState, `Rate limit reached (${recentCount}/${config.MAX_INTERVENTIONS_PER_10MIN} in last 10 min)`);
  }

  // Cooldown guard
  if (engineState.cooldownUntil && currentTime < engineState.cooldownUntil) {
    const remaining = Math.ceil((engineState.cooldownUntil - currentTime) / 1000);
    return noIntervention(engineState, `In cooldown (${remaining}s remaining)`);
  }

  switch (phase) {
    case 'MONITORING':
    case 'CONFIRMING':
      return handleMonitoring(inferredState, metrics, metricsHistory, engineState, config, currentTime, recentInterventions);

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
  recentInterventions: Intervention[] = [],
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
          phase: 'MONITORING' as EnginePhase,
        },
      };
    }
    return noIntervention(engineState, 'Conversation healthy — monitoring');
  }

  // Risk state detected
  const confirmingState = engineState.confirmingState;
  const confirmingSince = engineState.confirmingSince;

  // Analyze intervention history for the proposed intent
  const proposedIntent = STATE_TO_INTENT[currentStateName] ?? null;
  const history = analyzeInterventionHistory(recentInterventions, proposedIntent);

  // If we're not confirming yet, or confirming a different state, start/restart confirmation
  if (!confirmingSince || confirmingState !== currentStateName) {
    return {
      ...noIntervention(engineState, `${currentStateName} detected (confidence ${(confidence * 100).toFixed(0)}%) — starting confirmation`),
      stateUpdateOnly: {
        confirmingSince: currentTime,
        confirmingState: currentStateName,
        phase: 'CONFIRMING' as EnginePhase,
      },
    };
  }

  // Confirmation in progress — apply fatigue multiplier to required confirmation time
  const effectiveConfirmationSeconds = config.CONFIRMATION_SECONDS * history.confirmationMultiplier;
  const confirmationDuration = (currentTime - confirmingSince) / 1000;
  if (confirmationDuration < effectiveConfirmationSeconds) {
    const fatigueNote = history.fatigueActive
      ? ` [fatigue: ${history.confirmationMultiplier}x]`
      : '';
    return noIntervention(
      engineState,
      `Confirming ${currentStateName} (${confirmationDuration.toFixed(0)}s / ${effectiveConfirmationSeconds.toFixed(0)}s)${fatigueNote}`,
    );
  }

  // Persistence check: ≥70% of snapshots in confirmation window must have been in a RISK state.
  // Changed from checking a single specific state to ANY risk state, because groups can
  // oscillate between e.g. STALLED_DISCUSSION and CONVERGENCE_RISK — both are problematic,
  // and neither reaching 70% alone would reset the timer even though the group was at risk 100%.
  // When the threshold IS met, we fire the intervention for the most frequent risk state.
  const windowStart = currentTime - effectiveConfirmationSeconds * 1000;
  const snapshotsInWindow = metricsHistory
    .filter(m => m.timestamp >= windowStart && m.inferredState != null);

  if (snapshotsInWindow.length > 0) {
    // Count snapshots in ANY risk state
    const riskSnapshots = snapshotsInWindow.filter(
      m => RISK_STATES.includes(m.inferredState?.state as ConversationStateName),
    );
    const riskRatio = riskSnapshots.length / snapshotsInWindow.length;

    if (riskRatio < 0.70) {
      return {
        ...noIntervention(engineState, `Risk state not persistent (${(riskRatio * 100).toFixed(0)}% risk, ${snapshotsInWindow.length} samples) — resetting`),
        stateUpdateOnly: {
          confirmingSince: currentTime,
          confirmingState: currentStateName,
          phase: 'CONFIRMING' as EnginePhase,
        },
      };
    }

    // Threshold met — find the most frequent risk state to target
    if (riskSnapshots.length > 0) {
      const riskCounts: Partial<Record<ConversationStateName, number>> = {};
      for (const snap of riskSnapshots) {
        const s = snap.inferredState?.state as ConversationStateName;
        riskCounts[s] = (riskCounts[s] || 0) + 1;
      }
      // Pick the risk state with the highest count
      let bestState = currentStateName;
      let bestCount = 0;
      for (const [state, count] of Object.entries(riskCounts)) {
        if (count > bestCount && RISK_STATES.includes(state as ConversationStateName)) {
          bestState = state as ConversationStateName;
          bestCount = count;
        }
      }
      // Override currentStateName with the most frequent risk state
      if (bestState !== currentStateName) {
        // Re-derive intent from the most frequent risk state
        const overrideIntent = STATE_TO_INTENT[bestState];
        if (overrideIntent) {
          const trigger = intentToTrigger(overrideIntent);
          const effectiveCooldownMs = config.COOLDOWN_SECONDS * history.cooldownMultiplier * 1000;
          const fatigueReason = history.fatigueActive
            ? ` [fatigue: ${history.consecutiveFailures} consecutive failures, ${history.cooldownMultiplier}x cooldown]`
            : '';

          return {
            shouldIntervene: true,
            intent: overrideIntent,
            role: 'moderator',
            triggeringState: bestState,
            stateConfidence: confidence,
            reason: `Risk state confirmed (${bestState} most frequent) — firing ${overrideIntent}${fatigueReason}`,
            nextEngineState: {
              ...engineState,
              phase: 'POST_CHECK' as EnginePhase,
              confirmingSince: null,
              confirmingState: null,
              postCheckStartTime: currentTime,
              postCheckIntent: overrideIntent,
              cooldownUntil: currentTime + effectiveCooldownMs,
              metricsAtIntervention: metrics,
            },
            stateUpdateOnly: null,
          };
        }
      }
    }
    // else: persistence ≥ 70% with currentStateName as most frequent — fall through to fire
  }
  // If 0 qualified snapshots: insufficient data — skip persistence check, allow intervention to fire

  // Confirmed — fire intervention
  const intent = STATE_TO_INTENT[currentStateName];
  if (!intent) {
    return noIntervention(engineState, `No intent mapping for ${currentStateName}`);
  }

  const trigger = intentToTrigger(intent);

  // Apply fatigue cooldown multiplier
  const effectiveCooldownMs = config.COOLDOWN_SECONDS * history.cooldownMultiplier * 1000;
  const fatigueReason = history.fatigueActive
    ? ` [fatigue: ${history.consecutiveFailures} consecutive failures, ${history.cooldownMultiplier}x cooldown]`
    : '';

  return {
    shouldIntervene: true,
    intent,
    role: 'moderator',
    triggeringState: currentStateName,
    stateConfidence: confidence,
    reason: `${currentStateName} confirmed — firing ${intent}${fatigueReason}`,
    nextEngineState: {
      ...engineState,
      phase: 'POST_CHECK' as EnginePhase,
      confirmingSince: null,
      confirmingState: null,
      postCheckStartTime: currentTime,
      postCheckIntent: intent,
      cooldownUntil: currentTime + effectiveCooldownMs,
      metricsAtIntervention: metrics,
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
        phase: 'POST_CHECK' as EnginePhase,
      },
    };
  }

  const isAlly = engineState.postCheckIntent === 'ALLY_IMPULSE';
  // Ally post-check is shorter (max 60s) to avoid 3.5 minutes total wait in Scenario B
  const requiredSeconds = isAlly ? Math.min(60, config.POST_CHECK_SECONDS) : config.POST_CHECK_SECONDS;

  const elapsed = (currentTime - postCheckStart) / 1000;
  if (elapsed < requiredSeconds) {
    return noIntervention(
      engineState,
      `Post-check in progress (${elapsed.toFixed(0)}s / ${requiredSeconds}s)`,
    );
  }

  // Post-check window complete — evaluate recovery
  const intent = engineState.postCheckIntent ?? null;
  const recovery = evaluateRecovery(intent, metrics, engineState.metricsAtIntervention);

  const monitoringState: DecisionEngineState = {
    ...engineState,
    phase: 'MONITORING' as EnginePhase,
    postCheckStartTime: null,
    postCheckIntent: null,
    metricsAtIntervention: null,
    confirmingSince: null,
    confirmingState: null,
  };

  if (recovery.recovered || recovery.score >= config.RECOVERY_IMPROVEMENT_THRESHOLD) {
    return {
      shouldIntervene: false,
      intent: null,
      role: 'moderator',
      triggeringState: null,
      stateConfidence: inferredState?.confidence ?? 0,
      reason: `Recovery detected (score: ${recovery.score.toFixed(2)})`,
      nextEngineState: monitoringState,
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
      nextEngineState: monitoringState,
      stateUpdateOnly: null,
      recoveryResult: 'partial',
      recoveryScore: recovery.score,
    };
  }

  // No recovery
  if (scenario === 'B' && intent !== 'ALLY_IMPULSE') {
    // Escalate to ally — ally also gets a POST_CHECK afterward
    return {
      shouldIntervene: true,
      intent: 'ALLY_IMPULSE',
      role: 'ally',
      triggeringState: inferredState?.state ?? null,
      stateConfidence: inferredState?.confidence ?? 0,
      reason: `No recovery (score: ${recovery.score.toFixed(2)}) — escalating to ally`,
      nextEngineState: {
        ...engineState,
        phase: 'POST_CHECK' as EnginePhase,
        postCheckStartTime: currentTime,
        postCheckIntent: 'ALLY_IMPULSE',
        cooldownUntil: currentTime + config.COOLDOWN_SECONDS * 1000,
        metricsAtIntervention: metrics,
        confirmingSince: null,
        confirmingState: null,
      },
      stateUpdateOnly: null,
      recoveryResult: 'not_recovered',
      recoveryScore: recovery.score,
    };
  }

  // Scenario A, or ally post-check completed (no further escalation): cooldown → monitoring
  return {
    shouldIntervene: false,
    intent: null,
    role: 'moderator',
    triggeringState: null,
    stateConfidence: inferredState?.confidence ?? 0,
    reason: intent === 'ALLY_IMPULSE'
      ? `Ally post-check done (score: ${recovery.score.toFixed(2)}) — entering cooldown`
      : `No recovery (score: ${recovery.score.toFixed(2)}) — Scenario A, entering cooldown`,
    nextEngineState: {
      ...engineState,
      phase: 'COOLDOWN' as EnginePhase,
      postCheckStartTime: null,
      postCheckIntent: null,
      metricsAtIntervention: null,
      confirmingSince: null,
      confirmingState: null,
      cooldownUntil: engineState.cooldownUntil ?? (currentTime + config.COOLDOWN_SECONDS * 1000),
    },
    stateUpdateOnly: null,
    recoveryResult: 'not_recovered',
    recoveryScore: recovery.score,
  };
}

// --- COOLDOWN Phase ---
// NOTE: The global cooldown guard at the top of evaluatePolicy() already handles
// the in-progress cooldown case for ALL phases (including COOLDOWN itself).
// By the time we reach handleCooldown(), cooldownUntil is either null or expired.

function handleCooldown(
  engineState: DecisionEngineState,
  currentTime: number,
): PolicyDecision {
  // Cooldown expired (or never set) — return to monitoring
  const monitoringState: Partial<DecisionEngineState> = {
    phase: 'MONITORING' as EnginePhase,
    postCheckStartTime: null,
    postCheckIntent: null,
    metricsAtIntervention: null,
    confirmingSince: null,
    confirmingState: null,
    cooldownUntil: null,
  };

  return {
    shouldIntervene: false,
    intent: null,
    role: 'moderator',
    triggeringState: null,
    stateConfidence: 0,
    reason: 'Cooldown complete — returning to monitoring',
    nextEngineState: { ...engineState, ...monitoringState },
    stateUpdateOnly: monitoringState,
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
