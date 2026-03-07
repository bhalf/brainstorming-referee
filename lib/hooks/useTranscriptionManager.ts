import { useState, useCallback, useEffect, useRef, MutableRefObject } from 'react';
import { TranscriptSegment, ModelRoutingLogEntry } from '@/lib/types';
import { estimateSpeakingSeconds } from '@/lib/utils/format';
import { useSpeechRecognition } from '@/lib/transcription/useSpeechRecognition';
import { useAudioRecorder, AudioChunk } from '@/lib/transcription/useAudioRecorder';
import { processTranscriptionChunk } from '@/lib/transcription/processTranscriptionChunk';

/** Max ms since last local speaking event to accept a Speech Recognition result */
const ECHO_GATE_MS = 3000;

interface UseTranscriptionManagerParams {
  language: string;
  isSessionActive: boolean;
  speakingTimeRef: MutableRefObject<Map<string, number>>;
  /** Updated by LiveKit when local participant is speaking — used to filter echo */
  lastLocalSpeakingTimeRef?: MutableRefObject<number | null>;
  addTranscriptSegment: (segment: TranscriptSegment) => void;
  addModelRoutingLog: (entry: ModelRoutingLogEntry) => void;
  addError: (message: string, context?: string) => void;
  uploadSegment: (segment: TranscriptSegment) => void;
}

export function useTranscriptionManager({
  language,
  isSessionActive,
  speakingTimeRef,
  lastLocalSpeakingTimeRef,
  addTranscriptSegment,
  addModelRoutingLog,
  addError,
  uploadSegment,
}: UseTranscriptionManagerParams) {
  const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegment[]>([]);
  const [isWhisperEnabled, setIsWhisperEnabled] = useState(true);
  const transcriptSegmentsRef = useRef<TranscriptSegment[]>([]);

  // Keep ref in sync with state
  useEffect(() => {
    transcriptSegmentsRef.current = transcriptSegments;
  }, [transcriptSegments]);

  // Add segment helper (updates local state + context)
  const addSegment = useCallback((segment: TranscriptSegment) => {
    setTranscriptSegments(prev => [...prev, segment]);
    addTranscriptSegment(segment);
  }, [addTranscriptSegment]);

  // Speech recognition
  const {
    isSupported: isTranscriptionSupported,
    isListening: isTranscribing,
    interimTranscript,
    toggle: toggleTranscription,
    error: transcriptionError,
  } = useSpeechRecognition({
    language,
    continuous: true,
    interimResults: true,
    onResult: useCallback((result: { id: string; text: string; timestamp: number; isFinal: boolean }) => {
      // Echo gate: if LiveKit is connected and local user hasn't spoken recently,
      // this is likely echo from remote audio played through speakers — drop it
      if (lastLocalSpeakingTimeRef?.current !== null && lastLocalSpeakingTimeRef?.current !== undefined) {
        if (Date.now() - lastLocalSpeakingTimeRef.current > ECHO_GATE_MS) {
          return;
        }
      }

      const segment: TranscriptSegment = {
        id: result.id,
        speaker: 'You',
        text: result.text,
        timestamp: result.timestamp,
        isFinal: result.isFinal,
        language,
      };

      // Track local user speaking time via text-length proxy
      if (result.isFinal && result.text.trim().length > 0) {
        const estimatedSeconds = estimateSpeakingSeconds(result.text);
        const current = speakingTimeRef.current.get('You') || 0;
        speakingTimeRef.current.set('You', current + estimatedSeconds);
      }

      setTranscriptSegments(prev => [...prev, segment]);
      addTranscriptSegment(segment);

      if (result.isFinal) {
        uploadSegment(segment);
      }
    }, [language, addTranscriptSegment, uploadSegment, speakingTimeRef, lastLocalSpeakingTimeRef]),
    onError: useCallback((error: string) => {
      addError(error, 'speech-recognition');
    }, [addError]),
  });

  // Whisper audio chunk handler
  const handleAudioChunk = useCallback(async (chunk: AudioChunk) => {
    try {
      const result = await processTranscriptionChunk({
        blob: chunk.blob,
        timestamp: chunk.timestamp,
        language,
        speaker: 'You',
        idPrefix: 'whisper',
        addModelRoutingLog,
      });

      if (result.error) {
        console.warn('Whisper transcription failed:', result.error);
        return;
      }

      for (const segment of result.segments) {
        addSegment(segment);
      }
    } catch (error) {
      console.error('Whisper chunk processing error:', error);
    }
  }, [language, addModelRoutingLog, addSegment]);

  // Audio recorder for Whisper
  const {
    isRecording: isWhisperRecording,
    isSupported: isWhisperSupported,
    start: startWhisperRecording,
    stop: stopWhisperRecording,
    error: whisperError,
  } = useAudioRecorder({
    onAudioChunk: handleAudioChunk,
    chunkIntervalMs: 5000,
  });

  useEffect(() => {
    if (whisperError) console.error("Whisper recording error:", whisperError);
  }, [whisperError]);

  // Auto-start transcription when session is active
  useEffect(() => {
    if (!isSessionActive) {
      // Stop everything when session ends
      if (isWhisperRecording) stopWhisperRecording();
      return;
    }

    if (isWhisperEnabled && isWhisperSupported && !isWhisperRecording) {
      // Whisper path: stop speech recognition if running, start Whisper
      if (isTranscribing) toggleTranscription();
      startWhisperRecording();
    } else if (!isWhisperEnabled && isTranscriptionSupported && !isTranscribing) {
      // Speech Recognition path: auto-start when no Whisper
      toggleTranscription();
    }
  }, [isSessionActive, isWhisperEnabled, isWhisperSupported, isWhisperRecording,
      startWhisperRecording, stopWhisperRecording, isTranscribing, isTranscriptionSupported, toggleTranscription]);

  // Simulation fallback
  const handleAddSimulatedSegment = useCallback((text: string) => {
    const segment: TranscriptSegment = {
      id: `sim-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      speaker: 'Simulated',
      text,
      timestamp: Date.now(),
      isFinal: true,
      language,
    };
    addSegment(segment);
  }, [language, addSegment]);

  return {
    transcriptSegments,
    transcriptSegmentsRef,
    setTranscriptSegments,
    interimTranscript,
    isTranscribing,
    isTranscriptionSupported: isTranscriptionSupported && !isWhisperEnabled,
    toggleTranscription,
    transcriptionError,
    isWhisperEnabled,
    setIsWhisperEnabled,
    handleAddSimulatedSegment,
  };
}
