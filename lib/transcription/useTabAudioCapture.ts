'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

export interface TabAudioChunk {
    blob: Blob;
    timestamp: number;
    durationMs: number;
}

interface UseTabAudioCaptureOptions {
    /** Called with each audio chunk */
    onAudioChunk: (chunk: TabAudioChunk) => void;
    /** Chunk interval in milliseconds (default: 5000) */
    chunkIntervalMs?: number;
}

interface UseTabAudioCaptureReturn {
    /** Whether tab audio is currently being captured */
    isCapturing: boolean;
    /** Whether getDisplayMedia is supported */
    isSupported: boolean;
    /** Start capturing tab audio (triggers browser permission dialog) */
    start: () => Promise<void>;
    /** Stop capturing */
    stop: () => void;
    /** Current error, if any */
    error: string | null;
    /** Whether TTS output is being suppressed (mute filter active) */
    isTTSSuppressed: boolean;
    /** Tell the capture to suppress/unsuppress TTS output */
    setTTSSuppressed: (suppressed: boolean) => void;
}

/**
 * Hook to capture tab audio output via getDisplayMedia.
 * Captures all audio playing in the current browser tab (= remote participants in Jitsi).
 * Includes TTS suppression: when setTTSSuppressed(true) is called, audio chunks are
 * discarded to avoid transcribing our own intervention speech output.
 */
export function useTabAudioCapture({
    onAudioChunk,
    chunkIntervalMs = 5000,
}: UseTabAudioCaptureOptions): UseTabAudioCaptureReturn {
    const [isCapturing, setIsCapturing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isTTSSuppressed, setIsTTSSuppressed] = useState(false);

    const streamRef = useRef<MediaStream | null>(null);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const onAudioChunkRef = useRef(onAudioChunk);
    const isTTSSuppressedRef = useRef(false);
    const chunkStartTimeRef = useRef<number>(0);

    // Keep refs in sync
    useEffect(() => {
        onAudioChunkRef.current = onAudioChunk;
    }, [onAudioChunk]);

    useEffect(() => {
        isTTSSuppressedRef.current = isTTSSuppressed;
    }, [isTTSSuppressed]);

    const isSupported = typeof navigator !== 'undefined'
        && typeof navigator.mediaDevices !== 'undefined'
        && typeof navigator.mediaDevices.getDisplayMedia !== 'undefined';

    const stop = useCallback(() => {
        if (recorderRef.current && recorderRef.current.state !== 'inactive') {
            recorderRef.current.stop();
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        recorderRef.current = null;
        setIsCapturing(false);
    }, []);

    const start = useCallback(async () => {
        if (!isSupported) {
            setError('Tab audio capture is not supported in this browser');
            return;
        }

        try {
            setError(null);

            // Request tab audio capture via getDisplayMedia
            // preferCurrentTab hints to share the current tab directly
            const stream = await navigator.mediaDevices.getDisplayMedia({
                audio: true,
                video: true, // Required by spec, but we discard the video track
                // @ts-expect-error preferCurrentTab is a newer Chrome feature
                preferCurrentTab: true,
            });

            // Discard video track – we only want audio
            stream.getVideoTracks().forEach(track => track.stop());

            // Check we actually got an audio track
            const audioTracks = stream.getAudioTracks();
            if (audioTracks.length === 0) {
                setError('No audio track available. Make sure to check "Share tab audio" in the browser dialog.');
                stream.getTracks().forEach(track => track.stop());
                return;
            }

            // Create a new stream with only the audio track
            const audioStream = new MediaStream(audioTracks);
            streamRef.current = audioStream;

            // Handle track ending (user clicks "Stop sharing" in browser UI)
            audioTracks[0].addEventListener('ended', () => {
                stop();
            });

            // Detect best MIME type
            const mimeTypes = [
                'audio/webm;codecs=opus',
                'audio/webm',
                'audio/ogg;codecs=opus',
                'audio/mp4',
            ];
            let selectedMimeType = '';
            for (const mime of mimeTypes) {
                if (MediaRecorder.isTypeSupported(mime)) {
                    selectedMimeType = mime;
                    break;
                }
            }

            const recorder = new MediaRecorder(audioStream, {
                ...(selectedMimeType ? { mimeType: selectedMimeType } : {}),
            });
            recorderRef.current = recorder;

            recorder.ondataavailable = (event) => {
                if (event.data.size > 0 && !isTTSSuppressedRef.current) {
                    const now = Date.now();
                    const chunk: TabAudioChunk = {
                        blob: event.data,
                        timestamp: chunkStartTimeRef.current,
                        durationMs: now - chunkStartTimeRef.current,
                    };
                    onAudioChunkRef.current(chunk);
                }
                // Update start time for next chunk
                chunkStartTimeRef.current = Date.now();
            };

            recorder.onerror = () => {
                setError('Tab audio recording error');
                stop();
            };

            chunkStartTimeRef.current = Date.now();
            recorder.start(chunkIntervalMs);
            setIsCapturing(true);

        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to capture tab audio';
            // NotAllowedError = user cancelled the dialog
            if (err instanceof DOMException && err.name === 'NotAllowedError') {
                setError('Tab audio sharing was cancelled');
            } else {
                setError(message);
            }
        }
    }, [isSupported, chunkIntervalMs, stop]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (recorderRef.current && recorderRef.current.state !== 'inactive') {
                recorderRef.current.stop();
            }
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    return {
        isCapturing,
        isSupported,
        start,
        stop,
        error,
        isTTSSuppressed,
        setTTSSuppressed: setIsTTSSuppressed,
    };
}
