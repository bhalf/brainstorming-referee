import { useState, useCallback, useEffect, useRef, MutableRefObject } from 'react';
import { TranscriptSegment } from '@/lib/types';
import { generateId } from '@/lib/utils/generateId';
import { useOpenAIRealtimeStream } from '@/lib/transcription/useOpenAIRealtimeStream';
import { useSpeechRecognition } from '@/lib/transcription/useSpeechRecognition';

interface UseTranscriptionManagerParams {
  language: string;
  isSessionActive: boolean;
  /** When true, keeps the WebSocket alive but pauses audio sending (mic mute) */
  isMuted?: boolean;
  displayName: string;
  /** Updated by LiveKit when local participant is speaking — used to filter echo */
  lastLocalSpeakingTimeRef?: MutableRefObject<number | null>;
  addTranscriptSegment: (segment: TranscriptSegment) => void;
  addError: (message: string, context?: string) => void;
  uploadSegment: (segment: TranscriptSegment) => void;
  broadcastInterimTranscript?: (text: string, language?: string) => void;
  broadcastFinalTranscript?: (segment: TranscriptSegment) => void;
}

export function useTranscriptionManager({
  language,
  isSessionActive,
  isMuted = false,
  displayName,
  addTranscriptSegment,
  addError,
  uploadSegment,
  broadcastInterimTranscript,
  broadcastFinalTranscript,
}: UseTranscriptionManagerParams) {
  const [isRealtimeEnabled, setIsRealtimeEnabled] = useState(true);

  // Local interim state for OpenAI Realtime
  const [realtimeInterimTranscript, setRealtimeInterimTranscript] = useState<string>('');

  // Stable broadcast ref — kept in sync so callbacks always use the latest function
  const broadcastInterimRef = useRef(broadcastInterimTranscript);
  useEffect(() => { broadcastInterimRef.current = broadcastInterimTranscript; }, [broadcastInterimTranscript]);

  // Add segment helper (updates local state + context)
  const addSegment = useCallback((segment: TranscriptSegment) => {
    addTranscriptSegment(segment);
    uploadSegment(segment);
    if (broadcastFinalTranscript) {
      broadcastFinalTranscript(segment);
    }
  }, [addTranscriptSegment, uploadSegment, broadcastFinalTranscript]);

  // --- Web Speech API ---
  // When Realtime is enabled: used ONLY for live interim display (yellow box).
  //   Final segments come exclusively from OpenAI Realtime — no duplication.
  // When Realtime is disabled: used as full fallback, producing final segments.
  const isRealtimeEnabledRef = useRef(isRealtimeEnabled);
  useEffect(() => { isRealtimeEnabledRef.current = isRealtimeEnabled; }, [isRealtimeEnabled]);

  const {
    isSupported: isWebSpeechSupported,
    interimTranscript: speechInterimTranscript,
    start: startSpeechRecognition,
    stop: stopSpeechRecognition,
  } = useSpeechRecognition({
    language,
    continuous: true,
    interimResults: true,
    onResult: useCallback((result: { isFinal: boolean; text: string }) => {
      if (result.isFinal && result.text && !isRealtimeEnabledRef.current) {
        // Only produce segments when Realtime is OFF (fallback mode)
        const segment: TranscriptSegment = {
          id: generateId('ws'),
          speaker: displayName,
          text: result.text.trim(),
          timestamp: Date.now(),
          isFinal: true,
          language,
        };
        addSegment(segment);
      }
      // When Realtime is ON: ignore Web Speech finals entirely.
      // OpenAI Realtime provides the authoritative final transcript.
    }, [displayName, language, addSegment]),
  });

  // Start/stop speech recognition in sync with session & mute state.
  // IMPORTANT: When OpenAI Realtime is active, do NOT start Web Speech.
  // Both APIs request the microphone independently, causing audio contention
  // and glitches that break multi-participant transcription.
  useEffect(() => {
    if (isSessionActive && !isMuted && !isRealtimeEnabled) {
      startSpeechRecognition();
    } else {
      stopSpeechRecognition();
    }
  }, [isSessionActive, isMuted, isRealtimeEnabled, startSpeechRecognition, stopSpeechRecognition]);

  // Compute the interim transcript to display in the yellow box:
  // - When Realtime is active: use OpenAI interim only (Web Speech is disabled)
  // - When Realtime is off: use Web Speech interim (fallback mode)
  const displayInterim = isRealtimeEnabled
    ? realtimeInterimTranscript
    : speechInterimTranscript;

  // Broadcast interim to peers — throttled to prevent DataChannel flooding.
  // OpenAI Realtime sends character-by-character deltas; without throttling,
  // every delta triggers an unreliable DataChannel message that can saturate
  // the buffer and block reliable final-segment messages behind it.
  const lastBroadcastTimeRef = useRef(0);
  const pendingBroadcastRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const THROTTLE_MS = 150;
    const now = Date.now();
    const elapsed = now - lastBroadcastTimeRef.current;

    if (pendingBroadcastRef.current) {
      clearTimeout(pendingBroadcastRef.current);
      pendingBroadcastRef.current = null;
    }

    if (elapsed >= THROTTLE_MS) {
      // Enough time passed — broadcast immediately
      lastBroadcastTimeRef.current = now;
      broadcastInterimRef.current?.(displayInterim, language);
    } else {
      // Too soon — schedule a deferred broadcast
      pendingBroadcastRef.current = setTimeout(() => {
        lastBroadcastTimeRef.current = Date.now();
        broadcastInterimRef.current?.(displayInterim, language);
        pendingBroadcastRef.current = null;
      }, THROTTLE_MS - elapsed);
    }

    return () => {
      if (pendingBroadcastRef.current) {
        clearTimeout(pendingBroadcastRef.current);
      }
    };
  }, [displayInterim, language]);

  // --- OpenAI Realtime streaming (Primary) ---
  const realtime = useOpenAIRealtimeStream({
    language,
    speaker: displayName,
    isActive: isSessionActive && isRealtimeEnabled,
    isMuted,
    onInterimTranscript: useCallback((text: string) => {
      // Just update local state — the throttled displayInterim effect
      // handles broadcasting to peers
      setRealtimeInterimTranscript(text);
    }, []),
    onFinalSegment: useCallback((segment: TranscriptSegment) => {
      // Clear interim FIRST so the yellow preview box disappears in the same
      // render batch that the final white segment appears.
      // The throttled displayInterim effect will broadcast the empty string.
      setRealtimeInterimTranscript('');
      addSegment(segment);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [addSegment]),
  });

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
      id: generateId('sim'),
      speaker: 'Simulated',
      text,
      timestamp: Date.now(),
      isFinal: true,
      language,
    };
    addSegment(segment);
  }, [language, addSegment]);

  return {
    interimTranscript: displayInterim,
    isTranscribing: realtime.isConnected,
    isTranscriptionSupported: realtime.isSupported,
    toggleTranscription: () => { /* Realtime-only: no manual toggle needed */ },
    transcriptionError: realtime.error,

    // Realtime controls
    isRealtimeEnabled,
    setIsRealtimeEnabled,
    handleAddSimulatedSegment,

    // Health status
    realtimeConnected: realtime.isConnected,
    realtimeRecording: realtime.isRecording,
  };
}
