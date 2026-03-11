import { useCallback } from 'react';
import { useLatestRef } from '@/lib/hooks/useLatestRef';
import { useSupabaseChannel } from '@/lib/hooks/sync/useSupabaseChannel';
import { VoiceSettings } from '@/lib/types';
import { logSessionEvent } from '@/lib/services/eventService';
import { updateVoiceSettings as persistVoiceSettingsToServer } from '@/lib/services/sessionService';

/** Parameters for the realtime voice settings hook. */
interface UseRealtimeVoiceSettingsParams {
  sessionId: string | null;
  isActive: boolean;
  isHost: boolean;
  updateVoiceSettings: (updates: Partial<VoiceSettings>) => void;
}

/**
 * Synchronizes voice settings (TTS enabled, voice, speed) between the host and
 * participants via Supabase Realtime. The host persists changes to the sessions
 * table; participants subscribe to UPDATE events to receive them.
 *
 * @param params - Session ID, active/host flags, and voice settings dispatcher.
 * @returns A `persistVoiceSettings` function for the host to save changes.
 */
export function useRealtimeVoiceSettings({
  sessionId,
  isActive,
  isHost,
  updateVoiceSettings,
}: UseRealtimeVoiceSettingsParams) {
  const updateVoiceSettingsRef = useLatestRef(updateVoiceSettings);

  /** (Host only) Persists voice settings to Supabase and logs the event. */
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
