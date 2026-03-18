import { NextRequest, NextResponse } from 'next/server';
import { requireApiKey } from '@/lib/api/routeHelpers';

export async function POST(request: NextRequest) {
  const keyResult = requireApiKey();
  if ('error' in keyResult) return keyResult.error;

  try {
    const { text, voice, speed } = await request.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 });
    }

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${keyResult.key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text.slice(0, 4096),
        voice: voice || 'nova',
        response_format: 'mp3',
        speed: speed || 1.0,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI TTS error:', response.status, errorText);
      return NextResponse.json(
        { error: `OpenAI TTS error: ${response.status}` },
        { status: response.status }
      );
    }

    // Stream through instead of buffering the complete response
    if (response.body) {
      return new NextResponse(response.body as ReadableStream, {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'no-store',
        },
      });
    }

    // Fallback: no body (shouldn't happen)
    const audioBuffer = await response.arrayBuffer();
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('TTS route error:', error);
    return NextResponse.json({ error: 'TTS generation failed' }, { status: 500 });
  }
}
