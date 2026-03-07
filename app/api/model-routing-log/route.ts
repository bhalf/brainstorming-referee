import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';
import { routingLogToInsert } from '@/lib/supabase/converters';

// POST — Persist a model routing log entry
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
