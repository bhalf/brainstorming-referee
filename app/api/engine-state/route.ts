import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';
import { validateSessionExists } from '@/lib/api/validateSession';

// PUT — Upsert engine state for a session
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, state } = body;

    if (!sessionId || !state) {
      return NextResponse.json({ error: 'sessionId and state required' }, { status: 400 });
    }

    const validation = await validateSessionExists(sessionId);
    if (!validation.valid) return validation.response;

    const supabase = getServiceClient();

    const { error } = await supabase
      .from('engine_state')
      .upsert({
        session_id: sessionId,
        phase: state.phase || 'MONITORING',
        active_intent: state.postCheckIntent ?? null,
        confirmation_start: state.confirmingSince ?? null,
        last_intervention_time: state.lastInterventionTime ?? null,
        intervention_count: state.interventionCount ?? 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'session_id' });

    if (error) {
      console.error('Failed to upsert engine state:', error);
      return NextResponse.json({ error: 'Failed to upsert engine state' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Engine state upsert error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// GET — Retrieve engine state (for rejoin)
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  }

  const validation = await validateSessionExists(sessionId);
  if (!validation.valid) return validation.response;

  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('engine_state')
    .select('*')
    .eq('session_id', sessionId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Engine state not found' }, { status: 404 });
  }

  return NextResponse.json({ state: data });
}
