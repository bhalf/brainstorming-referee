'use client';

import { useState, useCallback } from 'react';
import { useSupabaseChannel } from '@/lib/hooks/sync/useSupabaseChannel';
import type { SessionSummary } from '@/types';

/**
 * Subscribes to the rolling session summary via Supabase Realtime.
 * The session_summary table uses session_id as PK — updates overwrite previous content.
 */
export function useRealtimeSummary(sessionId: string | null) {
  const [summary, setSummary] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const onPayload = useCallback((row: SessionSummary) => {
    setSummary(row.content);
    setUpdatedAt(row.updated_at);
  }, []);

  const { isSubscribed } = useSupabaseChannel<SessionSummary>({
    channelName: 'rt-summary',
    table: 'session_summary',
    sessionId,
    isActive: !!sessionId,
    event: '*',
    filter: (sid) => `session_id=eq.${sid}`,
    onPayload,
  });

  return { summary, updatedAt, isSubscribed };
}
