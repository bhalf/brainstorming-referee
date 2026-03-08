import { describe, it, expect } from 'vitest';
import {
  computeVolumeShare,
  computeTurnShare,
  computeSilentParticipantRatio,
  computeDominanceStreakScore,
  computeHooverIndex,
  computeParticipationRiskScore,
  computeParticipationMetrics,
} from '@/lib/metrics/participation';
import { TranscriptSegment } from '@/lib/types';
import { DEFAULT_CONFIG } from '@/lib/config';

// --- Helpers ---

function seg(speaker: string, text: string, id?: string): TranscriptSegment {
  return {
    id: id || `${speaker}-${Math.random().toString(36).slice(2, 8)}`,
    speaker,
    text,
    timestamp: Date.now(),
    isFinal: true,
  };
}

function segs(items: [string, string][]): TranscriptSegment[] {
  return items.map(([speaker, text], i) => seg(speaker, text, `seg-${i}`));
}

// --- Tests ---

describe('computeVolumeShare', () => {
  it('returns equal shares for equal word count', () => {
    const segments = segs([
      ['Alice', 'one two three'],
      ['Bob', 'four five six'],
    ]);
    const shares = computeVolumeShare(segments);
    expect(shares['Alice']).toBeCloseTo(0.5, 1);
    expect(shares['Bob']).toBeCloseTo(0.5, 1);
  });

  it('returns proportional shares for unequal word count', () => {
    const segments = segs([
      ['Alice', 'one two three four five six seven eight'],
      ['Bob', 'nine ten'],
    ]);
    const shares = computeVolumeShare(segments);
    expect(shares['Alice']).toBeCloseTo(0.8, 1);
    expect(shares['Bob']).toBeCloseTo(0.2, 1);
  });

  it('ignores activity markers', () => {
    const segments = [
      seg('Alice', 'hello world'),
      seg('System', '[joined the call]'),
    ];
    const shares = computeVolumeShare(segments);
    expect(shares['Alice']).toBe(1);
    expect(shares['System']).toBeUndefined();
  });

  it('returns empty for zero segments', () => {
    expect(computeVolumeShare([])).toEqual({});
  });
});

describe('computeTurnShare', () => {
  it('counts turns equally', () => {
    const segments = segs([
      ['Alice', 'hello'],
      ['Bob', 'hi'],
      ['Alice', 'how are you'],
      ['Bob', 'fine'],
    ]);
    const shares = computeTurnShare(segments);
    expect(shares['Alice']).toBeCloseTo(0.5);
    expect(shares['Bob']).toBeCloseTo(0.5);
  });

  it('reflects uneven turn distribution', () => {
    const segments = segs([
      ['Alice', 'a'],
      ['Alice', 'b'],
      ['Alice', 'c'],
      ['Bob', 'd'],
    ]);
    const shares = computeTurnShare(segments);
    expect(shares['Alice']).toBeCloseTo(0.75);
    expect(shares['Bob']).toBeCloseTo(0.25);
  });
});

describe('computeSilentParticipantRatio', () => {
  it('returns 0 for equal participation', () => {
    const shares = { Alice: 0.25, Bob: 0.25, Carol: 0.25, Dave: 0.25 };
    expect(computeSilentParticipantRatio(shares)).toBe(0);
  });

  it('detects silent participants below threshold', () => {
    const shares = { Alice: 0.80, Bob: 0.15, Carol: 0.04, Dave: 0.01 };
    // Carol (0.04) and Dave (0.01) are below 0.05
    expect(computeSilentParticipantRatio(shares)).toBeCloseTo(0.5);
  });

  it('returns 0 for single speaker', () => {
    expect(computeSilentParticipantRatio({ Alice: 1 })).toBe(0);
  });
});

describe('computeDominanceStreakScore', () => {
  it('returns high score for long consecutive runs', () => {
    // 10 consecutive turns by Alice, then 2 by Bob = 12 total
    const segments: TranscriptSegment[] = [];
    for (let i = 0; i < 10; i++) segments.push(seg('Alice', `turn ${i}`, `a-${i}`));
    for (let i = 0; i < 2; i++) segments.push(seg('Bob', `turn ${i}`, `b-${i}`));
    const score = computeDominanceStreakScore(segments);
    expect(score).toBeGreaterThan(0.5);
  });

  it('returns low score for alternating speakers', () => {
    const segments: TranscriptSegment[] = [];
    for (let i = 0; i < 20; i++) {
      segments.push(seg(i % 2 === 0 ? 'Alice' : 'Bob', `turn ${i}`, `s-${i}`));
    }
    const score = computeDominanceStreakScore(segments);
    expect(score).toBeLessThan(0.2);
  });

  it('returns 0 for fewer than 3 segments', () => {
    const segments = segs([['Alice', 'hello'], ['Bob', 'hi']]);
    expect(computeDominanceStreakScore(segments)).toBe(0);
  });

  it('returns 0 for single speaker alone (no dominance without others)', () => {
    const segments: TranscriptSegment[] = [];
    for (let i = 0; i < 10; i++) segments.push(seg('Alice', `turn ${i}`, `a-${i}`));
    // Without knownParticipantCount or with 1 participant, single speaker isn't "dominating"
    expect(computeDominanceStreakScore(segments)).toBe(0);
    expect(computeDominanceStreakScore(segments, 1)).toBe(0);
  });

  it('returns 1 for single speaker when others are known to exist', () => {
    const segments: TranscriptSegment[] = [];
    for (let i = 0; i < 10; i++) segments.push(seg('Alice', `turn ${i}`, `a-${i}`));
    // With 3 known participants but only 1 speaking → dominance
    expect(computeDominanceStreakScore(segments, 3)).toBe(1);
  });
});

describe('computeHooverIndex', () => {
  it('returns 0 for equal values', () => {
    expect(computeHooverIndex([25, 25, 25, 25])).toBeCloseTo(0, 1);
  });

  it('returns near 1 for maximally unequal values', () => {
    expect(computeHooverIndex([100, 0, 0, 0])).toBeCloseTo(1, 1);
  });

  it('returns 0 for empty array', () => {
    expect(computeHooverIndex([])).toBe(0);
  });

  it('returns 0 for single value (no inequality with 1 participant)', () => {
    expect(computeHooverIndex([42])).toBe(0);
  });
});

describe('computeParticipationRiskScore', () => {
  it('returns low risk for balanced participation', () => {
    const score = computeParticipationRiskScore(
      0.1,  // low gini
      0,    // no silent
      0.1,  // low streak
      { Alice: 0.25, Bob: 0.25, Carol: 0.25, Dave: 0.25 },
    );
    expect(score).toBeLessThan(0.15);
  });

  it('returns high risk for dominant speaker', () => {
    const score = computeParticipationRiskScore(
      0.8,   // high gini
      0.25,  // one silent
      0.7,   // high streak
      { Alice: 0.7, Bob: 0.2, Carol: 0.08, Dave: 0.02 },
    );
    expect(score).toBeGreaterThan(0.5);
  });
});

describe('computeParticipationMetrics', () => {
  it('integrates all sub-metrics for equal participation', () => {
    const segments = segs([
      ['Alice', 'one two three'],
      ['Bob', 'four five six'],
      ['Carol', 'seven eight nine'],
      ['Dave', 'ten eleven twelve'],
    ]);
    const result = computeParticipationMetrics(segments, DEFAULT_CONFIG, 0.1);
    expect(result.participationRiskScore).toBeLessThan(0.2);
    expect(result.silentParticipantRatio).toBe(0);
    expect(result.dominanceStreakScore).toBe(0); // only 4 segments, but they're < 3 final? Actually 4 final
    // 4 final segments, but each by different speaker → no streak
  });

  it('detects risk with one dominant speaker', () => {
    const segments: TranscriptSegment[] = [];
    // Alice speaks 16 turns, Bob/Carol/Dave 1 each
    for (let i = 0; i < 16; i++) segments.push(seg('Alice', `idea about topic ${i}`, `a-${i}`));
    segments.push(seg('Bob', 'I agree', 'b-0'));
    segments.push(seg('Carol', 'me too', 'c-0'));
    segments.push(seg('Dave', 'ok', 'd-0'));

    const result = computeParticipationMetrics(segments, DEFAULT_CONFIG, 0.8);
    expect(result.participationRiskScore).toBeGreaterThan(0.4);
    expect(result.dominanceStreakScore).toBeGreaterThan(0.5);
  });
});
