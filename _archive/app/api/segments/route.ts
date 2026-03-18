import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';
import { segmentToInsert } from '@/lib/supabase/converters';
import { validateSessionExists } from '@/lib/api/validateSession';

/**
 * POST /api/segments — Insert a transcript segment (idempotent).
 *
 * Uses Supabase upsert with ON CONFLICT on the segment id so duplicate
 * submissions (e.g. from retries) are silently ignored.
 *
 * @param request.body.sessionId - UUID of the owning session.
 * @param request.body.segment - Segment object with id (string), speaker (string),
 *        text (string), and optional timestamp (number, epoch ms).
 * @returns {{ success: true }} on successful insert or no-op duplicate.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, segment } = body;

    if (!sessionId || !segment) {
      return NextResponse.json({ error: 'sessionId and segment required' }, { status: 400 });
    }

    const validation = await validateSessionExists(sessionId);
    if (!validation.valid) return validation.response;

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

/**
 * GET /api/segments?sessionId={id}&since={timestamp} — Fetch transcript segments.
 *
 * Returns all segments for the given session that were created after the
 * optional `since` timestamp. Used for initial load when a participant joins
 * mid-session and needs to hydrate the transcript.
 *
 * @param request.query.sessionId - UUID of the session.
 * @param request.query.since - Optional epoch-ms cutoff; only newer segments are returned.
 * @returns {{ segments: object[] }} Array of raw segment rows.
 */
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('sessionId');
  const since = parseInt(request.nextUrl.searchParams.get('since') || '0', 10);

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  }

  const validation = await validateSessionExists(sessionId);
  if (!validation.valid) return validation.response;

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
