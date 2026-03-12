import { useEffect, useRef, MutableRefObject } from 'react';
import { useLatestRef } from '@/lib/hooks/useLatestRef';
import {
  TranscriptSegment,
  MetricSnapshot,
  Intervention,
  InterventionTrigger,
  ExperimentConfig,
  DecisionEngineState,
  Scenario,
  VoiceSettings,
  ModelRoutingLogEntry,
  ConversationStateInference,
} from '@/lib/types';
import { evaluatePolicy, intentToTrigger, countRecentInterventions, pruneInterventionTimestamps, generateInterventionContext } from '@/lib/decision/interventionPolicy';
import { checkRuleViolations, RULE_CHECK_INTERVAL_MS, RuleViolationResult } from '@/lib/decision/ruleViolationChecker';
import { buildTranscriptContext } from '@/lib/decision/transcriptContext';
import { executeIntervention, persistEngineState, persistRecoveryResult } from '@/lib/decision/interventionExecutor';
import { logEnginePhaseChange, logRecoveryEvaluation, logRuleViolationEvent, logInterventionSuppressed } from '@/lib/services/eventService';
import { DECISION_TICK_MS } from '@/lib/decision/tickConfig';

/** Parameters for the decision engine loop hook. */
interface UseDecisionLoopParams {
  isActive: boolean;
  isDecisionOwner: boolean;
  sessionId: string | null;
  transcriptSegmentsRef: MutableRefObject<TranscriptSegment[]>;
  interventionsRef: MutableRefObject<Intervention[]>;
  metricsHistoryRef: MutableRefObject<MetricSnapshot[]>;
  currentMetricsRef: MutableRefObject<MetricSnapshot | null>;
  stateHistoryRef: MutableRefObject<ConversationStateInference[]>;
  decisionState: DecisionEngineState;
  config: ExperimentConfig;
  voiceSettings: VoiceSettings;
  scenario: Scenario;
  language: string;
  speak: (text: string) => boolean;
  isTTSSupported: boolean;
  addIntervention: (intervention: Intervention) => void;
  updateIntervention: (id: string, updates: Partial<Intervention>) => void;
  addModelRoutingLog: (entry: ModelRoutingLogEntry) => void;
  addError: (message: string, context?: string) => void;
  updateDecisionState: (updates: Partial<DecisionEngineState>) => void;
  broadcastIntervention?: (intervention: Intervention) => void;
}

/**
 * Core decision engine loop that runs on the decision owner client.
 * On each tick it: (1) prunes stale intervention timestamps, (2) checks for rule
 * violations via LLM, (3) evaluates the policy engine for metric-based interventions,
 * and (4) fires interventions when budget and cooldown constraints allow.
 * In baseline scenario, detection runs but interventions are suppressed.
 *
 * @param params - Session state, refs, config, scenario, TTS, and dispatch callbacks.
 */
export function useDecisionLoop({
  isActive,
  isDecisionOwner,
  sessionId,
  transcriptSegmentsRef,
  interventionsRef,
  metricsHistoryRef,
  currentMetricsRef,
  stateHistoryRef,
  decisionState,
  config,
  voiceSettings,
  scenario,
  language,
  speak,
  isTTSSupported,
  addIntervention,
  updateIntervention,
  addModelRoutingLog,
  addError,
  updateDecisionState,
  broadcastIntervention,
}: UseDecisionLoopParams) {
  // Stable refs — useLatestRef keeps them in sync automatically
  const decisionStateRef = useLatestRef(decisionState);
  const configRef = useLatestRef(config);
  const voiceSettingsRef = useLatestRef(voiceSettings);
  const scenarioRef = useLatestRef(scenario);
  const languageRef = useLatestRef(language);
  const speakRef = useLatestRef(speak);
  const isTTSSupportedRef = useLatestRef(isTTSSupported);
  const sessionIdRef = useLatestRef(sessionId);
  const isProcessingRef = useRef(false);
  /** Tracks the last fired intervention ID for post-intervention recovery checks. */
  const lastInterventionIdRef = useRef<string | null>(null);
  const lastRuleCheckTimeRef = useRef(0);
  const isRuleCheckingRef = useRef(false);
  /** Holds a detected rule violation until the next tick can combine it with metric interventions. */
  const pendingRuleViolationRef = useRef<RuleViolationResult | null>(null);
  /** Sliding window of recent evidence strings to suppress duplicate rule violation triggers. */
  const recentEvidenceRef = useRef<Array<{ evidence: string; timestamp: number }>>([]);

  // --- Helper: Persist engine state shorthand ---
  const saveEngineState = (state: DecisionEngineState) => {
    persistEngineState(sessionIdRef.current, state);
  };

  // Applies a partial state update atomically to both React state and the stable ref.
  // This prevents the race window where React's async re-render hasn't propagated
  // the new value into the ref yet, causing the next tick to read stale data.
  const applyStateUpdate = (updates: Partial<DecisionEngineState>) => {
    const oldPhase = decisionStateRef.current.phase;
    updateDecisionState(updates);
    decisionStateRef.current = { ...decisionStateRef.current, ...updates };
    saveEngineState(decisionStateRef.current);

    // Log engine phase transitions for scientific analysis
    if (updates.phase && updates.phase !== oldPhase) {
      logEnginePhaseChange(
        sessionIdRef.current,
        oldPhase,
        updates.phase,
        decisionStateRef.current.postCheckIntent ?? undefined,
      );
    }
  };

  // Decision engine interval
  useEffect(() => {
    if (!isActive || !isDecisionOwner) return;

    const runDecisionEngine = async () => {
      if (isProcessingRef.current) return;

      const currentScenario = scenarioRef.current;
      const now = Date.now();
      const cfg = configRef.current;
      const lang = languageRef.current;

      // --- 1. Prune old intervention timestamps (sliding window housekeeping) ---
      const prunedTimestamps = pruneInterventionTimestamps(
        decisionStateRef.current.interventionTimestamps ?? [],
        now
      );
      if (prunedTimestamps.length !== (decisionStateRef.current.interventionTimestamps ?? []).length) {
        applyStateUpdate({ interventionTimestamps: prunedTimestamps });
      }

      // --- 2. Rule Violation Check (periodic LLM-based detection) ---
      // Require at least 1 speaker with recent segments (avoids checks on empty sessions)
      const recentSegments60s = transcriptSegmentsRef.current.filter(
        s => s.isFinal && s.timestamp > now - 60_000
      );
      const hasRecentActivity = recentSegments60s.length >= 1;

      if (!hasRecentActivity && pendingRuleViolationRef.current) {
        console.log('[DecisionLoop] Rule check skipped — no recent activity, clearing pending violation');
        logRuleViolationEvent(sessionIdRef.current, { event: 'suppressed', suppressionReason: 'no_activity' });
        pendingRuleViolationRef.current = null;
      }

      if (cfg.RULE_CHECK_ENABLED && !isRuleCheckingRef.current && hasRecentActivity) {
        const timeSinceLastRuleCheck = now - lastRuleCheckTimeRef.current;
        if (timeSinceLastRuleCheck >= RULE_CHECK_INTERVAL_MS) {
          const prevRuleCheckTime = lastRuleCheckTimeRef.current;
          isRuleCheckingRef.current = true;
          lastRuleCheckTimeRef.current = now;

          checkRuleViolations(transcriptSegmentsRef.current, lang, prevRuleCheckTime)
            .then((violation) => {
              if (violation) {
                pendingRuleViolationRef.current = violation;
                console.log(`[DecisionLoop] Rule violation detected: ${violation.rule} (${violation.severity})`);
                logRuleViolationEvent(sessionIdRef.current, {
                  event: 'detected',
                  rule: violation.rule,
                  severity: violation.severity,
                  evidence: violation.evidence,
                });
              }
            })
            .catch(() => {
              // Silently ignore rule check failures
            })
            .finally(() => {
              isRuleCheckingRef.current = false;
            });
        }
      }

      // --- 3. Policy Engine (runs in all scenarios, including baseline) ---
      const metrics = currentMetricsRef.current;
      const pendingViolation = pendingRuleViolationRef.current;

      if (!metrics && !pendingViolation) return; // Need metrics OR a rule violation

      let decision: ReturnType<typeof evaluatePolicy> | null = null;

      if (metrics) {
        const inferredState = metrics.inferredState ?? null;

        decision = evaluatePolicy(
          inferredState,
          metrics,
          metricsHistoryRef.current,
          decisionStateRef.current,
          cfg,
          currentScenario,
          now,
          interventionsRef.current.slice(-5),
        );

        if (decision.stateUpdateOnly) {
          applyStateUpdate(decision.stateUpdateOnly);
        }

        if (decision.recoveryResult && lastInterventionIdRef.current) {
          updateIntervention(lastInterventionIdRef.current, {
            recoveryResult: decision.recoveryResult,
            recoveryCheckedAt: now,
          });

          // Persist recovery result to DB via executor
          persistRecoveryResult(
            sessionIdRef.current,
            lastInterventionIdRef.current,
            decision.recoveryResult,
            now,
          );

          // Log recovery evaluation for scientific analysis
          logRecoveryEvaluation(sessionIdRef.current, {
            interventionId: lastInterventionIdRef.current,
            result: decision.recoveryResult,
            phaseDurationMs: now - (decisionStateRef.current.lastInterventionTime ?? now),
          });

          if (!decision.shouldIntervene && decision.recoveryResult !== undefined) {
            // Transition to next engine state atomically
            const oldPhase = decisionStateRef.current.phase;
            decisionStateRef.current = decision.nextEngineState;
            updateDecisionState(decision.nextEngineState);
            saveEngineState(decision.nextEngineState);
            // Log engine phase transition that bypasses applyStateUpdate
            if (decision.nextEngineState.phase !== oldPhase) {
              logEnginePhaseChange(sessionIdRef.current, oldPhase, decision.nextEngineState.phase);
            }
            lastInterventionIdRef.current = null;
          }
        }
      }

      // --- 4. Combine & Act: decide whether to fire a rule-based or metric-based intervention ---
      // In baseline scenario: all detection/logging runs, but no interventions are delivered.
      if (currentScenario === 'baseline') {
        // Log violation detections without acting
        if (pendingRuleViolationRef.current) {
          console.log(`[DecisionLoop] Baseline: rule violation logged (${pendingRuleViolationRef.current.rule}), not intervening`);
          logInterventionSuppressed(sessionIdRef.current, { reason: 'baseline', intent: 'NORM_REINFORCEMENT' });
          pendingRuleViolationRef.current = null;
        }
        if (decision?.shouldIntervene && decision?.intent) {
          logInterventionSuppressed(sessionIdRef.current, { reason: 'baseline', intent: decision.intent });
        }
        return;
      }

      const metricIntervention = decision?.shouldIntervene && decision?.intent;

      // Sliding window budget: count interventions in the last 10 minutes
      const recentInterventionCount = countRecentInterventions(
        decisionStateRef.current.interventionTimestamps ?? [], now
      );
      const budgetAvailable = recentInterventionCount < cfg.MAX_INTERVENTIONS_PER_10MIN;

      if (!budgetAvailable) {
        console.log('[DecisionLoop] Intervention budget exhausted — dropping pending violation');
        logInterventionSuppressed(sessionIdRef.current, {
          reason: 'budget_exhausted',
          recentCount: recentInterventionCount,
          maxAllowed: cfg.MAX_INTERVENTIONS_PER_10MIN,
        });
        pendingRuleViolationRef.current = null;
        return;
      }

      const cooldownActive = decisionStateRef.current.cooldownUntil != null && now < decisionStateRef.current.cooldownUntil;

      // Rule violations fire immediately but with a soft cooldown to prevent budget exhaustion
      const lastRuleViolationTime = decisionStateRef.current.lastRuleViolationTime ?? 0;
      const ruleViolationCooldownActive = (now - lastRuleViolationTime) < cfg.RULE_VIOLATION_COOLDOWN_MS;

      // Dedup: skip if the same evidence string was already flagged within the last 5 minutes
      let duplicateEvidence = false;
      if (pendingViolation?.evidence) {
        const normalized = pendingViolation.evidence.trim().toLowerCase();
        // Prune entries older than 5 minutes
        recentEvidenceRef.current = recentEvidenceRef.current.filter(e => now - e.timestamp < 5 * 60 * 1000);
        duplicateEvidence = recentEvidenceRef.current.some(e => e.evidence === normalized);
        if (duplicateEvidence) {
          console.log(`[DecisionLoop] Rule violation suppressed (duplicate evidence: "${pendingViolation.evidence}")`);
          logRuleViolationEvent(sessionIdRef.current, { event: 'suppressed', rule: pendingViolation.rule, suppressionReason: 'duplicate_evidence' });
          pendingRuleViolationRef.current = null;
        }
      }

      const shouldFireViolation = !!pendingViolation && !ruleViolationCooldownActive && !duplicateEvidence;

      if (pendingViolation && ruleViolationCooldownActive && !duplicateEvidence) {
        const cooldownRemainingSec = Math.ceil((cfg.RULE_VIOLATION_COOLDOWN_MS - (now - lastRuleViolationTime)) / 1000);
        console.log(`[DecisionLoop] Rule violation suppressed (cooldown: ${cooldownRemainingSec}s remaining)`);
        logRuleViolationEvent(sessionIdRef.current, { event: 'suppressed', rule: pendingViolation.rule, suppressionReason: 'cooldown' });
        pendingRuleViolationRef.current = null; // Drop silently
      }
      // Metric interventions respect the global cooldown
      const shouldFireMetric = metricIntervention && !cooldownActive;

      if (!shouldFireViolation && !shouldFireMetric) {
        return;
      }

      // --- Fire intervention ---
      isProcessingRef.current = true;

      try {
        const { transcriptExcerpt, totalTurns, previousInterventions } = buildTranscriptContext(
          transcriptSegmentsRef.current,
          interventionsRef.current,
        );
        const trigger = shouldFireMetric ? intentToTrigger(decision!.intent!) : 'rule_violation';
        const intent = shouldFireMetric ? decision!.intent! : 'NORM_REINFORCEMENT';
        const metricsForContext = metrics;
        const context = generateInterventionContext(trigger, metricsForContext);
        const isCombined = shouldFireViolation && shouldFireMetric;

        const endpoint = (shouldFireMetric && decision?.role === 'ally')
          ? '/api/intervention/ally'
          : '/api/intervention/moderator';

        const body: Record<string, unknown> = {
          trigger,
          intent,
          speakerDistribution: context.speakerDistribution,
          language: lang,
          participationImbalance: metrics?.participationImbalance ?? 0,
          repetitionRate: metrics?.semanticRepetitionRate ?? 0,
          stagnationDuration: metrics?.stagnationDuration ?? 0,
          transcriptExcerpt,
          totalTurns,
          scenario: currentScenario,
          phase: decisionStateRef.current.phase,
          previousInterventions,
          triggeringState: decision?.triggeringState,
          stateConfidence: decision?.stateConfidence,
          participationMetrics: metrics?.participation,
          semanticDynamics: metrics?.semanticDynamics,
        };

        // Add violation info for combined or rule-only messages
        if (shouldFireViolation && pendingViolation) {
          body.combined = isCombined;
          body.ruleViolation = {
            rule: pendingViolation.rule,
            evidence: pendingViolation.evidence,
            severity: pendingViolation.severity,
          };
          if (!shouldFireMetric) {
            body.violationType = pendingViolation.rule;
            body.violationEvidence = pendingViolation.evidence;
            body.violationSeverity = pendingViolation.severity;
          }
        }

        // Build next engine state: append current timestamp to the sliding window
        const updatedTimestamps = [...(decisionStateRef.current.interventionTimestamps ?? []), now];
        let nextEngineState: DecisionEngineState;

        if (shouldFireMetric) {
          nextEngineState = {
            ...decision!.nextEngineState,
            lastInterventionTime: now,
            interventionCount: decisionStateRef.current.interventionCount + 1, // legacy compat
            interventionTimestamps: updatedTimestamps,
          };
        } else {
          nextEngineState = {
            ...decisionStateRef.current,
            lastRuleViolationTime: now,
            lastInterventionTime: now,
            interventionCount: decisionStateRef.current.interventionCount + 1, // legacy compat
            interventionTimestamps: updatedTimestamps,
          };
        }

        if (shouldFireViolation) {
          nextEngineState.lastRuleViolationTime = now;
          // Record evidence for duplicate detection
          if (pendingViolation?.evidence) {
            recentEvidenceRef.current.push({
              evidence: pendingViolation.evidence.trim().toLowerCase(),
              timestamp: now,
            });
          }
        }

        const result = await executeIntervention(
          {
            endpoint,
            body,
            intent,
            trigger: trigger as InterventionTrigger,
            role: shouldFireMetric ? decision!.role : 'moderator',
            metrics,
            triggeringState: decision?.triggeringState ?? undefined,
            stateConfidence: decision?.stateConfidence,
            nextEngineState,
            ruleViolation: shouldFireViolation ? pendingViolation : null,
          },
          {
            updateDecisionState: (state) => {
              updateDecisionState(state);
              decisionStateRef.current = typeof state === 'object' ? { ...decisionStateRef.current, ...state } : state;
              saveEngineState(decisionStateRef.current);
            },
            addIntervention,
            addModelRoutingLog,
            addError,
            speak: speakRef.current,
            broadcastIntervention,
          },
          {
            sessionId: sessionIdRef.current,
            voiceSettings: voiceSettingsRef.current,
            isTTSSupported: isTTSSupportedRef.current,
          },
        );

        if (result.interventionId) {
          lastInterventionIdRef.current = result.interventionId;
        } else {
          // Clear stale intervention ID on failure: prevents the next tick's recovery
          // check from accidentally marking the previous (unrelated) intervention
          // as "recovered" when it was never the one that just fired.
          lastInterventionIdRef.current = null;
        }

        // Clear pending violation after firing
        pendingRuleViolationRef.current = null;

      } finally {
        isProcessingRef.current = false;
      }
    };

    const interval = setInterval(runDecisionEngine, DECISION_TICK_MS);
    return () => clearInterval(interval);
  }, [isActive, isDecisionOwner, addIntervention, updateIntervention, addModelRoutingLog, addError, updateDecisionState,
    currentMetricsRef, metricsHistoryRef, transcriptSegmentsRef, interventionsRef, stateHistoryRef]);

  return null;
}
