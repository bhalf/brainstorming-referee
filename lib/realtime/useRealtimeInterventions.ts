'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useSupabaseChannel, type RealtimeEventType } from '@/lib/hooks/sync/useSupabaseChannel';
import { supabase } from '@/lib/supabase/client';
import type { Intervention } from '@/types';

const MAX_AGE_MS = 30_000; // Only show overlay for interventions newer than 30s

/**
 * Subscribes to new interventions via Supabase Realtime AND loads initial data.
 *
 * Listens for both INSERT and UPDATE events so that:
 * - INSERT with empty text (from decision engine) is tracked but not shown as overlay
 * - UPDATE with text (from moderator/ally after LLM) triggers the overlay
 * This ensures the overlay text and TTS audio arrive close together.
 */
export function useRealtimeInterventions(sessionId: string | null) {
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [latestIntervention, setLatestIntervention] = useState<Intervention | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  /** IDs that were inserted with empty text — waiting for UPDATE with content */
  const pendingIdsRef = useRef<Set<string>>(new Set());

  // ── Initial data load ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId) return;
    seenIdsRef.current.clear();
    pendingIdsRef.current.clear();

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

  // ── Realtime subscription callback (INSERT + UPDATE) ──────────────────────
  const onPayload = useCallback((row: Intervention, eventType: RealtimeEventType) => {
    const hasText = !!row.text?.trim();

    if (eventType === 'UPDATE') {
      // UPDATE: refresh existing intervention with new data (text, audio_duration)
      setInterventions((prev) =>
        prev.map((iv) => (iv.id === row.id ? row : iv))
      );

      // If this was pending (empty-text INSERT) and now has text → show overlay
      if (hasText && pendingIdsRef.current.has(row.id)) {
        pendingIdsRef.current.delete(row.id);
        const age = Date.now() - new Date(row.created_at).getTime();
        if (age < MAX_AGE_MS) {
          console.log('[rt-interventions] UPDATE with text → showing overlay:', row.id);
          setLatestIntervention(row);
        }
      }
      return;
    }

    // INSERT: new intervention
    if (seenIdsRef.current.has(row.id)) return;
    seenIdsRef.current.add(row.id);

    if (hasText) {
      // INSERT already has text → show overlay immediately
      console.log('[rt-interventions] INSERT with text:', row.id);
      const age = Date.now() - new Date(row.created_at).getTime();
      if (age < MAX_AGE_MS) {
        setLatestIntervention(row);
      }
      setInterventions((prev) => [...prev, row]);
    } else {
      // INSERT with empty text → track as pending, wait for UPDATE
      console.log('[rt-interventions] INSERT pending (no text yet):', row.id);
      pendingIdsRef.current.add(row.id);
      setInterventions((prev) => [...prev, row]);
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
