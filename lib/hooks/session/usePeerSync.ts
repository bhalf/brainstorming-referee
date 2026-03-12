import { useState, useCallback, useEffect, MutableRefObject } from 'react';
import { TranscriptSegment, Intervention, InterventionDisplayMode } from '@/lib/types';
import { SyncInterimPayload, SyncFinalSegmentPayload, SyncInterventionPayload } from '@/lib/hooks/useLiveKitSync';

interface UsePeerSyncParams {
    addTranscriptSegment: (segment: TranscriptSegment) => void;
    addIntervention: (intervention: Intervention) => void;
    voiceEnabled: boolean;
    displayMode: InterventionDisplayMode;
    isTTSSupported: boolean | null;
    speak: (text: string) => boolean;
    /** Shared dedup set to prevent double-TTS from DataChannel + Supabase Realtime */
    spokenInterventionIdsRef?: MutableRefObject<Set<string>>;
}

export function usePeerSync({
    addTranscriptSegment,
    addIntervention,
    voiceEnabled,
    displayMode,
    isTTSSupported,
    speak,
    spokenInterventionIdsRef,
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
        const shouldSpeak = voiceEnabled && isTTSSupported
            && (displayMode === 'voice' || displayMode === 'both');
        if (shouldSpeak) {
            // Record this intervention as spoken so useRealtimeInterventions skips TTS
            spokenInterventionIdsRef?.current.add(payload.intervention.id);
            speak(payload.intervention.text);
        }
    }, [addIntervention, voiceEnabled, displayMode, isTTSSupported, speak, spokenInterventionIdsRef]);

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
