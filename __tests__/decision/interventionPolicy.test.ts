import { describe, it, expect } from 'vitest';
import { evaluatePolicy, intentToTrigger } from '@/lib/decision/interventionPolicy';
import {
  MetricSnapshot,
  DecisionEngineState,
  ConversationStateInference,
  ExperimentConfig,
} from '@/lib/types';
import { DEFAULT_CONFIG } from '@/lib/config';

// --- Helpers ---

function makeEngineState(overrides: Partial<DecisionEngineState> = {}): DecisionEngineState {
  return {
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
    ...overrides,
  };
}

function makeMetrics(overrides: Partial<MetricSnapshot> = {}): MetricSnapshot {
  return {
    id: 'test-snap',
    timestamp: Date.now(),
    speakingTimeDistribution: { Alice: 50, Bob: 50 },
    participationImbalance: 0.2,
    semanticRepetitionRate: 0.1,
    stagnationDuration: 0,
    diversityDevelopment: 0.7,
    windowStart: 0,
    windowEnd: 0,
    participation: {
      volumeShare: { Alice: 0.5, Bob: 0.5 },
      turnShare: { Alice: 0.5, Bob: 0.5 },
      silentParticipantRatio: 0,
      dominanceStreakScore: 0.1,
      participationRiskScore: 0.1,
    },
    semanticDynamics: {
      noveltyRate: 0.7,
      clusterConcentration: 0.2,
      explorationElaborationRatio: 0.7,
      semanticExpansionScore: 0.1,
    },
    ...overrides,
  };
}

function makeInference(
  state: string,
  confidence: number,
): ConversationStateInference {
  return {
    state: state as any,
    confidence,
    secondaryState: null,
    secondaryConfidence: 0,
    enteredAt: Date.now() - 60000,
    durationMs: 60000,
    criteriaSnapshot: {},
  };
}

const config: ExperimentConfig = DEFAULT_CONFIG;

// --- Tests ---

describe('evaluatePolicy', () => {
  it('returns no intervention for baseline scenario', () => {
    const result = evaluatePolicy(
      makeInference('DOMINANCE_RISK', 0.8),
      makeMetrics(),
      [],
      makeEngineState(),
      config,
      'baseline',
    );
    expect(result.shouldIntervene).toBe(false);
    expect(result.reason).toContain('Baseline');
  });

  it('returns no intervention when rate limited', () => {
    const engine = makeEngineState({
      interventionCount: config.MAX_INTERVENTIONS_PER_10MIN,
    });
    const result = evaluatePolicy(
      makeInference('DOMINANCE_RISK', 0.8),
      makeMetrics(),
      [],
      engine,
      config,
      'A',
    );
    expect(result.shouldIntervene).toBe(false);
    expect(result.reason).toContain('Rate limit');
  });

  it('returns no intervention when in cooldown', () => {
    const now = Date.now();
    const engine = makeEngineState({
      cooldownUntil: now + 60000,
    });
    const result = evaluatePolicy(
      makeInference('DOMINANCE_RISK', 0.8),
      makeMetrics(),
      [],
      engine,
      config,
      'A',
      now,
    );
    expect(result.shouldIntervene).toBe(false);
    expect(result.reason).toContain('cooldown');
  });

  it('starts confirmation when risk state detected', () => {
    const now = Date.now();
    const result = evaluatePolicy(
      makeInference('DOMINANCE_RISK', 0.6),
      makeMetrics(),
      [],
      makeEngineState(),
      config,
      'A',
      now,
    );
    expect(result.shouldIntervene).toBe(false);
    expect(result.stateUpdateOnly).not.toBeNull();
    expect(result.stateUpdateOnly?.confirmingState).toBe('DOMINANCE_RISK');
    expect(result.stateUpdateOnly?.phase).toBe('CONFIRMING');
  });

  it('does not intervene during confirmation window', () => {
    const now = Date.now();
    const engine = makeEngineState({
      phase: 'CONFIRMING',
      confirmingSince: now - 10000, // Only 10s in (need 30s)
      confirmingState: 'DOMINANCE_RISK',
    });
    const result = evaluatePolicy(
      makeInference('DOMINANCE_RISK', 0.6),
      makeMetrics(),
      [],
      engine,
      config,
      'A',
      now,
    );
    expect(result.shouldIntervene).toBe(false);
  });

  it('fires PARTICIPATION_REBALANCING after confirmed DOMINANCE_RISK', () => {
    const now = Date.now();
    const confirmStart = now - (config.CONFIRMATION_SECONDS + 5) * 1000;

    // Create history with consistent DOMINANCE_RISK inferences
    const history: MetricSnapshot[] = [];
    for (let i = 0; i < 10; i++) {
      history.push(makeMetrics({
        id: `hist-${i}`,
        timestamp: confirmStart + i * 3000,
        inferredState: makeInference('DOMINANCE_RISK', 0.7),
      }));
    }

    const engine = makeEngineState({
      phase: 'CONFIRMING',
      confirmingSince: confirmStart,
      confirmingState: 'DOMINANCE_RISK',
    });

    const result = evaluatePolicy(
      makeInference('DOMINANCE_RISK', 0.65),
      makeMetrics(),
      history,
      engine,
      config,
      'A',
      now,
    );
    expect(result.shouldIntervene).toBe(true);
    expect(result.intent).toBe('PARTICIPATION_REBALANCING');
    expect(result.role).toBe('moderator');
    expect(result.nextEngineState.phase).toBe('POST_CHECK');
  });

  it('resets confirmation when state becomes healthy', () => {
    const now = Date.now();
    const engine = makeEngineState({
      phase: 'CONFIRMING',
      confirmingSince: now - 15000,
      confirmingState: 'DOMINANCE_RISK',
    });

    const result = evaluatePolicy(
      makeInference('HEALTHY_EXPLORATION', 0.7),
      makeMetrics(),
      [],
      engine,
      config,
      'A',
      now,
    );
    expect(result.shouldIntervene).toBe(false);
    expect(result.stateUpdateOnly?.confirmingSince).toBeNull();
    expect(result.stateUpdateOnly?.phase).toBe('MONITORING');
  });

  it('handles post-check recovery → returns to MONITORING', () => {
    const now = Date.now();
    const atIntervention = makeMetrics({
      participation: {
        volumeShare: { Alice: 0.8, Bob: 0.2 },
        turnShare: { Alice: 0.7, Bob: 0.3 },
        silentParticipantRatio: 0.5,
        dominanceStreakScore: 0.7,
        participationRiskScore: 0.7,
      },
    });

    const engine = makeEngineState({
      phase: 'POST_CHECK',
      postCheckStartTime: now - (config.POST_CHECK_SECONDS + 5) * 1000,
      postCheckIntent: 'PARTICIPATION_REBALANCING',
      metricsAtIntervention: atIntervention,
    });

    // Current metrics show improvement
    const currentMetrics = makeMetrics({
      participation: {
        volumeShare: { Alice: 0.55, Bob: 0.45 },
        turnShare: { Alice: 0.5, Bob: 0.5 },
        silentParticipantRatio: 0,
        dominanceStreakScore: 0.1,
        participationRiskScore: 0.2,
      },
    });

    const result = evaluatePolicy(
      makeInference('HEALTHY_EXPLORATION', 0.7),
      currentMetrics,
      [],
      engine,
      config,
      'A',
      now,
    );
    expect(result.shouldIntervene).toBe(false);
    expect(result.recoveryResult).toBe('recovered');
    expect(result.nextEngineState.phase).toBe('MONITORING');
  });

  it('escalates to ally when post-check fails in Scenario B', () => {
    const now = Date.now();
    const atIntervention = makeMetrics({
      participation: {
        volumeShare: { Alice: 0.8, Bob: 0.2 },
        turnShare: { Alice: 0.7, Bob: 0.3 },
        silentParticipantRatio: 0.5,
        dominanceStreakScore: 0.7,
        participationRiskScore: 0.7,
      },
    });

    const engine = makeEngineState({
      phase: 'POST_CHECK',
      postCheckStartTime: now - (config.POST_CHECK_SECONDS + 5) * 1000,
      postCheckIntent: 'PARTICIPATION_REBALANCING',
      metricsAtIntervention: atIntervention,
    });

    // Current metrics unchanged (no recovery)
    const currentMetrics = makeMetrics({
      participation: {
        volumeShare: { Alice: 0.8, Bob: 0.2 },
        turnShare: { Alice: 0.7, Bob: 0.3 },
        silentParticipantRatio: 0.5,
        dominanceStreakScore: 0.7,
        participationRiskScore: 0.7,
      },
    });

    const result = evaluatePolicy(
      makeInference('DOMINANCE_RISK', 0.7),
      currentMetrics,
      [],
      engine,
      config,
      'B',
      now,
    );
    expect(result.shouldIntervene).toBe(true);
    expect(result.intent).toBe('ALLY_IMPULSE');
    expect(result.role).toBe('ally');
    expect(result.recoveryResult).toBe('not_recovered');
  });

  it('returns to monitoring after failed post-check in Scenario A', () => {
    const now = Date.now();
    const atIntervention = makeMetrics({
      participation: {
        volumeShare: { Alice: 0.8, Bob: 0.2 },
        turnShare: { Alice: 0.7, Bob: 0.3 },
        silentParticipantRatio: 0.5,
        dominanceStreakScore: 0.7,
        participationRiskScore: 0.7,
      },
    });

    const engine = makeEngineState({
      phase: 'POST_CHECK',
      postCheckStartTime: now - (config.POST_CHECK_SECONDS + 5) * 1000,
      postCheckIntent: 'PARTICIPATION_REBALANCING',
      metricsAtIntervention: atIntervention,
    });

    const currentMetrics = makeMetrics({
      participation: atIntervention.participation, // No change
    });

    const result = evaluatePolicy(
      makeInference('DOMINANCE_RISK', 0.7),
      currentMetrics,
      [],
      engine,
      config,
      'A',
      now,
    );
    expect(result.shouldIntervene).toBe(false);
    expect(result.recoveryResult).toBe('not_recovered');
    expect(result.nextEngineState.phase).toBe('MONITORING');
  });
});

describe('intentToTrigger', () => {
  it('maps intents to legacy triggers', () => {
    expect(intentToTrigger('PARTICIPATION_REBALANCING')).toBe('imbalance');
    expect(intentToTrigger('PERSPECTIVE_BROADENING')).toBe('repetition');
    expect(intentToTrigger('REACTIVATION')).toBe('stagnation');
    expect(intentToTrigger('ALLY_IMPULSE')).toBe('escalation');
  });
});
