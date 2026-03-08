import { NextResponse } from 'next/server';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * POST /api/transcription/token
 * Creates an ephemeral client secret for OpenAI Realtime Transcription.
 * The client uses this short-lived token to open a WebSocket directly to OpenAI.
 *
 * See: https://developers.openai.com/api/docs/guides/realtime-transcription/
 */
export async function POST(request: Request) {
    if (!OPENAI_API_KEY) {
        return NextResponse.json(
            { error: 'OPENAI_API_KEY not configured' },
            { status: 503 }
        );
    }

    // Parse optional language from request body
    let language: string | null = null;
    try {
        const body = await request.json();
        language = body.language || null;
    } catch {
        // No body or invalid JSON — auto-detect language
    }

    try {
        const res = await fetch('https://api.openai.com/v1/realtime/transcription_sessions', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                input_audio_format: 'pcm16',
                input_audio_transcription: {
                    model: 'gpt-4o-mini-transcribe',
                    language: language || null,
                },
                turn_detection: {
                    type: 'server_vad',
                    threshold: 0.4,
                    prefix_padding_ms: 300,
                    silence_duration_ms: 200,
                },
                input_audio_noise_reduction: {
                    type: 'near_field',
                },
            }),
        });

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            console.error('OpenAI ephemeral token creation failed:', res.status, JSON.stringify(errorData));
            return NextResponse.json(
                { error: 'Failed to create transcription session', detail: errorData },
                { status: 502 }
            );
        }

        const data = await res.json();
        const clientSecret = data.client_secret?.value;

        if (!clientSecret) {
            console.error('No client_secret in response:', data);
            return NextResponse.json(
                { error: 'Invalid session response' },
                { status: 502 }
            );
        }

        return NextResponse.json({
            token: clientSecret,
            expiresAt: data.client_secret?.expires_at,
        });
    } catch (error) {
        console.error('Transcription token error:', error);
        return NextResponse.json(
            { error: 'Failed to generate transcription token' },
            { status: 500 }
        );
    }
}
