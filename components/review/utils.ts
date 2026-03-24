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
      metric: 'Partizipations-Komposit',
      before: avg(before.map((m) => m.participation?.participation_composite ?? m.participation?.participation_risk_score ?? 0)),
      after: avg(after.map((m) => m.participation?.participation_composite ?? m.participation?.participation_risk_score ?? 0)),
      unit: 'pct' as const,
    },
    {
      metric: 'Novelty-Rate',
      before: avg(before.map((m) => m.semantic_dynamics?.novelty_rate ?? 0)),
      after: avg(after.map((m) => m.semantic_dynamics?.novelty_rate ?? 0)),
      unit: 'pct' as const,
    },
    {
      metric: 'Stagnation',
      before: avg(before.map((m) => m.semantic_dynamics?.stagnation_duration_seconds ?? 0)),
      after: avg(after.map((m) => m.semantic_dynamics?.stagnation_duration_seconds ?? 0)),
      unit: 'seconds' as const,
    },
    {
      metric: 'Cluster-Konzentration',
      before: avg(before.map((m) => m.semantic_dynamics?.cluster_concentration ?? 0)),
      after: avg(after.map((m) => m.semantic_dynamics?.cluster_concentration ?? 0)),
      unit: 'pct' as const,
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

export function formatImpactValue(value: number, unit: 'pct' | 'seconds'): string {
  if (unit === 'seconds') return `${Math.round(value)}s`;
  return `${Math.round(value * 100)}%`;
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

// --- Intent Chart Colors ---

export const INTENT_CHART_COLORS: Record<string, string> = {
  PARTICIPATION_REBALANCING: '#3b82f6',  // blue-500
  PERSPECTIVE_BROADENING: '#f97316',     // orange-500
  REACTIVATION: '#eab308',              // yellow-500
  ALLY_IMPULSE: '#22c55e',              // green-500
  NORM_REINFORCEMENT: '#ef4444',         // red-500
  GOAL_REFOCUS: '#06b6d4',              // cyan-500
};

// --- Speaking Time Estimation ---

export const AVG_SPEAKING_RATE_WPM = 130;

export function estimateSpeakingTimeMs(wordCount: number): number {
  return Math.round((wordCount / AVG_SPEAKING_RATE_WPM) * 60 * 1000);
}

// --- Idea Velocity KPIs ---

export interface IdeaVelocityKPIs {
  timeToFirstIdeaMs: number | null;
  avgTimeBetweenIdeasMs: number | null;
  fastestWindowCount: number;
  fastestWindowStartMs: number;
  longestGapMs: number | null;
  ideasPerMinute: number;
}

export function computeIdeaVelocityKPIs(
  ideas: Array<{ created_at: string; is_deleted: boolean }>,
  sessionStartedAt: string,
  sessionEndedAt?: string | null,
): IdeaVelocityKPIs {
  const activeIdeas = ideas
    .filter((i) => !i.is_deleted)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const sessionStart = new Date(sessionStartedAt).getTime();
  const sessionEnd = sessionEndedAt ? new Date(sessionEndedAt).getTime() : sessionStart;
  const durationMin = (sessionEnd - sessionStart) / 60000;

  if (activeIdeas.length === 0) {
    return {
      timeToFirstIdeaMs: null,
      avgTimeBetweenIdeasMs: null,
      fastestWindowCount: 0,
      fastestWindowStartMs: 0,
      longestGapMs: null,
      ideasPerMinute: 0,
    };
  }

  const timestamps = activeIdeas.map((i) => new Date(i.created_at).getTime());
  const timeToFirstIdeaMs = timestamps[0] - sessionStart;

  let avgTimeBetweenIdeasMs: number | null = null;
  let longestGapMs: number | null = null;
  if (timestamps.length >= 2) {
    let totalGap = 0;
    let maxGap = 0;
    for (let i = 1; i < timestamps.length; i++) {
      const gap = timestamps[i] - timestamps[i - 1];
      totalGap += gap;
      if (gap > maxGap) maxGap = gap;
    }
    avgTimeBetweenIdeasMs = totalGap / (timestamps.length - 1);
    longestGapMs = maxGap;
  }

  // Fastest 5-minute window (sliding, 30s step)
  const windowMs = 5 * 60 * 1000;
  const stepMs = 30 * 1000;
  let fastestWindowCount = 0;
  let fastestWindowStartMs = 0;
  for (let start = sessionStart; start <= sessionEnd - windowMs + stepMs; start += stepMs) {
    const end = start + windowMs;
    const count = timestamps.filter((t) => t >= start && t < end).length;
    if (count > fastestWindowCount) {
      fastestWindowCount = count;
      fastestWindowStartMs = start - sessionStart;
    }
  }

  return {
    timeToFirstIdeaMs,
    avgTimeBetweenIdeasMs,
    fastestWindowCount,
    fastestWindowStartMs,
    longestGapMs,
    ideasPerMinute: durationMin > 0 ? activeIdeas.length / durationMin : 0,
  };
}

// --- Traffic Light Rating ---

export type TrafficLight = 'green' | 'yellow' | 'red';

export function getTrafficLight(
  value: number,
  thresholds: { green: number; yellow: number },
  higherIsBetter: boolean,
): TrafficLight {
  if (higherIsBetter) {
    if (value >= thresholds.green) return 'green';
    if (value >= thresholds.yellow) return 'yellow';
    return 'red';
  } else {
    if (value <= thresholds.green) return 'green';
    if (value <= thresholds.yellow) return 'yellow';
    return 'red';
  }
}

// --- Strengths / Weaknesses Analyzer ---

export interface StrengthsWeaknesses {
  strengths: string[];
  weaknesses: string[];
}

export function analyzeStrengthsWeaknesses(kpis: {
  avgBalance: number;
  avgNovelty: number;
  avgDiversity: number;
  avgRisk: number;
  avgPiggybacking: number;
  avgGoalCoverage: number | null;
  healthyPct: number;
  recoveryRate: number;
  ideaCount: number;
  seedCount: number;
  interventionCount: number;
}): StrengthsWeaknesses {
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  if (kpis.avgBalance >= 0.7)
    strengths.push('Sehr ausgewogene Beteiligung aller Teilnehmer');
  else if (kpis.avgBalance < 0.5)
    weaknesses.push('Ungleichmässige Beteiligung — einige Teilnehmer waren deutlich stiller');

  if (kpis.avgNovelty >= 0.4)
    strengths.push('Hohe Neuheitsrate — viele frische Ideen eingebracht');
  else if (kpis.avgNovelty < 0.2)
    weaknesses.push('Niedrige Neuheitsrate — Diskussion kreiste um bekannte Themen');

  if (kpis.avgDiversity >= 0.6)
    strengths.push('Breite thematische Vielfalt in der Diskussion');
  else if (kpis.avgDiversity < 0.3)
    weaknesses.push('Geringe thematische Breite — Fokus auf wenige Cluster');

  if (kpis.healthyPct >= 70)
    strengths.push(`${kpis.healthyPct}% der Session in gesundem Zustand`);
  else if (kpis.healthyPct < 40)
    weaknesses.push(`Nur ${kpis.healthyPct}% der Session in gesundem Zustand`);

  if (kpis.avgRisk <= 0.2)
    strengths.push('Niedriges Partizipationsrisiko — alle waren aktiv');
  else if (kpis.avgRisk > 0.5)
    weaknesses.push('Hohes Partizipationsrisiko — Beteiligung war problematisch');

  if (kpis.recoveryRate >= 0.7 && kpis.interventionCount > 0)
    strengths.push('Hohe Recovery-Rate nach Interventionen');
  else if (kpis.recoveryRate < 0.3 && kpis.interventionCount > 1)
    weaknesses.push('Niedrige Recovery-Rate — Interventionen zeigten wenig Wirkung');

  if (kpis.seedCount >= 5)
    strengths.push(`${kpis.seedCount} originelle neue Ideen (Seeds) generiert`);
  else if (kpis.ideaCount > 0 && kpis.seedCount <= 1)
    weaknesses.push('Wenige wirklich neue Ideen — viele Erweiterungen bestehender Gedanken');

  if (kpis.avgGoalCoverage !== null) {
    if (kpis.avgGoalCoverage >= 0.7)
      strengths.push('Gute Abdeckung der definierten Ziele');
    else if (kpis.avgGoalCoverage < 0.3)
      weaknesses.push('Geringe Abdeckung der definierten Ziele');
  }

  if (kpis.avgPiggybacking > 0.5)
    weaknesses.push('Hoher Piggybacking-Score — wenig eigenständiges Denken');

  return {
    strengths: strengths.slice(0, 3),
    weaknesses: weaknesses.slice(0, 3),
  };
}

// --- Intervention Narrative Generator ---

export function generateInterventionNarrative(
  intervention: Intervention,
  impact: ReturnType<typeof computeInterventionImpact>,
  triggeredIdeaCount: number,
): string {
  const intentLabel = INTENT_LABELS[intervention.intent] || intervention.intent;
  const parts: string[] = [];

  if (intervention.recovered === true) {
    parts.push(`Die ${intentLabel}-Intervention war erfolgreich.`);
  } else if (intervention.recovered === false) {
    parts.push(`Die ${intentLabel}-Intervention zeigte begrenzte Wirkung.`);
  } else {
    parts.push(`${intentLabel}-Intervention wurde ausgelöst.`);
  }

  if (impact && impact.length > 0) {
    const improved = impact.filter((r) => r.improved);
    if (improved.length > 0) {
      const descriptions = improved.map((r) => {
        const delta = Math.abs(r.delta);
        if (r.unit === 'seconds') {
          return `${r.metric} um ${Math.round(delta)}s reduziert`;
        }
        return `${r.metric} um ${Math.round(delta * 100)} Pp. ${r.metric === 'Novelty-Rate' ? 'gesteigert' : 'gesenkt'}`;
      });
      parts.push(descriptions.join(', ') + '.');
    } else {
      parts.push('Keine der beobachteten Metriken hat sich verbessert.');
    }
  }

  if (triggeredIdeaCount > 0) {
    parts.push(
      triggeredIdeaCount === 1
        ? '1 neue Idee entstand innerhalb von 90 Sekunden.'
        : `${triggeredIdeaCount} neue Ideen entstanden innerhalb von 90 Sekunden.`
    );
  }

  if (intervention.recovery_score != null && intervention.recovery_score > 0) {
    parts.push(`Recovery-Score: ${Math.round(intervention.recovery_score * 100)}%.`);
  }

  return parts.join(' ');
}
