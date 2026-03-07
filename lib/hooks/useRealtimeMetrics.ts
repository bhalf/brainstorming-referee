import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { snapshotRowToApp } from '@/lib/supabase/converters';
import { MetricSnapshot } from '@/lib/types';
import type { Database } from '@/lib/supabase/types';
import type { RealtimeChannel } from '@supabase/supabase-js';

type SnapshotRow = Database['public']['Tables']['metric_snapshots']['Row'];

interface UseRealtimeMetricsParams {
  sessionId: string | null;
  isActive: boolean;
  addMetricSnapshot: (snapshot: MetricSnapshot) => void;
}

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY_MS = 1000;

export function useRealtimeMetrics({
  sessionId,
  isActive,
  addMetricSnapshot,
}: UseRealtimeMetricsParams) {
  const addMetricSnapshotRef = useRef(addMetricSnapshot);
  useEffect(() => { addMetricSnapshotRef.current = addMetricSnapshot; }, [addMetricSnapshot]);

  const reconnectAttemptsRef = useRef(0);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isMountedRef = useRef(true);

  const subscribe = useCallback((sid: string) => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel: RealtimeChannel = supabase
      .channel(`metrics-${sid}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'metric_snapshots',
          filter: `session_id=eq.${sid}`,
        },
        (payload) => {
          const row = payload.new as SnapshotRow;
          const snapshot = snapshotRowToApp(row);
          addMetricSnapshotRef.current(snapshot);
          reconnectAttemptsRef.current = 0;
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          reconnectAttemptsRef.current = 0;
        } else if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && isMountedRef.current) {
          console.error(`Realtime metrics error (${status}):`, err);
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
