import type { ConversationState, MetricSnapshot, Intervention } from '@/types';

// --- State Colors ---

export const STATE_COLORS: Record<ConversationState, string> = {
  HEALTHY_EXPLORATION: '#34d399',   // emerald-400
  HEALTHY_ELABORATION: '#2dd4bf',   // teal-400
  DOMINANCE_RISK: '#fb7185',        // rose-400
  CONVERGENCE_RISK: '#fbbf24',      // amber-400
  STALLED_DISCUSSION: '#facc15',    // yellow-400
};

export const STATE_LABELS: Record<ConversationState, string> = {
  HEALTHY_EXPLORATION: 'Gesunde Exploration',
  HEALTHY_ELABORATION: 'Gesunde Elaboration',
  DOMINANCE_RISK: 'Dominanz-Risiko',
  CONVERGENCE_RISK: 'Konvergenz-Risiko',
  STALLED_DISCUSSION: 'Stagnation',
};

export const INTENT_LABELS: Record<string, string> = {
  PARTICIPATION_REBALANCING: 'Rebalancing',
  PERSPECTIVE_BROADENING: 'Broadening',
  REACTIVATION: 'Reactivation',
  ALLY_IMPULSE: 'Ally-Impuls',
  NORM_REINFORCEMENT: 'Regel-Erinnerung',
  GOAL_REFOCUS: 'Ziel-Refokus',
};

// --- Time Formatting ---

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function formatTimestamp(isoString: string, sessionStart: string): string {
  const elapsed = new Date(isoString).getTime() - new Date(sessionStart).getTime();
  const totalSeconds = Math.floor(elapsed / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// --- Metric Helpers ---

export function getSessionDurationMs(startedAt?: string, endedAt?: string): number {
  if (!startedAt) return 0;
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  return end - start;
}

export function computeStateDurations(metrics: MetricSnapshot[]): Record<ConversationState, number> {
  const durations: Record<ConversationState, number> = {
    HEALTHY_EXPLORATION: 0,
    HEALTHY_ELABORATION: 0,
    DOMINANCE_RISK: 0,
    CONVERGENCE_RISK: 0,
    STALLED_DISCUSSION: 0,
  };

  for (let i = 0; i < metrics.length; i++) {
    const state = metrics[i].inferred_state?.state;
    if (!state) continue;
    // Each snapshot represents ~10s interval
    const interval = i < metrics.length - 1
      ? new Date(metrics[i + 1].computed_at).getTime() - new Date(metrics[i].computed_at).getTime()
      : 10000;
    durations[state] += interval;
  }

  return durations;
}

export function computeRecoveryRate(interventions: Intervention[]): number {
  const withRecovery = interventions.filter((i) => i.recovered !== undefined && i.recovered !== null);
  if (withRecovery.length === 0) return 0;
  const recovered = withRecovery.filter((i) => i.recovered).length;
  return recovered / withRecovery.length;
}

export function computeInterventionImpact(
  intervention: Intervention,
  metrics: MetricSnapshot[],
  sessionStart: string,
) {
  const interventionTime = new Date(intervention.created_at).getTime();
  const startTime = new Date(sessionStart).getTime();

  // 3-min window before, 5-min window after
  const beforeWindow = 3 * 60 * 1000;
  const afterWindow = 5 * 60 * 1000;
  const reactionDelay = 30 * 1000; // skip first 30s after intervention

  const before = metrics.filter((m) => {
    const t = new Date(m.computed_at).getTime();
    return t >= interventionTime - beforeWindow && t < interventionTime;
  });

  const after = metrics.filter((m) => {
    const t = new Date(m.computed_at).getTime();
    return t > interventionTime + reactionDelay && t <= interventionTime + afterWindow;
  });

  if (before.length < 2 || after.length < 2) return null;

  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

  const results = [
    {
      metric: 'Partizipationsrisiko',
      before: avg(before.map((m) => m.participation?.participation_risk_score ?? 0)),
      after: avg(after.map((m) => m.participation?.participation_risk_score ?? 0)),
    },
    {
      metric: 'Novelty-Rate',
      before: avg(before.map((m) => m.semantic_dynamics?.novelty_rate ?? 0)),
      after: avg(after.map((m) => m.semantic_dynamics?.novelty_rate ?? 0)),
    },
    {
      metric: 'Stagnation',
      before: avg(before.map((m) => m.semantic_dynamics?.stagnation_duration_seconds ?? 0)),
      after: avg(after.map((m) => m.semantic_dynamics?.stagnation_duration_seconds ?? 0)),
    },
    {
      metric: 'Cluster-Konzentration',
      before: avg(before.map((m) => m.semantic_dynamics?.cluster_concentration ?? 0)),
      after: avg(after.map((m) => m.semantic_dynamics?.cluster_concentration ?? 0)),
    },
  ];

  return results.map((r) => ({
    ...r,
    // For risk/stagnation/concentration, lower is better
    improved: r.metric === 'Novelty-Rate' ? r.after > r.before : r.after < r.before,
    delta: r.after - r.before,
    beforeCount: before.length,
    afterCount: after.length,
  }));
}

// --- Speaker Colors ---

const SPEAKER_COLORS = [
  '#818cf8', // indigo-400
  '#34d399', // emerald-400
  '#fb923c', // orange-400
  '#f472b6', // pink-400
  '#38bdf8', // sky-400
  '#a78bfa', // violet-400
  '#fbbf24', // amber-400
  '#2dd4bf', // teal-400
];

export function getSpeakerColor(index: number): string {
  return SPEAKER_COLORS[index % SPEAKER_COLORS.length];
}
