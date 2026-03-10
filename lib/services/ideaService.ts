import { apiFireAndForget } from './apiClient';
import type { Idea, IdeaConnection } from '@/lib/types';

// --- Service Functions ---

/** Persist a new idea to the backend */
export function persistIdea(sessionId: string, idea: Idea): void {
    apiFireAndForget('/api/ideas', {
        method: 'POST',
        body: JSON.stringify({ sessionId, idea }),
    }, 1);
}

/** Update an idea (position, content, soft-delete) */
export function updateIdea(ideaId: string, updates: Partial<Idea>): void {
    apiFireAndForget('/api/ideas', {
        method: 'PATCH',
        body: JSON.stringify({ id: ideaId, updates }),
    }, 1);
}

/** Persist a new idea connection */
export function persistConnection(sessionId: string, connection: IdeaConnection): void {
    apiFireAndForget('/api/ideas/connections', {
        method: 'POST',
        body: JSON.stringify({ sessionId, connection }),
    }, 1);
}
