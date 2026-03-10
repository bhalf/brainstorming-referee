import { AccessToken } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/api/rateLimit';

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, { maxRequests: 10 });
  if (limited) return limited;
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

    // Sanitize room name and identity to prevent abuse
    if (typeof room !== 'string' || room.length > 128 || !/^[\w-]+$/.test(room)) {
      return NextResponse.json(
        { error: 'Invalid room name' },
        { status: 400 }
      );
    }
    if (typeof identity !== 'string' || identity.length > 128) {
      return NextResponse.json(
        { error: 'Invalid identity' },
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
