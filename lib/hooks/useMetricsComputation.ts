import { useState, useEffect, useRef, MutableRefObject } from 'react';
import { TranscriptSegment, MetricSnapshot, ExperimentConfig, ConversationStateInference } from '@/lib/types';
import { computeMetricsAsync } from '@/lib/metrics/computeMetrics';
import { inferConversationState } from '@/lib/state/inferConversationState';

interface UseMetricsComputationParams {
  isActive: boolean;
  isParticipant: boolean;
  sessionId: string | null;
  config: ExperimentConfig;
  transcriptSegmentsRef: MutableRefObject<TranscriptSegment[]>;
  speakingTimeRef: MutableRefObject<Map<string, number>>;
  addMetricSnapshot: (snapshot: MetricSnapshot) => void;
}

export function useMetricsComputation({
  isActive,
  isParticipant,
  sessionId,
  config,
  transcriptSegmentsRef,
  speakingTimeRef,
  addMetricSnapshot,
}: UseMetricsComputationParams) {
  const [currentMetrics, setCurrentMetrics] = useState<MetricSnapshot | null>(null);
  const [metricsHistory, setMetricsHistory] = useState<MetricSnapshot[]>([]);
  const [stateHistory, setStateHistory] = useState<ConversationStateInference[]>([]);
  const isComputingRef = useRef(false);
  const sessionIdRef = useRef(sessionId);
  const currentMetricsRef = useRef<MetricSnapshot | null>(null);
  const metricsHistoryRef = useRef<MetricSnapshot[]>([]);
  const stateHistoryRef = useRef<ConversationStateInference[]>([]);
  const previousInferenceRef = useRef<ConversationStateInference | null>(null);

  // Keep refs in sync
  useEffect(() => {
    currentMetricsRef.current = currentMetrics;
  }, [currentMetrics]);

  useEffect(() => {
    metricsHistoryRef.current = metricsHistory;
  }, [metricsHistory]);

  useEffect(() => {
    stateHistoryRef.current = stateHistory;
  }, [stateHistory]);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // Metrics computation interval (async for embeddings)
  useEffect(() => {
    if (!isActive || isParticipant) return;

    const interval = setInterval(async () => {
      if (isComputingRef.current) return;
      const segments = transcriptSegmentsRef.current;
      if (segments.length === 0) return;
      isComputingRef.current = true;

      try {
        const now = Date.now();

        const metrics = await computeMetricsAsync(
          segments,
          config,
          now,
          speakingTimeRef.current,
          metricsHistoryRef.current,
        );

        // Infer conversation state from the computed metrics
        const inference = inferConversationState(
          metrics,
          previousInferenceRef.current,
          now,
        );

        // Attach inferred state to the snapshot
        metrics.inferredState = inference;
        previousInferenceRef.current = inference;

        setCurrentMetrics(metrics);
        setMetricsHistory(prev => [...prev.slice(-50), metrics]);
        setStateHistory(prev => [...prev.slice(-200), inference]);
        addMetricSnapshot(metrics);

        // Fire-and-forget persist to Supabase
        if (sessionIdRef.current) {
          fetch('/api/metrics/snapshot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: sessionIdRef.current, snapshot: metrics }),
          }).catch(() => {});
        }
      } catch (error) {
        console.error('Metrics computation error:', error);
      } finally {
        isComputingRef.current = false;
      }
    }, config.ANALYZE_EVERY_MS);

    return () => clearInterval(interval);
  }, [isActive, isParticipant, config, addMetricSnapshot, transcriptSegmentsRef, speakingTimeRef]);

  return {
    currentMetrics,
    metricsHistory,
    currentMetricsRef,
    metricsHistoryRef,
    stateHistory,
    stateHistoryRef,
    currentInferredState: currentMetrics?.inferredState ?? null,
  };
}
