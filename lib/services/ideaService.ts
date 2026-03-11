/**
 * Idea persistence service.
 *
 * Provides fire-and-forget helpers for creating, updating, and connecting
 * ideas via the backend API. All calls are non-blocking with a single retry.
 * @module
 */

import { apiFireAndForget } from './apiClient';
import type { Idea, IdeaConnection } from '@/lib/types';

// --- Service Functions ---

/**
 * Persist a new idea to the backend (fire-and-forget).
 * @param sessionId - The active session's UUID.
 * @param idea - The full Idea object to store.
 */
export function persistIdea(sessionId: string, idea: Idea): void {
    apiFireAndForget('/api/ideas', {
        method: 'POST',
        body: JSON.stringify({ sessionId, idea }),
    }, 1);
}

/**
 * Update an existing idea (position, content, soft-delete, etc.).
 * @param ideaId - The UUID of the idea to update.
 * @param updates - Partial fields to merge into the existing idea.
 */
export function updateIdea(ideaId: string, updates: Partial<Idea>): void {
    apiFireAndForget('/api/ideas', {
        method: 'PATCH',
        body: JSON.stringify({ id: ideaId, updates }),
    }, 1);
}

/**
 * Persist a new idea connection (edge on the idea board).
 * @param sessionId - The active session's UUID.
 * @param connection - The IdeaConnection describing source, target, and type.
 */
export function persistConnection(sessionId: string, connection: IdeaConnection): void {
    apiFireAndForget('/api/ideas/connections', {
        method: 'POST',
        body: JSON.stringify({ sessionId, connection }),
    }, 1);
}
