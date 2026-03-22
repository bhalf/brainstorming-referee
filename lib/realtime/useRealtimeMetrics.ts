'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useSupabaseChannel } from '@/lib/hooks/sync/useSupabaseChannel';
import { supabase } from '@/lib/supabase/client';
import type { MetricSnapshot, ParticipationMetrics, SemanticDynamicsMetrics, InferredState } from '@/types';

const MAX_SNAPSHOTS = 720; // ~60 min at 5s intervals
const INITIAL_FETCH_LIMIT = 30; // Load last 30 snapshots on mount

/**
 * Raw row shape from Supabase (matches actual production DB columns).
 * Columns: id, session_id, computed_at, participation, semantic_dynamics,
 *          inferred_state, window_start, window_end, created_at
 */
interface RawMetricSnapshotRow {
  id: string;
  session_id: string;
  computed_at: string;
  participation: ParticipationMetrics | null;
  semantic_dynamics: SemanticDynamicsMetrics | null;
  inferred_state: InferredState | null;
  window_start: string | null;
  window_end: string | null;
  created_at: string;
}

function normalizeRow(raw: RawMetricSnapshotRow): MetricSnapshot {
  return {
    id: raw.id,
    session_id: raw.session_id,
    computed_at: raw.computed_at,
    window_start: raw.window_start ?? undefined,
    window_end: raw.window_end ?? undefined,
    participation: raw.participation as MetricSnapshot['participation'],
    semantic_dynamics: raw.semantic_dynamics as MetricSnapshot['semantic_dynamics'],
    inferred_state: raw.inferred_state as MetricSnapshot['inferred_state'],
  };
}

/**
 * Subscribes to metric snapshots via Supabase Realtime AND loads initial data.
 *
 * The Realtime subscription only catches NEW inserts. Without the initial fetch,
 * metrics won't show until the backend sends the next snapshot (which may never
 * happen if the session is idle or just started).
 */
export function useRealtimeMetrics(sessionId: string | null) {
  const [history, setHistory] = useState<MetricSnapshot[]>([]);
  const [latest, setLatest] = useState<MetricSnapshot | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initialFetchDone = useRef(false);

  // ── Initial data load ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId) return;
    initialFetchDone.current = false;

    supabase
      .from('metric_snapshots')
      .select('*')
      .eq('session_id', sessionId)
      .order('computed_at', { ascending: false })
      .limit(INITIAL_FETCH_LIMIT)
      .then(({ data, error }) => {
        if (error) {
          console.error('[rt-metrics] Initial fetch failed:', error.message, error.details);
          return;
        }
        if (!data || data.length === 0) {
          console.log('[rt-metrics] No existing metric_snapshots found for session', sessionId);
          return;
        }

        console.log(`[rt-metrics] Loaded ${data.length} initial snapshots`);

        // Data comes newest-first from the query, reverse to chronological
        const rows = [...(data as RawMetricSnapshotRow[])].reverse();
        const normalized = rows.map(row => normalizeRow(row));

        // Mark all as seen to prevent duplicates from Realtime
        for (const row of rows) seenIdsRef.current.add(row.id);

        // Use functional updates to merge with any realtime data that
        // arrived while the fetch was in flight (prevents overwriting)
        setHistory((prev) => {
          // Merge: fetched as base, append any realtime entries not in fetched set
          const fetchedIds = new Set(normalized.map((r) => r.id));
          const realtimeOnly = prev.filter((r) => !fetchedIds.has(r.id));
          return [...normalized, ...realtimeOnly];
        });
        // Merge all into latest (newest wins per field)
        const merged = normalized.reduce<MetricSnapshot>((acc, row) => ({
          ...acc,
          id: row.id,
          computed_at: row.computed_at,
          window_start: row.window_start ?? acc.window_start,
          window_end: row.window_end ?? acc.window_end,
          participation: row.participation ?? acc.participation,
          semantic_dynamics: row.semantic_dynamics ?? acc.semantic_dynamics,
          inferred_state: row.inferred_state ?? acc.inferred_state,
        }), normalized[0]);

        setLatest((prev) => {
          if (!prev) return merged;
          // If a realtime snapshot is newer, keep it
          if (prev.computed_at > merged.computed_at) return prev;
          return merged;
        });
        initialFetchDone.current = true;
      });
  }, [sessionId]);

  // ── Realtime subscription callback ─────────────────────────────────────────
  const onPayload = useCallback((rawRow: RawMetricSnapshotRow) => {
    if (seenIdsRef.current.has(rawRow.id)) return;
    seenIdsRef.current.add(rawRow.id);

    console.log('[rt-metrics] Realtime INSERT received:', rawRow.id);

    const row = normalizeRow(rawRow);

    setLatest((prev) => {
      if (!prev) return row;
      return {
        ...prev,
        id: row.id,
        computed_at: row.computed_at,
        window_start: row.window_start ?? prev.window_start,
        window_end: row.window_end ?? prev.window_end,
        participation: row.participation ?? prev.participation,
        semantic_dynamics: row.semantic_dynamics ?? prev.semantic_dynamics,
        inferred_state: row.inferred_state ?? prev.inferred_state,
      };
    });

    setHistory((prev) => {
      if (prev.length >= MAX_SNAPSHOTS) {
        return [...prev.slice(-MAX_SNAPSHOTS + 1), row];
      }
      return [...prev, row];
    });
  }, []);

  // ── Realtime subscription ──────────────────────────────────────────────────
  const { isSubscribed } = useSupabaseChannel<RawMetricSnapshotRow>({
    channelName: 'rt-metrics',
    table: 'metric_snapshots',
    sessionId,
    isActive: !!sessionId,
    event: 'INSERT',
    onPayload,
    onError: (msg) => console.error('[rt-metrics]', msg),
  });

  // Log subscription status for debugging
  useEffect(() => {
    if (sessionId) {
      console.log(`[rt-metrics] Subscription status: ${isSubscribed ? 'SUBSCRIBED' : 'NOT SUBSCRIBED'} for session ${sessionId}`);
    }
  }, [isSubscribed, sessionId]);

  return { latest, history, isSubscribed };
}
