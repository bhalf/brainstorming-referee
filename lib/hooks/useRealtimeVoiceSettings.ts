import { useEffect, useRef, useCallback } from 'react';
import { useLatestRef } from '@/lib/hooks/useLatestRef';
import { supabase } from '@/lib/supabase/client';
import { VoiceSettings } from '@/lib/types';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { logSessionEvent } from '@/lib/services/eventService';
import { updateVoiceSettings as persistVoiceSettingsToServer } from '@/lib/services/sessionService';

interface UseRealtimeVoiceSettingsParams {
  sessionId: string | null;
  isActive: boolean;
  isHost: boolean;
  updateVoiceSettings: (updates: Partial<VoiceSettings>) => void;
}

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY_MS = 1000;

/**
 * Subscribes to voice settings changes on the sessions table.
 * When the host updates voice settings, participants receive them via Realtime.
 * The host persists voice settings changes; participants only listen.
 */
export function useRealtimeVoiceSettings({
  sessionId,
  isActive,
  isHost,
  updateVoiceSettings,
}: UseRealtimeVoiceSettingsParams) {
  const updateVoiceSettingsRef = useLatestRef(updateVoiceSettings);

  const reconnectAttemptsRef = useRef(0);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isMountedRef = useRef(true);

  // Host: persist voice settings to Supabase on change
  const persistVoiceSettings = useCallback((settings: Partial<VoiceSettings>) => {
    if (!sessionId || !isHost) return;

    persistVoiceSettingsToServer(sessionId, settings).catch((err) => {
      console.error('Failed to persist voice settings:', err);
    });

    // Log event for session timeline
    logSessionEvent(sessionId, 'voice_settings_changed', 'Researcher', settings as Record<string, unknown>);
  }, [sessionId, isHost]);

  // Participants: subscribe to voice settings changes. subscribe is intentionally stable
  // (empty deps) — supabase client never changes. The subscribeRef indirection is not needed.
  const subscribe = useCallback((sid: string) => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel: RealtimeChannel = supabase
      .channel(`voice-settings-${sid}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sessions',
          filter: `id=eq.${sid}`,
        },
        (payload) => {
          const config = (payload.new as { config?: Record<string, unknown> }).config;
          if (config?.voiceSettings) {
            updateVoiceSettingsRef.current(config.voiceSettings as Partial<VoiceSettings>);
          }
          reconnectAttemptsRef.current = 0;
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          reconnectAttemptsRef.current = 0;
        } else if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && isMountedRef.current) {
          console.error(`Realtime voice settings error (${status}):`, err);
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- supabase client is stable

  useEffect(() => {
    // Only participants need to subscribe — the host is the source of truth
    if (!sessionId || !isActive || isHost) return;

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
  }, [sessionId, isActive, isHost, subscribe]);

  return { persistVoiceSettings };
}
