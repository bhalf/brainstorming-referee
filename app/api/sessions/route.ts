import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';

// Stale participant threshold: 2 minutes without heartbeat
const STALE_PARTICIPANT_MS = 2 * 60 * 1000;

// GET — List sessions with participant counts (includes inline cleanup)
export async function GET(request: NextRequest) {
  const limit = Number(request.nextUrl.searchParams.get('limit') || '20');

  const supabase = getServiceClient();
  const now = new Date();

  // --- Inline Cleanup: mark stale participants & auto-close empty sessions ---
  // This runs on every dashboard poll (~10s), replacing the need for a cron job
  try {
    const staleThreshold = new Date(now.getTime() - STALE_PARTICIPANT_MS).toISOString();

    const { data: staleParticipants } = await supabase
      .from('session_participants')
      .update({ left_at: now.toISOString() })
      .is('left_at', null)
      .lt('last_heartbeat', staleThreshold)
      .select('session_id');

    if (staleParticipants && staleParticipants.length > 0) {
      const affectedSessionIds = [...new Set(staleParticipants.map(p => p.session_id))];

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
        }
      }

      console.log(`[Sessions] Cleaned up ${staleParticipants.length} stale participants from ${affectedSessionIds.length} sessions`);
    }
  } catch (cleanupErr) {
    // Don't fail the request if cleanup errors — just log
    console.warn('[Sessions] Inline cleanup error:', cleanupErr);
  }

  // --- Fetch sessions ---
  const { data, error } = await supabase
    .from('sessions')
    .select('id, room_name, scenario, language, started_at, ended_at, last_heartbeat, host_identity')
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to list sessions:', error);
    return NextResponse.json({ error: 'Failed to list sessions' }, { status: 500 });
  }

  // Get active participant counts for all sessions in one query
  const sessionIds = (data || []).map(s => s.id);
  let participantCounts: Record<string, number> = {};

  if (sessionIds.length > 0) {
    // Get participants grouped by session
    const { data: participants } = await supabase
      .from('session_participants')
      .select('session_id')
      .in('session_id', sessionIds)
      .is('left_at', null);

    if (participants) {
      participantCounts = participants.reduce((acc, p) => {
        acc[p.session_id] = (acc[p.session_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
    }
  }

  const sessions = (data || []).map(s => ({
    id: s.id,
    roomName: s.room_name,
    scenario: s.scenario,
    language: s.language,
    startedAt: s.started_at,
    endedAt: s.ended_at,
    lastHeartbeat: s.last_heartbeat,
    hostIdentity: s.host_identity,
    participantCount: participantCounts[s.id] || 0,
  }));

  // Split into active and past
  const active = sessions.filter(s => !s.endedAt);
  const past = sessions.filter(s => s.endedAt);

  return NextResponse.json({ sessions, active, past });
}

