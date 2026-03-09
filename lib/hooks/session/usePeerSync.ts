import { useState, useCallback, useEffect } from 'react';
import { TranscriptSegment, Intervention } from '@/lib/types';
import { SyncInterimPayload, SyncFinalSegmentPayload, SyncInterventionPayload } from '@/lib/hooks/useLiveKitSync';

interface UsePeerSyncParams {
    addTranscriptSegment: (segment: TranscriptSegment) => void;
    addIntervention: (intervention: Intervention) => void;
    voiceEnabled: boolean;
    isTTSSupported: boolean | null;
    speak: (text: string) => boolean;
}

export function usePeerSync({
    addTranscriptSegment,
    addIntervention,
    voiceEnabled,
    isTTSSupported,
    speak,
}: UsePeerSyncParams) {
    // Track peer interim transcripts with timestamps for stale cleanup
    const [peerInterims, setPeerInterims] = useState<Map<string, { text: string; speakerName: string; timestamp: number }>>(new Map());

    const handleInterimTranscriptReceived = useCallback((payload: SyncInterimPayload) => {
        setPeerInterims(prev => {
            const next = new Map(prev);
            if (!payload.text) {
                next.delete(payload.speakerName);
            } else {
                next.set(payload.speakerName, { text: payload.text, speakerName: payload.speakerName, timestamp: Date.now() });
            }
            return next;
        });
    }, []);

    const handleFinalSegmentReceived = useCallback((payload: SyncFinalSegmentPayload) => {
        addTranscriptSegment(payload.segment);
        // Clear their text from the fast interim overlay
        setPeerInterims(prev => {
            if (!prev.has(payload.segment.speaker)) return prev;
            const next = new Map(prev);
            next.delete(payload.segment.speaker);
            return next;
        });
    }, [addTranscriptSegment]);

    const handleInterventionReceived = useCallback((payload: SyncInterventionPayload) => {
        addIntervention(payload.intervention);
        if (voiceEnabled && isTTSSupported && speak) {
            speak(payload.intervention.text);
        }
    }, [addIntervention, voiceEnabled, isTTSSupported, speak]);

    // Stale peer interim cleanup (clear entries older than 8 seconds)
    useEffect(() => {
        const interval = setInterval(() => {
            setPeerInterims(prev => {
                const now = Date.now();
                let changed = false;
                const next = new Map(prev);
                for (const [key, entry] of next) {
                    if (now - entry.timestamp > 8000) {
                        next.delete(key);
                        changed = true;
                    }
                }
                return changed ? next : prev;
            });
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    return {
        peerInterims,
        handleInterimTranscriptReceived,
        handleFinalSegmentReceived,
        handleInterventionReceived,
    };
}
