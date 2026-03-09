import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';
import { interventionToInsert } from '@/lib/supabase/converters';

// POST — Insert a new intervention
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, intervention, engineState, ruleViolation } = body;

    if (!sessionId || !intervention) {
      return NextResponse.json({ error: 'sessionId and intervention required' }, { status: 400 });
    }

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

// GET — Fetch interventions for a session (for initial load on join)
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  }

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

// PATCH — Update intervention status / recovery result
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
