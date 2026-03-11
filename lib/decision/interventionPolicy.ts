/**
 * Intervention Policy — State-to-Intervention Mapping
 *
 * Core policy engine that maps inferred conversation states to intervention decisions.
 * Implements a 4-phase state machine (MONITORING -> CONFIRMING -> POST_CHECK -> COOLDOWN)
 * with sliding-window rate limiting, fatigue-based adaptive timing, and persistence
 * checks to prevent false positives from transient state flickers.
 *
 * The policy evaluates metrics each tick and decides whether to fire a moderator
 * intervention, escalate to an ally (Scenario B), or remain passive.
 *
 * @module interventionPolicy
 */

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

/** Sliding window size for rate limiting (10 minutes). */
const TEN_MINUTES_MS = 10 * 60 * 1000;

/**
 * Count how many interventions occurred within the last 10-minute sliding window.
 *
 * @param timestamps - Array of epoch-ms timestamps when interventions were fired.
 * @param currentTime - Reference time for the window boundary (defaults to now).
 * @returns Number of interventions inside the window.
 */
export function countRecentInterventions(
  timestamps: number[],
  currentTime: number = Date.now(),
): number {
  const windowStart = currentTime - TEN_MINUTES_MS;
  return timestamps.filter(t => t >= windowStart).length;
}

/**
 * Remove timestamps that fall outside the 10-minute sliding window.
 * Prevents unbounded growth of the timestamp array over long sessions.
 *
 * @param timestamps - Array of epoch-ms timestamps to prune.
 * @param currentTime - Reference time for the window boundary (defaults to now).
 * @returns A new array containing only timestamps within the window.
 */
export function pruneInterventionTimestamps(
  timestamps: number[],
  currentTime: number = Date.now(),
): number[] {
  const windowStart = currentTime - TEN_MINUTES_MS;
  return timestamps.filter(t => t >= windowStart);
}

/**
 * Context object passed to the LLM prompt so it can generate a
 * situationally appropriate intervention message.
 */
export interface InterventionContext {
  trigger: InterventionTrigger;
  metrics: MetricSnapshot | null;
  /** Human-readable speaker distribution string, e.g. "Alice: 45%, Bob: 55%". */
  speakerDistribution: string;
}

/**
 * Build the prompt context for an intervention LLM call.
 * Converts raw metric data into a human-readable speaker distribution summary.
 *
 * @param trigger - The trigger type that caused this intervention.
 * @param metrics - Current metric snapshot (may be null during early session).
 * @returns Context object containing trigger, metrics, and formatted distribution.
 */
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

  // Convert raw character counts to percentage strings per speaker
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

/**
 * Result of analyzing recent intervention history for fatigue detection.
 * Used to adaptively lengthen confirmation and cooldown periods when
 * repeated interventions fail to produce recovery.
 */
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
 * Analyze recent intervention history to derive fatigue-based timing multipliers.
 *
 * Walks the intervention list backwards to count consecutive failures. When the
 * system repeatedly fails to recover, confirmation and cooldown durations are
 * scaled up (1x / 1.5x / 2x) to avoid annoying participants with rapid-fire
 * ineffective interventions.
 *
 * @param recentInterventions - Chronologically ordered list of past interventions.
 * @param proposedIntent - The intent being considered for the next intervention.
 * @returns Analysis result with failure counts and timing multipliers.
 */
export function analyzeInterventionHistory(
  recentInterventions: Intervention[],
  proposedIntent: InterventionIntent | null,
): InterventionHistoryAnalysis {
  // Walk backwards: count consecutive not_recovered results (any intent)
  let consecutiveFailures = 0;
  for (let i = recentInterventions.length - 1; i >= 0; i--) {
    const r = recentInterventions[i].recoveryResult;
    if (r === 'not_recovered') {
      consecutiveFailures++;
    } else {
      break;
    }
  }

  // Walk backwards again: count consecutive failures for the specific proposed intent
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

  // Stepped multipliers: 0 failures -> 1x, 1 failure -> 1.5x, 2+ failures -> 2x (capped)
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

/**
 * Output of a single policy evaluation tick.
 *
 * - `shouldIntervene: true` means the caller should fire the intervention.
 * - `stateUpdateOnly` (non-null) means only engine state fields should be patched
 *   without firing an intervention.
 * - `nextEngineState` is the full engine state to apply after acting on the decision.
 */
export interface PolicyDecision {
  shouldIntervene: boolean;
  intent: InterventionIntent | null;
  role: 'moderator' | 'ally';
  triggeringState: ConversationStateName | null;
  stateConfidence: number;
  reason: string;
  nextEngineState: DecisionEngineState;
  stateUpdateOnly: Partial<DecisionEngineState> | null;
  /** Recovery info (populated after post-check completes). */
  recoveryResult?: 'pending' | 'recovered' | 'not_recovered' | 'partial';
  recoveryScore?: number;
  /** Rule violation info when a rule check co-occurred with the metric trigger. */
  ruleViolation?: RuleViolationResult | null;
}

/** Conversation states that can trigger an intervention. Healthy states are excluded. */
const RISK_STATES: ConversationStateName[] = [
  'DOMINANCE_RISK',
  'CONVERGENCE_RISK',
  'STALLED_DISCUSSION',
];

/** Maps each risk state to its corresponding intervention intent. */
const STATE_TO_INTENT: Record<string, InterventionIntent> = {
  DOMINANCE_RISK: 'PARTICIPATION_REBALANCING',
  CONVERGENCE_RISK: 'PERSPECTIVE_BROADENING',
  STALLED_DISCUSSION: 'REACTIVATION',
};

/**
 * Convert an intervention intent to its legacy trigger string.
 * The trigger is used in API payloads and Supabase records.
 *
 * @param intent - The intervention intent to convert.
 * @returns The corresponding legacy trigger name.
 */
export function intentToTrigger(intent: InterventionIntent): InterventionTrigger {
  switch (intent) {
    case 'PARTICIPATION_REBALANCING': return 'imbalance';
    case 'PERSPECTIVE_BROADENING': return 'repetition';
    case 'REACTIVATION': return 'stagnation';
    case 'ALLY_IMPULSE': return 'escalation';
    case 'NORM_REINFORCEMENT': return 'rule_violation';
  }
}

/** Minimum confidence threshold for a state inference to be considered actionable. */
const MIN_CONFIDENCE = 0.45;

/**
 * Main policy evaluation entry point. Called once per decision tick (~1s).
 *
 * Guards are evaluated top-down:
 *   1. Baseline scenario -> never intervene
 *   2. Rate limit -> block if too many recent interventions
 *   3. Cooldown -> block until cooldown expires
 *   4. Delegate to phase-specific handler
 *
 * @param inferredState - Current conversation state inference (may be null early on).
 * @param metrics - Latest metric snapshot.
 * @param metricsHistory - Array of past metric snapshots for persistence checking.
 * @param engineState - Current decision engine state (phase, timers, etc.).
 * @param config - Experiment configuration (thresholds, timing constants).
 * @param scenario - Experiment scenario ('baseline', 'A', or 'B').
 * @param currentTime - Reference timestamp in epoch-ms (defaults to now).
 * @param recentInterventions - Past interventions for fatigue analysis.
 * @returns A PolicyDecision indicating whether and how to intervene.
 */
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

  if (scenario === 'baseline') {
    return noIntervention(engineState, 'Baseline scenario — logging only');
  }

  // Sliding-window rate limit: cap interventions per 10-minute window
  const recentCount = countRecentInterventions(engineState.interventionTimestamps ?? [], currentTime);
  if (recentCount >= config.MAX_INTERVENTIONS_PER_10MIN) {
    return noIntervention(engineState, `Rate limit reached (${recentCount}/${config.MAX_INTERVENTIONS_PER_10MIN} in last 10 min)`);
  }

  // Global cooldown guard: applies to ALL phases
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

/**
 * MONITORING / CONFIRMING phase handler.
 *
 * Detects risk states, starts/restarts a confirmation timer, checks persistence
 * over a sliding window, and fires the intervention when the risk is confirmed.
 * The confirmation window is extended by fatigue multipliers when prior
 * interventions have failed to produce recovery.
 */
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

/**
 * POST_CHECK phase handler.
 *
 * After an intervention is fired, waits for POST_CHECK_SECONDS then evaluates
 * whether the conversation recovered. Three outcomes:
 *   1. Recovered / partial recovery -> return to MONITORING
 *   2. No recovery in Scenario B -> escalate to ALLY_IMPULSE
 *   3. No recovery in Scenario A (or after ally) -> enter COOLDOWN
 */
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

/**
 * COOLDOWN phase handler.
 *
 * By the time this is reached, the global cooldown guard in evaluatePolicy()
 * has already verified that cooldownUntil is either null or expired.
 * This handler simply transitions the engine back to MONITORING.
 */
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

/**
 * Construct a "no intervention" decision, preserving the current engine state.
 *
 * @param engineState - The current engine state to carry forward unchanged.
 * @param reason - Human-readable explanation for why no intervention is fired.
 * @returns A PolicyDecision with shouldIntervene=false.
 */
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
