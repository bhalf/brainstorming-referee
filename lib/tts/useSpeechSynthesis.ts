'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// --- Types ---

export interface UseSpeechSynthesisOptions {
  defaultVoice?: string;
  defaultRate?: number;
  defaultPitch?: number;
  defaultVolume?: number;
  rateLimitSeconds?: number;
  preferredLanguage?: string; // e.g. 'en-US', 'de-DE'
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
}

export interface UseSpeechSynthesisReturn {
  isSupported: boolean;
  isSpeaking: boolean;
  voices: SpeechSynthesisVoice[];
  currentVoice: SpeechSynthesisVoice | null;
  rate: number;
  pitch: number;
  volume: number;
  setVoice: (voiceName: string) => void;
  setRate: (rate: number) => void;
  setPitch: (pitch: number) => void;
  setVolume: (volume: number) => void;
  speak: (text: string) => boolean;
  cancel: () => void;
  canSpeak: boolean;
  lastSpeakTime: number | null;
}

// --- Chrome Pause Bug Workaround ---
// Chrome pauses speechSynthesis after ~15s of speaking. We keep it alive
// by periodically calling pause/resume while an utterance is playing.
const CHROME_KEEPALIVE_INTERVAL_MS = 5000;

// --- Hook ---

export function useSpeechSynthesis(
  options: UseSpeechSynthesisOptions = {}
): UseSpeechSynthesisReturn {
  const {
    defaultVoice = '',
    defaultRate = 1.0,
    defaultPitch = 1.0,
    defaultVolume = 0.8,
    rateLimitSeconds = 20,
    preferredLanguage = 'en-US',
    onStart,
    onEnd,
    onError,
  } = options;

  const [isSupported] = useState(() => {
    if (typeof window === 'undefined') return false;
    return 'speechSynthesis' in window;
  });

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [currentVoice, setCurrentVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [rate, setRate] = useState(defaultRate);
  const [pitch, setPitch] = useState(defaultPitch);
  const [volume, setVolume] = useState(defaultVolume);
  const [lastSpeakTime, setLastSpeakTime] = useState<number | null>(null);

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const queueRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);
  const voiceSelectedRef = useRef(false);
  const preferredLanguageRef = useRef(preferredLanguage);

  // Keep preferredLanguage ref in sync
  useEffect(() => {
    preferredLanguageRef.current = preferredLanguage;
  }, [preferredLanguage]);

  // --- Chrome Keepalive ---
  const startKeepAlive = useCallback(() => {
    stopKeepAlive();
    keepAliveRef.current = setInterval(() => {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, CHROME_KEEPALIVE_INTERVAL_MS);
  }, []);

  const stopKeepAlive = useCallback(() => {
    if (keepAliveRef.current) {
      clearInterval(keepAliveRef.current);
      keepAliveRef.current = null;
    }
  }, []);

  // --- Smart Voice Selection ---
  const pickBestVoice = useCallback(
    (availableVoices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | null => {
      if (availableVoices.length === 0) return null;

      const langPrefix = lang.split('-')[0]; // 'en' from 'en-US'

      // 1. Try exact language match, prefer remote (higher quality) voices
      const exactRemote = availableVoices.find(
        (v) => v.lang.replace('_', '-') === lang && !v.localService
      );
      if (exactRemote) return exactRemote;

      // 2. Exact match, local voice
      const exactLocal = availableVoices.find(
        (v) => v.lang.replace('_', '-') === lang && v.localService
      );
      if (exactLocal) return exactLocal;

      // 3. Same language prefix, prefer remote
      const prefixRemote = availableVoices.find(
        (v) => v.lang.replace('_', '-').startsWith(langPrefix) && !v.localService
      );
      if (prefixRemote) return prefixRemote;

      // 4. Same language prefix, local
      const prefixLocal = availableVoices.find(
        (v) => v.lang.replace('_', '-').startsWith(langPrefix) && v.localService
      );
      if (prefixLocal) return prefixLocal;

      // 5. Any English voice as ultimate fallback
      const anyEnglish = availableVoices.find((v) => v.lang.startsWith('en'));
      if (anyEnglish) return anyEnglish;

      return availableVoices[0];
    },
    []
  );

  // Load voices
  useEffect(() => {
    if (!isSupported) return;

    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      if (availableVoices.length === 0) return;

      setVoices(availableVoices);

      // Set voice from explicit default name
      if (defaultVoice && !voiceSelectedRef.current) {
        const voice = availableVoices.find((v) => v.name === defaultVoice);
        if (voice) {
          setCurrentVoice(voice);
          voiceSelectedRef.current = true;
          return;
        }
      }

      // Otherwise pick the best voice for the session language
      if (!voiceSelectedRef.current) {
        const best = pickBestVoice(availableVoices, preferredLanguageRef.current);
        if (best) {
          setCurrentVoice(best);
          voiceSelectedRef.current = true;
        }
      }
    };

    loadVoices();

    // Chrome loads voices asynchronously
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [isSupported, defaultVoice, pickBestVoice]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isSupported) {
        window.speechSynthesis.cancel();
      }
      stopKeepAlive();
      queueRef.current = [];
    };
  }, [isSupported, stopKeepAlive]);

  // Set voice by name
  const setVoiceByName = useCallback(
    (voiceName: string) => {
      const voice = voices.find((v) => v.name === voiceName);
      if (voice) {
        setCurrentVoice(voice);
        voiceSelectedRef.current = true;
      }
    },
    [voices]
  );

  // Check if we can speak (rate limit)
  const canSpeak = useCallback(() => {
    if (!lastSpeakTime) return true;
    const elapsed = (Date.now() - lastSpeakTime) / 1000;
    return elapsed >= rateLimitSeconds;
  }, [lastSpeakTime, rateLimitSeconds]);

  // --- Internal: play the next item in the queue ---
  const playNext = useCallback(() => {
    if (queueRef.current.length === 0) {
      isPlayingRef.current = false;
      setIsSpeaking(false);
      stopKeepAlive();
      onEnd?.();
      return;
    }

    const text = queueRef.current.shift()!;
    isPlayingRef.current = true;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = currentVoice;
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;
    // CRITICAL: Set the language on the utterance for correct pronunciation
    utterance.lang = currentVoice?.lang || preferredLanguageRef.current;

    utterance.onstart = () => {
      setIsSpeaking(true);
      setLastSpeakTime(Date.now());
      startKeepAlive();
      onStart?.();
    };

    utterance.onend = () => {
      stopKeepAlive();
      // Play next in queue
      playNext();
    };

    utterance.onerror = (event) => {
      stopKeepAlive();
      isPlayingRef.current = false;
      setIsSpeaking(false);

      // 'interrupted' and 'canceled' are expected when cancel() is called
      if (event.error === 'not-allowed') {
        queueRef.current = []; // Clear queue, TTS is blocked
        onError?.('Audio playback blocked by browser. Please interact with the page (e.g., click anywhere) before TTS can play.');
      } else if (event.error !== 'interrupted' && event.error !== 'canceled') {
        onError?.(`Speech error: ${event.error}`);
        // Attempt to continue queue on other errors
        playNext();
      }
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [currentVoice, rate, pitch, volume, startKeepAlive, stopKeepAlive, onStart, onEnd, onError]);

  // Speak text (public API)
  const speak = useCallback(
    (text: string): boolean => {
      if (!isSupported) {
        onError?.('Speech synthesis not supported');
        return false;
      }

      if (!canSpeak()) {
        const remaining = Math.ceil(
          rateLimitSeconds - (Date.now() - (lastSpeakTime || 0)) / 1000
        );
        onError?.(`Rate limited. Wait ${remaining}s`);
        return false;
      }

      // Add to queue
      queueRef.current.push(text);

      // If not currently playing, start
      if (!isPlayingRef.current) {
        playNext();
      }

      return true;
    },
    [isSupported, canSpeak, playNext, onError, rateLimitSeconds, lastSpeakTime]
  );

  // Cancel speech
  const cancel = useCallback(() => {
    if (isSupported) {
      queueRef.current = [];
      window.speechSynthesis.cancel();
      stopKeepAlive();
      isPlayingRef.current = false;
      setIsSpeaking(false);
    }
  }, [isSupported, stopKeepAlive]);

  return {
    isSupported,
    isSpeaking,
    voices,
    currentVoice,
    rate,
    pitch,
    volume,
    setVoice: setVoiceByName,
    setRate,
    setPitch,
    setVolume,
    speak,
    cancel,
    canSpeak: canSpeak(),
    lastSpeakTime,
  };
}
