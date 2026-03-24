'use client';

import { useMemo } from 'react';
import type { SessionExport } from '@/types';
import { getTrafficLight, type TrafficLight } from './utils';

interface Props {
  data: SessionExport;
}

export default function SessionKPIs({ data }: Props) {
  const { metrics, ideas, goals } = data;

  const activeIdeas = useMemo(() => ideas.filter((i) => !i.is_deleted), [ideas]);

  const kpis = useMemo(() => {
    if (metrics.length === 0) return null;

    const avgNovelty = metrics.reduce((s, m) => s + (m.semantic_dynamics?.novelty_rate ?? 0), 0) / metrics.length;
    const avgDiversity = metrics.reduce((s, m) => s + (m.semantic_dynamics?.diversity ?? 0.5), 0) / metrics.length;
    const avgBalance = metrics.reduce((s, m) => s + (m.participation?.balance ?? 1), 0) / metrics.length;
    const avgRisk = metrics.reduce((s, m) => s + (m.participation?.participation_composite ?? m.participation?.participation_risk_score ?? 0), 0) / metrics.length;
    const avgExploration = metrics.reduce((s, m) => s + (m.semantic_dynamics?.exploration_elaboration_ratio ?? 0.5), 0) / metrics.length;
    const avgPiggybacking = metrics.reduce((s, m) => s + (m.semantic_dynamics?.piggybacking_score ?? 0), 0) / metrics.length;

    const leafGoals = goals.filter((g) => !goals.some((c) => c.parent_id === g.id));
    const avgGoalCoverage = leafGoals.length > 0
      ? leafGoals.reduce((s, g) => s + g.coverage_score, 0) / leafGoals.length
      : null;

    return { avgNovelty, avgDiversity, avgBalance, avgRisk, avgExploration, avgPiggybacking, avgGoalCoverage };
  }, [metrics, goals]);

  if (!kpis) return null;

  return (
    <div className="glass p-5 space-y-3">
      <h3 className="text-sm font-semibold text-[var(--text-secondary)]">Session-Durchschnitte</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <KpiCard label="Partizipations-Balance" value={`${Math.round(kpis.avgBalance * 100)}%`} rating={getTrafficLight(kpis.avgBalance, { green: 0.7, yellow: 0.5 }, true)} />
        <KpiCard label="Novelty-Rate" value={`${Math.round(kpis.avgNovelty * 100)}%`} rating={getTrafficLight(kpis.avgNovelty, { green: 0.3, yellow: 0.15 }, true)} />
        <KpiCard label="Diversität" value={`${Math.round(kpis.avgDiversity * 100)}%`} rating={getTrafficLight(kpis.avgDiversity, { green: 0.4, yellow: 0.25 }, true)} />
        <KpiCard label="Partizipationsrisiko" value={`${Math.round(kpis.avgRisk * 100)}%`} rating={getTrafficLight(kpis.avgRisk, { green: 0.3, yellow: 0.5 }, false)} />
        <KpiCard label="Exploration/Elaboration" value={`${Math.round(kpis.avgExploration * 100)}%`} />
        <KpiCard label="Piggybacking" value={`${Math.round(kpis.avgPiggybacking * 100)}%`} />
        <KpiCard label="Seeds / Ideen" value={`${activeIdeas.filter((i) => i.novelty_role === 'seed').length}/${activeIdeas.length}`} />
        {kpis.avgGoalCoverage !== null && (
          <KpiCard label="Zielabdeckung" value={`${Math.round(kpis.avgGoalCoverage * 100)}%`} rating={getTrafficLight(kpis.avgGoalCoverage, { green: 0.5, yellow: 0.3 }, true)} />
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value, rating }: { label: string; value: string; rating?: TrafficLight }) {
  const trafficDot: Record<TrafficLight, string> = {
    green: 'bg-emerald-400',
    yellow: 'bg-amber-400',
    red: 'bg-rose-400',
  };
  const textColor = rating
    ? (rating === 'green' ? 'text-emerald-400' : rating === 'yellow' ? 'text-amber-400' : 'text-rose-400')
    : 'text-[var(--text-primary)]';

  return (
    <div className="glass-sm p-3 text-center">
      <div className="flex items-center justify-center gap-1.5">
        {rating && <span className={`w-2 h-2 rounded-full ${trafficDot[rating]}`} />}
        <span className={`text-lg font-bold tracking-tight ${textColor}`}>{value}</span>
      </div>
      <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">{label}</p>
    </div>
  );
}
