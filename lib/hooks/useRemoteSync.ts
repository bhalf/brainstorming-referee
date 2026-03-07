import { useEffect, useCallback, useRef, MutableRefObject } from 'react';
import { TranscriptSegment } from '@/lib/types';
import { estimateSpeakingSeconds } from '@/lib/utils/format';

interface UseRemoteSyncParams {
  isActive: boolean;
  roomName: string;
  isParticipant: boolean;
  participantName: string;
  transcriptSegmentsRef: MutableRefObject<TranscriptSegment[]>;
  speakingTimeRef: MutableRefObject<Map<string, number>>;
  addTranscriptSegment: (segment: TranscriptSegment) => void;
  setTranscriptSegments: React.Dispatch<React.SetStateAction<TranscriptSegment[]>>;
}

export function useRemoteSync({
  isActive,
  roomName,
  isParticipant,
  participantName,
  transcriptSegmentsRef,
  speakingTimeRef,
  addTranscriptSegment,
  setTranscriptSegments,
}: UseRemoteSyncParams) {
  // Upload: replaces 'You' speaker label with real display name
  const uploadSegment = useCallback(async (segment: TranscriptSegment) => {
    try {
      if (!roomName) return;
      const displayName = isParticipant ? participantName : 'Researcher';
      const uploadSeg = segment.speaker === 'You'
        ? { ...segment, speaker: displayName }
        : segment;
      await fetch('/api/sync/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: roomName, segment: uploadSeg })
      });
    } catch (e) {
      console.error("Upload error:", e);
    }
  }, [roomName, isParticipant, participantName]);

  // Poll for remote transcript segments
  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(async () => {
      try {
        const maxTimestamp = transcriptSegmentsRef.current.reduce(
          (max, seg) => Math.max(max, seg.timestamp), 0
        );

        const res = await fetch(`/api/sync/room?room=${roomName}&since=${maxTimestamp}`);
        if (res.ok) {
          const data = await res.json();
          if (data.segments && data.segments.length > 0) {
            const newSegments = data.segments as TranscriptSegment[];
            const uniqueNew = newSegments.filter(ns =>
              !transcriptSegmentsRef.current.some(existing => existing.id === ns.id)
            );

            if (uniqueNew.length > 0) {
              setTranscriptSegments(prev => {
                const actualNew = uniqueNew.filter(ns => !prev.some(p => p.id === ns.id));
                if (actualNew.length === 0) return prev;
                return [...prev, ...actualNew].sort((a, b) => a.timestamp - b.timestamp);
              });

              uniqueNew.forEach(s => addTranscriptSegment(s));

              // Track speaking time for remote segments
              uniqueNew.forEach(seg => {
                if (seg.speaker !== 'You') {
                  const estimatedSeconds = estimateSpeakingSeconds(seg.text);
                  const current = speakingTimeRef.current.get(seg.speaker) || 0;
                  speakingTimeRef.current.set(seg.speaker, current + estimatedSeconds);
                }
              });
            }
          }
        }
      } catch (e) {
        console.error("Sync error:", e);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isActive, roomName, addTranscriptSegment, transcriptSegmentsRef, speakingTimeRef, setTranscriptSegments]);

  return { uploadSegment };
}
