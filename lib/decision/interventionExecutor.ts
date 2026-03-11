/**
 * Intervention Executor — HTTP call, fallback, TTS, and persistence.
 *
 * Extracted from useDecisionLoop to be framework-agnostic. All side effects
 * (state updates, UI notifications, Supabase persistence) are performed via
 * injected callbacks, making this module testable without React.
 *
 * Execution flow:
 *   1. POST to the moderator/ally API endpoint with an abort timeout.
 *   2. On success: build an Intervention record, optionally speak via TTS,
 *      persist to Supabase, and log model routing metadata.
 *   3. On failure: use a hardcoded client-side fallback text so the
 *      brainstorming session is never left without guidance.
 *
 * @module interventionExecutor
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
import { TIMEOUTS } from '@/lib/config/timeouts';

/** Parameters describing a single intervention to fire. */
export interface FireInterventionParams {
    /** API route to call (e.g. '/api/intervention/moderator'). */
    endpoint: string;
    /** JSON body for the API request. */
    body: Record<string, unknown>;
    /** Intervention intent (e.g. 'PARTICIPATION_REBALANCING'). */
    intent: string;
    /** Legacy trigger type for backward-compatible records. */
    trigger: InterventionTrigger;
    role: 'moderator' | 'ally';
    /** Metric snapshot at the moment the intervention was triggered. */
    metrics: MetricSnapshot | null;
    triggeringState?: string;
    stateConfidence?: number;
    /** Engine state to apply after the intervention fires. */
    nextEngineState: DecisionEngineState;
    ruleViolation?: RuleViolationResult | null;
}

/**
 * Callback interface injected by the caller (typically useDecisionLoop).
 * Keeps the executor framework-agnostic by delegating all side effects.
 */
export interface InterventionCallbacks {
    updateDecisionState: (updates: Partial<DecisionEngineState> | DecisionEngineState) => void;
    addIntervention: (intervention: Intervention) => void;
    addModelRoutingLog: (entry: ModelRoutingLogEntry) => void;
    addError: (message: string, context?: string) => void;
    /** Speak text via Web Speech API. Returns true if speech was initiated. */
    speak: (text: string) => boolean;
    /** Optional: broadcast the intervention to other participants via LiveKit data channel. */
    broadcastIntervention?: (intervention: Intervention) => void;
}

/** Ambient context needed for execution (session identity, voice config). */
export interface ExecutionContext {
    sessionId: string | null;
    voiceSettings: VoiceSettings;
    isTTSSupported: boolean;
}

/**
 * Client-side fallback texts, mirroring server-side fallbacks.
 * These ensure an intervention is always delivered even if the LLM API
 * is unreachable, times out, or returns a 503.
 */
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

/**
 * Select the appropriate fallback text for a given intent, role, and language.
 * Defaults to German for UZH experiments when no language is specified.
 *
 * @param intent - Intervention intent key.
 * @param role - Whether this is a moderator or ally intervention.
 * @param language - BCP-47 language tag (e.g. 'de-CH', 'en').
 * @returns A pre-written fallback intervention string.
 */
function getClientFallbackText(intent: string, role: 'moderator' | 'ally', language?: string): string {
    const isGerman = language?.startsWith('de') ?? true;
    if (role === 'ally') {
        const fb = CLIENT_FALLBACKS.ALLY_DEFAULT;
        return isGerman ? fb.de : fb.en;
    }
    const fb = CLIENT_FALLBACKS[intent] || CLIENT_FALLBACKS.PARTICIPATION_REBALANCING;
    return isGerman ? fb.de : fb.en;
}

const INTERVENTION_TIMEOUT_MS = TIMEOUTS.INTERVENTION_MS;

/**
 * Fire a single intervention (moderator or ally).
 *
 * Calls the LLM API with a timeout. On success, builds an Intervention record,
 * optionally speaks it via TTS, persists to Supabase, and logs model routing.
 * On any failure, a client-side fallback text is used instead so the
 * brainstorming session always receives guidance.
 *
 * @param params - Intervention parameters (endpoint, body, intent, etc.).
 * @param callbacks - Side-effect callbacks for state updates, persistence, TTS.
 * @param ctx - Execution context (session ID, voice settings).
 * @returns Object with success=true and the generated interventionId (always succeeds
 *          due to fallback logic; success=false is currently unreachable).
 */
export async function executeIntervention(
    params: FireInterventionParams,
    callbacks: InterventionCallbacks,
    ctx: ExecutionContext,
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
 * Persist the current decision engine state to Supabase (fire-and-forget).
 * No-ops if sessionId is null (e.g. during local-only testing).
 *
 * @param sessionId - Supabase session identifier.
 * @param state - Full engine state to persist.
 */
export function persistEngineState(sessionId: string | null, state: DecisionEngineState): void {
    if (!sessionId) return;
    apiFireAndForget('/api/engine-state', {
        method: 'PUT',
        body: JSON.stringify({ sessionId, state }),
    }, 2);
}

/**
 * Persist a recovery result for a specific intervention (fire-and-forget).
 * Called after the post-check phase evaluates whether the conversation recovered.
 *
 * @param sessionId - Supabase session identifier.
 * @param interventionId - ID of the intervention being updated.
 * @param recoveryResult - Recovery outcome ('recovered', 'not_recovered', 'partial').
 * @param recoveryCheckedAt - Epoch-ms timestamp when recovery was evaluated.
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
