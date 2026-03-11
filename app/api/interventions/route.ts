import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';
import { interventionToInsert } from '@/lib/supabase/converters';
import { validateSessionExists } from '@/lib/api/validateSession';

/**
 * POST /api/interventions — Record a new intervention (idempotent).
 *
 * Persists a moderator or ally intervention together with the engine state
 * snapshot at the time of triggering and optional rule-violation metadata.
 * Uses upsert with ON CONFLICT on the intervention id.
 *
 * @param request.body.sessionId - UUID of the owning session.
 * @param request.body.intervention - Intervention object with id (string), text (string),
 *        and optional type ('moderator' | 'ally'), trigger, intent, etc.
 * @param request.body.engineState - Optional snapshot of the decision engine state at trigger time.
 * @param request.body.ruleViolation - Optional rule violation details (rule, evidence, severity).
 * @returns {{ success: true }} on successful insert.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, intervention, engineState, ruleViolation } = body;

    if (!sessionId || !intervention) {
      return NextResponse.json({ error: 'sessionId and intervention required' }, { status: 400 });
    }

    const validation = await validateSessionExists(sessionId);
    if (!validation.valid) return validation.response;

    // Validate intervention structure
    if (typeof intervention.id !== 'string' || typeof intervention.text !== 'string') {
      return NextResponse.json({ error: 'intervention must have id and text as strings' }, { status: 400 });
    }
    if (intervention.type && !['moderator', 'ally'].includes(intervention.type)) {
      return NextResponse.json({ error: 'intervention.type must be moderator or ally' }, { status: 400 });
    }

    const supabase = getServiceClient();
    const row = interventionToInsert(intervention, sessionId, engineState, ruleViolation ?? null);

    const { error } = await supabase
      .from('interventions')
      .upsert(row, { onConflict: 'id', ignoreDuplicates: true });

    if (error) {
      console.error('Failed to insert intervention:', error);
      return NextResponse.json({ error: 'Failed to insert intervention' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Intervention insert error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * GET /api/interventions?sessionId={id} — Fetch all interventions for a session.
 *
 * Returns interventions ordered by timestamp, used for initial hydration
 * when a participant joins mid-session.
 *
 * @param request.query.sessionId - UUID of the session.
 * @returns {{ interventions: object[] }} Array of raw intervention rows.
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
    .from('interventions')
    .select('*')
    .eq('session_id', sessionId)
    .order('timestamp', { ascending: true });

  if (error) {
    console.error('Failed to fetch interventions:', error);
    return NextResponse.json({ error: 'Failed to fetch interventions' }, { status: 500 });
  }

  return NextResponse.json({ interventions: data || [] });
}

/**
 * PATCH /api/interventions — Update an intervention's delivery or recovery status.
 *
 * Supports partial updates to status, delivered_at, recovery_result,
 * recovery_checked_at, and rule violation fields. Used by the decision
 * engine's post-check phase to record whether the intervention led to recovery.
 *
 * @param request.body.id - UUID of the intervention to update.
 * @param request.body.status - Optional new status string.
 * @param request.body.delivered_at - Optional delivery timestamp.
 * @param request.body.recovery_result - Optional recovery outcome.
 * @param request.body.recovery_checked_at - Optional timestamp of the recovery check.
 * @param request.body.rule_violated - Optional violated rule identifier.
 * @param request.body.rule_evidence - Optional evidence string.
 * @param request.body.rule_severity - Optional severity level.
 * @returns {{ success: true }} on successful update.
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status, delivered_at, recovery_result, recovery_checked_at,
      rule_violated, rule_evidence, rule_severity } = body;

    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    const supabase = getServiceClient();

    const updates: Record<string, unknown> = {};
    if (status) updates.status = status;
    if (delivered_at) updates.delivered_at = delivered_at;
    if (recovery_result !== undefined) updates.recovery_result = recovery_result;
    if (recovery_checked_at !== undefined) updates.recovery_checked_at = recovery_checked_at;
    if (rule_violated !== undefined) updates.rule_violated = rule_violated;
    if (rule_evidence !== undefined) updates.rule_evidence = rule_evidence;
    if (rule_severity !== undefined) updates.rule_severity = rule_severity;

    const { error } = await supabase
      .from('interventions')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('Failed to update intervention:', error);
      return NextResponse.json({ error: 'Failed to update intervention' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Intervention update error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
