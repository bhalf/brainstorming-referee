// ============================================
// Core Types for UZH Brainstorming Webapp
// ============================================

import type { ModelTaskKey } from './config/modelRouting';

// --- Speaking Time (windowed audio tracking) ---

export interface SpeakingTimeDelta {
  speaker: string;
  seconds: number;  // duration of this speaking interval
  timestamp: number; // when this delta was recorded (ms)
}

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
  cumulativeParticipationImbalance: number;  // 0-1: Hoover index over longer window (600s)
}

// --- Semantic Dynamics Metrics (v2) ---

export interface SemanticDynamicsMetrics {
  noveltyRate: number;                       // 0-1: fraction of novel segments
  clusterConcentration: number;              // 0-1: 1=all one cluster
  explorationElaborationRatio: number;       // 0-1: 1=pure exploration
  semanticExpansionScore: number;            // -1 to 1: positive=expanding
  ideationalFluencyRate: number;             // substantive turns per minute (Osborn: quantity first)
  piggybackingScore: number;                 // 0-1: avg cross-speaker build-on similarity
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
  | 'ALLY_IMPULSE'
  | 'NORM_REINFORCEMENT';

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
  /** Whether metrics were computed using embeddings or Jaccard fallback. */
  metricsMethod?: 'embedding' | 'fallback';
}

// --- Interventions ---

export type InterventionType = 'moderator' | 'ally';
export type InterventionTrigger =
  | 'imbalance'
  | 'repetition'
  | 'stagnation'
  | 'escalation'
  | 'rule_violation'
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

export interface DecisionEngineState {
  phase: EnginePhase;
  lastInterventionTime: number | null;
  interventionCount: number; // legacy: kept for Supabase backward compat
  interventionTimestamps: number[]; // sliding window: timestamps of recent interventions
  postCheckStartTime: number | null; // when post-check period started
  cooldownUntil: number | null;
  metricsAtIntervention: MetricSnapshot | null; // state of metrics when intervention fired
  confirmingSince: number | null;
  confirmingState: ConversationStateName | null;
  postCheckIntent: InterventionIntent | null;
  lastRuleViolationTime: number | null; // when last rule violation intervention fired
}

// --- Experiment Configuration ---

export type Scenario = 'baseline' | 'A' | 'B';

export interface ExperimentConfig {
  // Window & Analysis
  WINDOW_SECONDS: number; // Rolling window for metrics (default: 180)
  ANALYZE_EVERY_MS: number; // How often to compute metrics (default: 5000)

  // Trigger Timing
  COOLDOWN_SECONDS: number; // Min time between interventions (default: 180)
  POST_CHECK_SECONDS: number; // Time to wait before checking improvement (default: 180)

  // Safety Limits
  TTS_RATE_LIMIT_SECONDS: number; // Min time between TTS (default: 30)
  MAX_INTERVENTIONS_PER_10MIN: number; // Hard limit (default: 3)

  // Brainstorming Rules
  RULE_CHECK_ENABLED: boolean; // Whether to check Osborn's brainstorming rules (default: true)
  RULE_VIOLATION_COOLDOWN_MS: number; // Cooldown after a rule violation intervention (default: 45000)

  // Thresholds
  THRESHOLD_SILENT_PARTICIPANT: number;       // 0.05 — volumeShare below this = silent
  THRESHOLD_PARTICIPATION_RISK: number;       // 0.55 — composite risk score
  THRESHOLD_NOVELTY_RATE: number;             // 0.3  — below this = low novelty
  THRESHOLD_CLUSTER_CONCENTRATION: number;    // 0.7  — above this = high convergence
  CONFIRMATION_SECONDS: number;               // 30   — how long risky state must persist before intervention
  RECOVERY_IMPROVEMENT_THRESHOLD: number;     // 0.15 — recovery score needed to count as recovered

  // Computation parameters (calibrated for embedding model)
  NOVELTY_COSINE_THRESHOLD: number;           // 0.65 — cosine similarity below this = novel segment
  CLUSTER_MERGE_THRESHOLD: number;            // 0.60 — cosine similarity above this = merge into cluster
  STAGNATION_NOVELTY_THRESHOLD: number;       // 0.70 — cosine similarity below this = new content (stagnation)
  EXPLORATION_COSINE_THRESHOLD: number;       // 0.55 — avg cosine similarity below this = exploration
  ELABORATION_COSINE_THRESHOLD: number;       // 0.70 — max cosine similarity above this = elaboration
  PARTICIPATION_RISK_WEIGHTS: [number, number, number, number]; // [hoover, silent, streak, turnHoover] must sum to 1
  CUMULATIVE_WINDOW_SECONDS: number; // Longer window for participation metrics (default: 600)

  // UI Visibility
  PARTICIPANT_VIEW_RESTRICTED: boolean; // Hide analytics/settings from non-host participants (default: false)
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

export type InterventionDisplayMode = 'visual' | 'voice' | 'both';

export interface VoiceSettings {
  voiceName: string;
  rate: number;
  pitch: number;
  volume: number;
  enabled: boolean;
  displayMode: InterventionDisplayMode;
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
  ideas?: Idea[];
  ideaConnections?: IdeaConnection[];
  voiceSettings: VoiceSettings;
  modelRoutingLog: ModelRoutingLogEntry[];
  errors: Array<{ timestamp: number; message: string; context?: string }>;
  // v2 fields (optional for backward compat)
  sessionSummary?: SessionSummary;
  promptVersion?: string;
}

// --- Ideas (Live Idea Board) ---

export type IdeaSource = 'auto' | 'manual';

export type IdeaType = 'idea' | 'category' | 'action_item';

export interface Idea {
  id: string;
  sessionId: string;
  title: string;
  description: string | null;
  author: string;
  source: IdeaSource;
  sourceSegmentIds: string[];
  positionX: number;
  positionY: number;
  color: string;
  isDeleted: boolean;
  createdAt: number;
  updatedAt: number;
  ideaType: IdeaType;
  parentId: string | null;
}

// --- Idea Connections ---

export type IdeaConnectionType = 'builds_on' | 'contrasts' | 'supports' | 'leads_to' | 'related';

export interface IdeaConnection {
  id: string;
  sessionId: string;
  sourceIdeaId: string;
  targetIdeaId: string;
  label: string | null;
  connectionType: IdeaConnectionType;
  createdAt: number;
}

// --- Intervention Annotations ---

export type AnnotationRelevance = 'relevant' | 'partially_relevant' | 'not_relevant';
export type AnnotationEffectiveness = 'effective' | 'partially_effective' | 'not_effective';

export interface InterventionAnnotation {
  id: string;
  interventionId: string;
  sessionId: string;
  rating: number | null;         // 1-5
  relevance: AnnotationRelevance | null;
  effectiveness: AnnotationEffectiveness | null;
  notes: string | null;
  annotator: string;
  createdAt: number;
  updatedAt: number;
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
  ideas: Idea[];
  ideaConnections: IdeaConnection[];

  decisionState: DecisionEngineState;

  // Voice
  voiceSettings: VoiceSettings;

  // Model routing
  modelRoutingLog: ModelRoutingLogEntry[];

  // Errors
  errors: Array<{ timestamp: number; message: string; context?: string }>;
}

