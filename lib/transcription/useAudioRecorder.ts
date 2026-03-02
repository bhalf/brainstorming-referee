// ============================================
// useAudioRecorder – MediaRecorder Hook
// ============================================
// Captures audio from the user's microphone via
// MediaRecorder API in periodic chunks, suitable
// for streaming to Whisper API.
// ============================================

'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

// --- Types ---

export interface AudioChunk {
    blob: Blob;
    duration: number; // ms
    timestamp: number; // when this chunk started recording
}

export interface UseAudioRecorderOptions {
    onAudioChunk: (chunk: AudioChunk) => void;
    chunkIntervalMs?: number; // Default: 5000 (5s chunks)
    mimeType?: string; // Default: auto-detect best available
}

export interface UseAudioRecorderReturn {
    isRecording: boolean;
    isSupported: boolean;
    start: () => Promise<void>;
    stop: () => void;
    toggle: () => Promise<void>;
    error: string | null;
}

// --- Detect best available MIME type ---

function getBestMimeType(): string {
    if (typeof MediaRecorder === 'undefined') return 'audio/webm';

    const candidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
    ];

    for (const type of candidates) {
        if (MediaRecorder.isTypeSupported(type)) {
            return type;
        }
    }

    return 'audio/webm'; // Fallback
}

// --- Hook ---

export function useAudioRecorder(options: UseAudioRecorderOptions): UseAudioRecorderReturn {
    const {
        onAudioChunk,
        chunkIntervalMs = 5000,
        mimeType,
    } = options;

    const [isRecording, setIsRecording] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const chunkStartTimeRef = useRef<number>(0);
    const onAudioChunkRef = useRef(onAudioChunk);
    const mountedRef = useRef(true);

    // Keep callback ref up to date
    useEffect(() => {
        onAudioChunkRef.current = onAudioChunk;
    }, [onAudioChunk]);

    // Cleanup on unmount
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            // Stop recording and release stream
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }
        };
    }, []);

    const isSupported = typeof window !== 'undefined'
        && typeof navigator !== 'undefined'
        && typeof navigator.mediaDevices !== 'undefined'
        && typeof MediaRecorder !== 'undefined';

    const start = useCallback(async () => {
        if (!isSupported) {
            setError('MediaRecorder API not supported in this browser');
            return;
        }

        setError(null);

        try {
            // Request microphone access
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 16000, // Whisper works best with 16kHz
                },
            });

            streamRef.current = stream;

            const selectedMimeType = mimeType || getBestMimeType();
            const recorder = new MediaRecorder(stream, {
                mimeType: selectedMimeType,
            });

            mediaRecorderRef.current = recorder;

            // Handle data availability
            recorder.ondataavailable = (event) => {
                if (!mountedRef.current) return;
                if (event.data && event.data.size > 0) {
                    const chunk: AudioChunk = {
                        blob: event.data,
                        duration: Date.now() - chunkStartTimeRef.current,
                        timestamp: chunkStartTimeRef.current,
                    };
                    onAudioChunkRef.current(chunk);
                    chunkStartTimeRef.current = Date.now();
                }
            };

            recorder.onerror = (event) => {
                if (!mountedRef.current) return;
                console.error('MediaRecorder error:', event);
                setError('Recording error occurred');
                setIsRecording(false);
            };

            recorder.onstop = () => {
                if (!mountedRef.current) return;
                setIsRecording(false);
            };

            // Start recording with timeslice for periodic chunks
            chunkStartTimeRef.current = Date.now();
            recorder.start(chunkIntervalMs);
            setIsRecording(true);

            console.log(`[AudioRecorder] Started recording (${selectedMimeType}, ${chunkIntervalMs}ms chunks)`);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error('Failed to start recording:', message);

            if (message.includes('Permission denied') || message.includes('NotAllowedError')) {
                setError('Microphone permission denied');
            } else if (message.includes('NotFoundError')) {
                setError('No microphone found');
            } else {
                setError(`Recording failed: ${message}`);
            }
        }
    }, [isSupported, chunkIntervalMs, mimeType]);

    const stop = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
            console.log('[AudioRecorder] Stopped recording');
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        setIsRecording(false);
    }, []);

    const toggle = useCallback(async () => {
        if (isRecording) {
            stop();
        } else {
            await start();
        }
    }, [isRecording, start, stop]);

    return {
        isRecording,
        isSupported,
        start,
        stop,
        toggle,
        error,
    };
}
