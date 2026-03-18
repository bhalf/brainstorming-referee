/**
 * Shared TypeScript types for the brainstorming frontend.
 * All types match the Supabase DB schema (snake_case).
 * The frontend is read-only — data arrives via Supabase Realtime.
 *
 * Source of truth: bigpicture.md §4 (DB Schema) + §7-9 (Metric JSONB)
 */

// --- Feature Keys ---

export type FeatureKey = 'metrics' | 'ideas' | 'summary' | 'goals' | 'rules';

// --- Session ---

export interface Session {
  id: string;
  workspace_id?: string;
  created_by?: string;
  title: string;
  status: 'scheduled' | 'active' | 'idle' | 'ended';
  join_code: string;
  livekit_room: string;
  moderation_level: ModerationLevel;
  enabled_features: FeatureKey[];
  language: string;
  config: Record<string, unknown>;
  planned_duration_minutes: number | null;
  agent_id?: string;
  idle_since_at: string | null;
  started_at?: string;
  ended_at?: string;
  created_at: string;
}

// --- Session Participant ---

export type ParticipantRole = 'host' | 'co_host' | 'participant';

export interface SessionParticipant {
  id: string;
  session_id: string;
  display_name: string;
  livekit_identity: string;
  role: ParticipantRole;
  is_active: boolean;
  joined_at: string;
  left_at: string | null;
}

// --- Moderation Level ---

export type ModerationLevel = 'none' | 'moderation' | 'moderation_ally';

// --- Transcript ---

export interface TranscriptSegment {
  id: string;
  session_id: string;
  speaker_identity: string;
  speaker_name: string;
  text: string;
  is_final: boolean;
  language?: string;
  created_at: string;
}

// --- Metrics (bigpicture.md §7 + §8) ---

/** 5 conversation states from bigpicture.md §9 */
export type ConversationState =
  | 'HEALTHY_EXPLORATION'
  | 'HEALTHY_ELABORATION'
  | 'DOMINANCE_RISK'
  | 'CONVERGENCE_RISK'
  | 'STALLED_DISCUSSION';

/** Session-wide cumulative participation counters (never windowed) */
export interface CumulativeParticipation {
  volume_share: Record<string, number>;
  turn_share: Record<string, number>;
  balance: number;
  total_words: number;
  total_turns: number;
}

/** metric_snapshots.participation JSONB — bigpicture.md §7.7 */
export interface ParticipationMetrics {
  volume_share: Record<string, number>;
  turn_share: Record<string, number>;
  gini_imbalance: number;
  turn_share_gini: number;
  hoover_imbalance: number;
  turn_hoover: number;
  balance: number;
  silent_participant_ratio: number;
  dominance_streak_score: number;
  participation_risk_score: number;
  long_term_balance: number;
  cumulative_imbalance: number;
  ideational_fluency_rate: number;
  cumulative?: CumulativeParticipation;
}

/** metric_snapshots.semantic_dynamics JSONB — bigpicture.md §8.8 */
export interface SemanticDynamicsMetrics {
  novelty_rate: number;
  cluster_concentration: number;
  exploration_elaboration_ratio: number;
  semantic_expansion_score: number;
  cluster_count: number;
  has_embeddings: boolean;
  stagnation_duration_seconds: number;
  diversity: number;
  piggybacking_score: number;
}

/** metric_snapshots.inferred_state JSONB — bigpicture.md §9.2 */
export interface InferredState {
  state: ConversationState;
  confidence: number;
  secondary_state: ConversationState | null;
  secondary_confidence: number;
  criteria_snapshot: Record<string, number>;
}

/** metric_snapshots row — bigpicture.md §4 */
export interface MetricSnapshot {
  id: string;
  session_id: string;
  computed_at: string;
  participation: ParticipationMetrics;
  semantic_dynamics: SemanticDynamicsMetrics;
  inferred_state: InferredState;
  window_start?: string;
  window_end?: string;
  created_at?: string;
}

// --- Engine State (bigpicture.md §10) ---

export type EnginePhase = 'MONITORING' | 'CONFIRMING' | 'POST_CHECK' | 'COOLDOWN';

export interface EngineState {
  session_id: string;
  phase: EnginePhase;
  current_state: ConversationState;
  phase_entered_at: string;
  cooldown_until?: string;
  intervention_count: number;
  last_intervention_at?: string;
}

// --- Interventions (bigpicture.md §10.3 + §4) ---

export type InterventionIntent =
  | 'PARTICIPATION_REBALANCING'
  | 'PERSPECTIVE_BROADENING'
  | 'REACTIVATION'
  | 'ALLY_IMPULSE'
  | 'NORM_REINFORCEMENT'
  | 'GOAL_REFOCUS';

export type InterventionTrigger = 'state' | 'rule_violation' | 'goal_refocus';

export interface Intervention {
  id: string;
  session_id: string;
  intent: InterventionIntent;
  trigger: InterventionTrigger;
  text: string;
  audio_duration_ms?: number;
  metrics_at_intervention?: Record<string, unknown>;
  recovery_score?: number;
  recovered?: boolean;
  created_at: string;
}

// --- Ideas (bigpicture.md §4) ---

export type IdeaType = 'brainstorming_idea' | 'ally_intervention' | 'action_item';

export type NoveltyRole = 'seed' | 'extension' | 'variant' | 'tangent';

export type SourceContext = 'organic' | 'moderator_triggered' | 'ally_triggered';

export type GoalRelevance = 'direct_answer' | 'partial' | 'tangential';

export interface Idea {
  id: string;
  session_id: string;
  title: string;
  description?: string;
  author_name?: string;
  idea_type: IdeaType;
  novelty_role?: NoveltyRole;
  source_context?: SourceContext;
  linked_goal_id?: string;
  goal_relevance?: GoalRelevance;
  goal_quality?: number;
  position_x?: number;
  position_y?: number;
  color?: string;
  is_deleted: boolean;
  created_at: string;
}

export type ConnectionType = 'builds_on' | 'supports' | 'leads_to' | 'contrasts' | 'related' | 'contains' | 'refines';

export interface IdeaConnection {
  id: string;
  session_id: string;
  source_idea_id: string;
  target_idea_id: string;
  connection_type: ConnectionType;
  created_at: string;
}

// --- Goals (bigpicture.md §4) ---

export type GoalStatus = 'not_started' | 'mentioned' | 'partially_covered' | 'covered';

export interface SessionGoal {
  id: string;
  session_id: string;
  parent_id: string | null;
  label: string;
  description?: string;
  status: GoalStatus;
  heat_score: number;
  coverage_score: number;
  sort_order: number;
  notes?: string;
  updated_at: string;
}

// --- Topics (auto-generated subdimensions) ---

export interface SessionTopic {
  id: string;
  session_id: string;
  core_question: string;
  subdimension: string;
  description?: string;
  coverage: number;
  segment_count: number;
  updated_at: string;
}

// --- Summary ---

export interface SessionSummary {
  session_id: string;
  content: string;
  updated_at: string;
}

// --- Workspace ---

export type WorkspaceMemberRole = 'owner' | 'admin' | 'member';

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  plan: 'trial' | 'starter' | 'professional' | 'academic' | 'enterprise';
  owner_id: string;
  max_sessions_per_month: number;
  sessions_this_month: number;
  max_participants_per_session: number;
  billing_email: string | null;
  created_at: string;
}

export interface WorkspaceMember {
  workspace_id: string;
  user_id: string;
  display_name: string;
  email: string;
  role: WorkspaceMemberRole;
  joined_at: string;
}

export interface WorkspaceInvite {
  id: string;
  workspace_id: string;
  email: string;
  role: WorkspaceMemberRole;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

// --- Session Export (full post-session data) ---

export interface SessionExport {
  session: Session;
  participants: SessionParticipant[];
  segments: TranscriptSegment[];
  metrics: MetricSnapshot[];
  interventions: Intervention[];
  ideas: Idea[];
  connections: IdeaConnection[];
  goals: SessionGoal[];
  topics: SessionTopic[];
  engine_state: EngineState | null;
  summary: SessionSummary | null;
}

// --- Create Session Request ---

/** What the UI form produces — sent directly to backend */
export interface CreateSessionFormData {
  title: string;
  language: string;
  moderation_level: ModerationLevel;
  features: FeatureKey[];
  goals?: {
    label: string;
    description?: string;
    subgoals?: { label: string; description?: string }[];
  }[];
  planned_duration_minutes?: number;
  config?: Record<string, unknown>;
}

// --- Join Session Response ---

export interface JoinSessionResponse {
  session: Session;
  participant: SessionParticipant;
  livekit_token: string;
}
