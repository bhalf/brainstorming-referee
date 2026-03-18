/**
 * Session event broadcasting service.
 *
 * Logs lifecycle events (e.g. session start/end, participant join/leave)
 * to the backend in a fire-and-forget manner. These events build a timeline
 * used for post-session analysis and debugging.
 *
 * All scientific logging flows through typed wrapper functions below,
 * ensuring consistent payloads in the `session_events` table.
 * @module
 */

import { apiFireAndForget } from './apiClient';

/**
 * Log a session lifecycle event (fire-and-forget, single retry).
 * No-ops silently when sessionId is null (session not yet created).
 * @param sessionId - The active session's UUID, or null if unavailable.
 * @param eventType - Event name (e.g. 'session_start', 'participant_join').
 * @param actor - Optional identifier of who triggered the event.
 * @param payload - Optional structured metadata for the event.
 */
export function logSessionEvent(
    sessionId: string | null,
    eventType: string,
    actor?: string,
    payload?: Record<string, unknown>,
): void {
    if (!sessionId) return;

    apiFireAndForget('/api/session/events', {
        method: 'POST',
        body: JSON.stringify({
            sessionId,
            eventType,
            actor: actor ?? null,
            payload: payload ?? null,
            timestamp: Date.now(),
        }),
    }, 1); // Single retry -- events are best-effort
}

// ─── Typed Scientific Event Helpers ──────────────────────────────────────────
// Each function calls logSessionEvent() with a structured payload.
// Event types are prefixed to group related events in queries.

/**
 * Log a conversation state transition (e.g. HEALTHY_EXPLORATION → DOMINANCE_RISK).
 * Fired whenever the inferred conversation state changes.
 */
export function logStateTransition(
    sessionId: string | null,
    fromState: string,
    toState: string,
    confidence: number,
    triggeringMetrics?: {
        participationRisk?: number;
        novelty?: number;
        stagnation?: number;
        spread?: number;
    },
): void {
    logSessionEvent(sessionId, 'state_transition', 'system', {
        fromState,
        toState,
        confidence,
        ...(triggeringMetrics && { triggeringMetrics }),
    });
}

/**
 * Log an intervention lifecycle phase for latency analysis.
 * Called at: detected → generated → delivered.
 */
export function logInterventionLifecycle(
    sessionId: string | null,
    data: {
        interventionId: string;
        phase: 'detected' | 'generated' | 'delivered';
        intent: string;
        trigger: string;
        model?: string;
        generationMs?: number;
        deliveryMode?: string;
        wasFallback?: boolean;
        ttsInitiated?: boolean;
    },
): void {
    logSessionEvent(sessionId, 'intervention_lifecycle', 'system', data as Record<string, unknown>);
}

/**
 * Log a TTS playback event for analyzing voice delivery.
 * Tracks playback start, completion, errors, and cancellations.
 */
export function logTTSEvent(
    sessionId: string | null,
    data: {
        interventionId?: string;
        event: 'started' | 'completed' | 'error' | 'cancelled';
        durationMs?: number;
        voice?: string;
        method?: string;
        error?: string;
        textLength?: number;
    },
): void {
    logSessionEvent(sessionId, 'tts_event', 'system', data as Record<string, unknown>);
}

/**
 * Log a decision engine phase transition (e.g. MONITORING → CONFIRMING).
 * Tracks the full decision pipeline flow.
 */
export function logEnginePhaseChange(
    sessionId: string | null,
    fromPhase: string,
    toPhase: string,
    intent?: string,
    trigger?: string,
): void {
    logSessionEvent(sessionId, 'engine_phase_change', 'system', {
        fromPhase,
        toPhase,
        ...(intent && { intent }),
        ...(trigger && { trigger }),
    });
}

/**
 * Log user interaction with a visual intervention (toast display/dismiss).
 * Captures display duration and dismiss method for engagement analysis.
 */
export function logInterventionInteraction(
    sessionId: string | null,
    data: {
        interventionId: string;
        action: 'displayed' | 'dismissed_click' | 'dismissed_timeout';
        displayDurationMs?: number;
        displayMode: string;
    },
): void {
    logSessionEvent(sessionId, 'intervention_interaction', 'system', data as Record<string, unknown>);
}

/**
 * Log a session lifecycle event (start/end, participant join/leave).
 * Builds the participant timeline for session reconstruction.
 */
export function logSessionLifecycle(
    sessionId: string | null,
    event: 'session_start' | 'session_end' | 'participant_join' | 'participant_leave',
    actor?: string,
    payload?: Record<string, unknown>,
): void {
    logSessionEvent(sessionId, 'session_lifecycle', actor, { event, ...payload });
}

/**
 * Log a rule violation detection or suppression.
 * Builds the rule enforcement timeline.
 */
export function logRuleViolationEvent(
    sessionId: string | null,
    data: {
        event: 'detected' | 'suppressed';
        rule?: string;
        severity?: string;
        evidence?: string;
        suppressionReason?: 'cooldown' | 'duplicate_evidence' | 'no_activity' | 'baseline';
    },
): void {
    logSessionEvent(sessionId, 'rule_violation', 'system', data as Record<string, unknown>);
}

/**
 * Log when an intervention is suppressed by constraints.
 * Shows when the system wanted to intervene but couldn't.
 */
export function logInterventionSuppressed(
    sessionId: string | null,
    data: {
        reason: 'budget_exhausted' | 'cooldown_active' | 'baseline';
        recentCount?: number;
        maxAllowed?: number;
        cooldownRemainingSec?: number;
        intent?: string;
    },
): void {
    logSessionEvent(sessionId, 'intervention_suppressed', 'system', data as Record<string, unknown>);
}

/**
 * Log the result of a post-intervention recovery evaluation.
 * Tracks intervention effectiveness over time.
 */
export function logRecoveryEvaluation(
    sessionId: string | null,
    data: {
        interventionId: string;
        result: string;
        phaseDurationMs?: number;
    },
): void {
    logSessionEvent(sessionId, 'recovery_evaluation', 'system', data as Record<string, unknown>);
}
