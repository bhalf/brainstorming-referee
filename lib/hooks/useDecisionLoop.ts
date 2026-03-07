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
import { evaluatePolicy, intentToTrigger } from '@/lib/decision/interventionPolicy';
import { resetInterventionCountIfNeeded, generateInterventionContext } from '@/lib/decision/decisionEngine';

interface UseDecisionLoopParams {
  isActive: boolean;
  isParticipant: boolean;
  sessionId: string | null;
  // Stable refs to avoid interval recreation on every state change
  transcriptSegmentsRef: MutableRefObject<TranscriptSegment[]>;
  interventionsRef: MutableRefObject<Intervention[]>;
  metricsHistoryRef: MutableRefObject<MetricSnapshot[]>;
  currentMetricsRef: MutableRefObject<MetricSnapshot | null>;
  stateHistoryRef: MutableRefObject<ConversationStateInference[]>;
  // Session context refs
  decisionState: DecisionEngineState;
  config: ExperimentConfig;
  voiceSettings: VoiceSettings;
  scenario: Scenario;
  language: string;
  speak: (text: string) => boolean;
  isTTSSupported: boolean;
  // Actions
  addIntervention: (intervention: Intervention) => void;
  updateIntervention: (id: string, updates: Partial<Intervention>) => void;
  addModelRoutingLog: (entry: ModelRoutingLogEntry) => void;
  addError: (message: string, context?: string) => void;
  updateDecisionState: (updates: Partial<DecisionEngineState>) => void;
}

export function useDecisionLoop({
  isActive,
  isParticipant,
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

  // Keep refs in sync
  useEffect(() => { decisionStateRef.current = decisionState; }, [decisionState]);
  useEffect(() => { configRef.current = config; }, [config]);
  useEffect(() => { voiceSettingsRef.current = voiceSettings; }, [voiceSettings]);
  useEffect(() => { scenarioRef.current = scenario; }, [scenario]);
  useEffect(() => { languageRef.current = language; }, [language]);
  useEffect(() => { speakRef.current = speak; }, [speak]);
  useEffect(() => { isTTSSupportedRef.current = isTTSSupported; }, [isTTSSupported]);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);

  // Fire-and-forget engine state persist
  const persistEngineState = (newState: DecisionEngineState) => {
    const sid = sessionIdRef.current;
    if (!sid) return;
    fetch('/api/engine-state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sid, state: newState }),
    }).catch(() => {});
  };

  // Decision engine interval
  useEffect(() => {
    if (!isActive || isParticipant) return;

    const runDecisionEngine = async () => {
      const metrics = currentMetricsRef.current;
      const currentScenario = scenarioRef.current;

      if (!metrics || currentScenario === 'baseline') return;
      if (isProcessingRef.current) return;

      const now = Date.now();
      const currentDecisionState = decisionStateRef.current;
      const cfg = configRef.current;
      const lang = languageRef.current;

      // Periodically reset the intervention count (every 10 minutes)
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

      // Get the inferred state from the current metrics
      const inferredState = metrics.inferredState ?? null;

      const decision = evaluatePolicy(
        inferredState,
        metrics,
        metricsHistoryRef.current,
        decisionStateRef.current,
        cfg,
        currentScenario,
        now
      );

      // Safe state updates (e.g. confirmation timer, phase transitions)
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

        // If we're returning to monitoring (not escalating), apply the full state transition
        if (!decision.shouldIntervene && decision.recoveryResult !== undefined) {
          updateDecisionState(decision.nextEngineState);
          decisionStateRef.current = decision.nextEngineState;
          persistEngineState(decision.nextEngineState);
          lastInterventionIdRef.current = null;
        }
      }

      // Trigger intervention if the engine says so
      if (decision.shouldIntervene && decision.intent) {
        isProcessingRef.current = true;

        try {
          const trigger = intentToTrigger(decision.intent);
          const context = generateInterventionContext(trigger, metrics);

          const segments = transcriptSegmentsRef.current;
          const allFinalSegments = segments.filter(
            s => s.isFinal && !/^\[.*\]$/.test(s.text.trim())
          );
          const transcriptExcerpt = allFinalSegments
            .slice(-200)
            .map(s => `${s.speaker}: ${s.text}`);
          const totalTurns = allFinalSegments.length;

          const prevInterventions = interventionsRef.current
            .slice(-3)
            .map(i => i.text);

          const endpoint = decision.role === 'moderator'
            ? '/api/intervention/moderator'
            : '/api/intervention/ally';

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 12000);

          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              // v1 fields (backward compat)
              trigger,
              speakerDistribution: context.speakerDistribution,
              language: lang,
              participationImbalance: metrics.participationImbalance,
              repetitionRate: metrics.semanticRepetitionRate,
              stagnationDuration: metrics.stagnationDuration,
              transcriptExcerpt,
              totalTurns,
              scenario: currentScenario,
              currentState: decisionStateRef.current.currentState,
              previousInterventions: prevInterventions,
              // v2 fields
              intent: decision.intent,
              triggeringState: decision.triggeringState,
              stateConfidence: decision.stateConfidence,
              participationMetrics: metrics.participation,
              semanticDynamics: metrics.semanticDynamics,
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            const data = await response.json();

            const newDecisionState = decision.nextEngineState;
            updateDecisionState(newDecisionState);
            decisionStateRef.current = newDecisionState;
            persistEngineState(newDecisionState);

            const interventionId = `int-${Date.now()}`;
            const intervention: Intervention = {
              id: interventionId,
              timestamp: Date.now(),
              type: decision.role,
              trigger: trigger as InterventionTrigger,
              text: data.text,
              spoken: false,
              metricsAtTrigger: metrics,
              // v2 fields
              intent: decision.intent,
              triggeringState: decision.triggeringState ?? undefined,
              stateConfidence: decision.stateConfidence,
              recoveryResult: 'pending',
              modelUsed: data.logEntry?.model,
              latencyMs: data.logEntry?.latencyMs,
            };

            if (voiceSettingsRef.current.enabled && isTTSSupportedRef.current) {
              intervention.spoken = speakRef.current(data.text);
            }

            addIntervention(intervention);
            lastInterventionIdRef.current = interventionId;

            // Persist intervention to Supabase
            if (sessionIdRef.current) {
              fetch('/api/interventions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  sessionId: sessionIdRef.current,
                  intervention,
                  engineState: decisionStateRef.current,
                }),
              }).catch(() => {});
            }

            if (data.logEntry) {
              addModelRoutingLog(data.logEntry);

              // Persist routing log to Supabase
              if (sessionIdRef.current) {
                fetch('/api/model-routing-log', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    sessionId: sessionIdRef.current,
                    entry: data.logEntry,
                  }),
                }).catch(() => {});
              }
            }
          } else {
            if (response.status === 503) {
              addError('LLM unavailable — check OPENAI_API_KEY configuration', 'intervention');
            } else {
              addError(`Intervention API error: ${response.status}`, 'intervention');
            }
          }
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            addError('Intervention request timed out after 12s', 'intervention');
          } else {
            addError('Failed to generate intervention', 'intervention');
          }
        } finally {
          isProcessingRef.current = false;
        }
      }
    };

    const interval = setInterval(runDecisionEngine, 2000);
    return () => clearInterval(interval);
  }, [isActive, isParticipant, addIntervention, updateIntervention, addModelRoutingLog, addError, updateDecisionState,
      currentMetricsRef, metricsHistoryRef, transcriptSegmentsRef, interventionsRef, stateHistoryRef]);

  return null;
}
