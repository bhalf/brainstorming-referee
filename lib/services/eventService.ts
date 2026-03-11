/**
 * Session event broadcasting service.
 *
 * Logs lifecycle events (e.g. session start/end, participant join/leave)
 * to the backend in a fire-and-forget manner. These events build a timeline
 * used for post-session analysis and debugging.
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
