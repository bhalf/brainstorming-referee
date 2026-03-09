import { apiFireAndForget } from './apiClient';
import type { MetricSnapshot } from '@/lib/types';

// --- Service Functions ---

/** Persist a metrics snapshot to the backend */
export function persistMetricsSnapshot(
    sessionId: string,
    snapshot: MetricSnapshot,
): void {
    apiFireAndForget('/api/metrics/snapshot', {
        method: 'POST',
        body: JSON.stringify({ sessionId, snapshot }),
    }, 2);
}
