'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

export type CloudTTSVoice = 'alloy' | 'ash' | 'coral' | 'echo' | 'fable' | 'nova' | 'onyx' | 'sage' | 'shimmer';

export interface TTSPlaybackEvent {
  type: 'started' | 'completed' | 'error' | 'cancelled';
  durationMs?: number;
  method?: 'mse' | 'blob';
  error?: string;
  textLength?: number;
}

export interface UseCloudTTSOptions {
  voice?: CloudTTSVoice;
  speed?: number;
  volume?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
  onTTSEvent?: (event: TTSPlaybackEvent) => void;
}

export interface UseCloudTTSReturn {
  speak: (text: string) => boolean;
  cancel: () => void;
  isSpeaking: boolean;
  isSupported: boolean;
  voice: CloudTTSVoice;
  setVoice: (v: CloudTTSVoice) => void;
}

// --- MSE Support Detection ---

function isMSESupported(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof MediaSource === 'undefined') return false;
  return MediaSource.isTypeSupported('audio/mpeg');
}

// --- Streaming playback via MediaSource Extensions ---

async function playWithMSE(
  response: Response,
  volume: number,
  abortSignal: AbortSignal,
  onStart: (() => void) | undefined,
  onTTSEvent: ((event: TTSPlaybackEvent) => void) | undefined,
  textLength: number,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (abortSignal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }

    const mediaSource = new MediaSource();
    const audio = new Audio();
    audio.volume = volume;
    audio.src = URL.createObjectURL(mediaSource);
    let playbackStartTime = 0;

    let settled = false;
    const settle = (fn: typeof resolve | typeof reject, val?: unknown) => {
      if (settled) return;
      settled = true;
      abortSignal.removeEventListener('abort', onAbort);
      if (val !== undefined) (fn as (v: unknown) => void)(val);
      else (fn as () => void)();
    };

    const cleanup = () => {
      try { URL.revokeObjectURL(audio.src); } catch { /* noop */ }
    };

    const onAbort = () => {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      cleanup();
      onTTSEvent?.({ type: 'cancelled', method: 'mse', textLength });
      settle(reject, new DOMException('Aborted', 'AbortError'));
    };
    abortSignal.addEventListener('abort', onAbort, { once: true });

    audio.onended = () => {
      cleanup();
      onTTSEvent?.({ type: 'completed', method: 'mse', durationMs: Date.now() - playbackStartTime, textLength });
      settle(resolve);
    };

    audio.onerror = () => {
      cleanup();
      onTTSEvent?.({ type: 'error', method: 'mse', error: 'Audio playback failed', textLength });
      settle(reject, new Error('Audio playback failed'));
    };

    mediaSource.addEventListener('sourceopen', async () => {
      let sourceBuffer: SourceBuffer;
      try {
        sourceBuffer = mediaSource.addSourceBuffer('audio/mpeg');
      } catch (e) {
        cleanup();
        settle(reject, e instanceof Error ? e : new Error('Failed to create SourceBuffer'));
        return;
      }

      const reader = response.body!.getReader();
      const pendingChunks: Uint8Array[] = [];
      let streamDone = false;
      let startFired = false;

      const tryEndOfStream = () => {
        if (streamDone && pendingChunks.length === 0 && !sourceBuffer.updating && mediaSource.readyState === 'open') {
          try { mediaSource.endOfStream(); } catch { /* already ended */ }
        }
      };

      const appendNextChunk = () => {
        if (sourceBuffer.updating || pendingChunks.length === 0) return;
        const chunk = pendingChunks.shift()!;
        try {
          sourceBuffer.appendBuffer(new Uint8Array(chunk) as unknown as ArrayBuffer);
        } catch (e) {
          settle(reject, e instanceof Error ? e : new Error('SourceBuffer append failed'));
        }
      };

      sourceBuffer.addEventListener('updateend', () => {
        if (pendingChunks.length > 0) {
          appendNextChunk();
        } else {
          tryEndOfStream();
        }
      });

      // Start playback once browser has enough data
      audio.addEventListener('canplay', () => {
        if (!startFired) {
          startFired = true;
          playbackStartTime = Date.now();
          onStart?.();
          onTTSEvent?.({ type: 'started', method: 'mse', textLength });
          audio.play().catch((e) => settle(reject, e));
        }
      }, { once: true });

      // Read the stream and feed chunks to SourceBuffer
      try {
        while (true) {
          if (abortSignal.aborted) return;
          const { done, value } = await reader.read();
          if (done) {
            streamDone = true;
            tryEndOfStream();
            break;
          }
          pendingChunks.push(value);
          appendNextChunk();
        }
      } catch (err) {
        if (abortSignal.aborted) return;
        settle(reject, err instanceof Error ? err : new Error('Stream read failed'));
      }
    }, { once: true });
  });
}

// --- Blob fallback playback (Safari, or no MSE) ---

async function playWithBlob(
  response: Response,
  volume: number,
  abortSignal: AbortSignal,
  onStart: (() => void) | undefined,
  onTTSEvent: ((event: TTSPlaybackEvent) => void) | undefined,
  textLength: number,
): Promise<void> {
  const blob = await response.blob();
  if (abortSignal.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }
  const url = URL.createObjectURL(blob);

  return new Promise<void>((resolve, reject) => {
    const audio = new Audio(url);
    audio.volume = volume;
    let playbackStartTime = 0;

    const onAbort = () => {
      audio.pause();
      URL.revokeObjectURL(url);
      onTTSEvent?.({ type: 'cancelled', method: 'blob', textLength });
      reject(new DOMException('Aborted', 'AbortError'));
    };
    abortSignal.addEventListener('abort', onAbort, { once: true });

    audio.onplay = () => {
      playbackStartTime = Date.now();
      onStart?.();
      onTTSEvent?.({ type: 'started', method: 'blob', textLength });
    };

    audio.onended = () => {
      abortSignal.removeEventListener('abort', onAbort);
      URL.revokeObjectURL(url);
      onTTSEvent?.({ type: 'completed', method: 'blob', durationMs: Date.now() - playbackStartTime, textLength });
      resolve();
    };

    audio.onerror = () => {
      abortSignal.removeEventListener('abort', onAbort);
      URL.revokeObjectURL(url);
      onTTSEvent?.({ type: 'error', method: 'blob', error: 'Audio playback failed', textLength });
      reject(new Error('Audio playback failed'));
    };

    audio.play().catch(reject);
  });
}

// --- Hook ---

export function useCloudTTS(options: UseCloudTTSOptions = {}): UseCloudTTSReturn {
  const {
    voice: defaultVoice = 'nova',
    speed = 1.0,
    volume = 0.8,
    onStart,
    onEnd,
    onError,
    onTTSEvent,
  } = options;

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voice, setVoice] = useState<CloudTTSVoice>(defaultVoice);
  const useMSE = useRef(isMSESupported());

  useEffect(() => {
    setVoice(defaultVoice);
  }, [defaultVoice]);

  const queueRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const playNext = useCallback(async () => {
    if (queueRef.current.length === 0) {
      isPlayingRef.current = false;
      setIsSpeaking(false);
      onEnd?.();
      return;
    }

    const text = queueRef.current.shift()!;
    isPlayingRef.current = true;
    setIsSpeaking(true);

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice, speed }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`TTS API error: ${res.status}`);
      }

      if (useMSE.current && res.body) {
        await playWithMSE(res, volume, controller.signal, onStart, onTTSEvent, text.length);
      } else {
        await playWithBlob(res, volume, controller.signal, onStart, onTTSEvent, text.length);
      }

      // Play next in queue
      playNext();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      const msg = err instanceof Error ? err.message : 'Cloud TTS failed';
      onError?.(msg);
      isPlayingRef.current = false;
      setIsSpeaking(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice, speed, volume]);

  const speak = useCallback((text: string): boolean => {
    queueRef.current.push(text);
    if (!isPlayingRef.current) {
      playNext();
    }
    return true;
  }, [playNext]);

  const cancel = useCallback(() => {
    queueRef.current = [];
    abortRef.current?.abort();
    abortRef.current = null;
    isPlayingRef.current = false;
    setIsSpeaking(false);
  }, []);

  return {
    speak,
    cancel,
    isSpeaking,
    isSupported: true,
    voice,
    setVoice,
  };
}
