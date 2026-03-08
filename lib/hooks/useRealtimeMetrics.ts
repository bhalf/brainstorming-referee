import { useCallback } from 'react';
import { useSupabaseChannel } from '@/lib/hooks/sync/useSupabaseChannel';
import { snapshotRowToApp } from '@/lib/supabase/converters';
import { MetricSnapshot } from '@/lib/types';
import type { Database } from '@/lib/supabase/types';

type SnapshotRow = Database['public']['Tables']['metric_snapshots']['Row'];

interface UseRealtimeMetricsParams {
  sessionId: string | null;
  isActive: boolean;
  addMetricSnapshot: (snapshot: MetricSnapshot) => void;
}

export function useRealtimeMetrics({
  sessionId,
  isActive,
  addMetricSnapshot,
}: UseRealtimeMetricsParams) {
  const onPayload = useCallback((row: SnapshotRow) => {
    const snapshot = snapshotRowToApp(row);
    addMetricSnapshot(snapshot);
  }, [addMetricSnapshot]);

  useSupabaseChannel<SnapshotRow>({
    channelName: 'metrics',
    table: 'metric_snapshots',
    sessionId,
    isActive,
    event: 'INSERT',
    onPayload,
  });
}
