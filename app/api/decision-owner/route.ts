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

    // First, read the current engine state
    const { data: current, error: readError } = await supabase
      .from('engine_state')
      .select('session_id, decision_owner, decision_heartbeat')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (readError) {
      console.error('Decision owner read error:', readError);
      return NextResponse.json({ error: 'Failed to read engine state' }, { status: 500 });
    }

    const now = new Date();
    const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_SECONDS * 1000);

    if (!current) {
      // No engine_state row yet — create one with us as owner
      const { error: insertError } = await supabase
        .from('engine_state')
        .insert({
          session_id: sessionId,
          decision_owner: clientId,
          decision_heartbeat: now.toISOString(),
        });

      if (insertError) {
        // Race condition: another client might have inserted first
        // Read again and check if we can claim
        const { data: raceCheck } = await supabase
          .from('engine_state')
          .select('decision_owner, decision_heartbeat')
          .eq('session_id', sessionId)
          .maybeSingle();

        if (raceCheck && (
          !raceCheck.decision_owner ||
          raceCheck.decision_owner === clientId
        )) {
          const { data: claimed } = await supabase
            .from('engine_state')
            .update({
              decision_owner: clientId,
              decision_heartbeat: now.toISOString(),
              updated_at: now.toISOString(),
            })
            .eq('session_id', sessionId)
            .select('session_id')
            .maybeSingle();
          return NextResponse.json({ isOwner: !!claimed });
        }

        return NextResponse.json({ isOwner: false });
      }

      return NextResponse.json({ isOwner: true });
    }

    // Row exists — check if we can claim ownership
    const heartbeat = current.decision_heartbeat ? new Date(current.decision_heartbeat) : null;
    const canClaim =
      !current.decision_owner ||                        // No owner
      current.decision_owner === clientId ||             // We are the owner
      (heartbeat && heartbeat < staleThreshold);         // Heartbeat is stale

    if (!canClaim) {
      return NextResponse.json({ isOwner: false });
    }

    // Claim ownership
    const { data: updated, error: updateError } = await supabase
      .from('engine_state')
      .update({
        decision_owner: clientId,
        decision_heartbeat: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('session_id', sessionId)
      .select('session_id')
      .maybeSingle();

    if (updateError) {
      console.error('Decision owner claim error:', updateError);
      return NextResponse.json({ error: 'Failed to claim ownership' }, { status: 500 });
    }

    return NextResponse.json({ isOwner: !!updated });
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
