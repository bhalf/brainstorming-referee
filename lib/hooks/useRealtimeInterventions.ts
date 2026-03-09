import { useCallback } from 'react';
import { useLatestRef } from '@/lib/hooks/useLatestRef';
import { useSupabaseChannel } from '@/lib/hooks/sync/useSupabaseChannel';
import { interventionRowToApp } from '@/lib/supabase/converters';
import { Intervention } from '@/lib/types';

interface UseRealtimeInterventionsParams {
  sessionId: string | null;
  isActive: boolean;
  isDecisionOwner: boolean;
  addIntervention: (intervention: Intervention) => void;
  /** Optional: trigger TTS when a new intervention arrives (for participants) */
  speak?: (text: string) => boolean;
  voiceEnabled?: boolean;
  isTTSSupported?: boolean;
}

/**
 * Subscribes to Supabase Realtime for interventions.
 * When the host creates an intervention and saves it to Supabase,
 * participants receive it via this channel and can display + speak it.
 * Dedup is handled by the SessionContext reducer (ADD_INTERVENTION checks ID).
 */
export function useRealtimeInterventions({
  sessionId,
  isActive,
  isDecisionOwner,
  addIntervention,
  speak,
  voiceEnabled,
  isTTSSupported,
}: UseRealtimeInterventionsParams) {
  const isDecisionOwnerRef = useLatestRef(isDecisionOwner);
  const speakRef = useLatestRef(speak);
  const voiceEnabledRef = useLatestRef(voiceEnabled);
  const isTTSSupportedRef = useLatestRef(isTTSSupported);

  const onPayload = useCallback((row: Parameters<typeof interventionRowToApp>[0]) => {
    const intervention = interventionRowToApp(row);
    addIntervention(intervention);

    // Only speak on non-owner clients — the decision owner already
    // triggers TTS in useDecisionLoop when generating the intervention.
    if (!isDecisionOwnerRef.current && voiceEnabledRef.current && isTTSSupportedRef.current && speakRef.current) {
      speakRef.current(intervention.text);
    }
  }, [addIntervention]);

  useSupabaseChannel({
    channelName: 'interventions',
    table: 'interventions',
    sessionId,
    isActive,
    event: 'INSERT',
    onPayload,
  });
}
