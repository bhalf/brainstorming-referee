import { describe, it, expect } from 'vitest';
import {
  computeNoveltyRate,
  computeClusterConcentration,
  computeExplorationElaborationRatio,
  computeSemanticExpansionScore,
  computeSemanticDynamicsFallback,
} from '@/lib/metrics/semanticDynamics';
import { TranscriptSegment, MetricSnapshot } from '@/lib/types';

// --- Helpers ---

function seg(id: string, speaker: string, text: string): TranscriptSegment {
  return { id, speaker, text, timestamp: Date.now(), isFinal: true };
}

/** Create an embedding vector at a given angle (2D unit vector padded to dim) */
function embAtAngle(angleDeg: number, dim: number = 16): number[] {
  const rad = (angleDeg * Math.PI) / 180;
  const vec = new Array(dim).fill(0);
  vec[0] = Math.cos(rad);
  vec[1] = Math.sin(rad);
  return vec;
}

/** Create embeddings map from segment IDs and angle list */
function makeEmbeddings(segIds: string[], angles: number[]): Map<string, number[]> {
  const map = new Map<string, number[]>();
  for (let i = 0; i < segIds.length; i++) {
    map.set(segIds[i], embAtAngle(angles[i]));
  }
  return map;
}

function makeSnapshot(overrides: Partial<MetricSnapshot> = {}): MetricSnapshot {
  return {
    id: 'snap-' + Math.random().toString(36).slice(2, 6),
    timestamp: Date.now(),
    speakingTimeDistribution: {},
    participationImbalance: 0,
    semanticRepetitionRate: 0,
    stagnationDuration: 0,
    diversityDevelopment: 0.5,
    windowStart: 0,
    windowEnd: 0,
    ...overrides,
  };
}

// --- Tests ---

describe('computeNoveltyRate', () => {
  it('returns high novelty for orthogonal embeddings', () => {
    // Segments at 0°, 90°, 180°, 270° — all very different
    const segments = [
      seg('s0', 'A', 'topic one'),
      seg('s1', 'B', 'topic two'),
      seg('s2', 'A', 'topic three'),
      seg('s3', 'B', 'topic four'),
    ];
    const embeddings = makeEmbeddings(['s0', 's1', 's2', 's3'], [0, 90, 180, 270]);
    const rate = computeNoveltyRate(segments, embeddings);
    expect(rate).toBeGreaterThan(0.7);
  });

  it('returns low novelty for similar embeddings', () => {
    // All segments very close together (0°, 2°, 4°, 6°)
    const segments = [
      seg('s0', 'A', 'same topic'),
      seg('s1', 'B', 'same topic again'),
      seg('s2', 'A', 'still same topic'),
      seg('s3', 'B', 'same topic more'),
      seg('s4', 'A', 'topic continues'),
    ];
    const embeddings = makeEmbeddings(
      ['s0', 's1', 's2', 's3', 's4'],
      [0, 2, 4, 6, 8],
    );
    const rate = computeNoveltyRate(segments, embeddings);
    expect(rate).toBeLessThan(0.3);
  });

  it('returns neutral 0.5 for fewer than 2 segments (insufficient data)', () => {
    const segments = [seg('s0', 'A', 'hello')];
    const embeddings = makeEmbeddings(['s0'], [0]);
    expect(computeNoveltyRate(segments, embeddings)).toBe(0.5);
  });
});

describe('computeClusterConcentration', () => {
  it('returns high concentration for all-same-cluster embeddings', () => {
    const segments = [];
    const ids = [];
    const angles = [];
    for (let i = 0; i < 10; i++) {
      const id = `s${i}`;
      segments.push(seg(id, 'A', `text ${i}`));
      ids.push(id);
      angles.push(i * 2); // All within ~18° → same cluster
    }
    const embeddings = makeEmbeddings(ids, angles);
    const concentration = computeClusterConcentration(segments, embeddings);
    expect(concentration).toBeGreaterThan(0.7);
  });

  it('returns low concentration for distinct clusters', () => {
    const segments = [];
    const ids = [];
    const angles = [];
    // 5 clusters at 0°, 72°, 144°, 216°, 288° — 2 segments each
    for (let c = 0; c < 5; c++) {
      for (let j = 0; j < 2; j++) {
        const id = `s${c}_${j}`;
        segments.push(seg(id, 'A', `cluster ${c} text ${j}`));
        ids.push(id);
        angles.push(c * 72 + j * 2);
      }
    }
    const embeddings = makeEmbeddings(ids, angles);
    const concentration = computeClusterConcentration(segments, embeddings);
    expect(concentration).toBeLessThan(0.5);
  });

  it('returns neutral 0.5 for fewer than 2 embedded segments (insufficient data)', () => {
    const segments = [seg('s0', 'A', 'hello')];
    const embeddings = makeEmbeddings(['s0'], [0]);
    expect(computeClusterConcentration(segments, embeddings)).toBe(0.5);
  });
});

describe('computeExplorationElaborationRatio', () => {
  it('returns high exploration for diverse embeddings', () => {
    const segments = [];
    const ids = [];
    const angles = [];
    for (let i = 0; i < 8; i++) {
      const id = `s${i}`;
      segments.push(seg(id, 'A', `topic ${i}`));
      ids.push(id);
      angles.push(i * 45); // Spread across 360°
    }
    const embeddings = makeEmbeddings(ids, angles);
    const ratio = computeExplorationElaborationRatio(segments, embeddings);
    expect(ratio).toBeGreaterThan(0.5);
  });

  it('returns low exploration for clustered embeddings', () => {
    const segments = [];
    const ids = [];
    const angles = [];
    for (let i = 0; i < 8; i++) {
      const id = `s${i}`;
      segments.push(seg(id, 'A', `topic ${i}`));
      ids.push(id);
      angles.push(i * 3); // All within ~24°
    }
    const embeddings = makeEmbeddings(ids, angles);
    const ratio = computeExplorationElaborationRatio(segments, embeddings);
    expect(ratio).toBeLessThan(0.5);
  });
});

describe('computeSemanticExpansionScore', () => {
  it('returns positive score when concentration decreases', () => {
    const prevSnapshots = [
      makeSnapshot({
        semanticDynamics: {
          noveltyRate: 0.3,
          clusterConcentration: 0.8,
          explorationElaborationRatio: 0.3,
          semanticExpansionScore: 0,
        },
      }),
    ];
    const score = computeSemanticExpansionScore(0.4, 0.5, prevSnapshots);
    expect(score).toBeGreaterThan(0);
  });

  it('returns negative score when concentration increases', () => {
    const prevSnapshots = [
      makeSnapshot({
        semanticDynamics: {
          noveltyRate: 0.7,
          clusterConcentration: 0.3,
          explorationElaborationRatio: 0.7,
          semanticExpansionScore: 0,
        },
      }),
    ];
    const score = computeSemanticExpansionScore(0.8, 0.2, prevSnapshots);
    expect(score).toBeLessThan(0);
  });

  it('returns 0 with no history', () => {
    expect(computeSemanticExpansionScore(0.5, 0.5, [])).toBe(0);
  });
});

describe('computeSemanticDynamicsFallback', () => {
  it('returns neutral defaults for few segments (insufficient data)', () => {
    const segments = [seg('s0', 'A', 'hello world')];
    const result = computeSemanticDynamicsFallback(segments, []);
    expect(result.noveltyRate).toBe(0.5);
    expect(result.clusterConcentration).toBe(0.5);
    expect(result.explorationElaborationRatio).toBeCloseTo(0.5);
    expect(result.semanticExpansionScore).toBe(0);
  });

  it('detects low novelty with repeated words', () => {
    const segments = [];
    for (let i = 0; i < 10; i++) {
      segments.push(seg(`s${i}`, 'A', 'the quick brown fox jumps over the lazy dog'));
    }
    const result = computeSemanticDynamicsFallback(segments, []);
    expect(result.noveltyRate).toBeLessThan(0.3);
    expect(result.clusterConcentration).toBeGreaterThan(0.5);
  });

  it('detects high novelty with diverse words', () => {
    const segments = [
      seg('s0', 'A', 'quantum mechanics particle physics'),
      seg('s1', 'B', 'chocolate cake baking recipes dessert'),
      seg('s2', 'A', 'football stadium goals championship'),
      seg('s3', 'B', 'painting museum gallery modern abstract'),
      seg('s4', 'A', 'programming language compiler memory stack'),
    ];
    const result = computeSemanticDynamicsFallback(segments, []);
    expect(result.noveltyRate).toBeGreaterThan(0.5);
  });
});
