import { useState, useCallback, useRef } from 'react';
import { useSupabaseChannel } from '@/lib/hooks/sync/useSupabaseChannel';
import { segmentRowToApp } from '@/lib/supabase/converters';
import { TranscriptSegment } from '@/lib/types';
import type { MutableRefObject } from 'react';

interface UseRealtimeSegmentsParams {
  sessionId: string | null;
  isActive: boolean;
  addTranscriptSegment: (segment: TranscriptSegment) => void;
  speakingTimeRef: MutableRefObject<Map<string, number>>;
  onError?: (message: string, context?: string) => void;
}

export function useRealtimeSegments({
  sessionId,
  isActive,
  addTranscriptSegment,
  speakingTimeRef,
  onError,
}: UseRealtimeSegmentsParams) {
  const [isSubscribed, setIsSubscribed] = useState(false);

  // Track segment IDs already processed (received via LiveKit DataChannel or local).
  // This avoids redundant dispatch calls when Supabase Realtime delivers segments
  // that were already added via the faster LiveKit DataChannel path.
  // The SessionContext reducer also deduplicates by ID, but skipping here
  // prevents unnecessary re-renders from dispatching no-op actions.
  const knownIdsRef = useRef<Set<string>>(new Set());

  const onPayload = useCallback((row: Record<string, unknown>) => {
    // Validate required fields before conversion
    if (!row || typeof row.id !== 'string' || typeof row.speaker !== 'string' || typeof row.text !== 'string') {
      console.warn('[RealtimeSegments] Invalid segment payload, skipping:', row);
      return;
    }

    // Skip if we already have this segment (received via LiveKit DataChannel)
    if (knownIdsRef.current.has(row.id as string)) {
      return;
    }
    knownIdsRef.current.add(row.id as string);

    // Cap the Set size to prevent unbounded growth (~5000 segments max)
    if (knownIdsRef.current.size > 5000) {
      const iterator = knownIdsRef.current.values();
      // Delete the oldest 1000 entries
      for (let i = 0; i < 1000; i++) {
        const next = iterator.next();
        if (next.done) break;
        knownIdsRef.current.delete(next.value);
      }
    }

    try {
      const segment = segmentRowToApp(row as Parameters<typeof segmentRowToApp>[0]);
      addTranscriptSegment(segment);
    } catch (e) {
      console.error('[RealtimeSegments] Failed to process realtime segment:', e);
    }
  }, [addTranscriptSegment]);

  const handleError = useCallback((message: string, context?: string) => {
    onError?.(message, context);
    setIsSubscribed(false);
  }, [onError]);

  const result = useSupabaseChannel<Record<string, unknown>>({
    channelName: 'segments',
    table: 'transcript_segments',
    sessionId,
    isActive,
    event: 'INSERT',
    onPayload,
    onError: handleError,
  });

  return { isSubscribed: result.isSubscribed || isSubscribed };
}
