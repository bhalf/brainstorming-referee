/**
 * Transcript segment persistence service.
 *
 * Handles uploading new transcript segments (fire-and-forget with retries)
 * and fetching existing segments for initial session data load.
 * @module
 */

import { apiPost, apiGet, apiFireAndForget } from './apiClient';
import type { TranscriptSegment } from '@/lib/types';
import type { ApiOptions } from './apiClient';

// --- Service Functions ---

/**
 * Upload a transcript segment to the backend (fire-and-forget, 3 retries).
 * @param sessionId - The active session's UUID.
 * @param segment - The transcribed segment including speaker, text, and timestamp.
 */
export function uploadSegment(sessionId: string, segment: TranscriptSegment): void {
    apiFireAndForget('/api/segments', {
        method: 'POST',
        body: JSON.stringify({ sessionId, segment }),
    }, 3);
}

/**
 * Fetch all transcript segments for a session.
 * Used during initial data load to hydrate the client-side state.
 * @param sessionId - The session to fetch segments for.
 * @param since - Unix timestamp (ms); only segments after this time are returned.
 * @param options - Optional abort signal and retry config.
 * @returns An object containing an array of raw segment rows.
 */
export async function fetchSegments(
    sessionId: string,
    since = 0,
    options?: ApiOptions,
): Promise<{ segments: unknown[] }> {
    return apiGet('/api/segments', { sessionId, since: String(since) }, options);
}
