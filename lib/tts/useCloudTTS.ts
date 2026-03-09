'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

export type CloudTTSVoice = 'alloy' | 'ash' | 'coral' | 'echo' | 'fable' | 'nova' | 'onyx' | 'sage' | 'shimmer';

export interface UseCloudTTSOptions {
  voice?: CloudTTSVoice;
  speed?: number;
  volume?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
}

export interface UseCloudTTSReturn {
  speak: (text: string) => boolean;
  cancel: () => void;
  isSpeaking: boolean;
  isSupported: boolean;
  voice: CloudTTSVoice;
  setVoice: (v: CloudTTSVoice) => void;
}

export function useCloudTTS(options: UseCloudTTSOptions = {}): UseCloudTTSReturn {
  const {
    voice: defaultVoice = 'nova',
    speed = 1.0,
    volume = 0.8,
    onStart,
    onEnd,
    onError,
  } = options;

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voice, setVoice] = useState<CloudTTSVoice>(defaultVoice);

  // Sync internal voice state when the option prop changes
  useEffect(() => {
    setVoice(defaultVoice);
  }, [defaultVoice]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
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

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      await new Promise<void>((resolve, reject) => {
        const audio = new Audio(url);
        audio.volume = volume;
        audioRef.current = audio;

        audio.onplay = () => {
          onStart?.();
        };

        audio.onended = () => {
          URL.revokeObjectURL(url);
          audioRef.current = null;
          resolve();
        };

        audio.onerror = () => {
          URL.revokeObjectURL(url);
          audioRef.current = null;
          reject(new Error('Audio playback failed'));
        };

        audio.play().catch(reject);
      });

      // Play next in queue
      playNext();
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Cancelled — don't continue queue
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
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
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
