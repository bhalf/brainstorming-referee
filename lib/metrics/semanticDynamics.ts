// ============================================
// Semantic Dynamics Metrics — Idea-Space Analysis
// ============================================

import { TranscriptSegment, SemanticDynamicsMetrics, MetricSnapshot, ExperimentConfig } from '../types';
import { cosineSimilarity } from './embeddingCache';
import { DEFAULT_CONFIG } from '../config';

const MAX_SEGMENTS = 30;
const NOVELTY_WINDOW = 20;
const JACCARD_MERGE_THRESHOLD = 0.40;

const isActivityMarker = (seg: TranscriptSegment) => /^\[.*\]$/.test(seg.text.trim());

function getFinalSegments(segments: TranscriptSegment[]): TranscriptSegment[] {
  return segments.filter(s => s.isFinal && !isActivityMarker(s) && s.text.trim().length > 3);
}

// --- Novelty Rate ---
// Fraction of recent segments that introduce semantically new content.

export function computeNoveltyRate(
  segments: TranscriptSegment[],
  embeddings: Map<string, number[]>,
  threshold: number = DEFAULT_CONFIG.NOVELTY_COSINE_THRESHOLD,
): number {
  const finalSegs = getFinalSegments(segments).slice(-MAX_SEGMENTS);
  if (finalSegs.length < 2) return 0.5; // Neutral — insufficient data

  const recent = finalSegs.slice(-NOVELTY_WINDOW);
  let novelCount = 0;
  let evaluatedCount = 0;

  for (let i = 0; i < recent.length; i++) {
    const currentEmb = embeddings.get(recent[i].id);
    if (!currentEmb) continue;

    // First segment is always novel
    if (i === 0) {
      novelCount++;
      evaluatedCount++;
      continue;
    }

    // Compare with all preceding segments in the window.
    // Use MAX similarity: if the segment is very similar to ANY previous
    // segment, it's a repeat — even if it's different from others.
    // This prevents alternating phrases ("Hello"/"Thank you") from
    // being scored as novel.
    let maxSim = 0;
    let count = 0;
    for (let j = 0; j < i; j++) {
      const prevEmb = embeddings.get(recent[j].id);
      if (prevEmb) {
        const sim = cosineSimilarity(currentEmb, prevEmb);
        maxSim = Math.max(maxSim, sim);
        count++;
      }
    }

    if (count === 0) continue;
    evaluatedCount++;

    if (maxSim < threshold) {
      novelCount++;
    }
  }

  return evaluatedCount > 0 ? novelCount / evaluatedCount : 0.5;
}

// --- Cluster Concentration ---
// Greedy centroid clustering with HHI-based concentration metric.

interface Cluster {
  centroid: number[];
  size: number;
}

function addVectors(a: number[], b: number[]): number[] {
  return a.map((v, i) => v + (b[i] || 0));
}

function scaleVector(v: number[], s: number): number[] {
  return v.map(x => x * s);
}

export function computeClusterConcentration(
  segments: TranscriptSegment[],
  embeddings: Map<string, number[]>,
  clusterMergeThreshold: number = DEFAULT_CONFIG.CLUSTER_MERGE_THRESHOLD,
): number {
  const finalSegs = getFinalSegments(segments).slice(-MAX_SEGMENTS);
  const embeddedSegs = finalSegs.filter(s => embeddings.has(s.id));

  if (embeddedSegs.length < 2) return 0.5; // Neutral — insufficient data

  // Greedy centroid clustering
  const clusters: Cluster[] = [];
  const firstEmb = embeddings.get(embeddedSegs[0].id)!;
  clusters.push({ centroid: [...firstEmb], size: 1 });

  for (let i = 1; i < embeddedSegs.length; i++) {
    const emb = embeddings.get(embeddedSegs[i].id)!;

    // Find most similar cluster
    let maxSim = -1;
    let bestCluster = -1;
    for (let c = 0; c < clusters.length; c++) {
      const sim = cosineSimilarity(emb, clusters[c].centroid);
      if (sim > maxSim) {
        maxSim = sim;
        bestCluster = c;
      }
    }

    if (maxSim >= clusterMergeThreshold && bestCluster >= 0) {
      // Merge into existing cluster — update centroid as running mean
      const cluster = clusters[bestCluster];
      const newSize = cluster.size + 1;
      cluster.centroid = scaleVector(
        addVectors(scaleVector(cluster.centroid, cluster.size), emb),
        1 / newSize,
      );
      cluster.size = newSize;
    } else {
      // New cluster
      clusters.push({ centroid: [...emb], size: 1 });
    }
  }

  const numClusters = clusters.length;
  const numSegments = embeddedSegs.length;

  // Normalized HHI: standard measure from economics.
  // Raw HHI ranges from 1/n (uniform) to 1 (all in one cluster).
  // Normalize to 0-1: nHHI = (HHI - 1/n) / (1 - 1/n)
  const hhi = clusters.reduce((sum, c) => {
    const share = c.size / numSegments;
    return sum + share * share;
  }, 0);

  const minHHI = 1 / numSegments;
  const nHHI = numSegments > 1 ? (hhi - minHHI) / (1 - minHHI) : 0;

  return Math.max(0, Math.min(1, nHHI));
}

// --- Exploration / Elaboration Ratio ---
// Classifies each segment as "exploration" (new direction) or "elaboration" (deepening).

export function computeExplorationElaborationRatio(
  segments: TranscriptSegment[],
  embeddings: Map<string, number[]>,
  explorationThreshold: number = DEFAULT_CONFIG.EXPLORATION_COSINE_THRESHOLD,
  elaborationThreshold: number = DEFAULT_CONFIG.ELABORATION_COSINE_THRESHOLD,
): number {
  const finalSegs = getFinalSegments(segments).slice(-MAX_SEGMENTS);
  const recent = finalSegs.slice(-NOVELTY_WINDOW);

  let explorationCount = 0;
  let elaborationCount = 0;

  for (let i = 1; i < recent.length; i++) {
    const currentEmb = embeddings.get(recent[i].id);
    if (!currentEmb) continue;

    let totalSim = 0;
    let maxSim = 0;
    let count = 0;

    for (let j = 0; j < i; j++) {
      const prevEmb = embeddings.get(recent[j].id);
      if (prevEmb) {
        const sim = cosineSimilarity(currentEmb, prevEmb);
        totalSim += sim;
        maxSim = Math.max(maxSim, sim);
        count++;
      }
    }

    if (count === 0) continue;

    const avgSim = totalSim / count;

    if (avgSim < explorationThreshold) {
      explorationCount++;
    } else if (maxSim > elaborationThreshold) {
      elaborationCount++;
    }
    // Segments that are neither clearly exploration nor elaboration are uncounted
  }

  const total = explorationCount + elaborationCount;
  if (total === 0) return 0.5; // Neutral default
  return explorationCount / total;
}

// --- Semantic Expansion Score ---
// Whether the semantic space is expanding or contracting compared to recent history.

export function computeSemanticExpansionScore(
  currentConcentration: number,
  currentNoveltyRate: number,
  previousSnapshots: MetricSnapshot[],
): number {
  // Get last 5 snapshots that have semantic dynamics
  const withDynamics = previousSnapshots
    .filter(s => s.semanticDynamics)
    .slice(-5);

  if (withDynamics.length === 0) return 0; // Neutral when no history

  const avgPrevConcentration =
    withDynamics.reduce((sum, s) => sum + s.semanticDynamics!.clusterConcentration, 0) /
    withDynamics.length;

  const avgPrevNovelty =
    withDynamics.reduce((sum, s) => sum + s.semanticDynamics!.noveltyRate, 0) /
    withDynamics.length;

  const deltaConcentration = avgPrevConcentration - currentConcentration; // positive = less concentrated = expanding
  const deltaNovelty = currentNoveltyRate - avgPrevNovelty;               // positive = more novelty = expanding

  const score = 0.5 * deltaConcentration + 0.5 * deltaNovelty;
  return Math.max(-1, Math.min(1, score));
}

// --- Main Orchestrator (with embeddings) ---

export function computeSemanticDynamicsMetrics(
  segments: TranscriptSegment[],
  embeddings: Map<string, number[]>,
  previousSnapshots: MetricSnapshot[],
  config?: ExperimentConfig,
): SemanticDynamicsMetrics {
  const noveltyCosineThreshold = config?.NOVELTY_COSINE_THRESHOLD ?? DEFAULT_CONFIG.NOVELTY_COSINE_THRESHOLD;
  const clusterMergeThreshold = config?.CLUSTER_MERGE_THRESHOLD ?? DEFAULT_CONFIG.CLUSTER_MERGE_THRESHOLD;

  const explorationThreshold = config?.EXPLORATION_COSINE_THRESHOLD ?? DEFAULT_CONFIG.EXPLORATION_COSINE_THRESHOLD;
  const elaborationThreshold = config?.ELABORATION_COSINE_THRESHOLD ?? DEFAULT_CONFIG.ELABORATION_COSINE_THRESHOLD;

  const noveltyRate = computeNoveltyRate(segments, embeddings, noveltyCosineThreshold);
  const clusterConcentration = computeClusterConcentration(segments, embeddings, clusterMergeThreshold);
  const explorationElaborationRatio = computeExplorationElaborationRatio(segments, embeddings, explorationThreshold, elaborationThreshold);
  const semanticExpansionScore = computeSemanticExpansionScore(
    clusterConcentration,
    noveltyRate,
    previousSnapshots,
  );

  return {
    noveltyRate,
    clusterConcentration,
    explorationElaborationRatio,
    semanticExpansionScore,
  };
}

// --- Fallback (no embeddings) ---
// Uses Jaccard word-set similarity instead of cosine on embeddings.

// Stopwords for English and German — common function words that inflate Jaccard similarity
const STOPWORDS = new Set([
  // English
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was',
  'one', 'our', 'out', 'has', 'have', 'that', 'this', 'with', 'they', 'from', 'been',
  'will', 'also', 'just', 'more', 'some', 'than', 'them', 'then', 'very', 'what', 'when',
  'who', 'how', 'its', 'let', 'into', 'about', 'would', 'could', 'should', 'there',
  'their', 'which', 'other', 'were', 'does', 'done', 'being', 'these', 'those',
  // German
  'der', 'die', 'das', 'und', 'ist', 'ein', 'eine', 'für', 'von', 'mit', 'auf', 'den',
  'dem', 'des', 'sich', 'als', 'auch', 'nach', 'wie', 'über', 'nicht', 'noch', 'bei',
  'aber', 'aus', 'dass', 'hat', 'ich', 'wir', 'sie', 'man', 'mir', 'uns', 'was', 'war',
  'wird', 'haben', 'sind', 'oder', 'nur', 'schon', 'dann', 'eben', 'also', 'wenn',
  'doch', 'kann', 'hier', 'gibt', 'zum', 'zur', 'einen', 'einer', 'einem', 'eines',
]);

function getWordSet(text: string): Set<string> {
  return new Set(
    text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/)
      .filter(w => w.length > 2 && !STOPWORDS.has(w)),
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  const intersection = new Set([...a].filter(x => b.has(x)));
  const union = new Set([...a, ...b]);
  return union.size > 0 ? intersection.size / union.size : 0;
}

export function computeSemanticDynamicsFallback(
  segments: TranscriptSegment[],
  previousSnapshots: MetricSnapshot[],
): SemanticDynamicsMetrics {
  const finalSegs = getFinalSegments(segments).slice(-MAX_SEGMENTS);

  if (finalSegs.length < 2) {
    return {
      noveltyRate: 0.5,
      clusterConcentration: 0.5,
      explorationElaborationRatio: 0.5,
      semanticExpansionScore: 0,
    };
  }

  const wordSets = finalSegs.map(s => getWordSet(s.text));
  const recent = wordSets.slice(-NOVELTY_WINDOW);

  // Novelty: fraction with max Jaccard < 0.4 to any prior segment.
  // Uses MAX (not avg) so repeating ANY previous phrase is caught as "not novel".
  let novelCount = 1; // First is always novel
  let evalCount = 1;
  for (let i = 1; i < recent.length; i++) {
    let maxSim = 0;
    for (let j = 0; j < i; j++) {
      const sim = jaccardSimilarity(recent[i], recent[j]);
      maxSim = Math.max(maxSim, sim);
    }
    evalCount++;
    if (maxSim < JACCARD_MERGE_THRESHOLD) {
      novelCount++;
    }
  }
  const noveltyRate = evalCount > 0 ? novelCount / evalCount : 1;

  // Cluster concentration: greedy Jaccard clustering
  const clusters: { words: Set<string>; size: number }[] = [];
  clusters.push({ words: new Set(wordSets[0]), size: 1 });

  for (let i = 1; i < wordSets.length; i++) {
    let maxSim = -1;
    let bestCluster = -1;
    for (let c = 0; c < clusters.length; c++) {
      const sim = jaccardSimilarity(wordSets[i], clusters[c].words);
      if (sim > maxSim) {
        maxSim = sim;
        bestCluster = c;
      }
    }

    if (maxSim >= JACCARD_MERGE_THRESHOLD && bestCluster >= 0) {
      const cluster = clusters[bestCluster];
      for (const w of wordSets[i]) cluster.words.add(w);
      cluster.size++;
    } else {
      clusters.push({ words: new Set(wordSets[i]), size: 1 });
    }
  }

  // Normalized HHI (same formula as embedding path)
  const hhi = clusters.reduce((sum, c) => {
    const share = c.size / wordSets.length;
    return sum + share * share;
  }, 0);
  const minHHI = 1 / wordSets.length;
  const clusterConcentration = wordSets.length > 1
    ? Math.max(0, Math.min(1, (hhi - minHHI) / (1 - minHHI)))
    : 0;

  // Exploration ratio: Jaccard-based
  let explorationCount = 0;
  let elaborationCount = 0;
  for (let i = 1; i < recent.length; i++) {
    let totalSim = 0;
    let maxSim = 0;
    let count = 0;
    for (let j = 0; j < i; j++) {
      const sim = jaccardSimilarity(recent[i], recent[j]);
      totalSim += sim;
      maxSim = Math.max(maxSim, sim);
      count++;
    }
    if (count === 0) continue;
    const avgSim = totalSim / count;
    if (avgSim < JACCARD_MERGE_THRESHOLD) explorationCount++;
    else if (maxSim > 0.5) elaborationCount++;
  }
  const totalClassified = explorationCount + elaborationCount;
  const explorationElaborationRatio = totalClassified > 0 ? explorationCount / totalClassified : 0.5;

  const semanticExpansionScore = computeSemanticExpansionScore(
    clusterConcentration,
    noveltyRate,
    previousSnapshots,
  );

  return {
    noveltyRate,
    clusterConcentration,
    explorationElaborationRatio,
    semanticExpansionScore,
  };
}
