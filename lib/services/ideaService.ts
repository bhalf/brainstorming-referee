import { apiPost, apiGet, apiPatch, apiFireAndForget } from './apiClient';
import type { Idea, IdeaConnection, TranscriptSegment } from '@/lib/types';
import type { ApiOptions } from './apiClient';

// --- Service Functions ---

/** Persist a new idea to the backend */
export function persistIdea(sessionId: string, idea: Idea): void {
    apiFireAndForget('/api/ideas', {
        method: 'POST',
        body: JSON.stringify({ sessionId, idea }),
    }, 2);
}

/** Update an idea (position, content, soft-delete) */
export function updateIdea(ideaId: string, updates: Partial<Idea>): void {
    apiFireAndForget('/api/ideas', {
        method: 'PATCH',
        body: JSON.stringify({ id: ideaId, updates }),
    }, 2);
}

/** Persist a new idea connection */
export function persistConnection(sessionId: string, connection: IdeaConnection): void {
    apiFireAndForget('/api/ideas/connections', {
        method: 'POST',
        body: JSON.stringify({ sessionId, connection }),
    }, 2);
}

/** Fetch all ideas for a session */
export async function fetchIdeas(
    sessionId: string,
    options?: ApiOptions,
): Promise<{ ideas: unknown[] }> {
    return apiGet('/api/ideas', { sessionId }, options);
}

/** Fetch all connections for a session */
export async function fetchConnections(
    sessionId: string,
    options?: ApiOptions,
): Promise<{ connections: unknown[] }> {
    return apiGet('/api/ideas/connections', { sessionId }, options);
}

/** Extract ideas from transcript segments via LLM */
export async function extractIdeas(
    sessionId: string,
    segments: TranscriptSegment[],
    existingIdeas: Idea[],
    language?: string,
    options?: ApiOptions,
): Promise<{ ideas: Idea[]; connections: IdeaConnection[] }> {
    return apiPost('/api/ideas/extract', {
        sessionId,
        segments,
        existingIdeas,
        language,
    }, options);
}
