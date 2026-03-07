import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { interventionRowToApp } from '@/lib/supabase/converters';
import { Intervention } from '@/lib/types';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseRealtimeInterventionsParams {
  sessionId: string | null;
  isActive: boolean;
  addIntervention: (intervention: Intervention) => void;
  /** Optional: trigger TTS when a new intervention arrives (for participants) */
  speak?: (text: string) => boolean;
  voiceEnabled?: boolean;
  isTTSSupported?: boolean;
}

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY_MS = 1000;

/**
 * Subscribes to Supabase Realtime for interventions.
 * When the host creates an intervention and saves it to Supabase,
 * participants receive it via this channel and can display + speak it.
 * Dedup is handled by the SessionContext reducer (ADD_INTERVENTION checks ID).
 */
export function useRealtimeInterventions({
  sessionId,
  isActive,
  addIntervention,
  speak,
  voiceEnabled,
  isTTSSupported,
}: UseRealtimeInterventionsParams) {
  const addInterventionRef = useRef(addIntervention);
  const speakRef = useRef(speak);
  const voiceEnabledRef = useRef(voiceEnabled);
  const isTTSSupportedRef = useRef(isTTSSupported);

  useEffect(() => { addInterventionRef.current = addIntervention; }, [addIntervention]);
  useEffect(() => { speakRef.current = speak; }, [speak]);
  useEffect(() => { voiceEnabledRef.current = voiceEnabled; }, [voiceEnabled]);
  useEffect(() => { isTTSSupportedRef.current = isTTSSupported; }, [isTTSSupported]);

  const reconnectAttemptsRef = useRef(0);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isMountedRef = useRef(true);

  const subscribe = useCallback((sid: string) => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel: RealtimeChannel = supabase
      .channel(`interventions-${sid}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'interventions',
          filter: `session_id=eq.${sid}`,
        },
        (payload) => {
          const row = payload.new as Parameters<typeof interventionRowToApp>[0];
          const intervention = interventionRowToApp(row);

          addInterventionRef.current(intervention);
          reconnectAttemptsRef.current = 0;

          if (voiceEnabledRef.current && isTTSSupportedRef.current && speakRef.current) {
            speakRef.current(intervention.text);
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          reconnectAttemptsRef.current = 0;
        } else if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && isMountedRef.current) {
          console.error(`Realtime interventions error (${status}):`, err);
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
