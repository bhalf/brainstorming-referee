import { useEffect, useRef, MutableRefObject } from 'react';
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
import { evaluatePolicy, intentToTrigger, resetInterventionCountIfNeeded, generateInterventionContext } from '@/lib/decision/interventionPolicy';
import { apiFireAndForget } from '@/lib/services/apiClient';
import { persistIntervention as persistInterventionApi } from '@/lib/services/interventionService';
import { checkRuleViolations, RULE_CHECK_INTERVAL_MS, RULE_VIOLATION_COOLDOWN_MS, RuleViolationResult } from '@/lib/decision/ruleViolationChecker';

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
  // Stable refs to prevent interval recreation
  const decisionStateRef = useRef(decisionState);
  const configRef = useRef(config);
  const voiceSettingsRef = useRef(voiceSettings);
  const scenarioRef = useRef<Scenario>(scenario);
  const languageRef = useRef(language);
  const speakRef = useRef(speak);
  const isTTSSupportedRef = useRef(isTTSSupported);
  const sessionIdRef = useRef(sessionId);
  const isProcessingRef = useRef(false);
  const interventionCountResetTimeRef = useRef(Date.now());
  const lastInterventionIdRef = useRef<string | null>(null);
  const lastRuleCheckTimeRef = useRef(0);
  const isRuleCheckingRef = useRef(false);
  // Store pending rule violation for combining with metric interventions
  const pendingRuleViolationRef = useRef<RuleViolationResult | null>(null);

  // Keep refs in sync
  useEffect(() => { decisionStateRef.current = decisionState; }, [decisionState]);
  useEffect(() => { configRef.current = config; }, [config]);
  useEffect(() => { voiceSettingsRef.current = voiceSettings; }, [voiceSettings]);
  useEffect(() => { scenarioRef.current = scenario; }, [scenario]);
  useEffect(() => { languageRef.current = language; }, [language]);
  useEffect(() => { speakRef.current = speak; }, [speak]);
  useEffect(() => { isTTSSupportedRef.current = isTTSSupported; }, [isTTSSupported]);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);

  // Engine state persist with retry
  const persistEngineState = (newState: DecisionEngineState) => {
    const sid = sessionIdRef.current;
    if (!sid) return;
    apiFireAndForget('/api/engine-state', {
      method: 'PUT',
      body: JSON.stringify({ sessionId: sid, state: newState }),
    }, 2);
  };

  // --- Shared: Build transcript context for LLM ---
  const buildTranscriptContext = () => {
    const segments = transcriptSegmentsRef.current;
    const allFinalSegments = segments.filter(
      s => s.isFinal && !/^\[.*\]$/.test(s.text.trim())
    );
    return {
      transcriptExcerpt: allFinalSegments.slice(-200).map(s => `${s.speaker}: ${s.text}`),
      totalTurns: allFinalSegments.length,
      previousInterventions: interventionsRef.current.slice(-3).map(i => i.text),
    };
  };

  // --- Shared: Fire an intervention (moderator or ally) ---
  const fireIntervention = async (params: {
    endpoint: string;
    body: Record<string, unknown>;
    intent: string;
    trigger: InterventionTrigger;
    role: 'moderator' | 'ally';
    metrics: MetricSnapshot | null;
    triggeringState?: string;
    stateConfidence?: number;
    nextEngineState: DecisionEngineState;
    ruleViolation?: RuleViolationResult | null;
  }) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch(params.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params.body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();

        // Update engine state
        updateDecisionState(params.nextEngineState);
        decisionStateRef.current = params.nextEngineState;
        persistEngineState(params.nextEngineState);

        const interventionId = `int-${Date.now()}`;
        const intervention: Intervention = {
          id: interventionId,
          timestamp: Date.now(),
          type: params.role,
          trigger: params.trigger,
          text: data.text,
          spoken: false,
          metricsAtTrigger: params.metrics,
          intent: params.intent as Intervention['intent'],
          triggeringState: params.triggeringState as Intervention['triggeringState'],
          stateConfidence: params.stateConfidence,
          recoveryResult: 'pending',
          modelUsed: data.logEntry?.model,
          latencyMs: data.logEntry?.latencyMs,
        };

        if (voiceSettingsRef.current.enabled && isTTSSupportedRef.current) {
          intervention.spoken = speakRef.current(data.text);
        }

        addIntervention(intervention);
        lastInterventionIdRef.current = interventionId;

        if (broadcastIntervention) {
          broadcastIntervention(intervention);
        }

        // Persist to Supabase
        if (sessionIdRef.current) {
          persistInterventionApi(sessionIdRef.current, intervention, decisionStateRef.current);
        }

        if (data.logEntry) {
          addModelRoutingLog(data.logEntry);
          if (sessionIdRef.current) {
            apiFireAndForget('/api/model-routing-log', {
              method: 'POST',
              body: JSON.stringify({
                sessionId: sessionIdRef.current,
                entry: data.logEntry,
              }),
            }, 2);
          }
        }

        return true;
      } else {
        if (response.status === 503) {
          addError('LLM unavailable — check OPENAI_API_KEY configuration', 'intervention');
        } else {
          addError(`Intervention API error: ${response.status}`, 'intervention');
        }
        return false;
      }
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        addError('Intervention request timed out after 12s', 'intervention');
      } else {
        addError('Failed to generate intervention', 'intervention');
      }
      return false;
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

      // --- 1. Periodically reset the intervention count (every 10 minutes) ---
      const currentDecisionState = decisionStateRef.current;
      const resetResult = resetInterventionCountIfNeeded(
        currentDecisionState,
        interventionCountResetTimeRef.current,
        now
      );
      if (resetResult.newResetTime !== interventionCountResetTimeRef.current) {
        interventionCountResetTimeRef.current = resetResult.newResetTime;
        updateDecisionState({ interventionCount: 0 });
        decisionStateRef.current = { ...currentDecisionState, interventionCount: 0 };
      }

      // --- 2. Rule Violation Check (every 15s, detection only) ---
      if (cfg.RULE_CHECK_ENABLED && !isRuleCheckingRef.current) {
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

        // Apply safe state updates (timers, phase transitions)
        if (decision.stateUpdateOnly) {
          updateDecisionState(decision.stateUpdateOnly);
          decisionStateRef.current = { ...decisionStateRef.current, ...decision.stateUpdateOnly };
          persistEngineState(decisionStateRef.current);
        }

        // Handle recovery result from post-check
        if (decision.recoveryResult && lastInterventionIdRef.current) {
          updateIntervention(lastInterventionIdRef.current, {
            recoveryResult: decision.recoveryResult,
            recoveryCheckedAt: now,
          });

          if (!decision.shouldIntervene && decision.recoveryResult !== undefined) {
            updateDecisionState(decision.nextEngineState);
            decisionStateRef.current = decision.nextEngineState;
            persistEngineState(decision.nextEngineState);
            lastInterventionIdRef.current = null;
          }
        }
      }

      // --- 4. Combine & Act ---
      // In baseline: everything above runs (state inference, logging), but we never intervene
      if (currentScenario === 'baseline') {
        // Log violation detections without acting
        if (pendingRuleViolationRef.current) {
          console.log(`[DecisionLoop] Baseline: rule violation logged (${pendingRuleViolationRef.current.rule}), not intervening`);
          pendingRuleViolationRef.current = null;
        }
        return;
      }

      const metricIntervention = decision?.shouldIntervene && decision?.intent;

      // Check shared cooldown & budget
      const violationCooldownActive = (now - (decisionStateRef.current.lastRuleViolationTime ?? 0)) < RULE_VIOLATION_COOLDOWN_MS;
      const budgetAvailable = decisionStateRef.current.interventionCount < cfg.MAX_INTERVENTIONS_PER_10MIN;

      if (!budgetAvailable) {
        console.log('[DecisionLoop] Intervention budget exhausted — dropping pending violation');
        pendingRuleViolationRef.current = null;
        return;
      }

      const cooldownActive = decisionStateRef.current.cooldownUntil != null && now < decisionStateRef.current.cooldownUntil;

      // Determine what to fire
      const shouldFireViolation = pendingViolation && !violationCooldownActive;
      const shouldFireMetric = metricIntervention && !cooldownActive;

      if (pendingViolation && !shouldFireViolation) {
        console.log(`[DecisionLoop] Violation pending but blocked by violationCooldown`);
      }

      if (!shouldFireViolation && !shouldFireMetric) {
        // Nothing to do — keep pending violation for next cycle if cooldown is the reason
        if (pendingViolation && (violationCooldownActive || cooldownActive)) {
          // Keep it pending, will fire when cooldown expires
        } else {
          pendingRuleViolationRef.current = null;
        }
        return;
      }

      // --- Fire intervention ---
      isProcessingRef.current = true;

      try {
        const { transcriptExcerpt, totalTurns, previousInterventions } = buildTranscriptContext();
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

        // Compute next engine state
        const cooldownUntil = now + cfg.COOLDOWN_SECONDS * 1000;
        let nextEngineState: DecisionEngineState;

        if (shouldFireMetric) {
          // Metric intervention: use policy engine's next state
          nextEngineState = {
            ...decision!.nextEngineState,
            lastInterventionTime: now,
            interventionCount: decisionStateRef.current.interventionCount + 1,
          };
        } else {
          // Rule-only intervention: just apply cooldown, stay in current phase
          nextEngineState = {
            ...decisionStateRef.current,
            lastRuleViolationTime: now,
            lastInterventionTime: now,
            interventionCount: decisionStateRef.current.interventionCount + 1,
            cooldownUntil,
          };
        }

        if (shouldFireViolation) {
          nextEngineState.lastRuleViolationTime = now;
        }

        await fireIntervention({
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
        });

        // Clear pending violation after firing
        pendingRuleViolationRef.current = null;

      } finally {
        isProcessingRef.current = false;
      }
    };

    const interval = setInterval(runDecisionEngine, 1000);
    return () => clearInterval(interval);
  }, [isActive, isDecisionOwner, addIntervention, updateIntervention, addModelRoutingLog, addError, updateDecisionState,
    currentMetricsRef, metricsHistoryRef, transcriptSegmentsRef, interventionsRef, stateHistoryRef]);

  return null;
}
