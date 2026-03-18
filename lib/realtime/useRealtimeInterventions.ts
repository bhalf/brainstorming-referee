'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useSupabaseChannel } from '@/lib/hooks/sync/useSupabaseChannel';
import { supabase } from '@/lib/supabase/client';
import type { Intervention } from '@/types';

const MAX_AGE_MS = 30_000; // Only show overlay for interventions newer than 30s

/**
 * Subscribes to new interventions via Supabase Realtime AND loads initial data.
 *
 * Initial fetch populates the interventions list (for the tab) and marks IDs as
 * seen so that Realtime re-broadcasts don't cause duplicate overlays.
 */
export function useRealtimeInterventions(sessionId: string | null) {
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [latestIntervention, setLatestIntervention] = useState<Intervention | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());

  // ── Initial data load ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId) return;
    seenIdsRef.current.clear();

    supabase
      .from('interventions')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (error) {
          console.error('[rt-interventions] Initial fetch failed:', error.message);
          return;
        }
        if (!data || data.length === 0) return;

        console.log(`[rt-interventions] Loaded ${data.length} initial interventions`);

        // Mark all as seen to prevent Realtime duplicates
        for (const row of data) seenIdsRef.current.add(row.id);

        // Reverse to chronological order for the list
        const sorted = [...(data as Intervention[])].reverse();
        setInterventions(sorted);
        // Don't set latestIntervention — old interventions shouldn't trigger overlay
      });
  }, [sessionId]);

  // ── Realtime subscription callback ─────────────────────────────────────────
  const onPayload = useCallback((row: Intervention) => {
    if (seenIdsRef.current.has(row.id)) return;
    seenIdsRef.current.add(row.id);

    console.log('[rt-interventions] Realtime INSERT received:', row.id);

    // Only show overlay for recent interventions (guards against stale re-broadcasts)
    const age = Date.now() - new Date(row.created_at).getTime();
    if (age < MAX_AGE_MS) {
      setLatestIntervention(row);
    }

    setInterventions((prev) => [...prev, row]);
  }, []);

  const { isSubscribed } = useSupabaseChannel<Intervention>({
    channelName: 'rt-interventions',
    table: 'interventions',
    sessionId,
    isActive: !!sessionId,
    event: 'INSERT',
    onPayload,
  });

  /** Clear the latest intervention (e.g. after overlay dismiss) */
  const dismissLatest = useCallback(() => {
    setLatestIntervention(null);
  }, []);

  return { interventions, latestIntervention, dismissLatest, isSubscribed };
}
