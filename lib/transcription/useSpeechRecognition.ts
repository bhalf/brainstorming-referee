'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// Types for Web Speech API (not included in standard TS lib)
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
}

// --- Types ---

export interface TranscriptResult {
  id: string;
  text: string;
  isFinal: boolean;
  timestamp: number;
  confidence: number;
}

export interface UseSpeechRecognitionOptions {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onResult?: (result: TranscriptResult) => void;
  onError?: (error: string) => void;
}

export interface UseSpeechRecognitionReturn {
  isSupported: boolean;
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  results: TranscriptResult[];
  start: () => void;
  stop: () => void;
  toggle: () => void;
  clear: () => void;
  error: string | null;
}

// --- Utility: Generate unique ID ---
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// --- Hook ---

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {}
): UseSpeechRecognitionReturn {
  const {
    language = 'en-US',
    continuous = true,
    interimResults = true,
    onResult,
    onError,
  } = options;

  // Initialize as false to avoid hydration mismatch (SSR vs client)
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [results, setResults] = useState<TranscriptResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const shouldRestartRef = useRef(false);
  const isStartingRef = useRef(false);

  // Check support after mount (client-side only)
  useEffect(() => {
    const supported = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    setIsSupported(supported);
  }, []);

  // Initialize recognition
  useEffect(() => {
    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang = language;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      isStartingRef.current = false;
      setIsListening(true);
      setError(null);
    };

    recognition.onend = () => {
      setIsListening(false);
      isStartingRef.current = false;
      // Auto-restart if still should be listening (handles browser auto-stop)
      if (shouldRestartRef.current && !isStartingRef.current) {
        setTimeout(() => {
          if (shouldRestartRef.current && !isStartingRef.current && recognitionRef.current) {
            try {
              isStartingRef.current = true;
              recognitionRef.current.start();
            } catch (e) {
              isStartingRef.current = false;
              console.error('Failed to restart recognition:', e);
            }
          }
        }, 300);
      }
    };

    recognition.onerror = (event) => {
      isStartingRef.current = false;
      const errorMessage = `Speech recognition error: ${event.error}`;
      setError(errorMessage);
      onError?.(errorMessage);

      // Don't restart on certain errors
      if (['not-allowed', 'audio-capture', 'no-speech', 'aborted'].includes(event.error)) {
        shouldRestartRef.current = false;
        setIsListening(false);
      }
    };

    recognition.onresult = (event) => {
      let finalTranscript = '';
      let currentInterim = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;
        const confidence = result[0].confidence;

        if (result.isFinal) {
          finalTranscript += text;

          const newResult: TranscriptResult = {
            id: generateId(),
            text: text.trim(),
            isFinal: true,
            timestamp: Date.now(),
            confidence,
          };

          setResults((prev) => [...prev, newResult]);
          onResult?.(newResult);
        } else {
          currentInterim += text;
        }
      }

      if (finalTranscript) {
        setTranscript((prev) => prev + finalTranscript);
      }
      setInterimTranscript(currentInterim);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
      recognitionRef.current = null;
    };
  }, [language, continuous, interimResults, onResult, onError]);

  // Start recognition
  const start = useCallback(() => {
    if (!recognitionRef.current || isListening || isStartingRef.current) return;

    try {
      isStartingRef.current = true;
      shouldRestartRef.current = true;
      recognitionRef.current.start();
    } catch (e) {
      isStartingRef.current = false;
      const errorMsg = e instanceof Error ? e.message : 'Failed to start recognition';
      setError(errorMsg);
      onError?.(errorMsg);
    }
  }, [isListening, onError]);

  // Stop recognition
  const stop = useCallback(() => {
    if (!recognitionRef.current) return;

    shouldRestartRef.current = false;
    isStartingRef.current = false;
    recognitionRef.current.stop();
    setInterimTranscript('');
  }, []);

  // Toggle recognition
  const toggle = useCallback(() => {
    if (isListening) {
      stop();
    } else {
      start();
    }
  }, [isListening, start, stop]);

  // Clear all results
  const clear = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    setResults([]);
  }, []);

  return {
    isSupported,
    isListening,
    transcript,
    interimTranscript,
    results,
    start,
    stop,
    toggle,
    clear,
    error,
  };
}







