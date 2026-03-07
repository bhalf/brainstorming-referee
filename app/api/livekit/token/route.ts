import { AccessToken } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    return NextResponse.json(
      { error: 'LiveKit credentials not configured' },
      { status: 503 }
    );
  }

  try {
    const { room, identity, name } = await request.json();

    if (!room || !identity) {
      return NextResponse.json(
        { error: 'Missing required fields: room, identity' },
        { status: 400 }
      );
    }

    const at = new AccessToken(apiKey, apiSecret, {
      identity,
      name: name || identity,
      ttl: '6h',
    });
    at.addGrant({
      room,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
    });

    const token = await at.toJwt();
    return NextResponse.json({ token });
  } catch (error) {
    console.error('Token generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate token' },
      { status: 500 }
    );
  }
}
