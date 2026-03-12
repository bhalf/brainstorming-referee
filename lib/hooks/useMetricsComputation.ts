import { useEffect, useRef, useReducer, MutableRefObject } from 'react';
import { TranscriptSegment, MetricSnapshot, ExperimentConfig, ConversationStateInference, SpeakingTimeDelta } from '@/lib/types';
import { computeMetricsAsync } from '@/lib/metrics/computeMetrics';
import { inferConversationState } from '@/lib/state/inferConversationState';
import { persistMetricsSnapshot } from '@/lib/services/metricsService';
import { logStateTransition } from '@/lib/services/eventService';
import { STAGGER_METRICS_MS } from '@/lib/decision/tickConfig';

/** Throttle for Supabase persistence: snapshots are stored at most once every 30s. */
const PERSIST_INTERVAL_MS = 30_000;

/** Parameters for the metrics computation hook. */
interface UseMetricsComputationParams {
  isActive: boolean;
  isDecisionOwner: boolean;
  sessionId: string | null;
  config: ExperimentConfig;
  transcriptSegmentsRef: MutableRefObject<TranscriptSegment[]>;
  speakingTimeRef: MutableRefObject<SpeakingTimeDelta[]>;
  /** Total number of participants in the room (from LiveKit), including self. */
  participantCountRef?: MutableRefObject<number>;
}

/** Consolidated state managed via useReducer to avoid multiple setState calls per tick. */
interface MetricsState {
  currentMetrics: MetricSnapshot | null;
  metricsHistory: MetricSnapshot[];
  stateHistory: ConversationStateInference[];
  lastComputedAt: number | null;
  computationError: string | null;
}

type MetricsAction =
  | { type: 'COMPUTATION_SUCCESS'; metrics: MetricSnapshot; inference: ConversationStateInference }
  | { type: 'COMPUTATION_ERROR'; error: string }
  | { type: 'RESET' };

/** Reducer for metrics state transitions (success appends to capped history arrays). */
function metricsReducer(state: MetricsState, action: MetricsAction): MetricsState {
  switch (action.type) {
    case 'COMPUTATION_SUCCESS':
      return {
        currentMetrics: action.metrics,
        // Keep the last 180 metric snapshots and 200 state inferences (rolling window)
        metricsHistory: [...state.metricsHistory.slice(-179), action.metrics],
        stateHistory: [...state.stateHistory.slice(-199), action.inference],
        lastComputedAt: Date.now(),
        computationError: null,
      };
    case 'COMPUTATION_ERROR':
      return { ...state, computationError: action.error };
    case 'RESET':
      return { currentMetrics: null, metricsHistory: [], stateHistory: [], lastComputedAt: null, computationError: null };
    default:
      return state;
  }
}

const INITIAL_METRICS_STATE: MetricsState = {
  currentMetrics: null,
  metricsHistory: [],
  stateHistory: [],
  lastComputedAt: null,
  computationError: null,
};

/**
 * Periodically computes brainstorming quality metrics (participation balance,
 * semantic dynamics, stagnation) and infers the conversation state. Only the
 * decision owner runs computation; snapshots are persisted to Supabase at
 * a throttled interval and broadcast to other participants via Realtime.
 *
 * @param params - Session state, config, and transcript/speaking-time refs.
 * @returns Current and historical metrics, state history, and refs for the decision engine.
 */
export function useMetricsComputation({
  isActive,
  isDecisionOwner,
  sessionId,
  config,
  transcriptSegmentsRef,
  speakingTimeRef,
  participantCountRef,
}: UseMetricsComputationParams) {
  const [state, dispatch] = useReducer(metricsReducer, INITIAL_METRICS_STATE);

  const isComputingRef = useRef(false);
  const sessionIdRef = useRef(sessionId);
  const currentMetricsRef = useRef<MetricSnapshot | null>(null);
  const metricsHistoryRef = useRef<MetricSnapshot[]>([]);
  const stateHistoryRef = useRef<ConversationStateInference[]>([]);
  const previousInferenceRef = useRef<ConversationStateInference | null>(null);
  const lastPersistRef = useRef<number>(0);

  // Keep refs in sync with reducer state (single effect)
  useEffect(() => {
    currentMetricsRef.current = state.currentMetrics;
    metricsHistoryRef.current = state.metricsHistory;
    stateHistoryRef.current = state.stateHistory;
  }, [state.currentMetrics, state.metricsHistory, state.stateHistory]);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // Metrics computation interval (async for embeddings)
  useEffect(() => {
    if (!isActive || !isDecisionOwner) return;

    const performComputation = async () => {
      if (isComputingRef.current) return;
      const segments = transcriptSegmentsRef.current;
      if (segments.length === 0) return;

      // Skip if no segments fall within the analysis window (prevents misleading resets at session end).
      const windowStart = Date.now() - config.WINDOW_SECONDS * 1000;
      const windowedCount = segments.filter(s => s.timestamp >= windowStart).length;
      if (windowedCount === 0) return;

      isComputingRef.current = true;

      try {
        const now = Date.now();

        const metrics = await computeMetricsAsync(
          segments,
          config,
          now,
          speakingTimeRef.current,
          metricsHistoryRef.current,
          participantCountRef?.current,
        );

        // Infer conversation state from the computed metrics
        const inference = inferConversationState(
          metrics,
          previousInferenceRef.current,
          now,
        );

        // Attach inferred state to the snapshot
        metrics.inferredState = inference;

        // Log state transition when conversation state changes
        const prevState = previousInferenceRef.current?.state ?? null;
        if (prevState !== inference.state) {
          logStateTransition(
            sessionIdRef.current,
            prevState ?? 'NONE',
            inference.state,
            inference.confidence,
            {
              participationRisk: metrics.participation?.participationRiskScore,
              novelty: metrics.semanticDynamics?.noveltyRate,
              stagnation: metrics.stagnationDuration,
              spread: metrics.semanticDynamics ? 1 - metrics.semanticDynamics.clusterConcentration : undefined,
            },
          );
        }

        previousInferenceRef.current = inference;

        // Single dispatch instead of 5 separate setState calls
        dispatch({ type: 'COMPUTATION_SUCCESS', metrics, inference });

        // Throttled persistence: persist at most once every 30s
        if (sessionIdRef.current && now - lastPersistRef.current >= PERSIST_INTERVAL_MS) {
          lastPersistRef.current = now;
          persistMetricsSnapshot(sessionIdRef.current, metrics);
        }
      } catch (error) {
        console.error('Metrics computation error:', error);
        dispatch({ type: 'COMPUTATION_ERROR', error: error instanceof Error ? error.message : 'Unknown error' });
      } finally {
        isComputingRef.current = false;
      }
    };

    // Trigger initial computation after stagger delay (coordinated with other ticks)
    const initialTimeout = setTimeout(performComputation, STAGGER_METRICS_MS);

    // Then schedule recurring compute interval
    const interval = setInterval(performComputation, config.ANALYZE_EVERY_MS);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [isActive, isDecisionOwner, config, participantCountRef, transcriptSegmentsRef, speakingTimeRef]);

  return {
    currentMetrics: state.currentMetrics,
    metricsHistory: state.metricsHistory,
    currentMetricsRef,
    metricsHistoryRef,
    stateHistory: state.stateHistory,
    stateHistoryRef,
    currentInferredState: state.currentMetrics?.inferredState ?? null,
    lastComputedAt: state.lastComputedAt,
    computationError: state.computationError,
  };
}
