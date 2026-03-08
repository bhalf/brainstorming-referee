import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';

// POST — Create a new session (host only)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { roomName, scenario, language, config, hostIdentity } = body;

    if (!roomName || !hostIdentity) {
      return NextResponse.json({ error: 'roomName and hostIdentity required' }, { status: 400 });
    }

    const supabase = getServiceClient();

    // Check for existing active session with same room name
    const { data: existing } = await supabase
      .from('sessions')
      .select('id, host_identity')
      .eq('room_name', roomName)
      .is('ended_at', null)
      .limit(1)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'active_session_exists', sessionId: existing.id, hostIdentity: existing.host_identity },
        { status: 409 }
      );
    }

    const { data, error } = await supabase
      .from('sessions')
      .insert({
        room_name: roomName,
        scenario: scenario || 'A',
        language: language || 'en-US',
        config: config || {},
        host_identity: hostIdentity,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Failed to create session:', error);
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
    }

    // Initialize engine state for this session
    await supabase.from('engine_state').insert({ session_id: data.id });

    return NextResponse.json({ sessionId: data.id });
  } catch (error) {
    console.error('Session creation error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// GET — Get active session for a room
export async function GET(request: NextRequest) {
  const roomName = request.nextUrl.searchParams.get('room');

  if (!roomName) {
    return NextResponse.json({ error: 'room parameter required' }, { status: 400 });
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
    return NextResponse.json({ error: 'No active session found' }, { status: 404 });
  }

  return NextResponse.json({
    sessionId: data.id,
    roomName: data.room_name,
    scenario: data.scenario,
    language: data.language,
    config: data.config,
    hostIdentity: data.host_identity,
    startedAt: data.started_at,
  });
}

// PUT — Update session voice settings
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, voiceSettings } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
    }

    const supabase = getServiceClient();

    // Read current config, merge voice settings into it
    const { data: session, error: readError } = await supabase
      .from('sessions')
      .select('config')
      .eq('id', sessionId)
      .single();

    if (readError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const currentConfig = (session.config as Record<string, unknown>) || {};
    const updatedConfig = { ...currentConfig, voiceSettings };

    const { error } = await supabase
      .from('sessions')
      .update({ config: updatedConfig })
      .eq('id', sessionId);

    if (error) {
      console.error('Failed to update voice settings:', error);
      return NextResponse.json({ error: 'Failed to update voice settings' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Voice settings update error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PATCH — End a session
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
    }

    const supabase = getServiceClient();

    const { error } = await supabase
      .from('sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', sessionId);

    if (error) {
      console.error('Failed to end session:', error);
      return NextResponse.json({ error: 'Failed to end session' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Session end error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
