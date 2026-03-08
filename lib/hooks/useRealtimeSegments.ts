import { useState, useCallback } from 'react';
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

  const onPayload = useCallback((row: Record<string, unknown>) => {
    // Validate required fields before conversion
    if (!row || typeof row.id !== 'string' || typeof row.speaker !== 'string' || typeof row.text !== 'string') {
      console.warn('[RealtimeSegments] Invalid segment payload, skipping:', row);
      return;
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
