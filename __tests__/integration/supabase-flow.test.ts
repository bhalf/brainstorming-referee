/**
 * Integration Test: Supabase Data Flow
 *
 * Tests the full lifecycle with a sample brainstorming conversation:
 * 1. Create session
 * 2. Insert transcript segments
 * 3. Insert metric snapshots
 * 4. Insert engine state
 * 5. Insert interventions
 * 6. Insert model routing logs
 * 7. Export session
 * 8. End session
 * 9. Cleanup
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY in .env.local
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { segmentToInsert, snapshotToInsert, interventionToInsert, routingLogToInsert } from '@/lib/supabase/converters';
import type { TranscriptSegment, MetricSnapshot, Intervention, DecisionEngineState, ModelRoutingLogEntry } from '@/lib/types';
import { loadEnvFile } from 'node:process';

// Load .env.local
try { loadEnvFile('.env.local'); } catch { /* already loaded */ }

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase env vars — cannot run integration test');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

// --- Sample Data ---

const ROOM_NAME = `test-room-${Date.now()}`;
let SESSION_ID: string;

const sampleSegments: TranscriptSegment[] = [
  {
    id: `test-seg-1-${Date.now()}`,
    speaker: 'Researcher',
    text: 'Willkommen zur Brainstorming-Session. Heute geht es um nachhaltige Mobilitaet in Staedten.',
    timestamp: Date.now(),
    isFinal: true,
    language: 'de-DE',
  },
  {
    id: `test-seg-2-${Date.now()}`,
    speaker: 'Alice',
    text: 'Ich denke E-Scooter-Sharing koennte eine gute Loesung sein fuer die letzte Meile.',
    timestamp: Date.now() + 5000,
    isFinal: true,
    language: 'de-DE',
  },
  {
    id: `test-seg-3-${Date.now()}`,
    speaker: 'Bob',
    text: 'Was ist mit autonomen Shuttle-Bussen? Die koennten Randgebiete besser anbinden.',
    timestamp: Date.now() + 12000,
    isFinal: true,
    language: 'de-DE',
  },
  {
    id: `test-seg-4-${Date.now()}`,
    speaker: 'Alice',
    text: 'Stimmt, und kombiniert mit einer App fuer multimodale Routenplanung waere das super.',
    timestamp: Date.now() + 20000,
    isFinal: true,
    language: 'de-DE',
  },
  {
    id: `test-seg-5-${Date.now()}`,
    speaker: 'Charlie',
    text: 'Ich finde wir sollten auch an Anreize denken. Zum Beispiel ein Belohnungssystem fuer umweltfreundliches Pendeln.',
    timestamp: Date.now() + 30000,
    isFinal: true,
    language: 'de-DE',
  },
];

const sampleMetrics: MetricSnapshot = {
  id: `test-metric-${Date.now()}`,
  timestamp: Date.now() + 35000,
  speakingTimeDistribution: { Researcher: 5, Alice: 12, Bob: 6, Charlie: 8 },
  participationImbalance: 0.35,
  semanticRepetitionRate: 0.15,
  stagnationDuration: 0,
  diversityDevelopment: 0.72,
  windowStart: Date.now(),
  windowEnd: Date.now() + 35000,
  participation: {
    volumeShare: { Researcher: 0.16, Alice: 0.39, Bob: 0.19, Charlie: 0.26 },
    turnShare: { Researcher: 0.2, Alice: 0.4, Bob: 0.2, Charlie: 0.2 },
    silentParticipantRatio: 0,
    dominanceStreakScore: 0.1,
    participationRiskScore: 0.25,
  },
  semanticDynamics: {
    noveltyRate: 0.8,
    clusterConcentration: 0.4,
    explorationElaborationRatio: 0.65,
    semanticExpansionScore: 0.5,
  },
  inferredState: {
    state: 'HEALTHY_EXPLORATION',
    confidence: 0.82,
    secondaryState: 'HEALTHY_ELABORATION',
    secondaryConfidence: 0.45,
    enteredAt: Date.now(),
    durationMs: 35000,
    criteriaSnapshot: {
      HEALTHY_EXPLORATION: 0.82,
      HEALTHY_ELABORATION: 0.45,
      DOMINANCE_RISK: 0.1,
      CONVERGENCE_RISK: 0.08,
      STALLED_DISCUSSION: 0.02,
    },
  },
};

const sampleEngineState: DecisionEngineState = {
  currentState: 'OBSERVATION',
  lastInterventionTime: null,
  interventionCount: 0,
  persistenceStartTime: null,
  postCheckStartTime: null,
  cooldownUntil: null,
  metricsAtIntervention: null,
  triggerAtIntervention: null,
  phase: 'MONITORING',
  confirmingSince: null,
  confirmingState: null,
  postCheckIntent: null,
};

const sampleIntervention: Intervention = {
  id: `test-int-${Date.now()}`,
  timestamp: Date.now() + 60000,
  type: 'moderator',
  trigger: 'imbalance',
  text: 'Bob, du hattest vorhin den interessanten Punkt mit den Shuttle-Bussen. Koenntest du das naeher ausfuehren?',
  spoken: true,
  metricsAtTrigger: sampleMetrics,
  intent: 'PARTICIPATION_REBALANCING',
  triggeringState: 'DOMINANCE_RISK',
  stateConfidence: 0.72,
  recoveryResult: 'pending',
  modelUsed: 'gpt-4o-mini',
  latencyMs: 1200,
};

const sampleRoutingLog: ModelRoutingLogEntry = {
  id: `test-log-${Date.now()}`,
  timestamp: Date.now() + 60000,
  task: 'intervention_moderator' as ModelRoutingLogEntry['task'],
  provider: 'openai',
  model: 'gpt-4o-mini',
  latencyMs: 1200,
  inputTokens: 450,
  outputTokens: 85,
  success: true,
  fallbackUsed: false,
};

// --- Tests ---

describe('Supabase Integration: Full Session Flow', () => {
  beforeAll(async () => {
    // Create session
    const { data, error } = await supabase
      .from('sessions')
      .insert({
        room_name: ROOM_NAME,
        scenario: 'A',
        language: 'de-DE',
        config: { WINDOW_SECONDS: 180, ANALYZE_EVERY_MS: 5000 },
        host_identity: 'Researcher',
      })
      .select('id')
      .single();

    expect(error).toBeNull();
    expect(data).toBeTruthy();
    SESSION_ID = data!.id;

    // Initialize engine state
    await supabase.from('engine_state').insert({ session_id: SESSION_ID });
  });

  afterAll(async () => {
    // Cleanup: delete session (cascades to all related tables)
    if (SESSION_ID) {
      await supabase.from('sessions').delete().eq('id', SESSION_ID);
    }
  });

  it('should create session and retrieve it by room name', async () => {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('room_name', ROOM_NAME)
      .is('ended_at', null)
      .single();

    expect(error).toBeNull();
    expect(data).toBeTruthy();
    expect(data!.id).toBe(SESSION_ID);
    expect(data!.scenario).toBe('A');
    expect(data!.language).toBe('de-DE');
    expect(data!.host_identity).toBe('Researcher');
  });

  it('should insert transcript segments with deduplication', async () => {
    // Insert all segments
    const rows = sampleSegments.map(s => segmentToInsert(s, SESSION_ID));
    const { error } = await supabase
      .from('transcript_segments')
      .upsert(rows, { onConflict: 'id', ignoreDuplicates: true });

    expect(error).toBeNull();

    // Re-insert same segments (should not duplicate)
    const { error: error2 } = await supabase
      .from('transcript_segments')
      .upsert(rows, { onConflict: 'id', ignoreDuplicates: true });

    expect(error2).toBeNull();

    // Verify count
    const { count } = await supabase
      .from('transcript_segments')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', SESSION_ID);

    expect(count).toBe(5);
  });

  it('should fetch segments ordered by timestamp', async () => {
    const { data, error } = await supabase
      .from('transcript_segments')
      .select('*')
      .eq('session_id', SESSION_ID)
      .order('timestamp', { ascending: true });

    expect(error).toBeNull();
    expect(data).toHaveLength(5);
    expect(data![0].speaker).toBe('Researcher');
    expect(data![1].speaker).toBe('Alice');
    expect(data![4].speaker).toBe('Charlie');

    // Verify ordering
    for (let i = 1; i < data!.length; i++) {
      expect(data![i].timestamp).toBeGreaterThanOrEqual(data![i - 1].timestamp);
    }
  });

  it('should insert metric snapshot with state inference', async () => {
    const row = snapshotToInsert(sampleMetrics, SESSION_ID);
    const { error } = await supabase
      .from('metric_snapshots')
      .insert(row);

    expect(error).toBeNull();

    // Verify
    const { data } = await supabase
      .from('metric_snapshots')
      .select('*')
      .eq('session_id', SESSION_ID)
      .single();

    expect(data).toBeTruthy();
    expect(data!.metrics).toBeTruthy();
    expect(data!.state_inference).toBeTruthy();
    expect((data!.state_inference as Record<string, unknown>).state).toBe('HEALTHY_EXPLORATION');
  });

  it('should upsert engine state', async () => {
    // Update engine state
    const { error } = await supabase
      .from('engine_state')
      .upsert({
        session_id: SESSION_ID,
        phase: 'CONFIRMING',
        active_intent: 'PARTICIPATION_REBALANCING',
        confirmation_start: Date.now(),
        intervention_count: 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'session_id' });

    expect(error).toBeNull();

    // Verify
    const { data } = await supabase
      .from('engine_state')
      .select('*')
      .eq('session_id', SESSION_ID)
      .single();

    expect(data).toBeTruthy();
    expect(data!.phase).toBe('CONFIRMING');
    expect(data!.active_intent).toBe('PARTICIPATION_REBALANCING');
  });

  it('should insert intervention with metrics snapshot', async () => {
    const row = interventionToInsert(sampleIntervention, SESSION_ID, sampleEngineState);
    const { error } = await supabase
      .from('interventions')
      .upsert(row, { onConflict: 'id', ignoreDuplicates: true });

    expect(error).toBeNull();

    // Verify
    const { data } = await supabase
      .from('interventions')
      .select('*')
      .eq('session_id', SESSION_ID)
      .single();

    expect(data).toBeTruthy();
    expect(data!.type).toBe('moderator');
    expect(data!.intent).toBe('PARTICIPATION_REBALANCING');
    expect(data!.message).toContain('Bob');
    expect(data!.status).toBe('delivered');
    expect(data!.metrics_at_intervention).toBeTruthy();
    expect(data!.engine_state_snapshot).toBeTruthy();
  });

  it('should update intervention status', async () => {
    const { error } = await supabase
      .from('interventions')
      .update({ status: 'acknowledged', delivered_at: Date.now() + 62000 })
      .eq('id', sampleIntervention.id);

    expect(error).toBeNull();

    const { data } = await supabase
      .from('interventions')
      .select('status, delivered_at')
      .eq('id', sampleIntervention.id)
      .single();

    expect(data!.status).toBe('acknowledged');
    expect(data!.delivered_at).toBeTruthy();
  });

  it('should insert model routing log', async () => {
    const row = routingLogToInsert(sampleRoutingLog, SESSION_ID);
    const { error } = await supabase
      .from('model_routing_logs')
      .insert(row);

    expect(error).toBeNull();

    const { data } = await supabase
      .from('model_routing_logs')
      .select('*')
      .eq('session_id', SESSION_ID)
      .single();

    expect(data).toBeTruthy();
    expect(data!.route).toBe('intervention_moderator');
    expect(data!.model).toBe('gpt-4o-mini');
    expect(data!.latency_ms).toBe(1200);
  });

  it('should export full session data', async () => {
    // Fetch all data like the export route would
    const [sessionRes, segmentsRes, snapshotsRes, interventionsRes, routingRes] = await Promise.all([
      supabase.from('sessions').select('*').eq('id', SESSION_ID).single(),
      supabase.from('transcript_segments').select('*').eq('session_id', SESSION_ID).order('timestamp'),
      supabase.from('metric_snapshots').select('*').eq('session_id', SESSION_ID).order('timestamp'),
      supabase.from('interventions').select('*').eq('session_id', SESSION_ID).order('timestamp'),
      supabase.from('model_routing_logs').select('*').eq('session_id', SESSION_ID).order('timestamp'),
    ]);

    expect(sessionRes.data).toBeTruthy();
    expect(segmentsRes.data).toHaveLength(5);
    expect(snapshotsRes.data).toHaveLength(1);
    expect(interventionsRes.data).toHaveLength(1);
    expect(routingRes.data).toHaveLength(1);

    // Verify session metadata
    const session = sessionRes.data!;
    expect(session.room_name).toBe(ROOM_NAME);
    expect(session.scenario).toBe('A');
    expect(session.ended_at).toBeNull();
  });

  it('should end session', async () => {
    const { error } = await supabase
      .from('sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', SESSION_ID);

    expect(error).toBeNull();

    // Session should no longer appear as active
    const { data } = await supabase
      .from('sessions')
      .select('*')
      .eq('room_name', ROOM_NAME)
      .is('ended_at', null);

    expect(data).toHaveLength(0);
  });

  it('should cascade delete all data when session is deleted', async () => {
    // Delete session
    const { error } = await supabase
      .from('sessions')
      .delete()
      .eq('id', SESSION_ID);

    expect(error).toBeNull();

    // All related data should be gone
    const { count: segCount } = await supabase
      .from('transcript_segments')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', SESSION_ID);

    const { count: snapCount } = await supabase
      .from('metric_snapshots')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', SESSION_ID);

    const { count: intCount } = await supabase
      .from('interventions')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', SESSION_ID);

    expect(segCount).toBe(0);
    expect(snapCount).toBe(0);
    expect(intCount).toBe(0);

    // Prevent afterAll from trying to delete again
    SESSION_ID = '';
  });
});
