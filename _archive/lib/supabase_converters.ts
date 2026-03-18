/**
 * Supabase row <-> app type converters.
 *
 * Each entity (segment, intervention, snapshot, engine state, idea,
 * idea connection, routing log) has a pair of converter functions:
 *   - `*RowToApp` -- converts a Supabase row into the app-level type.
 *   - `*ToInsert` -- converts an app-level object into a Supabase insert payload.
 *
 * These converters centralise the snake_case/camelCase mapping and keep
 * API route handlers free of manual field remapping.
 * @module
 */

import type { Database } from './types';
import type {
  TranscriptSegment,
  MetricSnapshot,
  Intervention,
  DecisionEngineState,
  ModelRoutingLogEntry,
  Idea,
  IdeaSource,
  IdeaConnection,
  IdeaConnectionType,
} from '@/lib/types';

type SegmentRow = Database['public']['Tables']['transcript_segments']['Row'];
type SegmentInsert = Database['public']['Tables']['transcript_segments']['Insert'];
type InterventionRow = Database['public']['Tables']['interventions']['Row'];
type InterventionInsert = Database['public']['Tables']['interventions']['Insert'];
type SnapshotInsert = Database['public']['Tables']['metric_snapshots']['Insert'];
type EngineStateRow = Database['public']['Tables']['engine_state']['Row'];
type RoutingLogInsert = Database['public']['Tables']['model_routing_logs']['Insert'];
type IdeaRow = Database['public']['Tables']['ideas']['Row'];
type IdeaInsert = Database['public']['Tables']['ideas']['Insert'];
type IdeaConnectionRow = Database['public']['Tables']['idea_connections']['Row'];
type IdeaConnectionInsert = Database['public']['Tables']['idea_connections']['Insert'];

// --- Transcript Segments ---

/**
 * Convert a Supabase transcript_segments row to the app-level TranscriptSegment.
 * @param row - The raw database row.
 * @returns A TranscriptSegment with camelCase fields.
 */
export function segmentRowToApp(row: SegmentRow): TranscriptSegment {
  return {
    id: row.id,
    speaker: row.speaker,
    text: row.text,
    timestamp: row.timestamp,
    isFinal: row.is_final,
    language: row.language ?? undefined,
  };
}

/**
 * Convert an app-level TranscriptSegment to a Supabase insert payload.
 * @param segment - The app-level segment.
 * @param sessionId - The session this segment belongs to.
 * @returns A SegmentInsert object ready for Supabase upsert.
 */
export function segmentToInsert(segment: TranscriptSegment, sessionId: string): SegmentInsert {
  return {
    id: segment.id,
    session_id: sessionId,
    speaker: segment.speaker,
    text: segment.text,
    timestamp: segment.timestamp,
    is_final: segment.isFinal,
    language: segment.language ?? null,
  };
}

// --- Interventions ---

/**
 * Convert a Supabase interventions row to the app-level Intervention.
 * @param row - The raw database row.
 * @returns An Intervention with camelCase fields and typed enums.
 */
export function interventionRowToApp(row: InterventionRow): Intervention {
  return {
    id: row.id,
    timestamp: row.timestamp,
    type: row.type as Intervention['type'],
    trigger: (row.trigger ?? 'manual') as Intervention['trigger'],
    text: row.message,
    spoken: row.status === 'delivered',
    metricsAtTrigger: row.metrics_at_intervention as MetricSnapshot | null,
    intent: row.intent as Intervention['intent'],
    modelUsed: row.model ?? undefined,
    recoveryResult: (row.recovery_result as Intervention['recoveryResult']) ?? undefined,
    recoveryCheckedAt: row.recovery_checked_at ?? undefined,
  };
}

/**
 * Convert an app-level Intervention to a Supabase insert payload.
 * Includes optional engine state snapshot and rule violation metadata.
 * @param intervention - The app-level intervention.
 * @param sessionId - The session this intervention belongs to.
 * @param engineState - Optional decision engine state at time of intervention.
 * @param ruleViolation - Optional rule violation details.
 * @returns An InterventionInsert object ready for Supabase insert.
 */
export function interventionToInsert(
  intervention: Intervention,
  sessionId: string,
  engineState?: DecisionEngineState,
  ruleViolation?: { rule?: string; evidence?: string; severity?: string } | null,
): InterventionInsert {
  return {
    id: intervention.id,
    session_id: sessionId,
    type: intervention.type,
    intent: intervention.intent ?? null,
    trigger: intervention.trigger ?? null,
    message: intervention.text,
    timestamp: intervention.timestamp,
    status: intervention.spoken ? 'delivered' : 'generated',
    metrics_at_intervention: intervention.metricsAtTrigger as Record<string, unknown> | null,
    engine_state_snapshot: engineState as unknown as Record<string, unknown> | null,
    model: intervention.modelUsed ?? null,
    recovery_result: intervention.recoveryResult ?? null,
    rule_violated: ruleViolation?.rule ?? null,
    rule_evidence: ruleViolation?.evidence ?? null,
    rule_severity: ruleViolation?.severity ?? null,
  };
}

// --- Metric Snapshots ---

type SnapshotRow = Database['public']['Tables']['metric_snapshots']['Row'];

/**
 * Convert a Supabase metric_snapshots row to the app-level MetricSnapshot.
 * The `metrics` JSONB column is destructured into individual typed fields.
 * @param row - The raw database row.
 * @returns A MetricSnapshot with all computed metrics and inferred state.
 */
export function snapshotRowToApp(row: SnapshotRow): MetricSnapshot {
  const m = row.metrics as Record<string, unknown>;
  const si = row.state_inference as Record<string, unknown> | null;
  return {
    id: (m.id as string) || row.id,
    timestamp: row.timestamp,
    speakingTimeDistribution: (m.speakingTimeDistribution as MetricSnapshot['speakingTimeDistribution']) || {},
    participationImbalance: (m.participationImbalance as number) ?? 0,
    semanticRepetitionRate: (m.semanticRepetitionRate as number) ?? 0,
    stagnationDuration: (m.stagnationDuration as number) ?? 0,
    diversityDevelopment: (m.diversityDevelopment as number) ?? 0,
    windowStart: (m.windowStart as number) ?? 0,
    windowEnd: (m.windowEnd as number) ?? 0,
    participation: m.participation as MetricSnapshot['participation'],
    semanticDynamics: m.semanticDynamics as MetricSnapshot['semanticDynamics'],
    inferredState: si as unknown as MetricSnapshot['inferredState'],
  };
}

/**
 * Convert an app-level MetricSnapshot to a Supabase insert payload.
 * Separates the inferred state from the raw metrics for the DB schema.
 * @param snapshot - The app-level metric snapshot.
 * @param sessionId - The session this snapshot belongs to.
 * @returns A SnapshotInsert object ready for Supabase insert.
 */
export function snapshotToInsert(snapshot: MetricSnapshot, sessionId: string): SnapshotInsert {
  const { inferredState, ...metricsData } = snapshot;
  return {
    session_id: sessionId,
    timestamp: snapshot.timestamp,
    metrics: metricsData as unknown as Record<string, unknown>,
    state_inference: inferredState as unknown as Record<string, unknown> | null,
  };
}

// --- Engine State ---

/**
 * Convert a Supabase engine_state row to a partial DecisionEngineState.
 * Returns a partial because the DB only stores a subset of the full engine state.
 * @param row - The raw database row.
 * @returns A partial DecisionEngineState for merging into the client state.
 */
export function engineStateRowToApp(row: EngineStateRow): Partial<DecisionEngineState> {
  return {
    phase: row.phase as DecisionEngineState['phase'],
    confirmingSince: row.confirmation_start,
    lastInterventionTime: row.last_intervention_time,
    interventionCount: row.intervention_count,
    postCheckIntent: row.active_intent as DecisionEngineState['postCheckIntent'],
  };
}

// --- Ideas ---

/**
 * Convert a Supabase ideas row to the app-level Idea.
 * Converts ISO date strings to Unix timestamps for client-side use.
 * @param row - The raw database row.
 * @returns An Idea with camelCase fields and numeric timestamps.
 */
export function ideaRowToApp(row: IdeaRow): Idea {
  return {
    id: row.id,
    sessionId: row.session_id,
    title: row.title,
    description: row.description ?? null,
    author: row.author,
    source: row.source as IdeaSource,
    sourceSegmentIds: row.source_segment_ids ?? [],
    positionX: row.position_x,
    positionY: row.position_y,
    color: row.color,
    isDeleted: row.is_deleted,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
    ideaType: (row.idea_type as Idea['ideaType']) || 'idea',
    parentId: row.parent_id ?? null,
  };
}

/**
 * Convert an app-level Idea to a Supabase insert payload.
 * @param idea - The app-level idea.
 * @param sessionId - The session this idea belongs to.
 * @returns An IdeaInsert object ready for Supabase insert.
 */
export function ideaToInsert(idea: Idea, sessionId: string): IdeaInsert {
  return {
    id: idea.id,
    session_id: sessionId,
    title: idea.title,
    description: idea.description ?? null,
    author: idea.author,
    source: idea.source,
    source_segment_ids: idea.sourceSegmentIds,
    position_x: idea.positionX,
    position_y: idea.positionY,
    color: idea.color,
    is_deleted: idea.isDeleted,
    idea_type: idea.ideaType || 'idea',
    parent_id: idea.parentId ?? null,
  };
}

// --- Idea Connections ---

/**
 * Convert a Supabase idea_connections row to the app-level IdeaConnection.
 * @param row - The raw database row.
 * @returns An IdeaConnection with camelCase fields and a numeric timestamp.
 */
export function connectionRowToApp(row: IdeaConnectionRow): IdeaConnection {
  return {
    id: row.id,
    sessionId: row.session_id,
    sourceIdeaId: row.source_idea_id,
    targetIdeaId: row.target_idea_id,
    label: row.label ?? null,
    connectionType: row.connection_type as IdeaConnectionType,
    createdAt: new Date(row.created_at).getTime(),
  };
}

/**
 * Convert an app-level IdeaConnection to a Supabase insert payload.
 * @param conn - The app-level connection.
 * @param sessionId - The session this connection belongs to.
 * @returns An IdeaConnectionInsert object ready for Supabase insert.
 */
export function connectionToInsert(conn: IdeaConnection, sessionId: string): IdeaConnectionInsert {
  return {
    id: conn.id,
    session_id: sessionId,
    source_idea_id: conn.sourceIdeaId,
    target_idea_id: conn.targetIdeaId,
    label: conn.label ?? null,
    connection_type: conn.connectionType,
  };
}

// --- Model Routing Logs ---

/**
 * Convert an app-level ModelRoutingLogEntry to a Supabase insert payload.
 * Sums input and output tokens into a single `token_count` column.
 * @param entry - The log entry from the LLM client.
 * @param sessionId - The session this log belongs to.
 * @returns A RoutingLogInsert object ready for Supabase insert.
 */
export function routingLogToInsert(entry: ModelRoutingLogEntry, sessionId: string): RoutingLogInsert {
  return {
    session_id: sessionId,
    timestamp: entry.timestamp,
    route: entry.task,
    model: entry.model ?? null,
    latency_ms: entry.latencyMs ?? null,
    token_count: (entry.inputTokens ?? 0) + (entry.outputTokens ?? 0) || null,
    error: entry.error ?? null,
  };
}
