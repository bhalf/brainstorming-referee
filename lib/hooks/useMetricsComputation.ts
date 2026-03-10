import { useEffect, useRef, useReducer, MutableRefObject } from 'react';
import { TranscriptSegment, MetricSnapshot, ExperimentConfig, ConversationStateInference, SpeakingTimeDelta } from '@/lib/types';
import { computeMetricsAsync } from '@/lib/metrics/computeMetrics';
import { inferConversationState } from '@/lib/state/inferConversationState';
import { persistMetricsSnapshot } from '@/lib/services/metricsService';
import { STAGGER_METRICS_MS } from '@/lib/decision/tickConfig';

// --- Persistence throttle: persist at most once every 30s ---
const PERSIST_INTERVAL_MS = 30_000;

interface UseMetricsComputationParams {
  isActive: boolean;
  isDecisionOwner: boolean;
  sessionId: string | null;
  config: ExperimentConfig;
  transcriptSegmentsRef: MutableRefObject<TranscriptSegment[]>;
  speakingTimeRef: MutableRefObject<SpeakingTimeDelta[]>;
  /** Total number of participants in the room (from LiveKit), including self */
  participantCountRef?: MutableRefObject<number>;
}

// Consolidated state to avoid multiple setState calls per computation
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

function metricsReducer(state: MetricsState, action: MetricsAction): MetricsState {
  switch (action.type) {
    case 'COMPUTATION_SUCCESS':
      return {
        currentMetrics: action.metrics,
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
