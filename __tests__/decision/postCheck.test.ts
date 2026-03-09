import { describe, it, expect } from 'vitest';
import { evaluateRecovery } from '@/lib/decision/postCheck';
import { MetricSnapshot } from '@/lib/types';

// --- Helpers ---

function makeMetrics(overrides: Partial<MetricSnapshot> = {}): MetricSnapshot {
  return {
    id: 'test-snap',
    timestamp: Date.now(),
    speakingTimeDistribution: {},
    participationImbalance: 0.3,
    semanticRepetitionRate: 0.2,
    stagnationDuration: 10,
    diversityDevelopment: 0.6,
    windowStart: 0,
    windowEnd: 0,
    participation: {
      volumeShare: { Alice: 0.5, Bob: 0.5 },
      turnShare: { Alice: 0.5, Bob: 0.5 },
      silentParticipantRatio: 0,
      dominanceStreakScore: 0.1,
      participationRiskScore: 0.2,
      cumulativeParticipationImbalance: 0.3,
    },
    semanticDynamics: {
      noveltyRate: 0.6,
      clusterConcentration: 0.3,
      explorationElaborationRatio: 0.6,
      semanticExpansionScore: 0.1,
      ideationalFluencyRate: 6,
      piggybackingScore: 0.5,
    },
    ...overrides,
  };
}

// --- Tests ---

describe('evaluateRecovery', () => {
  describe('PARTICIPATION_REBALANCING', () => {
    it('detects successful recovery when risk drops significantly', () => {
      const atIntervention = makeMetrics({
        participationImbalance: 0.7,
        participation: {
          volumeShare: { Alice: 0.8, Bob: 0.2 },
          turnShare: { Alice: 0.7, Bob: 0.3 },
          silentParticipantRatio: 0.3,
          dominanceStreakScore: 0.6,
          participationRiskScore: 0.7,
          cumulativeParticipationImbalance: 0.7,
        },
      });

      const current = makeMetrics({
        participationImbalance: 0.3,
        participation: {
          volumeShare: { Alice: 0.55, Bob: 0.45 },
          turnShare: { Alice: 0.5, Bob: 0.5 },
          silentParticipantRatio: 0.1,
          dominanceStreakScore: 0.1,
          participationRiskScore: 0.25,
          cumulativeParticipationImbalance: 0.3,
        },
      });

      const result = evaluateRecovery('PARTICIPATION_REBALANCING', current, atIntervention);
      expect(result.recovered).toBe(true);
      expect(result.score).toBeGreaterThan(0);
      expect(result.details.participationRiskScore.improved).toBe(true);
    });

    it('detects no recovery when metrics unchanged', () => {
      const atIntervention = makeMetrics({
        participationImbalance: 0.7,
        participation: {
          volumeShare: { Alice: 0.8, Bob: 0.2 },
          turnShare: { Alice: 0.7, Bob: 0.3 },
          silentParticipantRatio: 0.3,
          dominanceStreakScore: 0.6,
          participationRiskScore: 0.7,
          cumulativeParticipationImbalance: 0.7,
        },
      });

      const current = makeMetrics({
        participationImbalance: 0.7,
        participation: {
          ...atIntervention.participation!,
        },
      });

      const result = evaluateRecovery('PARTICIPATION_REBALANCING', current, atIntervention);
      expect(result.recovered).toBe(false);
      expect(result.partial).toBe(false);
    });

    it('detects partial recovery when only risk improves', () => {
      const atIntervention = makeMetrics({
        participationImbalance: 0.7,
        participation: {
          volumeShare: { Alice: 0.8, Bob: 0.2 },
          turnShare: { Alice: 0.7, Bob: 0.3 },
          silentParticipantRatio: 0.3,
          dominanceStreakScore: 0.6,
          participationRiskScore: 0.7,
          cumulativeParticipationImbalance: 0.7,
        },
      });

      const current = makeMetrics({
        participationImbalance: 0.65, // Not enough
        participation: {
          volumeShare: { Alice: 0.7, Bob: 0.3 },
          turnShare: { Alice: 0.65, Bob: 0.35 },
          silentParticipantRatio: 0.25, // Not enough drop
          dominanceStreakScore: 0.5,
          participationRiskScore: 0.5, // 0.7→0.5 = 28% drop ≥ 15%
          cumulativeParticipationImbalance: 0.65,
        },
      });

      const result = evaluateRecovery('PARTICIPATION_REBALANCING', current, atIntervention);
      // Risk improved but silent didn't improve enough AND turn didn't improve enough
      expect(result.partial).toBe(true);
    });
  });

  describe('PERSPECTIVE_BROADENING', () => {
    it('detects successful recovery when novelty and concentration both improve', () => {
      const atIntervention = makeMetrics({
        semanticDynamics: {
          noveltyRate: 0.15,
          clusterConcentration: 0.85,
          explorationElaborationRatio: 0.2,
          semanticExpansionScore: -0.3,
          ideationalFluencyRate: 3,
          piggybackingScore: 0.4,
        },
      });

      const current = makeMetrics({
        semanticDynamics: {
          noveltyRate: 0.5,  // +0.35 ≥ 0.10 ✓
          clusterConcentration: 0.5,  // -0.35 ≥ 0.08 ✓
          explorationElaborationRatio: 0.6,
          semanticExpansionScore: 0.2,
          ideationalFluencyRate: 6,
          piggybackingScore: 0.5,
        },
      });

      const result = evaluateRecovery('PERSPECTIVE_BROADENING', current, atIntervention);
      expect(result.recovered).toBe(true);
      expect(result.score).toBeGreaterThan(0);
    });

    it('detects failure when metrics unchanged', () => {
      const atIntervention = makeMetrics({
        semanticDynamics: {
          noveltyRate: 0.15,
          clusterConcentration: 0.85,
          explorationElaborationRatio: 0.2,
          semanticExpansionScore: -0.3,
          ideationalFluencyRate: 2,
          piggybackingScore: 0.3,
        },
      });

      const current = makeMetrics({
        semanticDynamics: {
          ...atIntervention.semanticDynamics!,
        },
      });

      const result = evaluateRecovery('PERSPECTIVE_BROADENING', current, atIntervention);
      expect(result.recovered).toBe(false);
    });
  });

  describe('REACTIVATION', () => {
    it('detects successful recovery when novelty increases and stagnation drops', () => {
      const atIntervention = makeMetrics({
        stagnationDuration: 200,
        semanticDynamics: {
          noveltyRate: 0.1,
          clusterConcentration: 0.7,
          explorationElaborationRatio: 0.2,
          semanticExpansionScore: -0.3,
          ideationalFluencyRate: 2,
          piggybackingScore: 0.3,
        },
      });

      const current = makeMetrics({
        stagnationDuration: 10, // -190s ≥ 30s ✓
        semanticDynamics: {
          noveltyRate: 0.4,  // +0.3 ≥ 0.10 ✓
          clusterConcentration: 0.4,
          explorationElaborationRatio: 0.6,
          semanticExpansionScore: 0.2,
          ideationalFluencyRate: 6,
          piggybackingScore: 0.5,
        },
      });

      const result = evaluateRecovery('REACTIVATION', current, atIntervention);
      expect(result.recovered).toBe(true);
      expect(result.score).toBeGreaterThan(0);
    });

    it('detects partial recovery when only stagnation improves', () => {
      const atIntervention = makeMetrics({
        stagnationDuration: 200,
        semanticDynamics: {
          noveltyRate: 0.1,
          clusterConcentration: 0.7,
          explorationElaborationRatio: 0.2,
          semanticExpansionScore: -0.3,
          ideationalFluencyRate: 2,
          piggybackingScore: 0.3,
        },
      });

      const current = makeMetrics({
        stagnationDuration: 100, // -100s ≥ 30s ✓
        semanticDynamics: {
          noveltyRate: 0.15, // +0.05, not ≥ 0.10
          clusterConcentration: 0.65,
          explorationElaborationRatio: 0.25,
          semanticExpansionScore: -0.2,
          ideationalFluencyRate: 2,
          piggybackingScore: 0.3,
        },
      });

      const result = evaluateRecovery('REACTIVATION', current, atIntervention);
      expect(result.recovered).toBe(false);
      expect(result.partial).toBe(true);
    });
  });

  describe('ALLY_IMPULSE', () => {
    it('considers any single improvement as recovery', () => {
      const atIntervention = makeMetrics({
        stagnationDuration: 100,
        participation: {
          volumeShare: { Alice: 0.8, Bob: 0.2 },
          turnShare: { Alice: 0.7, Bob: 0.3 },
          silentParticipantRatio: 0.3,
          dominanceStreakScore: 0.6,
          participationRiskScore: 0.7,
          cumulativeParticipationImbalance: 0.7,
        },
        semanticDynamics: {
          noveltyRate: 0.1,
          clusterConcentration: 0.7,
          explorationElaborationRatio: 0.2,
          semanticExpansionScore: -0.3,
          ideationalFluencyRate: 2,
          piggybackingScore: 0.3,
        },
      });

      // Only novelty improved slightly
      const current = makeMetrics({
        stagnationDuration: 90, // Not enough (need 15 drop)
        participation: { ...atIntervention.participation! },
        semanticDynamics: {
          noveltyRate: 0.2,  // +0.10 ≥ 0.05 ✓
          clusterConcentration: 0.65,
          explorationElaborationRatio: 0.25,
          semanticExpansionScore: -0.2,
          ideationalFluencyRate: 3,
          piggybackingScore: 0.35,
        },
      });

      const result = evaluateRecovery('ALLY_IMPULSE', current, atIntervention);
      expect(result.recovered).toBe(true);
    });
  });

  it('returns recovered when no baseline to compare', () => {
    const result = evaluateRecovery('PARTICIPATION_REBALANCING', makeMetrics(), null);
    expect(result.recovered).toBe(true);
  });

  it('returns recovered when intent is null', () => {
    const result = evaluateRecovery(null, makeMetrics(), makeMetrics());
    expect(result.recovered).toBe(true);
  });
});
