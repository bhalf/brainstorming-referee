import { useMemo, useRef, MutableRefObject } from 'react';
import {
  TranscriptSegment,
  MetricSnapshot,
  Intervention,
  ExperimentConfig,
  DecisionEngineState,
  Scenario,
  VoiceSettings,
  ModelRoutingLogEntry,
  Idea,
  IdeaConnection,
  ConversationStateInference,
  SpeakingTimeDelta,
} from '@/lib/types';
import { useRealtimeSegments } from '@/lib/hooks/useRealtimeSegments';
import { useRealtimeInterventions } from '@/lib/hooks/useRealtimeInterventions';
import { useRealtimeMetrics } from '@/lib/hooks/useRealtimeMetrics';
import { useDecisionOwnership } from '@/lib/hooks/useDecisionOwnership';
import { useRealtimeEngineState } from '@/lib/hooks/useRealtimeEngineState';
import { useMetricsComputation } from '@/lib/hooks/useMetricsComputation';
import { useDecisionLoop } from '@/lib/hooks/useDecisionLoop';
import { useRealtimeVoiceSettings } from '@/lib/hooks/useRealtimeVoiceSettings';
import { useRealtimeIdeas } from '@/lib/hooks/useRealtimeIdeas';
import { useRealtimeConnections } from '@/lib/hooks/useRealtimeConnections';
import { useIdeaExtraction } from '@/lib/hooks/useIdeaExtraction';
import { useConnectionReview } from '@/lib/hooks/useConnectionReview';
import { useLiveSummary } from '@/lib/hooks/useLiveSummary';
import type { LiveSummaryState } from '@/lib/hooks/useLiveSummary';
import { useGoalTracker } from '@/lib/hooks/useGoalTracker';
import type { GoalContext } from '@/lib/hooks/useGoalTracker';
import type { GoalTrackingState } from '@/lib/types';
import { useLatestRef } from '@/lib/hooks/useLatestRef';

// --- Params ---

/**
 * Parameters for the session orchestration hook.
 * Aggregates all session state, dispatch functions, refs, and callbacks needed
 * by the sub-hooks (realtime subscriptions, metrics, decision engine, etc.).
 */
interface UseSessionOrchestrationParams {
  // Session state
  isActive: boolean;
  sessionId: string | null;
  scenario: Scenario;
  language: string;
  isParticipant: boolean;

  // Dispatch functions from useSession
  addTranscriptSegment: (segment: TranscriptSegment) => void;
  addIntervention: (intervention: Intervention) => void;
  updateIntervention: (id: string, updates: Partial<Intervention>) => void;
  addMetricSnapshot: (snapshot: MetricSnapshot) => void;
  addIdea: (idea: Idea) => void;
  updateIdea: (id: string, updates: Partial<Idea>) => void;
  addIdeaConnection: (connection: IdeaConnection) => void;
  removeIdeaConnection: (id: string) => void;
  updateIdeaConnection: (id: string, updates: Partial<IdeaConnection>) => void;
  addModelRoutingLog: (entry: ModelRoutingLogEntry) => void;
  addError: (message: string, context?: string) => void;
  updateDecisionState: (updates: Partial<DecisionEngineState>) => void;
  updateVoiceSettings: (updates: Partial<VoiceSettings>) => void;

  // State values needed by sub-hooks
  config: ExperimentConfig;
  decisionState: DecisionEngineState;
  voiceSettings: VoiceSettings;
  interventions: Intervention[];
  ideas: Idea[];
  ideaConnections: IdeaConnection[];

  // Refs from CallPage
  transcriptSegmentsRef: MutableRefObject<TranscriptSegment[]>;
  speakingTimeRef: MutableRefObject<SpeakingTimeDelta[]>;
  participantCountRef: MutableRefObject<number>;

  // TTS
  speak: (text: string) => boolean;
  isTTSSupported: boolean;

  // Broadcast callback for interventions via LiveKit DataChannel
  broadcastIntervention: (intervention: Intervention) => void;

  /** Shared dedup set to prevent double-TTS from DataChannel + Supabase Realtime. */
  spokenInterventionIdsRef: MutableRefObject<Set<string>>;
}

// --- Return ---

/** Values and refs exposed by the session orchestration hook. */
interface UseSessionOrchestrationReturn {
  isDecisionOwner: boolean;
  currentMetrics: MetricSnapshot | null;
  metricsHistory: MetricSnapshot[];
  currentMetricsRef: MutableRefObject<MetricSnapshot | null>;
  metricsHistoryRef: MutableRefObject<MetricSnapshot[]>;
  stateHistoryRef: MutableRefObject<ConversationStateInference[]>;
  lastComputedAt: number | null;
  computationError: string | null;
  realtimeSyncConnected: boolean;
  persistVoiceSettings: (settings: Partial<VoiceSettings>) => void;
  liveSummary: LiveSummaryState;
  goalTracking: GoalTrackingState | null;
  getGoalContext: () => GoalContext | null;
}

// --- Hook ---

/**
 * Top-level orchestration hook that composes all session-related sub-hooks.
 * Wires up Supabase Realtime subscriptions (segments, interventions, metrics,
 * engine state, voice settings, ideas, connections), decision ownership negotiation,
 * metrics computation, the decision engine loop, idea extraction, and live summary.
 *
 * This is the single entry point mounted by the call page; individual sub-hooks
 * are never mounted directly by page components.
 *
 * @param params - Full session state, dispatch functions, refs, and callbacks.
 * @returns Decision ownership status, computed metrics, realtime sync state, and live summary.
 */
export function useSessionOrchestration({
  isActive,
  sessionId,
  scenario,
  language,
  isParticipant,
  addTranscriptSegment,
  addIntervention,
  updateIntervention,
  addMetricSnapshot,
  addIdea,
  updateIdea,
  addIdeaConnection,
  removeIdeaConnection,
  updateIdeaConnection,
  addModelRoutingLog,
  addError,
  updateDecisionState,
  updateVoiceSettings,
  config,
  decisionState,
  voiceSettings,
  interventions,
  ideas,
  ideaConnections,
  transcriptSegmentsRef,
  speakingTimeRef,
  participantCountRef,
  speak,
  isTTSSupported,
  broadcastIntervention,
  spokenInterventionIdsRef,
}: UseSessionOrchestrationParams): UseSessionOrchestrationReturn {

  // --- Realtime Segments (Supabase) ---
  const { isSubscribed: realtimeSyncConnected } = useRealtimeSegments({
    sessionId,
    isActive,
    addTranscriptSegment,
    onError: addError,
  });

  // Keep interventions ref in sync for decision engine
  const interventionsRef = useLatestRef(interventions);

  // --- Decision Ownership (Supabase-based lock: one decision engine per session) ---
  const { isDecisionOwner } = useDecisionOwnership({
    sessionId,
    isActive,
    isParticipant,
  });

  // --- Realtime Engine State (non-owners see phase transitions via Supabase Realtime) ---
  useRealtimeEngineState({
    sessionId,
    isActive,
    isDecisionOwner,
    updateDecisionState,
  });

  // --- Realtime Voice Settings (host -> participants via Supabase Realtime) ---
  const { persistVoiceSettings } = useRealtimeVoiceSettings({
    sessionId,
    isActive,
    isHost: !isParticipant,
    updateVoiceSettings,
  });

  // --- Realtime Metrics (all clients receive metric snapshots via Supabase Realtime) ---
  useRealtimeMetrics({
    sessionId,
    isActive,
    addMetricSnapshot,
  });

  // Memoize config using JSON.stringify for deep comparison to avoid resetting
  // the metrics computation interval on unrelated state changes.
  const configJson = JSON.stringify(config);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableConfig = useMemo(() => config, [configJson]);

  // --- Metrics Computation (only runs on the decision owner) ---
  const { currentMetrics, metricsHistory, currentMetricsRef, metricsHistoryRef, stateHistoryRef, lastComputedAt, computationError } = useMetricsComputation({
    isActive,
    isDecisionOwner,
    sessionId,
    config: stableConfig,
    transcriptSegmentsRef,
    speakingTimeRef,
    participantCountRef,
  });

  // Stable ref for goal context — populated after useGoalTracker mounts below.
  // useDecisionLoop reads this via useLatestRef inside the interval, so the value
  // is always current by the time the engine ticks.
  const getGoalContextRef = useRef<(() => GoalContext | null) | undefined>(undefined);

  // --- Decision Engine (only runs on the decision owner) ---
  useDecisionLoop({
    isActive,
    isDecisionOwner,
    sessionId,
    transcriptSegmentsRef,
    interventionsRef,
    metricsHistoryRef,
    currentMetricsRef,
    stateHistoryRef,
    decisionState,
    config: stableConfig,
    voiceSettings,
    scenario,
    language,
    speak,
    isTTSSupported,
    addIntervention,
    updateIntervention,
    addModelRoutingLog,
    addError,
    updateDecisionState,
    broadcastIntervention,
    getGoalContext: () => getGoalContextRef.current?.() ?? null,
  });

  // --- Realtime Interventions (Supabase -> all participants) ---
  useRealtimeInterventions({
    sessionId,
    isActive,
    isDecisionOwner,
    addIntervention,
    speak,
    voiceEnabled: voiceSettings.enabled,
    displayMode: voiceSettings.displayMode ?? 'both',
    isTTSSupported,
    spokenInterventionIdsRef,
  });

  // --- Realtime Ideas (Supabase -> all participants) ---
  useRealtimeIdeas({
    sessionId,
    isActive,
    addIdea,
    updateIdea,
  });

  // --- Realtime Idea Connections (Supabase -> all participants) ---
  useRealtimeConnections({
    sessionId,
    isActive,
    addConnection: addIdeaConnection,
  });

  // --- Idea Extraction (only runs on the decision owner) ---
  useIdeaExtraction({
    isActive,
    isDecisionOwner,
    sessionId,
    transcriptSegmentsRef,
    ideas,
    connections: ideaConnections,
    language,
    addIdea,
    addIdeaConnection,
    addModelRoutingLog,
    addError,
  });

  // --- Connection Review (periodic review of all connections, decision owner only) ---
  useConnectionReview({
    isActive,
    isDecisionOwner,
    sessionId,
    ideas,
    connections: ideaConnections,
    language,
    addIdeaConnection,
    removeIdeaConnection,
    updateIdeaConnection,
    addModelRoutingLog,
  });

  // --- Live Summary (decision owner generates, others receive via Supabase Realtime) ---
  const liveSummary = useLiveSummary({
    isActive,
    isDecisionOwner,
    sessionId,
    transcriptSegmentsRef,
    ideas,
    language,
    addModelRoutingLog,
    addError,
  });

  // --- Goal Tracking (decision owner generates assessments, others via Supabase Realtime) ---
  const { goalTracking, getGoalContext } = useGoalTracker({
    isActive,
    isDecisionOwner,
    sessionId,
    goals: stableConfig.conversationGoals ?? [],
    transcriptSegmentsRef,
    liveSummary,
    language,
    addModelRoutingLog,
    addError,
  });
  // Keep ref in sync so useDecisionLoop (mounted earlier) can access the latest getter
  getGoalContextRef.current = getGoalContext;

  return {
    isDecisionOwner,
    currentMetrics,
    metricsHistory,
    currentMetricsRef,
    metricsHistoryRef,
    stateHistoryRef,
    lastComputedAt,
    computationError,
    realtimeSyncConnected,
    persistVoiceSettings,
    liveSummary,
    goalTracking,
    getGoalContext,
  };
}
