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

  // Thresholds
  THRESHOLD_IMBALANCE: number; // 0-1 (default: 0.6)
  THRESHOLD_REPETITION: number; // 0-1 (default: 0.5)
  THRESHOLD_STAGNATION_SECONDS: number; // seconds (default: 45)

  // Safety Limits
  TTS_RATE_LIMIT_SECONDS: number; // Min time between TTS (default: 20)
  MAX_INTERVENTIONS_PER_10MIN: number; // Hard limit (default: 5)
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

export interface SessionLog {
  metadata: SessionMetadata;
  activeConfig: ExperimentConfig;
  transcriptSegments: TranscriptSegment[];
  metricSnapshots: MetricSnapshot[];
  interventions: Intervention[];
  voiceSettings: VoiceSettings;
  modelRoutingLog: ModelRoutingLogEntry[];
  errors: Array<{ timestamp: number; message: string; context?: string }>;
}

// --- UI State ---

export interface SessionState {
  // Session info
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

