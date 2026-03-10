import { useCallback } from 'react';
import { useLatestRef } from '@/lib/hooks/useLatestRef';
import { useSupabaseChannel } from '@/lib/hooks/sync/useSupabaseChannel';
import { VoiceSettings } from '@/lib/types';
import { logSessionEvent } from '@/lib/services/eventService';
import { updateVoiceSettings as persistVoiceSettingsToServer } from '@/lib/services/sessionService';

interface UseRealtimeVoiceSettingsParams {
  sessionId: string | null;
  isActive: boolean;
  isHost: boolean;
  updateVoiceSettings: (updates: Partial<VoiceSettings>) => void;
}

/**
 * Subscribes to voice settings changes on the sessions table.
 * When the host updates voice settings, participants receive them via Realtime.
 * The host persists voice settings changes; participants only listen.
 *
 * Now uses the generic useSupabaseChannel hook instead of custom subscription logic.
 */
export function useRealtimeVoiceSettings({
  sessionId,
  isActive,
  isHost,
  updateVoiceSettings,
}: UseRealtimeVoiceSettingsParams) {
  const updateVoiceSettingsRef = useLatestRef(updateVoiceSettings);

  // Host: persist voice settings to Supabase on change
  const persistVoiceSettings = useCallback((settings: Partial<VoiceSettings>) => {
    if (!sessionId || !isHost) return;

    persistVoiceSettingsToServer(sessionId, settings).catch((err) => {
      console.error('Failed to persist voice settings:', err);
    });

    // Log event for session timeline
    logSessionEvent(sessionId, 'voice_settings_changed', 'Researcher', settings as Record<string, unknown>);
  }, [sessionId, isHost]);

  const onPayload = useCallback((row: Record<string, unknown>) => {
    const config = (row as { config?: Record<string, unknown> }).config;
    if (config?.voiceSettings) {
      updateVoiceSettingsRef.current(config.voiceSettings as Partial<VoiceSettings>);
    }
  }, []);

  // Only participants need to subscribe — the host is the source of truth.
  // When isHost is true, isActive is overridden to false so the channel is not created.
  useSupabaseChannel<Record<string, unknown>>({
    channelName: 'voice-settings',
    table: 'sessions',
    sessionId,
    isActive: isActive && !isHost,
    event: 'UPDATE',
    filter: (sid) => `id=eq.${sid}`,
    onPayload,
  });

  return { persistVoiceSettings };
}
