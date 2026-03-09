import { describe, it, expect } from 'vitest';
import { inferConversationState } from '@/lib/state/inferConversationState';
import { MetricSnapshot, ConversationStateInference } from '@/lib/types';

// --- Test Helpers ---

function makeSnapshot(overrides: Partial<MetricSnapshot> = {}): MetricSnapshot {
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
      cumulativeParticipationImbalance: 0.2,
    },
    semanticDynamics: {
      noveltyRate: 0.7,
      clusterConcentration: 0.2,
      explorationElaborationRatio: 0.7,
      semanticExpansionScore: 0.1,
      ideationalFluencyRate: 6,
      piggybackingScore: 0.5,
    },
    ...overrides,
  };
}

// --- Tests ---

describe('inferConversationState — fluency penalty fix', () => {
  it('silence (rate=0) yields higher STALLED penalty than slow speech (rate=1)', () => {
    const silentSnapshot = makeSnapshot({
      semanticDynamics: {
        noveltyRate: 0.3,
        clusterConcentration: 0.5,
        explorationElaborationRatio: 0.3,
        semanticExpansionScore: -0.2,
        ideationalFluencyRate: 0, // Complete silence
        piggybackingScore: 0.5,
      },
      stagnationDuration: 90,
      diversityDevelopment: 0.3,
    });

    const slowSnapshot = makeSnapshot({
      semanticDynamics: {
        noveltyRate: 0.3,
        clusterConcentration: 0.5,
        explorationElaborationRatio: 0.3,
        semanticExpansionScore: -0.2,
        ideationalFluencyRate: 1, // Very slow (1 turn/min)
        piggybackingScore: 0.5,
      },
      stagnationDuration: 90,
      diversityDevelopment: 0.3,
    });

    const silentResult = inferConversationState(silentSnapshot, null);
    const slowResult = inferConversationState(slowSnapshot, null);

    // Find STALLED_DISCUSSION confidence in both
    const silentStalledConf = silentResult.criteriaSnapshot?.conf_STALLED_DISCUSSION ?? 0;
    const slowStalledConf = slowResult.criteriaSnapshot?.conf_STALLED_DISCUSSION ?? 0;

    // Silence should produce HIGHER stalled confidence than slow speech
    expect(silentStalledConf).toBeGreaterThan(slowStalledConf);
  });

  it('healthy fluency rate (6 turns/min) yields minimal STALLED penalty', () => {
    const healthySnapshot = makeSnapshot({
      semanticDynamics: {
        noveltyRate: 0.3,
        clusterConcentration: 0.5,
        explorationElaborationRatio: 0.3,
        semanticExpansionScore: -0.2,
        ideationalFluencyRate: 6, // Healthy rate
        piggybackingScore: 0.5,
      },
      stagnationDuration: 90,
      diversityDevelopment: 0.3,
    });

    const result = inferConversationState(healthySnapshot, null);
    const stalledConf = result.criteriaSnapshot?.conf_STALLED_DISCUSSION ?? 0;

    // At healthy rate, the fluency component (weight 0.20) contributes 0,
    // so stalled confidence should be moderate-low (driven only by other factors)
    expect(stalledConf).toBeLessThan(0.6);
  });

  it('complete silence contributes maximum fluency penalty', () => {
    const silentSnapshot = makeSnapshot({
      semanticDynamics: {
        noveltyRate: 0.3,
        clusterConcentration: 0.5,
        explorationElaborationRatio: 0.3,
        semanticExpansionScore: -0.2,
        ideationalFluencyRate: 0,
        piggybackingScore: 0.5,
      },
      stagnationDuration: 180, // Max stagnation
      diversityDevelopment: 0.0,
    });

    const result = inferConversationState(silentSnapshot, null);
    const stalledConf = result.criteriaSnapshot?.conf_STALLED_DISCUSSION ?? 0;

    // With all signals pointing to stalled, confidence should be high
    expect(stalledConf).toBeGreaterThan(0.6);
  });
});
