import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';
import { segmentRowToApp, interventionRowToApp, ideaRowToApp, connectionRowToApp } from '@/lib/supabase/converters';
import { validateSessionExists } from '@/lib/api/validateSession';

/**
 * GET /api/session/export?sessionId={id} — Export the complete session log.
 *
 * Fetches all session artifacts from Supabase in parallel (transcript segments,
 * metric snapshots, interventions, ideas, connections, annotations, routing
 * logs, errors, events) and assembles them into a single JSON export object
 * suitable for offline analysis and reproducibility.
 *
 * @param request.query.sessionId - UUID of the session to export.
 * @returns A comprehensive session log object with metadata, transcripts,
 *          metrics, interventions, ideas, connections, annotations, and events.
 */
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  }

  const validation = await validateSessionExists(sessionId);
  if (!validation.valid) return validation.response;

  const supabase = getServiceClient();

  // Fetch all data in parallel
  const [sessionRes, segmentsRes, snapshotsRes, interventionsRes, routingRes,
    ideasRes, connectionsRes, annotationsRes, errorsRes, eventsRes] = await Promise.all([
      supabase.from('sessions').select('*').eq('id', sessionId).single(),
      supabase.from('transcript_segments').select('*').eq('session_id', sessionId).order('timestamp'),
      supabase.from('metric_snapshots').select('*').eq('session_id', sessionId).order('timestamp'),
      supabase.from('interventions').select('*').eq('session_id', sessionId).order('timestamp'),
      supabase.from('model_routing_logs').select('*').eq('session_id', sessionId).order('timestamp'),
      supabase.from('ideas').select('*').eq('session_id', sessionId).eq('is_deleted', false).order('created_at'),
      supabase.from('idea_connections').select('*').eq('session_id', sessionId).order('created_at'),
      supabase.from('intervention_annotations').select('*').eq('session_id', sessionId).order('created_at'),
      supabase.from('session_errors').select('*').eq('session_id', sessionId).order('timestamp'),
      supabase.from('session_events').select('*').eq('session_id', sessionId).order('timestamp'),
    ]);

  if (sessionRes.error || !sessionRes.data) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const session = sessionRes.data;
  // Extract experiment metadata (prompt/engine version) embedded in the config JSON
  const config = (session.config || {}) as Record<string, unknown>;
  const experimentMeta = config._experimentMeta as Record<string, unknown> | undefined;

  const sessionLog = {
    metadata: {
      sessionId: session.id,
      roomName: session.room_name,
      scenario: session.scenario,
      startTime: new Date(session.started_at).getTime(),
      endTime: session.ended_at ? new Date(session.ended_at).getTime() : null,
      language: session.language,
    },
    activeConfig: session.config,
    promptVersion: experimentMeta?.promptVersion ?? null,
    engineVersion: experimentMeta?.engineVersion ?? null,
    // Convert DB rows to app-level types using shared converters
    transcriptSegments: (segmentsRes.data || []).map(segmentRowToApp),
    // Flatten metrics JSON column and attach state inference at top level
    metricSnapshots: (snapshotsRes.data || []).map(s => ({
      ...s.metrics,
      inferredState: s.state_inference,
      timestamp: s.timestamp,
    })),
    interventions: (interventionsRes.data || []).map(interventionRowToApp),
    ideas: (ideasRes.data || []).map(ideaRowToApp),
    ideaConnections: (connectionsRes.data || []).map(connectionRowToApp),
    modelRoutingLog: (routingRes.data || []).map(r => ({
      id: r.id,
      timestamp: r.timestamp,
      task: r.route,
      model: r.model,
      latencyMs: r.latency_ms,
      success: !r.error,
      error: r.error,
    })),
    annotations: (annotationsRes.data || []).map(a => ({
      id: a.id,
      interventionId: a.intervention_id,
      rating: a.rating,
      relevance: a.relevance,
      effectiveness: a.effectiveness,
      notes: a.notes,
      annotator: a.annotator,
      createdAt: a.created_at,
    })),
    errors: (errorsRes.data || []).map(e => ({
      timestamp: e.timestamp,
      message: e.message,
      context: e.context,
    })),
    events: (eventsRes.data || []).map(e => ({
      eventType: e.event_type,
      timestamp: e.timestamp,
      payload: e.payload,
      actor: e.actor,
    })),
    report: session.report ?? null,
  };

  return NextResponse.json(sessionLog);
}
