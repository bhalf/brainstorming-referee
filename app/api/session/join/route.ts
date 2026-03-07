import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';

// POST — Join an existing session (participant)
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

    // Deduplicate participant name: check for existing speakers in this session
    let resolvedName = participantName || 'Participant';
    if (participantName) {
      const { data: existingSegments } = await supabase
        .from('transcript_segments')
        .select('speaker')
        .eq('session_id', data.id)
        .limit(500);

      if (existingSegments && existingSegments.length > 0) {
        const existingSpeakers = new Set(existingSegments.map(s => s.speaker));
        if (existingSpeakers.has(participantName)) {
          // Append incrementing suffix until unique
          let suffix = 2;
          while (existingSpeakers.has(`${participantName} (${suffix})`)) {
            suffix++;
          }
          resolvedName = `${participantName} (${suffix})`;
        }
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
