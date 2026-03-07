// ============================================
// useAudioRecorder – MediaRecorder Hook
// ============================================
// Captures audio from the user's microphone via
// MediaRecorder API in periodic chunks, suitable
// for streaming to Whisper API.
//
// Uses stop/start cycles (not timeslice) so that
// each chunk is a self-contained audio file with
// proper container headers.
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

    const streamRef = useRef<MediaStream | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const onAudioChunkRef = useRef(onAudioChunk);
    const mountedRef = useRef(true);
    const selectedMimeRef = useRef<string>('audio/webm');
    const isRecordingRef = useRef(false);

    // Keep callback ref up to date
    useEffect(() => {
        onAudioChunkRef.current = onAudioChunk;
    }, [onAudioChunk]);

    // Cleanup on unmount
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
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

    // Record a single complete chunk: start → collect data → stop → emit blob
    const recordOneChunk = useCallback((stream: MediaStream) => {
        if (!mountedRef.current || !isRecordingRef.current) return;

        const recorder = new MediaRecorder(stream, {
            mimeType: selectedMimeRef.current,
        });

        const chunks: BlobPart[] = [];
        const chunkStart = Date.now();

        recorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                chunks.push(event.data);
            }
        };

        recorder.onstop = () => {
            if (!mountedRef.current || chunks.length === 0) return;
            const blob = new Blob(chunks, { type: selectedMimeRef.current });
            if (blob.size > 0) {
                onAudioChunkRef.current({
                    blob,
                    duration: Date.now() - chunkStart,
                    timestamp: chunkStart,
                });
            }
        };

        recorder.onerror = (event) => {
            console.error('MediaRecorder error:', event);
        };

        recorder.start();

        // Stop after chunkIntervalMs to finalize this chunk
        setTimeout(() => {
            if (recorder.state !== 'inactive') {
                recorder.stop();
            }
        }, chunkIntervalMs);
    }, [chunkIntervalMs]);

    const start = useCallback(async () => {
        if (!isSupported) {
            setError('MediaRecorder API not supported in this browser');
            return;
        }

        setError(null);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 16000,
                },
            });

            streamRef.current = stream;
            selectedMimeRef.current = mimeType || getBestMimeType();
            isRecordingRef.current = true;
            setIsRecording(true);

            console.log(`[AudioRecorder] Started (${selectedMimeRef.current}, ${chunkIntervalMs}ms cycles)`);

            // Record first chunk immediately
            recordOneChunk(stream);

            // Then schedule subsequent chunks
            intervalRef.current = setInterval(() => {
                if (streamRef.current && isRecordingRef.current) {
                    recordOneChunk(streamRef.current);
                }
            }, chunkIntervalMs);

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
    }, [isSupported, chunkIntervalMs, mimeType, recordOneChunk]);

    const stop = useCallback(() => {
        isRecordingRef.current = false;

        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        setIsRecording(false);
        console.log('[AudioRecorder] Stopped');
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
