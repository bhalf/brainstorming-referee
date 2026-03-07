import type { Database } from './types';
import type {
  TranscriptSegment,
  MetricSnapshot,
  Intervention,
  DecisionEngineState,
  ModelRoutingLogEntry,
} from '@/lib/types';

type SegmentRow = Database['public']['Tables']['transcript_segments']['Row'];
type SegmentInsert = Database['public']['Tables']['transcript_segments']['Insert'];
type InterventionRow = Database['public']['Tables']['interventions']['Row'];
type InterventionInsert = Database['public']['Tables']['interventions']['Insert'];
type SnapshotInsert = Database['public']['Tables']['metric_snapshots']['Insert'];
type EngineStateRow = Database['public']['Tables']['engine_state']['Row'];
type RoutingLogInsert = Database['public']['Tables']['model_routing_logs']['Insert'];

// --- Transcript Segments ---

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
  };
}

export function interventionToInsert(
  intervention: Intervention,
  sessionId: string,
  engineState?: DecisionEngineState,
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
  };
}

// --- Metric Snapshots ---

type SnapshotRow = Database['public']['Tables']['metric_snapshots']['Row'];

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

export function engineStateRowToApp(row: EngineStateRow): Partial<DecisionEngineState> {
  return {
    phase: row.phase as DecisionEngineState['phase'],
    confirmingSince: row.confirmation_start,
    lastInterventionTime: row.last_intervention_time,
    interventionCount: row.intervention_count,
    postCheckIntent: row.active_intent as DecisionEngineState['postCheckIntent'],
  };
}

// --- Model Routing Logs ---

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
