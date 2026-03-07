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
    onInterimTranscript,
    onFinalSegment,
}: UseOpenAIRealtimeStreamParams): UseOpenAIRealtimeStreamReturn {
    const [isConnected, setIsConnected] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const wsRef = useRef<WebSocket | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const reconnectAttemptsRef = useRef(0);
    const isMountedRef = useRef(true);
    const isActiveRef = useRef(isActive);
    const segmentCounterRef = useRef(0);
    const currentTranscriptRef = useRef('');

    // Stable refs for callbacks
    const onInterimTranscriptRef = useRef(onInterimTranscript);
    const onFinalSegmentRef = useRef(onFinalSegment);
    const speakerRef = useRef(speaker);
    const languageRef = useRef(language);

    useEffect(() => { onInterimTranscriptRef.current = onInterimTranscript; }, [onInterimTranscript]);
    useEffect(() => { onFinalSegmentRef.current = onFinalSegment; }, [onFinalSegment]);
    useEffect(() => { speakerRef.current = speaker; }, [speaker]);
    useEffect(() => { languageRef.current = language; }, [language]);
    useEffect(() => { isActiveRef.current = isActive; }, [isActive]);

    const isSupported = typeof window !== 'undefined'
        && typeof navigator !== 'undefined'
        && typeof navigator.mediaDevices !== 'undefined'
        && typeof WebSocket !== 'undefined'
        && typeof AudioContext !== 'undefined';

    // Fetch ephemeral token from our server
    const fetchToken = useCallback(async (): Promise<string | null> => {
        try {
            const res = await fetch('/api/transcription/token', { method: 'POST' });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                console.error('[OpenAIStream] Token fetch failed:', data.error || res.status);
                return null;
            }
            const { token } = await res.json();
            return token;
        } catch (e) {
            console.error('[OpenAIStream] Token fetch error:', e);
            return null;
        }
    }, []);

    // Clean up WebSocket
    const cleanupWebSocket = useCallback(() => {
        if (wsRef.current) {
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

    // Connect WebSocket with intent=transcription
    const connectWebSocket = useCallback(async (): Promise<WebSocket> => {
        const token = await fetchToken();
        if (!token) {
            throw new Error('Failed to get OpenAI transcription token');
        }

        cleanupWebSocket();

        // intent=transcription tells OpenAI this is a transcription-only session
        const url = 'wss://api.openai.com/v1/realtime?intent=transcription';
        console.log('[OpenAIStream] Connecting to OpenAI Realtime API (transcription mode)...');

        return new Promise<WebSocket>((resolve, reject) => {
            const ws = new WebSocket(url, [
                'realtime',
                `openai-insecure-api-key.${token}`,
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

                // Configure session for transcription-only mode
                // Since the ephemeral token creates a realtime session, we use session.update
                // with modalities: ['text'] to disable audio responses
                const langCode = getLanguageCode(languageRef.current);
                const sessionUpdate: OpenAIRealtimeEvent = {
                    type: 'session.update',
                    session: {
                        modalities: ['text'],
                        input_audio_format: 'pcm16',
                        input_audio_transcription: {
                            model: 'gpt-4o-mini-transcribe',
                            language: langCode,
                            prompt: langCode === 'de'
                                ? 'Transkription eines Brainstorming-Meetings auf Deutsch.'
                                : 'Transcription of a brainstorming meeting.',
                        },
                        turn_detection: {
                            type: 'server_vad',
                            threshold: 0.5,
                            prefix_padding_ms: 300,
                            silence_duration_ms: 500,
                        },
                    },
                };
                ws.send(JSON.stringify(sessionUpdate));
                console.log(`[OpenAIStream] Transcription session configured (language: ${langCode})`);

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
                                id: `oai-${Date.now()}-${segmentCounterRef.current++}`,
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
                            console.log(`[OpenAIStream] ${msg.type}`);
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
                console.log(`[OpenAIStream] WebSocket closed (code=${event.code}, reason=${event.reason || 'none'})`);
                setIsConnected(false);

                // Reject if the promise hasn't resolved yet
                reject(new Error(`WebSocket closed (code=${event.code})`));

                // Auto-reconnect if still active
                if (isActiveRef.current && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
                    const delay = RECONNECT_BASE_DELAY_MS * Math.pow(2, reconnectAttemptsRef.current);
                    reconnectAttemptsRef.current++;
                    console.log(`[OpenAIStream] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`);
                    setTimeout(async () => {
                        if (isMountedRef.current && isActiveRef.current) {
                            try {
                                await connectWebSocket();
                                if (streamRef.current) {
                                    startAudioPipeline(streamRef.current);
                                }
                            } catch (e) {
                                console.error('[OpenAIStream] Reconnect failed:', e);
                            }
                        }
                    }, delay);
                } else if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
                    setError('Transcription connection lost after max retries');
                }
            };
        });
    }, [fetchToken, cleanupWebSocket]);

    // Start the audio capture pipeline (mic → PCM 24kHz → Base64 → WebSocket)
    const startAudioPipeline = useCallback((stream: MediaStream) => {
        if (processorNodeRef.current) processorNodeRef.current.disconnect();
        if (sourceNodeRef.current) sourceNodeRef.current.disconnect();
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close();
        }

        const audioContext = new AudioContext({ sampleRate: PCM_SAMPLE_RATE });
        audioContextRef.current = audioContext;

        const source = audioContext.createMediaStreamSource(stream);
        sourceNodeRef.current = source;

        const processor = audioContext.createScriptProcessor(AUDIO_BUFFER_SIZE, 1, 1);
        processorNodeRef.current = processor;

        processor.onaudioprocess = (e) => {
            if (wsRef.current?.readyState !== WebSocket.OPEN) return;

            const inputData = e.inputBuffer.getChannelData(0);
            const base64Audio = float32ToPcm16Base64(inputData);

            const event: OpenAIRealtimeEvent = {
                type: 'input_audio_buffer.append',
                audio: base64Audio,
            };
            wsRef.current.send(JSON.stringify(event));
        };

        source.connect(processor);
        processor.connect(audioContext.destination);

        setIsRecording(true);
        console.log(`[OpenAIStream] Audio pipeline started (PCM ${PCM_SAMPLE_RATE}Hz, buffer ${AUDIO_BUFFER_SIZE})`);
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
            startAudioPipeline(stream);

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
    useEffect(() => {
        if (isActive && !isRecording) {
            start();
        } else if (!isActive && isRecording) {
            stop();
        }
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
