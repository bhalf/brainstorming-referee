import { describe, it, expect } from 'vitest';
import { evaluatePolicy, intentToTrigger, analyzeInterventionHistory } from '@/lib/decision/interventionPolicy';
import {
  MetricSnapshot,
  DecisionEngineState,
  ConversationStateInference,
  ExperimentConfig,
  Intervention,
} from '@/lib/types';
import { DEFAULT_CONFIG } from '@/lib/config';

// --- Helpers ---

function makeEngineState(overrides: Partial<DecisionEngineState> = {}): DecisionEngineState {
  return {
    phase: 'MONITORING',
    lastInterventionTime: null,
    interventionCount: 0,
    postCheckStartTime: null,
    cooldownUntil: null,
    metricsAtIntervention: null,
    confirmingSince: null,
    confirmingState: null,
    postCheckIntent: null,
    lastRuleViolationTime: null,
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

  it('enters cooldown after failed post-check in Scenario A (no ally escalation)', () => {
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
    expect(result.nextEngineState.phase).toBe('COOLDOWN');
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

// --- Intervention History & Fatigue Tests ---

function makeIntervention(overrides: Partial<Intervention> = {}): Intervention {
  return {
    id: `int-${Date.now()}-${Math.random()}`,
    timestamp: Date.now(),
    type: 'moderator',
    trigger: 'imbalance',
    text: 'Test intervention',
    spoken: false,
    metricsAtTrigger: null,
    intent: 'PARTICIPATION_REBALANCING',
    recoveryResult: 'not_recovered',
    ...overrides,
  };
}

describe('analyzeInterventionHistory', () => {
  it('returns neutral analysis for empty history', () => {
    const result = analyzeInterventionHistory([], 'PARTICIPATION_REBALANCING');
    expect(result.consecutiveFailures).toBe(0);
    expect(result.consecutiveFailuresForIntent).toBe(0);
    expect(result.fatigueActive).toBe(false);
    expect(result.confirmationMultiplier).toBe(1);
    expect(result.cooldownMultiplier).toBe(1);
    expect(result.lastRecoveryForIntent).toBeNull();
  });

  it('counts consecutive failures from the end', () => {
    const interventions = [
      makeIntervention({ recoveryResult: 'recovered' }),
      makeIntervention({ recoveryResult: 'not_recovered' }),
      makeIntervention({ recoveryResult: 'not_recovered' }),
    ];
    const result = analyzeInterventionHistory(interventions, 'PARTICIPATION_REBALANCING');
    expect(result.consecutiveFailures).toBe(2);
    expect(result.fatigueActive).toBe(true);
    expect(result.confirmationMultiplier).toBe(2);
    expect(result.cooldownMultiplier).toBe(2);
  });

  it('stops counting at first non-failure', () => {
    const interventions = [
      makeIntervention({ recoveryResult: 'not_recovered' }),
      makeIntervention({ recoveryResult: 'recovered' }),
      makeIntervention({ recoveryResult: 'not_recovered' }),
    ];
    const result = analyzeInterventionHistory(interventions, 'PARTICIPATION_REBALANCING');
    expect(result.consecutiveFailures).toBe(1);
    expect(result.fatigueActive).toBe(false);
    expect(result.confirmationMultiplier).toBe(1.5);
  });

  it('tracks failures per intent separately', () => {
    const interventions = [
      makeIntervention({ intent: 'PARTICIPATION_REBALANCING', recoveryResult: 'not_recovered' }),
      makeIntervention({ intent: 'PERSPECTIVE_BROADENING', recoveryResult: 'not_recovered' }),
      makeIntervention({ intent: 'PARTICIPATION_REBALANCING', recoveryResult: 'not_recovered' }),
    ];
    const result = analyzeInterventionHistory(interventions, 'PARTICIPATION_REBALANCING');
    expect(result.consecutiveFailuresForIntent).toBe(2);
    expect(result.lastRecoveryForIntent).toBe('not_recovered');
  });

  it('reports last recovery for intent', () => {
    const interventions = [
      makeIntervention({ intent: 'REACTIVATION', recoveryResult: 'not_recovered' }),
      makeIntervention({ intent: 'PARTICIPATION_REBALANCING', recoveryResult: 'recovered' }),
    ];
    const result = analyzeInterventionHistory(interventions, 'PARTICIPATION_REBALANCING');
    expect(result.lastRecoveryForIntent).toBe('recovered');
    expect(result.consecutiveFailuresForIntent).toBe(0);
  });
});

describe('evaluatePolicy with intervention history (fatigue)', () => {
  it('extends confirmation time after 1 consecutive failure', () => {
    const now = Date.now();
    // Confirmation started 35s ago — enough for base (30s) but not for 1.5x (45s)
    const confirmStart = now - 35000;

    const history: MetricSnapshot[] = [];
    for (let i = 0; i < 12; i++) {
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

    const recentInterventions = [
      makeIntervention({ intent: 'PARTICIPATION_REBALANCING', recoveryResult: 'not_recovered' }),
    ];

    const result = evaluatePolicy(
      makeInference('DOMINANCE_RISK', 0.65),
      makeMetrics(),
      history,
      engine,
      config,
      'A',
      now,
      recentInterventions,
    );

    // Should NOT fire yet (35s < 45s effective confirmation)
    expect(result.shouldIntervene).toBe(false);
    expect(result.reason).toContain('Confirming');
  });

  it('fires after extended confirmation time is met', () => {
    const now = Date.now();
    // Confirmation started 50s ago — enough for 1.5x (45s)
    const confirmStart = now - 50000;

    const history: MetricSnapshot[] = [];
    for (let i = 0; i < 17; i++) {
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

    const recentInterventions = [
      makeIntervention({ intent: 'PARTICIPATION_REBALANCING', recoveryResult: 'not_recovered' }),
    ];

    const result = evaluatePolicy(
      makeInference('DOMINANCE_RISK', 0.65),
      makeMetrics(),
      history,
      engine,
      config,
      'A',
      now,
      recentInterventions,
    );

    expect(result.shouldIntervene).toBe(true);
    expect(result.intent).toBe('PARTICIPATION_REBALANCING');
  });

  it('doubles confirmation and cooldown after 2+ consecutive failures', () => {
    const now = Date.now();
    // Confirmation started 55s ago — enough for 1.5x (45s) but not for 2x (60s)
    const confirmStart = now - 55000;

    const history: MetricSnapshot[] = [];
    for (let i = 0; i < 19; i++) {
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

    const recentInterventions = [
      makeIntervention({ recoveryResult: 'not_recovered' }),
      makeIntervention({ recoveryResult: 'not_recovered' }),
    ];

    const result = evaluatePolicy(
      makeInference('DOMINANCE_RISK', 0.65),
      makeMetrics(),
      history,
      engine,
      config,
      'A',
      now,
      recentInterventions,
    );

    // Should NOT fire yet (55s < 60s effective confirmation with 2x multiplier)
    expect(result.shouldIntervene).toBe(false);
    expect(result.reason).toContain('fatigue');
  });

  it('applies fatigue cooldown multiplier when firing after failures', () => {
    const now = Date.now();
    const confirmStart = now - 65000; // 65s — enough for 2x (60s)

    const history: MetricSnapshot[] = [];
    for (let i = 0; i < 22; i++) {
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

    const recentInterventions = [
      makeIntervention({ recoveryResult: 'not_recovered' }),
      makeIntervention({ recoveryResult: 'not_recovered' }),
    ];

    const result = evaluatePolicy(
      makeInference('DOMINANCE_RISK', 0.65),
      makeMetrics(),
      history,
      engine,
      config,
      'A',
      now,
      recentInterventions,
    );

    expect(result.shouldIntervene).toBe(true);
    expect(result.reason).toContain('fatigue');
    // Cooldown should be 2x the normal value
    const expectedCooldownMs = config.COOLDOWN_SECONDS * 2 * 1000;
    expect(result.nextEngineState.cooldownUntil).toBe(now + expectedCooldownMs);
  });

  it('no fatigue when all recent interventions recovered', () => {
    const now = Date.now();
    const confirmStart = now - (config.CONFIRMATION_SECONDS + 5) * 1000;

    const history: MetricSnapshot[] = [];
    for (let i = 0; i < 12; i++) {
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

    const recentInterventions = [
      makeIntervention({ recoveryResult: 'recovered' }),
      makeIntervention({ recoveryResult: 'recovered' }),
    ];

    const result = evaluatePolicy(
      makeInference('DOMINANCE_RISK', 0.65),
      makeMetrics(),
      history,
      engine,
      config,
      'A',
      now,
      recentInterventions,
    );

    expect(result.shouldIntervene).toBe(true);
    // Normal cooldown (1x)
    const expectedCooldownMs = config.COOLDOWN_SECONDS * 1000;
    expect(result.nextEngineState.cooldownUntil).toBe(now + expectedCooldownMs);
  });
});
