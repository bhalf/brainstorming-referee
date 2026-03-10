import { useMemo, MutableRefObject } from 'react';
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
import { useLiveSummary } from '@/lib/hooks/useLiveSummary';
import type { LiveSummaryState } from '@/lib/hooks/useLiveSummary';
import { useLatestRef } from '@/lib/hooks/useLatestRef';

// --- Params ---

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

  // Refs from CallPage
  transcriptSegmentsRef: MutableRefObject<TranscriptSegment[]>;
  speakingTimeRef: MutableRefObject<SpeakingTimeDelta[]>;
  participantCountRef: MutableRefObject<number>;

  // TTS
  speak: (text: string) => boolean;
  isTTSSupported: boolean;

  // Broadcast callback for interventions via LiveKit DataChannel
  broadcastIntervention: (intervention: Intervention) => void;

  /** Shared dedup set to prevent double-TTS from DataChannel + Supabase Realtime */
  spokenInterventionIdsRef: MutableRefObject<Set<string>>;
}

// --- Return ---

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
}

// --- Hook ---

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
  addModelRoutingLog,
  addError,
  updateDecisionState,
  updateVoiceSettings,
  config,
  decisionState,
  voiceSettings,
  interventions,
  ideas,
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

  // Memoize config to prevent useMetricsComputation interval reset on unrelated state changes.
  // Uses JSON.stringify as deep-comparison dep since ExperimentConfig is a plain object.
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
  });

  // --- Realtime Interventions (Supabase -> all participants) ---
  useRealtimeInterventions({
    sessionId,
    isActive,
    isDecisionOwner,
    addIntervention,
    speak,
    voiceEnabled: voiceSettings.enabled,
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
    language,
    addIdea,
    addIdeaConnection,
    addModelRoutingLog,
    addError,
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
  };
}
