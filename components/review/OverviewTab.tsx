'use client';

import { useMemo } from 'react';
import type { SessionExport } from '@/types';
import {
  formatDuration,
  getSessionDurationMs,
  computeRecoveryRate,
  computeStateDurations,
  analyzeStrengthsWeaknesses,
  STATE_LABELS,
  INTENT_LABELS,
} from './utils';

interface Props {
  data: SessionExport;
}

export default function OverviewTab({ data }: Props) {
  const { session, participants, metrics, interventions, ideas, goals, summary } = data;

  const durationMs = getSessionDurationMs(session.started_at, session.ended_at);
  const recoveryRate = computeRecoveryRate(interventions);
  const stateDurations = computeStateDurations(metrics);
  const totalStateMs = Object.values(stateDurations).reduce((a, b) => a + b, 0);
  const healthyMs = (stateDurations.HEALTHY_EXPLORATION || 0) + (stateDurations.HEALTHY_ELABORATION || 0);
  const healthyPct = totalStateMs > 0 ? Math.round((healthyMs / totalStateMs) * 100) : 0;

  const activeIdeas = ideas.filter((i) => !i.is_deleted);

  const kpis = useMemo(() => {
    if (metrics.length === 0) return null;

    const avgNovelty = metrics.reduce((s, m) => s + (m.semantic_dynamics?.novelty_rate ?? 0), 0) / metrics.length;
    const avgDiversity = metrics.reduce((s, m) => s + (m.semantic_dynamics?.diversity ?? 0.5), 0) / metrics.length;
    const avgBalance = metrics.reduce((s, m) => s + (m.participation?.balance ?? 1), 0) / metrics.length;
    const avgRisk = metrics.reduce((s, m) => s + (m.participation?.participation_composite ?? m.participation?.participation_risk_score ?? 0), 0) / metrics.length;
    const avgPiggybacking = metrics.reduce((s, m) => s + (m.semantic_dynamics?.piggybacking_score ?? 0), 0) / metrics.length;

    const leafGoals = goals.filter((g) => !goals.some((c) => c.parent_id === g.id));
    const avgGoalCoverage = leafGoals.length > 0
      ? leafGoals.reduce((s, g) => s + g.coverage_score, 0) / leafGoals.length
      : null;

    return {
      avgNovelty,
      avgDiversity,
      avgBalance,
      avgRisk,
      avgPiggybacking,
      avgGoalCoverage,
      seedCount: activeIdeas.filter((i) => i.novelty_role === 'seed').length,
    };
  }, [metrics, goals, activeIdeas]);

  const strengthsWeaknesses = useMemo(() => {
    if (!kpis) return null;
    return analyzeStrengthsWeaknesses({
      avgBalance: kpis.avgBalance,
      avgNovelty: kpis.avgNovelty,
      avgDiversity: kpis.avgDiversity,
      avgRisk: kpis.avgRisk,
      avgPiggybacking: kpis.avgPiggybacking,
      avgGoalCoverage: kpis.avgGoalCoverage,
      healthyPct,
      recoveryRate,
      ideaCount: activeIdeas.length,
      seedCount: kpis.seedCount,
      interventionCount: interventions.length,
    });
  }, [kpis, healthyPct, recoveryRate, activeIdeas.length, interventions.length]);

  // Intervention breakdown by intent
  const intentCounts: Record<string, number> = {};
  for (const iv of interventions) {
    intentCounts[iv.intent] = (intentCounts[iv.intent] || 0) + 1;
  }

  return (
    <div className="space-y-5">
      {/* Hero: 4 Key Numbers */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <HeroCard
          label="Dauer"
          value={formatDuration(durationMs)}
          sub={`${participants.length} Teilnehmer`}
        />
        <HeroCard
          label="Gesundheit"
          value={`${healthyPct}%`}
          color={healthyPct >= 60 ? 'emerald' : healthyPct >= 40 ? 'amber' : 'rose'}
          sub="in gesundem Zustand"
        />
        <HeroCard
          label="Interventionen"
          value={String(interventions.length)}
          sub={interventions.length > 0 ? `${Math.round(recoveryRate * 100)}% Recovery` : 'keine nötig'}
          color={interventions.length === 0 ? 'emerald' : recoveryRate >= 0.6 ? 'emerald' : recoveryRate >= 0.3 ? 'amber' : 'rose'}
        />
        <HeroCard
          label="Ideen"
          value={String(activeIdeas.length)}
          sub={kpis ? `${kpis.seedCount} neue Seeds` : undefined}
        />
      </div>

      {/* State Distribution Bar */}
      {totalStateMs > 0 && (
        <div className="glass p-4 space-y-2.5">
          <div className="w-full bg-white/[0.06] rounded-full h-2.5 overflow-hidden flex">
            {Object.entries(stateDurations).map(([state, ms]) => {
              const pct = (ms / totalStateMs) * 100;
              if (pct < 1) return null;
              const colors: Record<string, string> = {
                HEALTHY_EXPLORATION: 'bg-emerald-400',
                HEALTHY_ELABORATION: 'bg-teal-400',
                DOMINANCE_RISK: 'bg-rose-400',
                CONVERGENCE_RISK: 'bg-amber-400',
                STALLED_DISCUSSION: 'bg-yellow-400',
              };
              return (
                <div
                  key={state}
                  className={`h-full ${colors[state] || 'bg-white/20'}`}
                  style={{ width: `${pct}%` }}
                  title={`${STATE_LABELS[state as keyof typeof STATE_LABELS]}: ${Math.round(pct)}%`}
                />
              );
            })}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-tertiary)]">
            {Object.entries(stateDurations)
              .filter(([, ms]) => ms > 0)
              .map(([state, ms]) => (
                <span key={state} className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${
                    state.startsWith('HEALTHY') ? 'bg-emerald-400' :
                    state === 'DOMINANCE_RISK' ? 'bg-rose-400' :
                    state === 'CONVERGENCE_RISK' ? 'bg-amber-400' : 'bg-yellow-400'
                  }`} />
                  {STATE_LABELS[state as keyof typeof STATE_LABELS]}: {formatDuration(ms)}
                </span>
              ))}
          </div>
        </div>
      )}

      {/* Session Summary */}
      {summary?.content && (
        <div className="glass p-5 space-y-2">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)]">Zusammenfassung</h3>
          <p className="text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">
            {summary.content}
          </p>
        </div>
      )}

      {/* Strengths / Weaknesses */}
      {strengthsWeaknesses && (strengthsWeaknesses.strengths.length > 0 || strengthsWeaknesses.weaknesses.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {strengthsWeaknesses.strengths.length > 0 && (
            <div className="glass p-4 space-y-2">
              <h3 className="text-sm font-semibold text-emerald-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Stärken
              </h3>
              <ul className="space-y-1.5">
                {strengthsWeaknesses.strengths.map((s, i) => (
                  <li key={i} className="text-xs text-[var(--text-secondary)] flex items-start gap-2">
                    <span className="text-emerald-400 mt-0.5 shrink-0">+</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {strengthsWeaknesses.weaknesses.length > 0 && (
            <div className="glass p-4 space-y-2">
              <h3 className="text-sm font-semibold text-rose-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-400" />
                Verbesserungspotenzial
              </h3>
              <ul className="space-y-1.5">
                {strengthsWeaknesses.weaknesses.map((w, i) => (
                  <li key={i} className="text-xs text-[var(--text-secondary)] flex items-start gap-2">
                    <span className="text-rose-400 mt-0.5 shrink-0">-</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Compact Intervention Summary */}
      {interventions.length > 0 && (
        <div className="glass p-4 space-y-2">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)]">Interventionen</h3>
          <div className="flex flex-wrap gap-3 text-xs">
            {Object.entries(intentCounts).map(([intent, count]) => (
              <span key={intent} className="flex items-center gap-1.5 text-[var(--text-tertiary)]">
                <span className="font-mono text-[var(--text-secondary)]">{count}x</span>
                {INTENT_LABELS[intent] || intent}
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${recoveryRate >= 0.6 ? 'bg-emerald-400' : recoveryRate >= 0.3 ? 'bg-amber-400' : 'bg-rose-400'}`} />
              <span className="text-[var(--text-tertiary)]">Recovery: {Math.round(recoveryRate * 100)}%</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function HeroCard({ label, value, sub, color }: {
  label: string;
  value: string;
  sub?: string;
  color?: 'emerald' | 'amber' | 'rose';
}) {
  const colorClass = color === 'emerald' ? 'text-emerald-400'
    : color === 'amber' ? 'text-amber-400'
    : color === 'rose' ? 'text-rose-400'
    : 'text-[var(--text-primary)]';

  return (
    <div className="glass p-4">
      <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider mb-1">{label}</p>
      <div className={`text-2xl font-bold tracking-tight ${colorClass}`}>{value}</div>
      {sub && <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{sub}</p>}
    </div>
  );
}
