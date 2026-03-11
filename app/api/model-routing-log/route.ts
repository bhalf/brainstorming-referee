import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';
import { routingLogToInsert } from '@/lib/supabase/converters';

/**
 * POST /api/model-routing-log — Persist a model routing log entry.
 *
 * Records which LLM model was used for a given task, its latency, token
 * usage, and whether a fallback was triggered. Called fire-and-forget after
 * each LLM invocation for observability and post-hoc analysis.
 *
 * @param request.body.sessionId - UUID of the owning session.
 * @param request.body.entry - Routing log entry with task, model, latencyMs, success, etc.
 * @returns {{ success: true }} on successful insert.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, entry } = body;

    if (!sessionId || !entry) {
      return NextResponse.json({ error: 'sessionId and entry required' }, { status: 400 });
    }

    const supabase = getServiceClient();
    const row = routingLogToInsert(entry, sessionId);

    const { error } = await supabase
      .from('model_routing_logs')
      .insert(row);

    if (error) {
      console.error('Failed to insert routing log:', error);
      return NextResponse.json({ error: 'Failed to insert routing log' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Routing log insert error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
