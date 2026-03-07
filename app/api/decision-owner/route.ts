import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';

const STALE_THRESHOLD_SECONDS = 10;

// POST — Claim or refresh ownership for the decision engine
export async function POST(request: NextRequest) {
  try {
    const { sessionId, clientId } = await request.json();

    if (!sessionId || !clientId) {
      return NextResponse.json({ error: 'sessionId and clientId required' }, { status: 400 });
    }

    const supabase = getServiceClient();

    // Atomic claim: only succeeds if no owner, we are the owner, or heartbeat is stale
    const { data, error } = await supabase
      .from('engine_state')
      .update({
        decision_owner: clientId,
        decision_heartbeat: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('session_id', sessionId)
      .or(`decision_owner.is.null,decision_owner.eq.${clientId},decision_heartbeat.lt.${new Date(Date.now() - STALE_THRESHOLD_SECONDS * 1000).toISOString()}`)
      .select('session_id')
      .maybeSingle();

    if (error) {
      console.error('Decision owner claim error:', error);
      return NextResponse.json({ error: 'Failed to claim ownership' }, { status: 500 });
    }

    if (data) {
      return NextResponse.json({ isOwner: true });
    }

    // No row updated — either the row doesn't exist or another owner is active
    // Check if engine_state row exists at all
    const { data: existing } = await supabase
      .from('engine_state')
      .select('session_id')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (!existing) {
      // No engine_state row yet — create one with us as owner
      const { error: insertError } = await supabase
        .from('engine_state')
        .insert({
          session_id: sessionId,
          decision_owner: clientId,
          decision_heartbeat: new Date().toISOString(),
        });

      if (insertError) {
        // Race: another client might have inserted first — try claim again
        const { data: retryData } = await supabase
          .from('engine_state')
          .update({
            decision_owner: clientId,
            decision_heartbeat: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('session_id', sessionId)
          .or(`decision_owner.is.null,decision_owner.eq.${clientId}`)
          .select('session_id')
          .maybeSingle();

        return NextResponse.json({ isOwner: !!retryData });
      }

      return NextResponse.json({ isOwner: true });
    }

    // Row exists but another owner is active
    return NextResponse.json({ isOwner: false });
  } catch (error) {
    console.error('Decision owner error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE — Release ownership
export async function DELETE(request: NextRequest) {
  try {
    const { sessionId, clientId } = await request.json();

    if (!sessionId || !clientId) {
      return NextResponse.json({ error: 'sessionId and clientId required' }, { status: 400 });
    }

    const supabase = getServiceClient();

    await supabase
      .from('engine_state')
      .update({
        decision_owner: null,
        decision_heartbeat: null,
        updated_at: new Date().toISOString(),
      })
      .eq('session_id', sessionId)
      .eq('decision_owner', clientId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Decision owner release error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
