'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSupabaseChannel, type RealtimeEventType } from '@/lib/hooks/sync/useSupabaseChannel';
import { supabase } from '@/lib/supabase/client';
import type { SessionGoal } from '@/types';

/**
 * Subscribes to session goal updates via Supabase Realtime AND loads initial data.
 *
 * Initial fetch ensures goals created during session setup are visible immediately.
 * Realtime subscription handles live updates (progress, status changes) during the session.
 */
export function useRealtimeGoals(sessionId: string | null) {
  const [goals, setGoals] = useState<SessionGoal[]>([]);
  const knownIdsRef = useRef<Set<string>>(new Set());

  // ── Initial data load ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId) return;
    knownIdsRef.current.clear();

    supabase
      .from('session_goals')
      .select('*')
      .eq('session_id', sessionId)
      .then(({ data, error }) => {
        if (error) {
          console.error('[rt-goals] Initial fetch failed:', error.message);
          return;
        }
        if (!data || data.length === 0) return;

        console.log(`[rt-goals] Loaded ${data.length} initial goals`);
        for (const row of data) knownIdsRef.current.add(row.id);
        setGoals(data as SessionGoal[]);
      });
  }, [sessionId]);

  // ── Realtime subscription callback ─────────────────────────────────────────
  const onPayload = useCallback((row: SessionGoal, eventType: RealtimeEventType) => {
    if (eventType === 'INSERT') {
      if (knownIdsRef.current.has(row.id)) return;
      knownIdsRef.current.add(row.id);
      setGoals((prev) => {
        if (prev.some((g) => g.id === row.id)) return prev;
        return [...prev, row];
      });
    } else if (eventType === 'UPDATE') {
      setGoals((prev) => prev.map((g) => (g.id === row.id ? row : g)));
    } else if (eventType === 'DELETE') {
      knownIdsRef.current.delete(row.id);
      setGoals((prev) => prev.filter((g) => g.id !== row.id));
    }
  }, []);

  const { isSubscribed } = useSupabaseChannel<SessionGoal>({
    channelName: 'rt-goals',
    table: 'session_goals',
    sessionId,
    isActive: !!sessionId,
    event: '*',
    onPayload,
  });

  return { goals, isSubscribed };
}
