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

// --- Client-side fallback texts ---
// Mirrors the server-side fallbacks so interventions always succeed.
const CLIENT_FALLBACKS: Record<string, { en: string; de: string }> = {
    PARTICIPATION_REBALANCING: {
        en: "It feels like we could benefit from hearing more perspectives. Who else has thoughts to share?",
        de: 'Es wäre bereichernd, noch mehr Perspektiven zu hören. Wer möchte noch etwas beitragen?',
    },
    PERSPECTIVE_BROADENING: {
        en: "We've built strong ideas around a few themes. What completely different direction could we explore?",
        de: 'Wir haben starke Ideen zu einigen Themen entwickelt. Welche völlig andere Richtung könnten wir erkunden?',
    },
    REACTIVATION: {
        en: "Let's pause and think about what territory we haven't explored yet. What dimensions are still open?",
        de: 'Lasst uns kurz überlegen, welche Bereiche wir noch nicht erkundet haben. Welche Dimensionen sind noch offen?',
    },
    NORM_REINFORCEMENT: {
        en: "Quick reminder — in brainstorming, all ideas are welcome! Let's save evaluation for later and keep building on each other's thoughts.",
        de: 'Kurze Erinnerung: Beim Brainstorming sind alle Ideen willkommen! Bewertungen heben wir uns für später auf — lasst uns weiter aufeinander aufbauen.',
    },
    ALLY_DEFAULT: {
        en: "What if we tried looking at this from a completely unexpected angle?",
        de: 'Was wäre, wenn wir das Ganze aus einem völlig unerwarteten Blickwinkel betrachten?',
    },
};

function getClientFallbackText(intent: string, role: 'moderator' | 'ally', language?: string): string {
    const isGerman = language?.startsWith('de') ?? true; // Default to German for UZH experiments
    if (role === 'ally') {
        const fb = CLIENT_FALLBACKS.ALLY_DEFAULT;
        return isGerman ? fb.de : fb.en;
    }
    const fb = CLIENT_FALLBACKS[intent] || CLIENT_FALLBACKS.PARTICIPATION_REBALANCING;
    return isGerman ? fb.de : fb.en;
}

const INTERVENTION_TIMEOUT_MS = 20_000;

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
        const data = await apiPost<any>(params.endpoint, params.body, {
            signal: controller.signal,
            // Don't retry at this level — callLLM already handles retries via its
            // model fallback chain. Double-retry compounds latency and can exceed
            // the abort timeout, causing spurious AbortErrors.
            maxRetries: 0,
        });
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

        const errorDesc = error.name === 'AbortError'
            ? 'timeout'
            : error.status === 503 ? 'LLM unavailable' : (error.message || 'unknown');
        console.warn(`[InterventionExecutor] API failed (${errorDesc}) — using client-side fallback`);

        // --- CLIENT-SIDE FALLBACK ---
        // Interventions are critical for the experiment — they must ALWAYS be delivered.
        // If the API call failed (timeout, network error, LLM down), we use a hardcoded
        // fallback text so the brainstorming session is never left without guidance.
        const fallbackText = getClientFallbackText(params.intent, params.role, params.body?.language as string);

        callbacks.updateDecisionState(params.nextEngineState);

        const interventionId = generateId('int');
        const intervention: Intervention = {
            id: interventionId,
            timestamp: Date.now(),
            type: params.role,
            trigger: params.trigger,
            text: fallbackText,
            spoken: false,
            metricsAtTrigger: params.metrics,
            intent: params.intent as Intervention['intent'],
            triggeringState: params.triggeringState as Intervention['triggeringState'],
            stateConfidence: params.stateConfidence,
            recoveryResult: 'pending',
            modelUsed: 'fallback',
            latencyMs: 0,
        };

        // TTS
        if (ctx.voiceSettings.enabled && ctx.isTTSSupported) {
            intervention.spoken = callbacks.speak(fallbackText);
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

        return { success: true, interventionId };
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
