import { useCallback, useEffect } from 'react';
import { useRoomContext, useLocalParticipant } from '@livekit/components-react';
import { DataPacket_Kind } from 'livekit-client';
import { TranscriptSegment, Intervention } from '@/lib/types';

// Topic identifiers for DataChannel
export const LK_TOPIC_TRANSCRIPT_INTERIM = 'transcript_interim';
export const LK_TOPIC_TRANSCRIPT_FINAL = 'transcript_final';
export const LK_TOPIC_INTERVENTION = 'intervention';
export interface SyncInterimPayload {
    speakerId: string;
    speakerName: string;
    text: string;
    language?: string;
}

export interface SyncFinalSegmentPayload {
    segment: TranscriptSegment;
}

export interface SyncInterventionPayload {
    intervention: Intervention;
}

interface UseLiveKitSyncParams {
    onInterimTranscriptReceived?: (payload: SyncInterimPayload) => void;
    onFinalSegmentReceived?: (payload: SyncFinalSegmentPayload) => void;
    onInterventionReceived?: (payload: SyncInterventionPayload) => void;
}

export function useLiveKitSync({
    onInterimTranscriptReceived,
    onFinalSegmentReceived,
    onInterventionReceived,
}: UseLiveKitSyncParams = {}) {
    const room = useRoomContext();
    const { localParticipant } = useLocalParticipant();

    // Listen for incoming DataChannel messages
    useEffect(() => {
        if (!room) return;

        const handleDataReceived = (
            payload: Uint8Array,
            participant?: unknown,
            kind?: DataPacket_Kind,
            topic?: string
        ) => {
            // Decode the payload
            const decoder = new TextDecoder();
            const strData = decoder.decode(payload);
            let parsed: unknown;
            try {
                parsed = JSON.parse(strData);
            } catch (e) {
                console.warn('[LiveKitSync] Failed to parse DataChannel payload', e);
                return;
            }

            switch (topic) {
                case LK_TOPIC_TRANSCRIPT_INTERIM:
                    if (onInterimTranscriptReceived) onInterimTranscriptReceived(parsed as SyncInterimPayload);
                    break;
                case LK_TOPIC_TRANSCRIPT_FINAL:
                    if (onFinalSegmentReceived) onFinalSegmentReceived(parsed as SyncFinalSegmentPayload);
                    break;
                case LK_TOPIC_INTERVENTION:
                    if (onInterventionReceived) onInterventionReceived(parsed as SyncInterventionPayload);
                    break;
            }
        };

        room.on('dataReceived', handleDataReceived);
        return () => {
            room.off('dataReceived', handleDataReceived);
        };
    }, [room, onInterimTranscriptReceived, onFinalSegmentReceived, onInterventionReceived]);

    // Broadcast functions
    const broadcastInterimTranscript = useCallback(
        async (text: string, language?: string) => {
            if (!localParticipant || text.trim() === '') return;
            const payload: SyncInterimPayload = {
                speakerId: localParticipant.identity,
                speakerName: localParticipant.name || localParticipant.identity,
                text,
                language,
            };
            const encoder = new TextEncoder();
            const data = encoder.encode(JSON.stringify(payload));
            try {
                await localParticipant.publishData(data, {
                    topic: LK_TOPIC_TRANSCRIPT_INTERIM,
                    reliable: false, // lossy is fine for high-frequency interim
                });
            } catch (e) {
                console.warn('[LiveKitSync] Failed to broadcast interim transcript', e);
            }
        },
        [localParticipant]
    );

    const broadcastFinalTranscript = useCallback(
        async (segment: TranscriptSegment) => {
            if (!localParticipant) return;
            const payload: SyncFinalSegmentPayload = { segment };
            const encoder = new TextEncoder();
            const data = encoder.encode(JSON.stringify(payload));
            try {
                await localParticipant.publishData(data, {
                    topic: LK_TOPIC_TRANSCRIPT_FINAL,
                    reliable: true, // we want this to arrive
                });
            } catch (e) {
                console.warn('[LiveKitSync] Failed to broadcast final transcript', e);
            }
        },
        [localParticipant]
    );

    const broadcastIntervention = useCallback(
        async (intervention: Intervention) => {
            if (!localParticipant) return;
            const payload: SyncInterventionPayload = { intervention };
            const encoder = new TextEncoder();
            const data = encoder.encode(JSON.stringify(payload));
            try {
                await localParticipant.publishData(data, {
                    topic: LK_TOPIC_INTERVENTION,
                    reliable: true, // critical
                });
            } catch (e) {
                console.warn('[LiveKitSync] Failed to broadcast intervention', e);
            }
        },
        [localParticipant]
    );

    return {
        broadcastInterimTranscript,
        broadcastFinalTranscript,
        broadcastIntervention,
    };
}
