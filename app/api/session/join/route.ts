import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';

// POST — Join an existing session (participant)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { roomName } = body;

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

    return NextResponse.json({
      sessionId: data.id,
      scenario: data.scenario,
      language: data.language,
      config: data.config,
    });
  } catch (error) {
    console.error('Session join error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
