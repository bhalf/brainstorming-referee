import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';

// POST — Register a participant (join) or leave (for sendBeacon compatibility)
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { sessionId, identity, displayName, role, action } = body;

        // sendBeacon can only POST, so we support action: 'leave' here
        if (action === 'leave') {
            return handleLeave(sessionId, identity);
        }

        if (!sessionId || !identity || !displayName) {
            return NextResponse.json(
                { error: 'sessionId, identity, and displayName required' },
                { status: 400 }
            );
        }

        const supabase = getServiceClient();
        const now = new Date().toISOString();

        // Upsert: if they rejoin (e.g. page refresh), reset left_at and update heartbeat
        const { error } = await supabase
            .from('session_participants')
            .upsert(
                {
                    session_id: sessionId,
                    identity,
                    display_name: displayName,
                    role: role || 'participant',
                    joined_at: now,
                    last_heartbeat: now,
                    left_at: null,
                },
                { onConflict: 'session_id,identity' }
            );

        if (error) {
            console.error('[Participants] Join error:', error);
            return NextResponse.json({ error: 'Failed to register participant' }, { status: 500 });
        }

        // Also bump session-level heartbeat
        await supabase
            .from('sessions')
            .update({ last_heartbeat: now })
            .eq('id', sessionId);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[Participants] Join error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// PATCH — Heartbeat (keep participant alive)
export async function PATCH(request: NextRequest) {
    try {
        const { sessionId, identity } = await request.json();

        if (!sessionId || !identity) {
            return NextResponse.json({ error: 'sessionId and identity required' }, { status: 400 });
        }

        const supabase = getServiceClient();
        const now = new Date().toISOString();

        // Update participant heartbeat
        await supabase
            .from('session_participants')
            .update({ last_heartbeat: now })
            .eq('session_id', sessionId)
            .eq('identity', identity)
            .is('left_at', null);

        // Update session-level heartbeat
        await supabase
            .from('sessions')
            .update({ last_heartbeat: now })
            .eq('id', sessionId);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[Participants] Heartbeat error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// Shared leave logic (used by both DELETE and POST with action: 'leave')
async function handleLeave(sessionId: string, identity: string) {
    if (!sessionId || !identity) {
        return NextResponse.json({ error: 'sessionId and identity required' }, { status: 400 });
    }

    const supabase = getServiceClient();
    const now = new Date().toISOString();

    // Mark participant as left
    await supabase
        .from('session_participants')
        .update({ left_at: now })
        .eq('session_id', sessionId)
        .eq('identity', identity);

    // Check if any active participants remain
    const { count } = await supabase
        .from('session_participants')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', sessionId)
        .is('left_at', null);

    // Auto-close session if no participants remain
    if (count === 0) {
        console.log(`[Participants] No active participants in session ${sessionId} — auto-closing`);
        await supabase
            .from('sessions')
            .update({ ended_at: now })
            .eq('id', sessionId)
            .is('ended_at', null);
    }

    return NextResponse.json({ success: true, sessionEnded: count === 0 });
}

// DELETE — Leave (participant departs)
export async function DELETE(request: NextRequest) {
    try {
        const { sessionId, identity } = await request.json();
        return handleLeave(sessionId, identity);
    } catch (error) {
        console.error('[Participants] Leave error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
