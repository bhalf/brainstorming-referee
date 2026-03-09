import { useCallback } from 'react';
import { useLatestRef } from '@/lib/hooks/useLatestRef';
import { useSupabaseChannel } from '@/lib/hooks/sync/useSupabaseChannel';
import { engineStateRowToApp } from '@/lib/supabase/converters';
import { DecisionEngineState } from '@/lib/types';
import type { Database } from '@/lib/supabase/types';

type EngineStateRow = Database['public']['Tables']['engine_state']['Row'];

interface UseRealtimeEngineStateParams {
  sessionId: string | null;
  isActive: boolean;
  /** Don't apply Realtime updates if we are the decision owner (we already have local state) */
  isDecisionOwner: boolean;
  updateDecisionState: (updates: Partial<DecisionEngineState>) => void;
}

/**
 * Subscribes to Supabase Realtime for engine_state UPDATE events.
 * This allows non-owner clients to see the current engine phase,
 * and supports recovery when decision ownership transfers.
 */
export function useRealtimeEngineState({
  sessionId,
  isActive,
  isDecisionOwner,
  updateDecisionState,
}: UseRealtimeEngineStateParams) {
  const isDecisionOwnerRef = useLatestRef(isDecisionOwner);

  const onPayload = useCallback((row: EngineStateRow) => {
    // Skip if we are the decision owner — we already have local state
    if (isDecisionOwnerRef.current) return;
    const stateUpdate = engineStateRowToApp(row);
    updateDecisionState(stateUpdate);
  }, [updateDecisionState]);

  useSupabaseChannel<EngineStateRow>({
    channelName: 'engine-state',
    table: 'engine_state',
    sessionId,
    isActive,
    event: 'UPDATE',
    onPayload,
  });
}
