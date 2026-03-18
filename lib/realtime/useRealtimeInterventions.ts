'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useSupabaseChannel, type RealtimeEventType } from '@/lib/hooks/sync/useSupabaseChannel';
import { supabase } from '@/lib/supabase/client';
import type { Intervention } from '@/types';

const MAX_AGE_MS = 60_000; // Only show overlay for interventions newer than 60s

/**
 * Subscribes to new interventions via Supabase Realtime AND loads initial data.
 *
 * Shows the overlay IMMEDIATELY on INSERT (even without text) so the user sees
 * the intent/reason right away. When the UPDATE arrives with generated text,
 * the overlay updates in-place and the auto-dismiss timer resets.
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

        // Mark all as seen to prevent Realtime duplicates
        for (const row of data) seenIdsRef.current.add(row.id);

        // Reverse to chronological order for the list
        const sorted = [...(data as Intervention[])].reverse();
        setInterventions(sorted);
        // Don't set latestIntervention — old interventions shouldn't trigger overlay
      });
  }, [sessionId]);

  // ── Realtime subscription callback (INSERT + UPDATE) ──────────────────────
  const onPayload = useCallback((row: Intervention, eventType: RealtimeEventType) => {
    if (eventType === 'UPDATE') {
      // UPDATE: refresh existing intervention with new data (text, audio_duration)
      setInterventions((prev) =>
        prev.map((iv) => (iv.id === row.id ? row : iv))
      );

      // If overlay is currently showing this intervention, update it in-place
      // (this resets the auto-dismiss timer in InterventionOverlay)
      setLatestIntervention((prev) => {
        if (prev?.id === row.id) return row;
        // If no overlay showing but text just arrived, show it now
        if (!prev && row.text?.trim()) {
          const age = Date.now() - new Date(row.created_at).getTime();
          if (age < MAX_AGE_MS) return row;
        }
        return prev;
      });
      return;
    }

    // INSERT: new intervention — show overlay immediately
    if (seenIdsRef.current.has(row.id)) return;
    seenIdsRef.current.add(row.id);

    setInterventions((prev) => [...prev, row]);

    const age = Date.now() - new Date(row.created_at).getTime();
    if (age < MAX_AGE_MS) {
      setLatestIntervention(row);
    }
  }, []);

  const { isSubscribed } = useSupabaseChannel<Intervention>({
    channelName: 'rt-interventions',
    table: 'interventions',
    sessionId,
    isActive: !!sessionId,
    event: '*',
    onPayload,
  });

  /** Clear the latest intervention (e.g. after overlay dismiss) */
  const dismissLatest = useCallback(() => {
    setLatestIntervention(null);
  }, []);

  return { interventions, latestIntervention, dismissLatest, isSubscribed };
}
