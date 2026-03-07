import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { segmentRowToApp } from '@/lib/supabase/converters';
import { TranscriptSegment } from '@/lib/types';
import { estimateSpeakingSeconds } from '@/lib/utils/format';
import type { MutableRefObject } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseRealtimeSegmentsParams {
  sessionId: string | null;
  isActive: boolean;
  addTranscriptSegment: (segment: TranscriptSegment) => void;
  speakingTimeRef: MutableRefObject<Map<string, number>>;
}

export function useRealtimeSegments({
  sessionId,
  isActive,
  addTranscriptSegment,
  speakingTimeRef,
}: UseRealtimeSegmentsParams) {
  const addTranscriptSegmentRef = useRef(addTranscriptSegment);
  useEffect(() => { addTranscriptSegmentRef.current = addTranscriptSegment; }, [addTranscriptSegment]);

  useEffect(() => {
    if (!sessionId || !isActive) return;

    const channel: RealtimeChannel = supabase
      .channel(`segments-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transcript_segments',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          const segment = segmentRowToApp(row as Parameters<typeof segmentRowToApp>[0]);

          // Add to context (dedup handled by reducer)
          addTranscriptSegmentRef.current(segment);

          // Track speaking time for remote participants
          if (segment.isFinal && segment.speaker !== 'You' && segment.text.trim().length > 0) {
            const estimatedSeconds = estimateSpeakingSeconds(segment.text);
            const current = speakingTimeRef.current.get(segment.speaker) || 0;
            speakingTimeRef.current.set(segment.speaker, current + estimatedSeconds);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, isActive, speakingTimeRef]);
}
