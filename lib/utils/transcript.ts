import type { TranscriptSegment } from '../types';

/**
 * Check if a transcript segment is a system activity marker like [speaking].
 * These markers have identical text across segments and should be excluded
 * from content-based analysis (metrics, stagnation, repetition, embeddings).
 */
export function isActivityMarker(seg: TranscriptSegment): boolean {
    return /^\[.*\]$/.test(seg.text.trim());
}

/**
 * Returns final segments that contain real speech content.
 * Excludes interim segments and activity markers.
 */
export function getFinalContentSegments(segments: TranscriptSegment[]): TranscriptSegment[] {
    return segments.filter(s => s.isFinal && !isActivityMarker(s));
}

/**
 * Returns final segments with minimum text length.
 * Useful for embedding analysis where very short segments aren't meaningful.
 */
export function getFinalSubstantiveSegments(
    segments: TranscriptSegment[],
    minLength: number = 4,
): TranscriptSegment[] {
    return segments.filter(
        s => s.isFinal && s.text.trim().length > minLength && !isActivityMarker(s),
    );
}
