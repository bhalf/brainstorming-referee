// ============================================
// Core Types for UZH Brainstorming Webapp
// ============================================

import type { ModelTaskKey } from './config/modelRouting';

// --- Transcript ---

export interface TranscriptSegment {
  id: string;
  speaker: string; // Participant name or ID
  text: string;
  timestamp: number; // Unix timestamp (ms)
  isFinal: boolean; // false = interim (still being spoken)
  language?: string;
}

// --- Participation Metrics (v2) ---

export interface ParticipationMetrics {
  volumeShare: Record<string, number>;       // speaker → fraction of total words (sum=1)
  turnShare: Record<string, number>;         // speaker → fraction of total turns
  silentParticipantRatio: number;            // 0-1: fraction with <5% volume
  dominanceStreakScore: number;              // 0-1: consecutive-turn dominance
  participationRiskScore: number;            // 0-1: weighted composite
}

// --- Semantic Dynamics Metrics (v2) ---

export interface SemanticDynamicsMetrics {
  noveltyRate: number;                       // 0-1: fraction of novel segments
  clusterConcentration: number;              // 0-1: 1=all one cluster
  explorationElaborationRatio: number;       // 0-1: 1=pure exploration
  semanticExpansionScore: number;            // -1 to 1: positive=expanding
}

// --- Conversation State Inference (v2) ---

export type ConversationStateName =
  | 'HEALTHY_EXPLORATION'
  | 'HEALTHY_ELABORATION'
  | 'DOMINANCE_RISK'
  | 'CONVERGENCE_RISK'
  | 'STALLED_DISCUSSION';

export interface ConversationStateInference {
  state: ConversationStateName;
  confidence: number;                        // 0-1
  secondaryState: ConversationStateName | null;
  secondaryConfidence: number;
  enteredAt: number;                         // timestamp when this state was first inferred
  durationMs: number;                        // how long in this state
  criteriaSnapshot: Record<string, number>;  // key metric values that drove inference
}

// --- Intervention Intent (v2) ---

export type InterventionIntent =
  | 'PARTICIPATION_REBALANCING'
  | 'PERSPECTIVE_BROADENING'
  | 'REACTIVATION'
  | 'ALLY_IMPULSE';

// --- Engine Phase (v2) ---

export type EnginePhase = 'MONITORING' | 'CONFIRMING' | 'POST_CHECK' | 'COOLDOWN';

// --- Metrics ---

export interface SpeakingTimeDistribution {
  [speaker: string]: number; // seconds or character count as proxy
}

export interface MetricSnapshot {
  id: string;
  timestamp: number;
  speakingTimeDistribution: SpeakingTimeDistribution;
  participationImbalance: number; // 0-1, higher = more imbalanced
  semanticRepetitionRate: number; // 0-1, higher = more repetition
  stagnationDuration: number; // seconds since last "new" content
  diversityDevelopment: number; // 0-1, higher = more diverse
  windowStart: number; // timestamp of window start
  windowEnd: number; // timestamp of window end
  // v2 fields (optional for backward compat)
  participation?: ParticipationMetrics;
  semanticDynamics?: SemanticDynamicsMetrics;
  inferredState?: ConversationStateInference;
}

// --- Interventions ---

export type InterventionType = 'moderator' | 'ally';
export type InterventionTrigger =
  | 'imbalance'
  | 'repetition'
  | 'stagnation'
  | 'escalation'
  | 'manual';

export interface Intervention {
  id: string;
  timestamp: number;
  type: InterventionType;
  trigger: InterventionTrigger;
  text: string;
  spoken: boolean; // Was TTS used?
  metricsAtTrigger: MetricSnapshot | null;
  // v2 fields (optional for backward compat)
  intent?: InterventionIntent;
  triggeringState?: ConversationStateName;
  stateConfidence?: number;
  recoveryResult?: 'pending' | 'recovered' | 'not_recovered' | 'partial';
  recoveryCheckedAt?: number;
  modelUsed?: string;
  latencyMs?: number;
}

// --- Decision Engine State ---

export type DecisionState = 'OBSERVATION' | 'STABILIZATION' | 'ESCALATION';

export interface DecisionEngineState {
  currentState: DecisionState;
  lastInterventionTime: number | null;
  interventionCount: number; // within current 10-min window
  persistenceStartTime: number | null; // when threshold breach started
  postCheckStartTime: number | null; // when post-check period started
  cooldownUntil: number | null;
  metricsAtIntervention: MetricSnapshot | null; // state of metrics when intervention fired
  triggerAtIntervention: InterventionTrigger | null; // which metric caused the intervention
  // v2 fields (optional for backward compat)
  phase?: EnginePhase;
  confirmingSince?: number | null;
  confirmingState?: ConversationStateName | null;
  postCheckIntent?: InterventionIntent | null;
}

// --- Experiment Configuration ---

export type Scenario = 'baseline' | 'A' | 'B';

export interface ExperimentConfig {
  // Window & Analysis
  WINDOW_SECONDS: number; // Rolling window for metrics (default: 90)
  ANALYZE_EVERY_MS: number; // How often to compute metrics (default: 3000)

  // Trigger Timing
  PERSISTENCE_SECONDS: number; // How long threshold must be breached (default: 10)
  COOLDOWN_SECONDS: number; // Min time between interventions (default: 30)
  POST_CHECK_SECONDS: number; // Time to wait before checking improvement (default: 15)

  // Thresholds (v1 — kept for backward compat and legacy checkThresholds)
  THRESHOLD_IMBALANCE: number; // 0-1 (default: 0.6)
  THRESHOLD_REPETITION: number; // 0-1 (default: 0.5)
  THRESHOLD_STAGNATION_SECONDS: number; // seconds (default: 45)

  // Safety Limits
  TTS_RATE_LIMIT_SECONDS: number; // Min time between TTS (default: 20)
  MAX_INTERVENTIONS_PER_10MIN: number; // Hard limit (default: 5)

  // v2 thresholds
  THRESHOLD_SILENT_PARTICIPANT: number;       // 0.05 — volumeShare below this = silent
  THRESHOLD_PARTICIPATION_RISK: number;       // 0.55 — composite risk score
  THRESHOLD_NOVELTY_RATE: number;             // 0.3  — below this = low novelty
  THRESHOLD_CLUSTER_CONCENTRATION: number;    // 0.7  — above this = high convergence
  CONFIRMATION_SECONDS: number;               // 30   — how long risky state must persist before intervention
  RECOVERY_IMPROVEMENT_THRESHOLD: number;     // 0.15 — recovery score needed to count as recovered
}

// --- Model Routing Log ---

export interface ModelRoutingLogEntry {
  id: string;
  timestamp: number;
  task: ModelTaskKey;
  provider: string;
  model: string;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  success: boolean;
  error?: string;
  fallbackUsed: boolean;
  fallbackModel?: string;
}

// --- Session Log (for export) ---

export interface SessionMetadata {
  roomName: string;
  scenario: Scenario;
  startTime: number;
  endTime: number | null;
  language: string;
}

export interface VoiceSettings {
  voiceName: string;
  rate: number;
  pitch: number;
  volume: number;
  enabled: boolean;
}

// --- Session Summary (v2) ---

export interface SessionSummary {
  totalInterventionsByIntent: Record<string, number>;
  avgStateDurations: Record<string, number>;  // avg ms per state occurrence
  avgRecoveryByIntent: Record<string, { attempted: number; recovered: number; partial: number }>;
  totalSessionDurationMs: number;
  dominantState: ConversationStateName;
  stateTransitions: number;
}

export interface SessionLog {
  metadata: SessionMetadata;
  activeConfig: ExperimentConfig;
  transcriptSegments: TranscriptSegment[];
  metricSnapshots: MetricSnapshot[];
  interventions: Intervention[];
  voiceSettings: VoiceSettings;
  modelRoutingLog: ModelRoutingLogEntry[];
  errors: Array<{ timestamp: number; message: string; context?: string }>;
  // v2 fields (optional for backward compat)
  sessionSummary?: SessionSummary;
  promptVersion?: string;
}

// --- UI State ---

export interface SessionState {
  // Session info
  sessionId: string | null;
  roomName: string;
  scenario: Scenario;
  language: string;
  isActive: boolean;
  startTime: number | null;

  // Config
  config: ExperimentConfig;

  // Data
  transcriptSegments: TranscriptSegment[];
  metricSnapshots: MetricSnapshot[];
  interventions: Intervention[];

  decisionState: DecisionEngineState;

  // Voice
  voiceSettings: VoiceSettings;

  // Model routing
  modelRoutingLog: ModelRoutingLogEntry[];

  // Errors
  errors: Array<{ timestamp: number; message: string; context?: string }>;
}

