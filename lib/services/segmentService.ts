import { apiPost, apiGet, apiFireAndForget } from './apiClient';
import type { TranscriptSegment } from '@/lib/types';
import type { ApiOptions } from './apiClient';

// --- Service Functions ---

/** Upload a segment to the backend (fire-and-forget with retry) */
export function uploadSegment(sessionId: string, segment: TranscriptSegment): void {
    apiFireAndForget('/api/segments', {
        method: 'POST',
        body: JSON.stringify({ sessionId, segment }),
    }, 3);
}

/** Fetch all segments for a session (used for initial data load) */
export async function fetchSegments(
    sessionId: string,
    since = 0,
    options?: ApiOptions,
): Promise<{ segments: unknown[] }> {
    return apiGet('/api/segments', { sessionId, since: String(since) }, options);
}
