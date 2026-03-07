import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';
import { segmentRowToApp, interventionRowToApp } from '@/lib/supabase/converters';

// GET — Export full session log from Supabase
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  }

  const supabase = getServiceClient();

  // Fetch all data in parallel
  const [sessionRes, segmentsRes, snapshotsRes, interventionsRes, routingRes] = await Promise.all([
    supabase.from('sessions').select('*').eq('id', sessionId).single(),
    supabase.from('transcript_segments').select('*').eq('session_id', sessionId).order('timestamp'),
    supabase.from('metric_snapshots').select('*').eq('session_id', sessionId).order('timestamp'),
    supabase.from('interventions').select('*').eq('session_id', sessionId).order('timestamp'),
    supabase.from('model_routing_logs').select('*').eq('session_id', sessionId).order('timestamp'),
  ]);

  if (sessionRes.error || !sessionRes.data) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const session = sessionRes.data;

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
    transcriptSegments: (segmentsRes.data || []).map(segmentRowToApp),
    metricSnapshots: (snapshotsRes.data || []).map(s => ({
      ...s.metrics,
      inferredState: s.state_inference,
      timestamp: s.timestamp,
    })),
    interventions: (interventionsRes.data || []).map(interventionRowToApp),
    modelRoutingLog: (routingRes.data || []).map(r => ({
      id: r.id,
      timestamp: r.timestamp,
      task: r.route,
      model: r.model,
      latencyMs: r.latency_ms,
      success: !r.error,
      error: r.error,
    })),
  };

  return NextResponse.json(sessionLog);
}
