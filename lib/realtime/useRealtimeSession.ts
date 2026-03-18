'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSupabaseChannel } from '@/lib/hooks/sync/useSupabaseChannel';
import { getSession } from '@/lib/api-client';
import type { Session } from '@/types';

/**
 * Subscribes to session row updates via Supabase Realtime.
 * Tracks idle and ended states for status banners.
 */
export function useRealtimeSession(sessionId: string | null) {
  const [session, setSession] = useState<Session | null>(null);

  // Initial load from API
  useEffect(() => {
    if (!sessionId) return;
    getSession(sessionId)
      .then(setSession)
      .catch((err) => console.error('Failed to load session:', err));
  }, [sessionId]);

  const onPayload = useCallback((row: Session) => {
    setSession(row);
  }, []);

  useSupabaseChannel<Session>({
    channelName: 'rt-session',
    table: 'sessions',
    sessionId,
    isActive: !!sessionId,
    event: '*',
    filter: (sid) => `id=eq.${sid}`,
    onPayload,
  });

  const isIdle = session?.status === 'idle';
  const isEnded = session?.status === 'ended';

  return { session, isIdle, isEnded };
}
