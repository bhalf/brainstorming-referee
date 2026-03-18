'use client';

import { useState, useCallback, useRef } from 'react';
import { useSupabaseChannel } from '@/lib/hooks/sync/useSupabaseChannel';
import type { TranscriptSegment } from '@/types';

const MAX_SEGMENTS = 15_000;
const DEDUP_SET_SIZE = 5_000;

/**
 * Subscribes to new transcript segments via Supabase Realtime.
 * Returns an accumulated array of segments (read-only).
 */
export function useRealtimeSegments(sessionId: string | null) {
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const seenIdsRef = useRef<Set<string>>(new Set());

  const onPayload = useCallback((row: TranscriptSegment) => {
    if (seenIdsRef.current.has(row.id)) return;
    seenIdsRef.current.add(row.id);

    // Prevent unbounded Set growth
    if (seenIdsRef.current.size > DEDUP_SET_SIZE) {
      const entries = Array.from(seenIdsRef.current);
      seenIdsRef.current = new Set(entries.slice(-DEDUP_SET_SIZE / 2));
    }

    setSegments((prev) => {
      if (prev.length >= MAX_SEGMENTS) {
        return [...prev.slice(-MAX_SEGMENTS + 1), row];
      }
      return [...prev, row];
    });
  }, []);

  const { isSubscribed } = useSupabaseChannel<TranscriptSegment>({
    channelName: 'rt-segments',
    table: 'transcript_segments',
    sessionId,
    isActive: !!sessionId,
    event: 'INSERT',
    onPayload,
  });

  return { segments, isSubscribed };
}
