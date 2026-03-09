/**
 * Intervention executor — extracted from useDecisionLoop.
 * Handles the actual HTTP call, intervention creation, persistence,
 * TTS, and model routing log persistence.
 *
 * This is framework-agnostic: it takes callbacks instead of mutating
 * React state directly, making it testable and reusable.
 */
import {
    InterventionTrigger,
    Intervention,
    MetricSnapshot,
    DecisionEngineState,
    VoiceSettings,
    ModelRoutingLogEntry,
} from '@/lib/types';
import { apiPost, apiFireAndForget } from '@/lib/services/apiClient';
import { generateId } from '@/lib/utils/generateId';
import { persistIntervention as persistInterventionApi } from '@/lib/services/interventionService';
import { RuleViolationResult } from '@/lib/decision/ruleViolationChecker';

// --- Types ---

export interface FireInterventionParams {
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
}

export interface InterventionCallbacks {
    updateDecisionState: (updates: Partial<DecisionEngineState> | DecisionEngineState) => void;
    addIntervention: (intervention: Intervention) => void;
    addModelRoutingLog: (entry: ModelRoutingLogEntry) => void;
    addError: (message: string, context?: string) => void;
    speak: (text: string) => boolean;
    broadcastIntervention?: (intervention: Intervention) => void;
}

export interface InterventionContext {
    sessionId: string | null;
    voiceSettings: VoiceSettings;
    isTTSSupported: boolean;
}

const INTERVENTION_TIMEOUT_MS = 12_000;

/**
 * Fire a single intervention (moderator or ally).
 * Returns true if the intervention was successfully created.
 */
export async function executeIntervention(
    params: FireInterventionParams,
    callbacks: InterventionCallbacks,
    ctx: InterventionContext,
): Promise<{ success: boolean; interventionId: string | null }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), INTERVENTION_TIMEOUT_MS);

    try {
        const data = await apiPost<any>(params.endpoint, params.body, { signal: controller.signal });
        clearTimeout(timeoutId);

        // Update engine state
        callbacks.updateDecisionState(params.nextEngineState);

        const interventionId = generateId('int');
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

        // TTS
        if (ctx.voiceSettings.enabled && ctx.isTTSSupported) {
            intervention.spoken = callbacks.speak(data.text);
        }

        callbacks.addIntervention(intervention);

        if (callbacks.broadcastIntervention) {
            callbacks.broadcastIntervention(intervention);
        }

        // Persist to Supabase
        if (ctx.sessionId) {
            persistInterventionApi(
                ctx.sessionId,
                intervention,
                params.nextEngineState,
                params.ruleViolation ? {
                    rule: params.ruleViolation.rule,
                    evidence: params.ruleViolation.evidence,
                    severity: params.ruleViolation.severity,
                } : null,
            );
        }

        // Model routing log
        if (data.logEntry) {
            callbacks.addModelRoutingLog(data.logEntry);
            if (ctx.sessionId) {
                apiFireAndForget('/api/model-routing-log', {
                    method: 'POST',
                    body: JSON.stringify({
                        sessionId: ctx.sessionId,
                        entry: data.logEntry,
                    }),
                }, 2);
            }
        }

        return { success: true, interventionId };
    } catch (error: any) {
        clearTimeout(timeoutId);

        if (error.status === 503) {
            callbacks.addError('LLM unavailable — check OPENAI_API_KEY configuration', 'intervention');
        } else if (error.name === 'AbortError') {
            callbacks.addError('Intervention timed out', 'intervention');
        } else {
            callbacks.addError(`Intervention API error: ${error.status || error.message}`, 'intervention');
        }

        console.error('Intervention execution failed:', error);
        return { success: false, interventionId: null };
    }
}

/**
 * Persist engine state to the backend (fire-and-forget).
 */
export function persistEngineState(sessionId: string | null, state: DecisionEngineState): void {
    if (!sessionId) return;
    apiFireAndForget('/api/engine-state', {
        method: 'PUT',
        body: JSON.stringify({ sessionId, state }),
    }, 2);
}

/**
 * Persist a recovery result for an intervention.
 */
export function persistRecoveryResult(
    sessionId: string | null,
    interventionId: string,
    recoveryResult: string,
    recoveryCheckedAt: number,
): void {
    if (!sessionId) return;
    apiFireAndForget('/api/interventions', {
        method: 'PATCH',
        body: JSON.stringify({
            id: interventionId,
            recovery_result: recoveryResult,
            recovery_checked_at: recoveryCheckedAt,
        }),
    }, 2);
}
