import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';
import { generateSessionReport, generateLLMSessionSummary } from '@/lib/state/generateSessionReport';

/**
 * POST /api/session — Create a new brainstorming session.
 *
 * Only the host calls this endpoint. If an active session with the same room
 * name already exists and is still fresh (< 1 hour), a 409 conflict is returned.
 * Stale sessions are auto-ended to allow seamless recreation.
 *
 * @param request.body.roomName - Unique LiveKit room identifier.
 * @param request.body.scenario - Experiment scenario ('baseline' | 'A' | 'B'). Defaults to 'A'.
 * @param request.body.language - BCP-47 locale for transcription/prompts. Defaults to 'en-US'.
 * @param request.body.config - Optional experiment configuration overrides.
 * @param request.body.hostIdentity - Display name / identity of the host.
 * @returns {{ sessionId: string }} The newly created session's UUID.
 */
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
      .select('id, host_identity, started_at, created_at, last_heartbeat')
      .eq('room_name', roomName)
      .is('ended_at', null)
      .limit(1)
      .single();

    if (existing) {
      // Auto-end stale sessions instead of blocking new session creation
      const lastActivity = existing.last_heartbeat || existing.started_at || existing.created_at;
      const sessionAge = Date.now() - new Date(lastActivity).getTime();
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

/**
 * GET /api/session?room={roomName} — Retrieve the active session for a room.
 *
 * Returns the most recently created non-ended session for the given room name.
 * If the session's last activity exceeds MAX_SESSION_AGE_MS it is auto-ended
 * and a 404 is returned so the caller can create a fresh session.
 *
 * @param request.query.room - The LiveKit room name to look up.
 * @returns Session metadata including sessionId, scenario, language, config, and hostIdentity.
 */
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

  // Auto-end stale sessions: if no heartbeat for >1 hour, it was
  // likely abandoned (browser closed without proper cleanup). End it and
  // return 404 so the caller creates a fresh session.
  const lastActivity = data.last_heartbeat || data.started_at || data.created_at;
  const sessionAge = Date.now() - new Date(lastActivity).getTime();
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

/**
 * PUT /api/session — Update session voice (TTS) settings.
 *
 * Merges the provided voice settings into the session's existing config JSON
 * column so other config fields are preserved.
 *
 * @param request.body.sessionId - UUID of the session to update.
 * @param request.body.voiceSettings - Partial voice settings object to merge.
 * @returns {{ success: true }} on success.
 */
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

/**
 * PATCH /api/session — End an active session.
 *
 * Marks all remaining participants as left, sets the session's ended_at
 * timestamp, and kicks off an asynchronous post-session report generation
 * (including an optional LLM narrative summary).
 *
 * @param request.body.sessionId - UUID of the session to end.
 * @returns {{ success: true }} immediately; the report generates in the background.
 */
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

/**
 * Generates a post-session analytics report and persists it to the sessions table.
 *
 * Fetches all session artifacts (segments, snapshots, interventions, ideas,
 * participants) in parallel, computes a deterministic statistical report, and
 * optionally appends an LLM-generated narrative summary.
 */
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

