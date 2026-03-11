import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';
import { snapshotToInsert } from '@/lib/supabase/converters';
import { validateSessionExists } from '@/lib/api/validateSession';

/**
 * POST /api/metrics/snapshot — Persist a computed metric snapshot.
 *
 * Called fire-and-forget by the client's metrics computation hook each time
 * new participation and semantic metrics are computed. The snapshot includes
 * the full metrics object and the inferred conversation state.
 *
 * @param request.body.sessionId - UUID of the owning session.
 * @param request.body.snapshot - Metrics snapshot object (participation scores,
 *        semantic dynamics, inferred state, timestamp).
 * @returns {{ success: true }} on successful insert.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, snapshot } = body;

    if (!sessionId || !snapshot) {
      return NextResponse.json({ error: 'sessionId and snapshot required' }, { status: 400 });
    }

    const validation = await validateSessionExists(sessionId);
    if (!validation.valid) return validation.response;

    const supabase = getServiceClient();
    const row = snapshotToInsert(snapshot, sessionId);

    const { error } = await supabase
      .from('metric_snapshots')
      .insert(row);

    if (error) {
      console.error('Failed to insert snapshot:', error);
      return NextResponse.json({ error: 'Failed to insert snapshot' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Snapshot insert error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
