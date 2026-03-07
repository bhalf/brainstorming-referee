import { NextResponse } from 'next/server';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * POST /api/transcription/token
 * Creates an ephemeral client secret for OpenAI Realtime Transcription.
 * The client uses this short-lived token to open a WebSocket directly to OpenAI.
 *
 * See: https://developers.openai.com/api/docs/guides/realtime-transcription/
 */
export async function POST() {
    if (!OPENAI_API_KEY) {
        return NextResponse.json(
            { error: 'OPENAI_API_KEY not configured' },
            { status: 503 }
        );
    }

    try {
        const res = await fetch('https://api.openai.com/v1/realtime/sessions', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini-realtime-preview',
            }),
        });

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            console.error('OpenAI ephemeral token creation failed:', res.status, errorData);
            return NextResponse.json(
                { error: 'Failed to create transcription session' },
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
