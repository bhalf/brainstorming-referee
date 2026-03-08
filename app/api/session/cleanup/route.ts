import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';

// Stale participant threshold: 2 minutes without heartbeat
const STALE_PARTICIPANT_MS = 2 * 60 * 1000;
// Stale session threshold: 1 hour max session age as final safety net
const MAX_SESSION_AGE_MS = 1 * 60 * 60 * 1000;

/**
 * POST /api/session/cleanup
 * Finds and closes stale sessions + removes dead participants.
 * Can be called by a cron job, webhook, or manually.
 * Protected by a simple secret header for external callers.
 */
export async function POST(request: NextRequest) {
    // Optional: protect with a secret for cron callers
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get('authorization');
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        // Allow unauthenticated calls in development / when no secret is set
        if (cronSecret !== '') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
    }

    const supabase = getServiceClient();
    const now = new Date();
    const staleThreshold = new Date(now.getTime() - STALE_PARTICIPANT_MS).toISOString();
    const maxAgeThreshold = new Date(now.getTime() - MAX_SESSION_AGE_MS).toISOString();

    try {
        // 1. Mark stale participants as left
        const { data: staleParticipants } = await supabase
            .from('session_participants')
            .update({ left_at: now.toISOString() })
            .is('left_at', null)
            .lt('last_heartbeat', staleThreshold)
            .select('session_id');

        // 2. For each affected session, check if any active participants remain
        const affectedSessionIds = new Set(
            (staleParticipants || []).map(p => p.session_id)
        );

        let closedCount = 0;
        for (const sessionId of affectedSessionIds) {
            const { count } = await supabase
                .from('session_participants')
                .select('id', { count: 'exact', head: true })
                .eq('session_id', sessionId)
                .is('left_at', null);

            if (count === 0) {
                await supabase
                    .from('sessions')
                    .update({ ended_at: now.toISOString() })
                    .eq('id', sessionId)
                    .is('ended_at', null);
                closedCount++;
            }
        }

        // 3. Force-close very old sessions (safety net)
        const { data: ancientSessions } = await supabase
            .from('sessions')
            .update({ ended_at: now.toISOString() })
            .is('ended_at', null)
            .lt('started_at', maxAgeThreshold)
            .select('id');

        const ancientCount = ancientSessions?.length || 0;

        console.log(
            `[Cleanup] Marked ${staleParticipants?.length || 0} stale participants, ` +
            `closed ${closedCount} empty sessions, ` +
            `force-closed ${ancientCount} ancient sessions`
        );

        return NextResponse.json({
            staleParticipants: staleParticipants?.length || 0,
            closedSessions: closedCount,
            ancientSessionsClosed: ancientCount,
        });
    } catch (error) {
        console.error('[Cleanup] Error:', error);
        return NextResponse.json({ error: 'Cleanup failed' }, { status: 500 });
    }
}
