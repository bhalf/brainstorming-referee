
import { NextRequest, NextResponse } from 'next/server';
import { getRoomData, appendSegmentToRoom, saveSessionConfig, SessionConfig } from '@/lib/sync/roomPersistence';
import { TranscriptSegment } from '@/lib/types';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const roomId = searchParams.get('room');
  const since = parseInt(searchParams.get('since') || '0', 10);

  if (!roomId) {
    return NextResponse.json({ error: 'Room ID required' }, { status: 400 });
  }

  const data = getRoomData(roomId);

  // Filter segments strictly after the 'since' timestamp
  // Note: We use segment.timestamp, NOT arrival time, to ensure we get history correctly.
  // Actually, for sync, we want segments added *after* we last checked.
  // But our simple store doesn't track insertion time separately.
  // Let's just return all segments for now, or filter by segment.timestamp if reliable.
  // Better: The client sends the ID of the last segment they have?
  // For simplicity with polling: filter by timestamp > since.

  const newSegments = data.segments.filter(s => s.timestamp > since);

  return NextResponse.json({
    segments: newSegments,
    count: newSegments.length,
    sessionConfig: data.sessionConfig || null,
    timestamp: Date.now()
  });
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { roomId, sessionConfig } = body as { roomId: string; sessionConfig: SessionConfig };

    if (!roomId || !sessionConfig) {
      return NextResponse.json({ error: 'roomId and sessionConfig required' }, { status: 400 });
    }

    saveSessionConfig(roomId, sessionConfig);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving session config:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { roomId, segment } = body;

    if (!roomId || !segment) {
      return NextResponse.json({ error: 'Room ID and segment required' }, { status: 400 });
    }

    appendSegmentToRoom(roomId, segment as TranscriptSegment);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error posting segment:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

