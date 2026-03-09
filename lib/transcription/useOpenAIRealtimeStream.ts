'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { TranscriptSegment } from '@/lib/types';
import { isWhisperHallucination } from './whisperHallucinationFilter';

// --- Types ---

interface OpenAIRealtimeEvent {
    type: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
}

export interface UseOpenAIRealtimeStreamParams {
    language: string;
    speaker: string;
    isActive: boolean;
    /** When true, keeps the WebSocket alive but stops sending audio (e.g. mic mute) */
    isMuted?: boolean;
    onInterimTranscript: (text: string) => void;
    onFinalSegment: (segment: TranscriptSegment) => void;
}

export interface UseOpenAIRealtimeStreamReturn {
    isConnected: boolean;
    isRecording: boolean;
    isSupported: boolean;
    error: string | null;
    start: () => Promise<void>;
    stop: () => void;
}

// --- Constants ---

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY_MS = 1000;
const WS_CONNECT_TIMEOUT_MS = 10000;
const PCM_SAMPLE_RATE = 24000;
const AUDIO_BUFFER_SIZE = 4096;

/**
 * Minimum RMS energy to send an audio buffer to OpenAI.
 * Buffers below this threshold are treated as silence and skipped,
 * preventing the model from hallucinating on near-silent audio.
 * Typical values: background silence ~0.001-0.005, speech ~0.02-0.3.
 *
 * Set conservatively low so quiet speakers are not filtered out.
 * The adaptive noise floor (computed from the first ~2s of audio)
 * provides a per-environment baseline on top of this.
 */
const MIN_RMS_ENERGY_FLOOR = 0.003;
const NOISE_CALIBRATION_BUFFERS = 12; // ~2s of audio at 4096-sample buffers @ 24kHz

// --- Helpers ---

/** Convert Float32 PCM samples to 16-bit PCM and Base64-encode */
function float32ToPcm16Base64(float32: Float32Array): string {
    const pcm16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
        const s = Math.max(-1, Math.min(1, float32[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    const bytes = new Uint8Array(pcm16.buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/** Map language code to ISO 639-1 for OpenAI */
function getLanguageCode(lang: string): string {
    const base = lang.split('-')[0].toLowerCase();
    return base || 'en';
}

// --- Hook ---

export function useOpenAIRealtimeStream({
    language,
    speaker,
    isActive,
    isMuted = false,
    onInterimTranscript,
    onFinalSegment,
}: UseOpenAIRealtimeStreamParams): UseOpenAIRealtimeStreamReturn {
    const [isConnected, setIsConnected] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const wsRef = useRef<WebSocket | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const processorNodeRef = useRef<AudioWorkletNode | ScriptProcessorNode | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const reconnectAttemptsRef = useRef(0);
    const isMountedRef = useRef(true);
    const isActiveRef = useRef(isActive);
    const isIntentionalCloseRef = useRef(false);
    const currentTranscriptRef = useRef('');
    const tokenRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const noiseFloorRef = useRef<number>(MIN_RMS_ENERGY_FLOOR);
    const calibrationSamplesRef = useRef<number[]>([]);

    // Stable refs for callbacks
    const onInterimTranscriptRef = useRef(onInterimTranscript);
    const onFinalSegmentRef = useRef(onFinalSegment);
    const speakerRef = useRef(speaker);
    const languageRef = useRef(language);

    useEffect(() => { onInterimTranscriptRef.current = onInterimTranscript; }, [onInterimTranscript]);
    useEffect(() => { onFinalSegmentRef.current = onFinalSegment; }, [onFinalSegment]);
    useEffect(() => { speakerRef.current = speaker; }, [speaker]);
    useEffect(() => { languageRef.current = language; }, [language]);
    const isMutedRef = useRef(isMuted);
    useEffect(() => { isActiveRef.current = isActive; }, [isActive]);
    useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);

    const isSupported = typeof window !== 'undefined'
        && typeof navigator !== 'undefined'
        && typeof navigator.mediaDevices !== 'undefined'
        && typeof WebSocket !== 'undefined'
        && typeof AudioContext !== 'undefined';

    // Fetch ephemeral token from our server
    const fetchToken = useCallback(async (): Promise<{ token: string; expiresAt: number } | null> => {
        try {
            const langCode = getLanguageCode(languageRef.current);
            const res = await fetch('/api/transcription/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ language: langCode }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                console.error('[OpenAIStream] Token fetch failed:', data.error || res.status);
                return null;
            }
            const { token, expiresAt } = await res.json();
            return { token, expiresAt: expiresAt ?? (Date.now() / 1000 + 300) }; // default 5 min if not provided
        } catch (e) {
            console.error('[OpenAIStream] Token fetch error:', e);
            return null;
        }
    }, []);

    // Clean up WebSocket
    const cleanupWebSocket = useCallback(() => {
        if (tokenRefreshTimerRef.current) {
            clearTimeout(tokenRefreshTimerRef.current);
            tokenRefreshTimerRef.current = null;
        }
        if (wsRef.current) {
            // Mark as intentional so onclose handler doesn't auto-reconnect
            isIntentionalCloseRef.current = true;
            if (wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.close();
            }
            wsRef.current = null;
        }
        setIsConnected(false);
    }, []);

    // Clean up Audio pipeline and mic stream
    const cleanupAudio = useCallback(() => {
        if (processorNodeRef.current) {
            processorNodeRef.current.disconnect();
            processorNodeRef.current = null;
        }
        if (sourceNodeRef.current) {
            sourceNodeRef.current.disconnect();
            sourceNodeRef.current = null;
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        setIsRecording(false);
    }, []);

    // Schedule a token refresh before expiry — reconnects WebSocket with new token
    const scheduleTokenRefresh = useCallback((expiresAtEpochSec: number) => {
        if (tokenRefreshTimerRef.current) {
            clearTimeout(tokenRefreshTimerRef.current);
        }
        const nowSec = Date.now() / 1000;
        // Refresh 60 seconds before expiry, minimum 10 seconds from now
        const refreshInMs = Math.max(10_000, (expiresAtEpochSec - nowSec - 60) * 1000);
        console.log(`[OpenAIStream] Token refresh scheduled in ${Math.round(refreshInMs / 1000)}s`);

        tokenRefreshTimerRef.current = setTimeout(async () => {
            if (!isMountedRef.current || !isActiveRef.current) return;
            console.log('[OpenAIStream] Token expiring soon — reconnecting WebSocket with fresh token...');
            reconnectAttemptsRef.current = 0; // Reset reconnect counter for token refresh
            try {
                // IMPORTANT: We only reconnect the WebSocket. 
                // We do NOT restart the audio pipeline because creating a new AudioContext 
                // without a direct user interaction (like a click) will cause the browser 
                // to start it in a "suspended" state, muting the microphone secretly.
                await connectWebSocket();
            } catch (e) {
                console.error('[OpenAIStream] Token refresh reconnect failed:', e);
                setError('Transcription token refresh failed');
            }
        }, refreshInMs);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Connect WebSocket with intent=transcription
    const connectWebSocket = useCallback(async (): Promise<WebSocket> => {
        const tokenData = await fetchToken();
        if (!tokenData) {
            throw new Error('Failed to get OpenAI transcription token');
        }

        cleanupWebSocket();

        // Schedule automatic refresh before this token expires
        scheduleTokenRefresh(tokenData.expiresAt);

        // intent=transcription tells OpenAI this is a transcription-only session
        const url = 'wss://api.openai.com/v1/realtime?intent=transcription';
        console.log('[OpenAIStream] Connecting to OpenAI Realtime API (transcription mode)...');

        return new Promise<WebSocket>((resolve, reject) => {
            const ws = new WebSocket(url, [
                'realtime',
                `openai-insecure-api-key.${tokenData.token}`,
                'openai-beta.realtime-v1',
            ]);
            wsRef.current = ws;

            const connectTimeout = setTimeout(() => {
                if (ws.readyState !== WebSocket.OPEN) {
                    ws.close();
                    reject(new Error('WebSocket connection timed out'));
                }
            }, WS_CONNECT_TIMEOUT_MS);

            ws.onopen = () => {
                clearTimeout(connectTimeout);
                if (!isMountedRef.current) {
                    ws.close();
                    reject(new Error('Component unmounted'));
                    return;
                }
                console.log('[OpenAIStream] WebSocket connected');
                setIsConnected(true);
                setError(null);
                reconnectAttemptsRef.current = 0;
                isIntentionalCloseRef.current = false;

                // Session is pre-configured via the token endpoint
                // No transcription_session.update needed
                const langCode = getLanguageCode(languageRef.current);
                console.log(`[OpenAIStream] Transcription session ready (language: ${langCode})`);

                resolve(ws);
            };

            ws.onmessage = (event) => {
                try {
                    const msg: OpenAIRealtimeEvent = JSON.parse(event.data);

                    switch (msg.type) {
                        case 'conversation.item.input_audio_transcription.delta': {
                            // Interim/incremental transcript
                            const delta = msg.delta || '';
                            currentTranscriptRef.current += delta;
                            onInterimTranscriptRef.current(currentTranscriptRef.current);
                            break;
                        }

                        case 'conversation.item.input_audio_transcription.completed': {
                            // Final transcript for this turn
                            const transcript = (msg.transcript || currentTranscriptRef.current).trim();
                            currentTranscriptRef.current = '';
                            onInterimTranscriptRef.current('');

                            if (!transcript) break;

                            // Filter hallucinations
                            if (isWhisperHallucination(transcript)) {
                                console.log('[OpenAIStream] Filtered hallucination:', transcript.substring(0, 80));
                                break;
                            }

                            const segment: TranscriptSegment = {
                                id: `oai-${crypto.randomUUID()}`,
                                speaker: speakerRef.current,
                                text: transcript,
                                timestamp: Date.now(),
                                isFinal: true,
                                language: languageRef.current,
                            };
                            onFinalSegmentRef.current(segment);
                            break;
                        }

                        case 'input_audio_buffer.speech_started':
                            // User started speaking — reset interim
                            currentTranscriptRef.current = '';
                            break;

                        case 'input_audio_buffer.speech_stopped':
                        case 'input_audio_buffer.committed':
                            // End of speech turn — these are informational
                            break;

                        case 'error': {
                            console.error('[OpenAIStream] Server error:', msg.error?.message || JSON.stringify(msg));
                            break;
                        }

                        case 'transcription_session.created':
                        case 'transcription_session.updated':
                            console.log(`[OpenAIStream] ${msg.type}`, msg.session ? '(configured)' : '');
                            break;

                        case 'session.created':
                        case 'session.updated':
                            // Legacy session events — ignore if using transcription mode
                            break;

                        default:
                            // Log unknown events during development
                            console.log(`[OpenAIStream] Event: ${msg.type}`);
                            break;
                    }
                } catch (e) {
                    console.warn('[OpenAIStream] Failed to parse message:', e);
                }
            };

            ws.onerror = () => {
                clearTimeout(connectTimeout);
                console.error('[OpenAIStream] WebSocket error (readyState:', ws.readyState, ')');
            };

            ws.onclose = (event) => {
                clearTimeout(connectTimeout);
                if (!isMountedRef.current) return;
                console.log(`[OpenAIStream] WebSocket closed (code=${event.code}, reason=${event.reason || 'none'}, intentional=${isIntentionalCloseRef.current})`);
                setIsConnected(false);

                // Reject if the promise hasn't resolved yet
                reject(new Error(`WebSocket closed (code=${event.code})`));

                // Skip auto-reconnect if this was an intentional close (token refresh, stop, cleanup)
                if (isIntentionalCloseRef.current) {
                    isIntentionalCloseRef.current = false;
                    return;
                }

                // Auto-reconnect if still active
                if (isActiveRef.current && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
                    // Salvage any interim transcript before reconnecting
                    const lostInterim = currentTranscriptRef.current.trim();
                    if (lostInterim && !isWhisperHallucination(lostInterim)) {
                        console.log('[OpenAIStream] Salvaging interim transcript on disconnect:', lostInterim.substring(0, 80));
                        const segment: TranscriptSegment = {
                            id: `oai-salvage-${crypto.randomUUID()}`,
                            speaker: speakerRef.current,
                            text: lostInterim,
                            timestamp: Date.now(),
                            isFinal: true,
                            language: languageRef.current,
                        };
                        onFinalSegmentRef.current(segment);
                    }
                    currentTranscriptRef.current = '';
                    onInterimTranscriptRef.current('');

                    const delay = RECONNECT_BASE_DELAY_MS * Math.pow(2, reconnectAttemptsRef.current);
                    reconnectAttemptsRef.current++;
                    console.log(`[OpenAIStream] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`);
                    setTimeout(async () => {
                        if (isMountedRef.current && isActiveRef.current) {
                            try {
                                // Reconnect WebSocket only. The existing audio pipeline
                                // will automatically stream to the new socket once open.
                                await connectWebSocket();
                            } catch (e) {
                                console.error('[OpenAIStream] Reconnect failed:', e);
                                // Propagate error to UI so user knows transcription stopped
                                if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
                                    setError('Transcription connection lost — please restart');
                                }
                            }
                        }
                    }, delay);
                } else if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
                    setError('Transcription connection lost after max retries');
                }
            };
        });
    }, [fetchToken, cleanupWebSocket, scheduleTokenRefresh]);

    // Start the audio capture pipeline (mic → PCM 24kHz → Base64 → WebSocket)
    const startAudioPipeline = useCallback(async (stream: MediaStream) => {
        if (processorNodeRef.current) processorNodeRef.current.disconnect();
        if (sourceNodeRef.current) sourceNodeRef.current.disconnect();
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close();
        }

        // Reset adaptive noise floor calibration state
        calibrationSamplesRef.current = [];
        noiseFloorRef.current = MIN_RMS_ENERGY_FLOOR;

        const audioContext = new AudioContext({ sampleRate: PCM_SAMPLE_RATE });
        audioContextRef.current = audioContext;

        const source = audioContext.createMediaStreamSource(stream);
        sourceNodeRef.current = source;

        // Handler for processing audio data (shared between worklet and fallback)
        const processAudioData = (inputData: Float32Array) => {
            if (wsRef.current?.readyState !== WebSocket.OPEN) return;
            // When muted, skip sending audio but keep the connection alive
            if (isMutedRef.current) return;

            // Client-side energy gate: skip near-silent buffers to prevent hallucinations
            let sumSq = 0;
            for (let i = 0; i < inputData.length; i++) {
                sumSq += inputData[i] * inputData[i];
            }
            const rms = Math.sqrt(sumSq / inputData.length);

            // Adaptive noise floor: learn from first ~2s of audio
            if (calibrationSamplesRef.current.length < NOISE_CALIBRATION_BUFFERS) {
                calibrationSamplesRef.current.push(rms);
                if (calibrationSamplesRef.current.length === NOISE_CALIBRATION_BUFFERS) {
                    // Set noise floor to 2x the median RMS of calibration period
                    const sorted = [...calibrationSamplesRef.current].sort((a, b) => a - b);
                    const median = sorted[Math.floor(sorted.length / 2)];
                    noiseFloorRef.current = Math.max(MIN_RMS_ENERGY_FLOOR, median * 2);
                    console.log(`[OpenAIStream] Adaptive noise floor calibrated: ${noiseFloorRef.current.toFixed(5)} (median: ${median.toFixed(5)})`);
                }
            }

            if (rms < noiseFloorRef.current) return;

            const base64Audio = float32ToPcm16Base64(inputData);

            const event: OpenAIRealtimeEvent = {
                type: 'input_audio_buffer.append',
                audio: base64Audio,
            };
            wsRef.current.send(JSON.stringify(event));
        };

        // Try AudioWorklet (modern, runs on audio thread)
        let useWorklet = false;
        if (typeof audioContext.audioWorklet !== 'undefined') {
            try {
                await audioContext.audioWorklet.addModule('/pcm-capture-processor.js');
                const workletNode = new AudioWorkletNode(audioContext, 'pcm-capture-processor');
                workletNode.port.onmessage = (e: MessageEvent<Float32Array>) => {
                    processAudioData(e.data);
                };
                processorNodeRef.current = workletNode;
                source.connect(workletNode);
                workletNode.connect(audioContext.destination);
                useWorklet = true;
                console.log(`[OpenAIStream] Audio pipeline started with AudioWorklet (PCM ${PCM_SAMPLE_RATE}Hz)`);
            } catch (e) {
                console.warn('[OpenAIStream] AudioWorklet not available, falling back to ScriptProcessor:', e);
            }
        }

        // Fallback: ScriptProcessorNode (deprecated but works everywhere)
        if (!useWorklet) {
            const processor = audioContext.createScriptProcessor(AUDIO_BUFFER_SIZE, 1, 1);
            processorNodeRef.current = processor;
            processor.onaudioprocess = (e) => {
                processAudioData(e.inputBuffer.getChannelData(0));
            };
            source.connect(processor);
            processor.connect(audioContext.destination);
            console.log(`[OpenAIStream] Audio pipeline started with ScriptProcessor fallback (PCM ${PCM_SAMPLE_RATE}Hz, buffer ${AUDIO_BUFFER_SIZE})`);
        }

        setIsRecording(true);
    }, []);

    // Start: get mic → connect WS → start audio pipeline
    const start = useCallback(async () => {
        if (!isSupported) {
            setError('WebSocket or AudioContext not supported');
            return;
        }

        setError(null);
        reconnectAttemptsRef.current = 0;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: PCM_SAMPLE_RATE,
                },
            });
            streamRef.current = stream;

            await connectWebSocket();
            await startAudioPipeline(stream);

        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error('[OpenAIStream] Start failed:', message);

            if (message.includes('Permission denied') || message.includes('NotAllowedError')) {
                setError('Microphone permission denied');
            } else if (message.includes('NotFoundError')) {
                setError('No microphone found');
            } else {
                setError(`Transcription start failed: ${message}`);
            }

            cleanupAudio();
            cleanupWebSocket();
        }
    }, [isSupported, connectWebSocket, startAudioPipeline, cleanupAudio, cleanupWebSocket]);

    // Stop everything
    const stop = useCallback(() => {
        cleanupAudio();
        cleanupWebSocket();
        onInterimTranscriptRef.current('');
        currentTranscriptRef.current = '';
        console.log('[OpenAIStream] Stopped');
    }, [cleanupAudio, cleanupWebSocket]);

    // Auto-start/stop based on isActive
    // Guard: prevent overlapping start() calls which create duplicate WS + audio pipelines
    const isStartingRef = useRef(false);
    const isRecordingRef = useRef(false);
    useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);

    const startStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        if (startStopTimerRef.current) {
            clearTimeout(startStopTimerRef.current);
        }

        if (isActive && !isRecordingRef.current && !isStartingRef.current) {
            isStartingRef.current = true;
            start().finally(() => { isStartingRef.current = false; });
        } else if (!isActive && (isRecordingRef.current || isStartingRef.current)) {
            // Delay stop to avoid tearing down on brief toggles
            startStopTimerRef.current = setTimeout(() => {
                if (!isActiveRef.current) {
                    isStartingRef.current = false;
                    stop();
                }
            }, 1500);
        }

        return () => {
            if (startStopTimerRef.current) clearTimeout(startStopTimerRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isActive]);

    // Cleanup on unmount
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            cleanupAudio();
            cleanupWebSocket();
        };
    }, [cleanupAudio, cleanupWebSocket]);

    return {
        isConnected,
        isRecording,
        isSupported,
        error,
        start,
        stop,
    };
}
