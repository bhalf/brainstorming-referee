import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';
import { validateSessionExists } from '@/lib/api/validateSession';

/**
 * PUT /api/engine-state — Upsert the decision engine state for a session.
 *
 * Persists the current phase (MONITORING, CONFIRMING, POST_CHECK, COOLDOWN),
 * active intent, confirmation timing, and intervention counters. Uses
 * ON CONFLICT on session_id so repeated writes are safe.
 *
 * @param request.body.sessionId - UUID of the session.
 * @param request.body.state - Engine state object with phase, postCheckIntent,
 *        confirmingSince, lastInterventionTime, and interventionCount.
 * @returns {{ success: true }} on successful upsert.
 */
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

/**
 * GET /api/engine-state?sessionId={id} — Retrieve the engine state.
 *
 * Used when a participant or host rejoins a session to restore the decision
 * engine to its last persisted phase.
 *
 * @param request.query.sessionId - UUID of the session.
 * @returns {{ state: object }} The raw engine_state row.
 */
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
