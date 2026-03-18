import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';

/**
 * POST /api/session/join — Join an existing brainstorming session as a participant.
 *
 * Looks up the most recent active (non-ended) session for the given room name.
 * If the desired participant name already exists among the session's transcript
 * speakers or active participants, an incrementing suffix is appended to
 * guarantee uniqueness.
 *
 * @param request.body.roomName - LiveKit room to join.
 * @param request.body.participantName - Desired display name (may be deduplicated).
 * @returns Session metadata (sessionId, scenario, language, config) plus the
 *          resolved (possibly suffixed) participant name.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { roomName, participantName } = body;

    if (!roomName) {
      return NextResponse.json({ error: 'roomName required' }, { status: 400 });
    }

    const supabase = getServiceClient();

    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('room_name', roomName)
      .is('ended_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'No active session found for this room' }, { status: 404 });
    }

    // Deduplicate participant name: check existing speakers AND active participants
    let resolvedName = participantName || 'Participant';
    if (participantName) {
      const [{ data: existingSegments }, { data: existingParticipants }] = await Promise.all([
        supabase
          .from('transcript_segments')
          .select('speaker')
          .eq('session_id', data.id)
          .limit(500),
        supabase
          .from('session_participants')
          .select('display_name')
          .eq('session_id', data.id),
      ]);

      const existingSpeakers = new Set([
        ...(existingSegments || []).map(s => s.speaker),
        ...(existingParticipants || []).map(p => p.display_name),
      ]);

      if (existingSpeakers.has(participantName)) {
        // Append incrementing suffix until unique
        let suffix = 2;
        while (existingSpeakers.has(`${participantName} (${suffix})`)) {
          suffix++;
        }
        resolvedName = `${participantName} (${suffix})`;
      }
    }

    return NextResponse.json({
      sessionId: data.id,
      scenario: data.scenario,
      language: data.language,
      config: data.config,
      resolvedName,
    });
  } catch (error) {
    console.error('Session join error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
