'use client';

import { useState, useCallback, useRef } from 'react';
import { useSupabaseChannel } from '@/lib/hooks/sync/useSupabaseChannel';
import type { EngineState } from '@/types';

/**
 * Raw row shape from Supabase Realtime (matches DB columns).
 * Supports both old schema (active_intent, confirmation_start) and
 * new schema (current_state, phase_entered_at).
 */
interface RawEngineStateRow {
  session_id: string;
  phase: string;
  intervention_count: number;
  // New schema fields
  current_state?: string;
  phase_entered_at?: string;
  cooldown_until?: string;
  last_intervention_at?: string;
  // Old schema fields (fallbacks)
  active_intent?: string;
  confirmation_start?: number;
  last_intervention_time?: number;
  decision_owner?: string;
  updated_at?: string;
}

function normalizeRow(raw: RawEngineStateRow): EngineState {
  return {
    session_id: raw.session_id,
    phase: (raw.phase ?? 'MONITORING') as EngineState['phase'],
    current_state: (raw.current_state ?? 'HEALTHY_EXPLORATION') as EngineState['current_state'],
    phase_entered_at: raw.phase_entered_at ?? raw.updated_at ?? new Date().toISOString(),
    cooldown_until: raw.cooldown_until,
    intervention_count: raw.intervention_count ?? 0,
    last_intervention_at: raw.last_intervention_at,
  };
}

/**
 * Subscribes to engine state updates via Supabase Realtime.
 * The engine_state table uses session_id as PK — updates overwrite previous state.
 *
 * Deduplicates by comparing meaningful fields (phase + current_state + intervention_count)
 * to prevent unnecessary re-renders from no-op writes.
 */
export function useRealtimeEngineState(sessionId: string | null) {
  const [engineState, setEngineState] = useState<EngineState | null>(null);
  const prevKeyRef = useRef<string>('');

  const onPayload = useCallback((rawRow: RawEngineStateRow) => {
    const row = normalizeRow(rawRow);
    // Only update state if meaningful fields changed (prevents flicker from no-op writes)
    const key = `${row.phase}|${row.current_state}|${row.intervention_count}`;
    if (key === prevKeyRef.current) return;
    prevKeyRef.current = key;
    setEngineState(row);
  }, []);

  const { isSubscribed } = useSupabaseChannel<RawEngineStateRow>({
    channelName: 'rt-engine-state',
    table: 'engine_state',
    sessionId,
    isActive: !!sessionId,
    event: '*',
    filter: (sid) => `session_id=eq.${sid}`,
    onPayload,
  });

  return { engineState, isSubscribed };
}
