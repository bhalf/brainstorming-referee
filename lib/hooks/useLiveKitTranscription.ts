import { useEffect, useRef, useCallback } from 'react';
import { RemoteParticipant, Track } from 'livekit-client';
import { TranscriptSegment, ModelRoutingLogEntry } from '@/lib/types';
import { processTranscriptionChunk } from '@/lib/transcription/processTranscriptionChunk';

interface UseLiveKitTranscriptionParams {
  remoteParticipants: RemoteParticipant[];
  language: string;
  isActive: boolean;
  onSegment: (segment: TranscriptSegment) => void;
  uploadSegment: (segment: TranscriptSegment) => void;
  addModelRoutingLog: (entry: ModelRoutingLogEntry) => void;
  chunkIntervalMs?: number;
}

interface ParticipantRecorder {
  recorder: MediaRecorder;
  stream: MediaStream;
  identity: string;
  name: string;
  chunkStartTime: number;
  wasSpeakingDuringChunk: boolean;
}

const SUPPORTED_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4',
];

function getSupportedMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const mimeType of SUPPORTED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(mimeType)) return mimeType;
  }
  return null;
}

function stopAndCleanup(rec: ParticipantRecorder) {
  if (rec.recorder.state !== 'inactive') {
    try { rec.recorder.stop(); } catch { /* already stopped */ }
  }
  rec.stream.getTracks().forEach(t => t.stop());
}

export function useLiveKitTranscription({
  remoteParticipants,
  language,
  isActive,
  onSegment,
  uploadSegment,
  addModelRoutingLog,
  chunkIntervalMs = 5000,
}: UseLiveKitTranscriptionParams) {
  const recordersRef = useRef<Map<string, ParticipantRecorder>>(new Map());
  const isProcessingRef = useRef<Set<string>>(new Set());
  const onSegmentRef = useRef(onSegment);
  const uploadSegmentRef = useRef(uploadSegment);
  const addModelRoutingLogRef = useRef(addModelRoutingLog);
  const languageRef = useRef(language);

  // Keep refs in sync
  useEffect(() => { onSegmentRef.current = onSegment; }, [onSegment]);
  useEffect(() => { uploadSegmentRef.current = uploadSegment; }, [uploadSegment]);
  useEffect(() => { addModelRoutingLogRef.current = addModelRoutingLog; }, [addModelRoutingLog]);
  useEffect(() => { languageRef.current = language; }, [language]);

  // Process an audio chunk from a specific participant
  const processChunk = useCallback(async (
    blob: Blob,
    timestamp: number,
    identity: string,
    name: string,
  ) => {
    if (blob.size < 100) return;

    // Skip if already processing for this participant (prevent queue buildup)
    if (isProcessingRef.current.has(identity)) return;
    isProcessingRef.current.add(identity);

    try {
      const result = await processTranscriptionChunk({
        blob,
        timestamp,
        language: languageRef.current,
        speaker: name,
        idPrefix: `lk-${identity.slice(0, 8)}`,
        addModelRoutingLog: addModelRoutingLogRef.current,
      });

      if (!result.error) {
        for (const segment of result.segments) {
          onSegmentRef.current(segment);
          uploadSegmentRef.current(segment);
        }
      }
    } catch (error) {
      console.error(`Transcription error for ${name}:`, error);
    } finally {
      isProcessingRef.current.delete(identity);
    }
  }, []);

  // Track speaking state per participant (to skip silent chunks)
  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      remoteParticipants.forEach(p => {
        const recorder = recordersRef.current.get(p.identity);
        if (recorder && p.isSpeaking) {
          recorder.wasSpeakingDuringChunk = true;
        }
      });
    }, 250);

    return () => clearInterval(interval);
  }, [isActive, remoteParticipants]);

  // Single unified effect: manage recorders for all remote participants
  // Handles: join, leave, mic toggle on/off — all in one place to prevent duplicates
  useEffect(() => {
    if (!isActive) {
      // Stop all recorders when inactive
      recordersRef.current.forEach(rec => stopAndCleanup(rec));
      recordersRef.current.clear();
      return;
    }

    const mimeType = getSupportedMimeType();
    if (!mimeType) {
      console.warn('No supported audio MIME type for MediaRecorder');
      return;
    }

    const currentIdentities = new Set(remoteParticipants.map(p => p.identity));

    // 1. Remove recorders for participants who left
    recordersRef.current.forEach((rec, identity) => {
      if (!currentIdentities.has(identity)) {
        stopAndCleanup(rec);
        recordersRef.current.delete(identity);
      }
    });

    // 2. For each current participant: create, keep, or recreate recorder as needed
    remoteParticipants.forEach(participant => {
      const audioPublication = participant.getTrackPublication(Track.Source.Microphone);
      const audioTrack = audioPublication?.track;
      const isMuted = audioPublication?.isMuted ?? false;
      const existing = recordersRef.current.get(participant.identity);

      // Track disappeared or muted — remove recorder
      if ((!audioTrack?.mediaStreamTrack || isMuted) && existing) {
        stopAndCleanup(existing);
        recordersRef.current.delete(participant.identity);
        return;
      }

      // No track, muted, or already recording — skip
      if (!audioTrack?.mediaStreamTrack || isMuted || existing) return;

      // Track available but no recorder — create one
      try {
        const mediaStream = new MediaStream([audioTrack.mediaStreamTrack]);
        const recorder = new MediaRecorder(mediaStream, { mimeType });
        const name = participant.name || participant.identity;

        const participantRecorder: ParticipantRecorder = {
          recorder,
          stream: mediaStream,
          identity: participant.identity,
          name,
          chunkStartTime: Date.now(),
          wasSpeakingDuringChunk: false,
        };

        recorder.ondataavailable = (event) => {
          const chunkTimestamp = participantRecorder.chunkStartTime;
          // Reset for next chunk
          participantRecorder.chunkStartTime = Date.now();

          if (event.data.size > 0 && participantRecorder.wasSpeakingDuringChunk) {
            processChunk(event.data, chunkTimestamp, participantRecorder.identity, participantRecorder.name);
          }
          participantRecorder.wasSpeakingDuringChunk = false;
        };

        recorder.onerror = () => {
          console.error(`MediaRecorder error for ${name}`);
          stopAndCleanup(participantRecorder);
          recordersRef.current.delete(participant.identity);
        };

        recorder.start(chunkIntervalMs);
        recordersRef.current.set(participant.identity, participantRecorder);
      } catch (error) {
        console.error(`Failed to create recorder for ${participant.name}:`, error);
      }
    });
  }, [isActive, remoteParticipants, chunkIntervalMs, processChunk]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recordersRef.current.forEach(rec => stopAndCleanup(rec));
      recordersRef.current.clear();
    };
  }, []);
}
