import { apiFireAndForget } from './apiClient';

/**
 * Fire-and-forget helper to log a session event.
 * Used to build a timeline of session lifecycle changes.
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
    }, 1); // Single retry — events are best-effort
}
