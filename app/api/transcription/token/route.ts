import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/api/rateLimit';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * Language-specific prompts that constrain the transcription model to output
 * ONLY in the target language. The `language` parameter alone is just a hint —
 * the model can still produce other languages (especially with dialect input).
 * The prompt provides a much stronger constraint.
 */
const TRANSCRIPTION_PROMPTS: Record<string, string> = {
    de: 'Transkribiere ausschließlich auf Deutsch. Schweizerdeutsch, Österreichisch und andere deutsche Dialekte sollen auf Hochdeutsch transkribiert werden. Gib niemals Text in anderen Sprachen aus.',
    en: 'Transcribe exclusively in English. Do not output text in any other language.',
    fr: 'Transcris exclusivement en français. Ne produis jamais de texte dans une autre langue.',
};

/**
 * POST /api/transcription/token — Create an ephemeral OpenAI Realtime Transcription token.
 *
 * Requests a short-lived client secret from OpenAI's transcription session
 * endpoint. The client uses this token to open a WebSocket directly to OpenAI
 * for real-time speech-to-text. Configures server-side VAD, noise reduction,
 * and optional language hints.
 *
 * Rate-limited to 30 requests per window.
 *
 * @param request.body.language - Optional BCP-47 locale (e.g. 'de-CH'). Normalized to
 *        ISO 639-1 (e.g. 'de') for the OpenAI API. Omit for auto-detection.
 * @returns {{ token: string, expiresAt: string }} Ephemeral client secret and its expiry.
 *
 * @see https://developers.openai.com/api/docs/guides/realtime-transcription/
 */
export async function POST(request: NextRequest) {
    const limited = rateLimit(request, { maxRequests: 30 });
    if (limited) return limited;

    if (!OPENAI_API_KEY) {
        return NextResponse.json(
            { error: 'OPENAI_API_KEY not configured' },
            { status: 503 }
        );
    }

    // Parse optional language from request body and normalize to ISO 639-1
    let language: string | null = null;
    try {
        const body = await request.json();
        const raw: string | null = body.language || null;
        if (raw) {
            // Normalize locale codes like 'de-CH' → 'de' (OpenAI only accepts ISO 639-1)
            language = raw.split('-')[0].toLowerCase() || null;
        }
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
                    model: 'gpt-4o-transcribe',
                    // Omit language entirely when null — OpenAI rejects `null` but accepts
                    // a missing field and auto-detects the language.
                    ...(language ? { language } : {}),
                    // Prompt constrains the model to output ONLY in the target language.
                    // Critical for dialects (e.g. Swiss German) which otherwise cause
                    // the model to hallucinate text in other languages (Spanish, etc.).
                    ...(language && TRANSCRIPTION_PROMPTS[language]
                        ? { prompt: TRANSCRIPTION_PROMPTS[language] }
                        : {}),
                },
                turn_detection: {
                    type: 'server_vad',
                    threshold: 0.5, // slightly higher threshold to avoid breath noises
                    // 300ms context before speech for better accuracy in
                    // multi-participant sessions where speakers have varied pacing.
                    prefix_padding_ms: 300,
                    // 500ms silence before committing a turn — balances fast UX with
                    // avoiding micro-segmentation when multiple participants speak.
                    // 200ms was too aggressive: natural breath pauses committed turns,
                    // flooding the system with tiny fragments in multi-speaker sessions.
                    silence_duration_ms: 500,
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
