import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';
import { generateSessionReport, generateLLMSessionSummary } from '@/lib/state/generateSessionReport';

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
      .select('id, host_identity, started_at, created_at')
      .eq('room_name', roomName)
      .is('ended_at', null)
      .limit(1)
      .single();

    if (existing) {
      // Auto-end stale sessions instead of blocking new session creation
      const sessionAge = Date.now() - new Date(existing.started_at || existing.created_at).getTime();
      if (sessionAge > MAX_SESSION_AGE_MS) {
        console.warn(`[Session] Auto-ending stale session ${existing.id} before creating new one (age: ${Math.round(sessionAge / 3600000)}h)`);
        await supabase
          .from('sessions')
          .update({ ended_at: new Date().toISOString() })
          .eq('id', existing.id);
      } else {
        return NextResponse.json(
          { error: 'active_session_exists', sessionId: existing.id, hostIdentity: existing.host_identity },
          { status: 409 }
        );
      }
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

// Maximum age for a session to be considered "active" (1 hour)
const MAX_SESSION_AGE_MS = 1 * 60 * 60 * 1000;

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

  // Auto-end stale sessions: if the session is older than 4 hours, it was
  // likely abandoned (browser closed without proper cleanup). End it and
  // return 404 so the caller creates a fresh session.
  const sessionAge = Date.now() - new Date(data.started_at || data.created_at).getTime();
  if (sessionAge > MAX_SESSION_AGE_MS) {
    console.warn(`[Session] Auto-ending stale session ${data.id} (age: ${Math.round(sessionAge / 3600000)}h)`);
    await supabase
      .from('sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', data.id);
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

// PATCH — End a session (also marks all participants as left + generates report)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
    }

    const supabase = getServiceClient();
    const now = new Date().toISOString();

    // Mark all remaining participants as left
    await supabase
      .from('session_participants')
      .update({ left_at: now })
      .eq('session_id', sessionId)
      .is('left_at', null);

    // End the session
    const { error } = await supabase
      .from('sessions')
      .update({ ended_at: now })
      .eq('id', sessionId);

    if (error) {
      console.error('Failed to end session:', error);
      return NextResponse.json({ error: 'Failed to end session' }, { status: 500 });
    }

    console.log(`[Session] Session ${sessionId} ended — all participants marked as left`);

    // Generate post-session report asynchronously (best-effort, don't block response)
    generateReport(supabase, sessionId).catch(err => {
      console.error('[Session] Failed to generate report:', err);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Session end error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generateReport(supabase: any, sessionId: string) {
  const [sessionRes, segmentsRes, snapshotsRes, interventionsRes, ideasRes, participantsRes] = await Promise.all([
    supabase.from('sessions').select('started_at, ended_at, language').eq('id', sessionId).single(),
    supabase.from('transcript_segments').select('speaker, text, timestamp').eq('session_id', sessionId).order('timestamp'),
    supabase.from('metric_snapshots').select('timestamp, metrics, state_inference').eq('session_id', sessionId).order('timestamp'),
    supabase.from('interventions').select('id, type, trigger, intent, message, timestamp, recovery_result, rule_violated, rule_evidence, rule_severity').eq('session_id', sessionId).order('timestamp'),
    supabase.from('ideas').select('author').eq('session_id', sessionId).eq('is_deleted', false),
    supabase.from('session_participants').select('identity, display_name, role').eq('session_id', sessionId),
  ]);

  if (!sessionRes.data) return;

  const session = sessionRes.data;
  const report = generateSessionReport(
    new Date(session.started_at).getTime(),
    session.ended_at ? new Date(session.ended_at).getTime() : null,
    segmentsRes.data ?? [],
    snapshotsRes.data ?? [],
    interventionsRes.data ?? [],
    ideasRes.data ?? [],
    participantsRes.data ?? [],
  );

  // Generate LLM narrative summary (best-effort)
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey && report.overview.totalSegments > 0) {
    try {
      const summary = await generateLLMSessionSummary(report, session.language ?? 'en-US', apiKey);
      report.llmSummary = summary;
      console.log(`[Session] LLM summary generated for session ${sessionId}`);
    } catch (err) {
      console.error('[Session] LLM summary failed (non-blocking):', err);
    }
  }

  await supabase
    .from('sessions')
    .update({ report: report as unknown as Record<string, unknown> })
    .eq('id', sessionId);

  console.log(`[Session] Report generated for session ${sessionId}`);
}

