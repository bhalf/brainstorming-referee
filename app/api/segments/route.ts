import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';
import { segmentToInsert } from '@/lib/supabase/converters';

// POST — Insert a transcript segment (idempotent via ON CONFLICT)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, segment } = body;

    if (!sessionId || !segment) {
      return NextResponse.json({ error: 'sessionId and segment required' }, { status: 400 });
    }

    // Validate segment structure
    if (typeof segment.id !== 'string' || typeof segment.speaker !== 'string' || typeof segment.text !== 'string') {
      return NextResponse.json({ error: 'segment must have id, speaker, and text as strings' }, { status: 400 });
    }
    if (segment.timestamp !== undefined && typeof segment.timestamp !== 'number') {
      return NextResponse.json({ error: 'segment.timestamp must be a number' }, { status: 400 });
    }

    const supabase = getServiceClient();
    const row = segmentToInsert(segment, sessionId);

    const { error } = await supabase
      .from('transcript_segments')
      .upsert(row, { onConflict: 'id', ignoreDuplicates: true });

    if (error) {
      console.error('Failed to insert segment:', error);
      return NextResponse.json({ error: 'Failed to insert segment' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Segment insert error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// GET — Fetch segments for a session (for initial load on join)
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('sessionId');
  const since = parseInt(request.nextUrl.searchParams.get('since') || '0', 10);

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  }

  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('transcript_segments')
    .select('*')
    .eq('session_id', sessionId)
    .gt('timestamp', since)
    .order('timestamp', { ascending: true });

  if (error) {
    console.error('Failed to fetch segments:', error);
    return NextResponse.json({ error: 'Failed to fetch segments' }, { status: 500 });
  }

  return NextResponse.json({ segments: data || [] });
}
