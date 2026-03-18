'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useSupabaseChannel, type RealtimeEventType } from '@/lib/hooks/sync/useSupabaseChannel';
import { getParticipants } from '@/lib/api-client';
import type { SessionParticipant } from '@/types';

/**
 * Subscribes to session participant updates via Supabase Realtime.
 * Also performs an initial load from the API to populate existing participants.
 */
export function useRealtimeParticipants(sessionId: string | null, myIdentity: string | null) {
  const [allParticipants, setAllParticipants] = useState<SessionParticipant[]>([]);

  // Initial load from API
  useEffect(() => {
    if (!sessionId) return;
    getParticipants(sessionId)
      .then(setAllParticipants)
      .catch((err) => console.error('Failed to load participants:', err));
  }, [sessionId]);

  const onPayload = useCallback((row: SessionParticipant, eventType: RealtimeEventType) => {
    if (eventType === 'INSERT') {
      setAllParticipants((prev) => {
        if (prev.some((p) => p.id === row.id)) return prev;
        return [...prev, row];
      });
    } else if (eventType === 'UPDATE') {
      setAllParticipants((prev) => prev.map((p) => (p.id === row.id ? row : p)));
    } else if (eventType === 'DELETE') {
      setAllParticipants((prev) => prev.filter((p) => p.id !== row.id));
    }
  }, []);

  useSupabaseChannel<SessionParticipant>({
    channelName: 'rt-participants',
    table: 'session_participants',
    sessionId,
    isActive: !!sessionId,
    event: '*',
    onPayload,
  });

  const participants = useMemo(
    () => allParticipants.filter((p) => p.is_active),
    [allParticipants],
  );

  const hostIdentity = useMemo(
    () => allParticipants.find((p) => p.role === 'host')?.livekit_identity ?? null,
    [allParticipants],
  );

  const myParticipant = useMemo(
    () => (myIdentity ? allParticipants.find((p) => p.livekit_identity === myIdentity) : null),
    [allParticipants, myIdentity],
  );

  const myRole = myParticipant?.role ?? null;
  const isHost = myRole === 'host';
  const isCoHost = myRole === 'co_host';

  return {
    participants,
    allParticipants,
    hostIdentity,
    myRole,
    isHost,
    isCoHost,
  };
}
