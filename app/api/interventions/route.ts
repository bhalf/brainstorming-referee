import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';
import { interventionToInsert } from '@/lib/supabase/converters';

// POST — Insert a new intervention
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, intervention, engineState } = body;

    if (!sessionId || !intervention) {
      return NextResponse.json({ error: 'sessionId and intervention required' }, { status: 400 });
    }

    const supabase = getServiceClient();
    const row = interventionToInsert(intervention, sessionId, engineState);

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

// PATCH — Update intervention status
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status, delivered_at } = body;

    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    const supabase = getServiceClient();

    const updates: Record<string, unknown> = {};
    if (status) updates.status = status;
    if (delivered_at) updates.delivered_at = delivered_at;

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
