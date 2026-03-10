import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';
import { snapshotToInsert } from '@/lib/supabase/converters';
import { validateSessionExists } from '@/lib/api/validateSession';

// POST — Persist a metric snapshot
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
