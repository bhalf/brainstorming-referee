import { useState, useCallback, useEffect, useRef, MutableRefObject } from 'react';
import { TranscriptSegment, ModelRoutingLogEntry } from '@/lib/types';
import { useSpeechRecognition } from '@/lib/transcription/useSpeechRecognition';
import { useOpenAIRealtimeStream } from '@/lib/transcription/useOpenAIRealtimeStream';

/** Max ms since last local speaking event to accept a Speech Recognition result */
const ECHO_GATE_MS = 3000;

interface UseTranscriptionManagerParams {
  language: string;
  isSessionActive: boolean;
  displayName: string;
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
  displayName,
  lastLocalSpeakingTimeRef,
  addTranscriptSegment,
  addModelRoutingLog,
  addError,
  uploadSegment,
}: UseTranscriptionManagerParams) {
  const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegment[]>([]);
  const [isRealtimeEnabled, setIsRealtimeEnabled] = useState(true);
  const transcriptSegmentsRef = useRef<TranscriptSegment[]>([]);

  // Local interim state for OpenAI Realtime
  const [realtimeInterimTranscript, setRealtimeInterimTranscript] = useState<string>('');

  // Keep ref in sync with state
  useEffect(() => {
    transcriptSegmentsRef.current = transcriptSegments;
  }, [transcriptSegments]);

  // Add segment helper (updates local state + context)
  const addSegment = useCallback((segment: TranscriptSegment) => {
    setTranscriptSegments(prev => [...prev, segment]);
    addTranscriptSegment(segment);
    uploadSegment(segment);
  }, [addTranscriptSegment, uploadSegment]);

  // 1. OpenAI Realtime streaming (Primary)
  const realtime = useOpenAIRealtimeStream({
    language,
    speaker: displayName,
    isActive: isSessionActive && isRealtimeEnabled,
    onInterimTranscript: (text) => {
      setRealtimeInterimTranscript(text);
    },
    onFinalSegment: (segment) => {
      addSegment(segment);
    }
  });

  // 2. Speech recognition (Fallback)
  const {
    isSupported: isTranscriptionSupported,
    isListening: isSpeechTranscribing,
    interimTranscript: speechInterimTranscript,
    toggle: toggleSpeechTranscription,
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

      if (result.isFinal) {
        const segment: TranscriptSegment = {
          id: result.id,
          speaker: displayName,
          text: result.text,
          timestamp: result.timestamp,
          isFinal: result.isFinal,
          language,
        };
        addSegment(segment);
      }
    }, [language, displayName, addSegment, lastLocalSpeakingTimeRef]),
    onError: useCallback((error: string) => {
      if (!isRealtimeEnabled) {
        addError(error, 'speech-recognition');
      }
    }, [addError, isRealtimeEnabled]),
  });

  // Auto-start fallback transcription when realtime is disabled
  useEffect(() => {
    if (!isSessionActive) {
      if (isSpeechTranscribing) toggleSpeechTranscription();
      return;
    }

    if (!isRealtimeEnabled && isTranscriptionSupported && !isSpeechTranscribing) {
      toggleSpeechTranscription();
    } else if (isRealtimeEnabled && isSpeechTranscribing) {
      // Turn off fallback if realtime is enabled
      toggleSpeechTranscription();
    }
  }, [isSessionActive, isRealtimeEnabled, isTranscriptionSupported, isSpeechTranscribing, toggleSpeechTranscription]);

  // Bubble up Realtime errors
  useEffect(() => {
    if (realtime.error) {
      console.error('OpenAI Realtime stream error:', realtime.error);
      addError(realtime.error, 'openai-realtime');
    }
  }, [realtime.error, addError]);

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
    interimTranscript: isRealtimeEnabled ? realtimeInterimTranscript : speechInterimTranscript,
    isTranscribing: isRealtimeEnabled ? realtime.isConnected : isSpeechTranscribing,
    isTranscriptionSupported: isRealtimeEnabled ? realtime.isSupported : (isTranscriptionSupported && !isRealtimeEnabled),
    toggleTranscription: toggleSpeechTranscription, // Note: mostly for fallback manual control
    transcriptionError: isRealtimeEnabled ? realtime.error : transcriptionError,

    // Legacy compat mappings
    isWhisperEnabled: false,
    setIsWhisperEnabled: () => { },

    // Realtime controls
    isRealtimeEnabled,
    setIsRealtimeEnabled,
    handleAddSimulatedSegment,
  };
}
