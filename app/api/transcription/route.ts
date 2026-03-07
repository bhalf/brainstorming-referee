// ============================================
// Whisper Transcription API Route
// ============================================
// Receives audio chunks (WebM/Opus) from the browser,
// sends to OpenAI Whisper API, returns transcription
// with word-level timestamps.
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { requireApiKey, loadRoutingConfig } from '@/lib/api/routeHelpers';

export async function POST(request: NextRequest) {
    try {
        const routingConfig = loadRoutingConfig();

        if (!routingConfig.transcription_server.enabled) {
            return NextResponse.json(
                { error: 'Server transcription is disabled in model routing config' },
                { status: 503 }
            );
        }

        const apiKeyResult = requireApiKey();
        if ('error' in apiKeyResult) return apiKeyResult.error;
        const apiKey = apiKeyResult.key;

        // Parse multipart form data
        const formData = await request.formData();
        const audioFile = formData.get('audio') as File | null;
        const language = (formData.get('language') as string) || 'en';

        if (!audioFile) {
            return NextResponse.json(
                { error: 'audio file is required' },
                { status: 400 }
            );
        }

        // Validate file size (max 25MB — Whisper limit)
        if (audioFile.size > 25 * 1024 * 1024) {
            return NextResponse.json(
                { error: 'Audio file too large (max 25MB)' },
                { status: 400 }
            );
        }

        const taskConfig = routingConfig.transcription_server;
        const startTime = Date.now();

        try {
            // Build form data for OpenAI Whisper API
            const whisperFormData = new FormData();
            // Preserve original filename/extension from client upload
            whisperFormData.append('file', audioFile, audioFile.name || 'audio.webm');
            whisperFormData.append('model', taskConfig.model);
            whisperFormData.append('language', language.split('-')[0]); // 'de-CH' → 'de'
            whisperFormData.append('response_format', 'verbose_json');
            whisperFormData.append('timestamp_granularities[]', 'segment');

            // Dialect prompt: helps Whisper adapt to Swiss German accent and vocabulary
            if (language === 'de-CH') {
                whisperFormData.append('prompt',
                    'Brainstorming-Diskussion auf Schweizerdeutsch. ' +
                    'Die Teilnehmer sprechen mit Schweizer Akzent und verwenden Helvetismen wie ' +
                    'grüezi, merci, ähm, genau, oder, also, quasi, mega, luege, chönne, müesse, wäge, Velo, Trottoir, Natel, parkieren.'
                );
            }

            const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                },
                body: whisperFormData,
                signal: AbortSignal.timeout(taskConfig.timeoutMs),
            });

            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({}));
                throw new Error(errorBody?.error?.message || `HTTP ${response.status}`);
            }

            const data = await response.json();
            const latencyMs = Date.now() - startTime;

            // Build log entry
            const logEntry = {
                id: `llm-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
                timestamp: Date.now(),
                task: 'transcription_server' as const,
                provider: taskConfig.provider,
                model: taskConfig.model,
                latencyMs,
                inputTokens: undefined,
                outputTokens: undefined,
                success: true,
                fallbackUsed: false,
            };

            // Extract segments with timestamps
            const segments = (data.segments || []).map((seg: { start: number; end: number; text: string }) => ({
                start: seg.start,
                end: seg.end,
                text: seg.text.trim(),
            }));

            return NextResponse.json({
                text: data.text || '',
                segments,
                language: data.language || language,
                duration: data.duration,
                logEntry,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error('Whisper API error:', message);

            const logEntry = {
                id: `llm-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
                timestamp: Date.now(),
                task: 'transcription_server' as const,
                provider: taskConfig.provider,
                model: taskConfig.model,
                latencyMs: Date.now() - startTime,
                success: false,
                error: message,
                fallbackUsed: false,
            };

            return NextResponse.json(
                { error: `Whisper transcription failed: ${message}`, logEntry },
                { status: 502 }
            );
        }
    } catch (error) {
        console.error('Transcription endpoint error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
