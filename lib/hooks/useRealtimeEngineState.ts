import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { engineStateRowToApp } from '@/lib/supabase/converters';
import { DecisionEngineState } from '@/lib/types';
import type { Database } from '@/lib/supabase/types';
import type { RealtimeChannel } from '@supabase/supabase-js';

type EngineStateRow = Database['public']['Tables']['engine_state']['Row'];

interface UseRealtimeEngineStateParams {
  sessionId: string | null;
  isActive: boolean;
  /** Don't apply Realtime updates if we are the decision owner (we already have local state) */
  isDecisionOwner: boolean;
  updateDecisionState: (updates: Partial<DecisionEngineState>) => void;
}

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY_MS = 1000;

/**
 * Subscribes to Supabase Realtime for engine_state UPDATE events.
 * This allows non-owner clients to see the current engine phase,
 * and supports recovery when decision ownership transfers.
 *
 * NOTE: Requires `alter publication supabase_realtime add table engine_state;`
 * to be run in Supabase SQL editor.
 */
export function useRealtimeEngineState({
  sessionId,
  isActive,
  isDecisionOwner,
  updateDecisionState,
}: UseRealtimeEngineStateParams) {
  const updateDecisionStateRef = useRef(updateDecisionState);
  const isDecisionOwnerRef = useRef(isDecisionOwner);
  useEffect(() => { updateDecisionStateRef.current = updateDecisionState; }, [updateDecisionState]);
  useEffect(() => { isDecisionOwnerRef.current = isDecisionOwner; }, [isDecisionOwner]);

  const reconnectAttemptsRef = useRef(0);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isMountedRef = useRef(true);

  const subscribe = useCallback((sid: string) => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel: RealtimeChannel = supabase
      .channel(`engine-state-${sid}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'engine_state',
          filter: `session_id=eq.${sid}`,
        },
        (payload) => {
          // Skip if we are the decision owner — we already have local state
          if (isDecisionOwnerRef.current) return;

          const row = payload.new as EngineStateRow;
          const stateUpdate = engineStateRowToApp(row);
          updateDecisionStateRef.current(stateUpdate);
          reconnectAttemptsRef.current = 0;
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          reconnectAttemptsRef.current = 0;
        } else if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && isMountedRef.current) {
          console.error(`Realtime engine state error (${status}):`, err);
          if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
            const delay = RECONNECT_BASE_DELAY_MS * Math.pow(2, reconnectAttemptsRef.current);
            reconnectAttemptsRef.current++;
            setTimeout(() => {
              if (isMountedRef.current) subscribe(sid);
            }, delay);
          }
        }
      });

    channelRef.current = channel;
  }, []);

  useEffect(() => {
    if (!sessionId || !isActive) return;

    isMountedRef.current = true;
    reconnectAttemptsRef.current = 0;
    subscribe(sessionId);

    return () => {
      isMountedRef.current = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [sessionId, isActive, subscribe]);
}
