'use client';

import { useMemo } from 'react';
import type { SessionExport } from '@/types';
import {
  formatDuration,
  getSessionDurationMs,
  computeRecoveryRate,
  computeStateDurations,
  computeIdeaVelocityKPIs,
  analyzeStrengthsWeaknesses,
  getTrafficLight,
  STATE_LABELS,
  INTENT_LABELS,
  type TrafficLight,
} from './utils';

interface Props {
  data: SessionExport;
}

export default function OverviewTab({ data }: Props) {
  const { session, participants, segments, metrics, interventions, ideas, connections, goals, summary } = data;

  const durationMs = getSessionDurationMs(session.started_at, session.ended_at);
  const recoveryRate = computeRecoveryRate(interventions);
  const stateDurations = computeStateDurations(metrics);
  const totalStateMs = Object.values(stateDurations).reduce((a, b) => a + b, 0);
  const healthyMs = (stateDurations.HEALTHY_EXPLORATION || 0) + (stateDurations.HEALTHY_ELABORATION || 0);
  const healthyPct = totalStateMs > 0 ? Math.round((healthyMs / totalStateMs) * 100) : 0;

  // Speaking shares — prefer cumulative (whole session) over windowed snapshot
  const lastMetric = metrics[metrics.length - 1];
  const volumeShare = lastMetric?.participation?.cumulative?.volume_share
    ?? lastMetric?.participation?.volume_share
    ?? {};
  const cumulative = lastMetric?.participation?.cumulative;

  // Intervention breakdown by intent
  const intentCounts: Record<string, number> = {};
  for (const iv of interventions) {
    intentCounts[iv.intent] = (intentCounts[iv.intent] || 0) + 1;
  }

  // Active ideas
  const activeIdeas = ideas.filter((i) => !i.is_deleted);

  // Session-level KPIs
  const kpis = useMemo(() => {
    if (metrics.length === 0) return null;

    const avgNovelty = metrics.reduce((s, m) => s + (m.semantic_dynamics?.novelty_rate ?? 0), 0) / metrics.length;
    const avgDiversity = metrics.reduce((s, m) => s + (m.semantic_dynamics?.diversity ?? 0.5), 0) / metrics.length;
    const avgBalance = metrics.reduce((s, m) => s + (m.participation?.balance ?? 1), 0) / metrics.length;
    const avgRisk = metrics.reduce((s, m) => s + (m.participation?.participation_composite ?? m.participation?.participation_risk_score ?? 0), 0) / metrics.length;
    const avgPiggybacking = metrics.reduce((s, m) => s + (m.semantic_dynamics?.piggybacking_score ?? 0), 0) / metrics.length;
    const avgExploration = metrics.reduce((s, m) => s + (m.semantic_dynamics?.exploration_elaboration_ratio ?? 0.5), 0) / metrics.length;

    // Goal coverage (leaf goals)
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
      avgExploration,
      avgGoalCoverage,
      ideaCount: activeIdeas.length,
      seedCount: activeIdeas.filter((i) => i.novelty_role === 'seed').length,
    };
  }, [metrics, goals, activeIdeas]);

  const ideaVelocity = useMemo(
    () => computeIdeaVelocityKPIs(ideas, session.started_at || session.created_at, session.ended_at),
    [ideas, session.started_at, session.created_at, session.ended_at]
  );

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

  return (
    <div className="space-y-5">
      {/* Session Config Header */}
      <div className="flex flex-wrap gap-2 text-xs text-[var(--text-tertiary)]">
        {session.moderation_level && session.moderation_level !== 'none' && (
          <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full">
            {session.moderation_level === 'moderation_ally' ? 'Moderation + Ally' : 'Moderation'}
          </span>
        )}
        {session.planned_duration_minutes && (
          <span className="bg-white/[0.06] px-2 py-0.5 rounded-full">
            Geplant: {session.planned_duration_minutes}min
          </span>
        )}
        {session.language && (
          <span className="bg-white/[0.06] px-2 py-0.5 rounded-full">
            {session.language}
          </span>
        )}
        {(session.enabled_features || []).map((f) => (
          <span key={f} className="bg-white/[0.06] px-2 py-0.5 rounded-full">{f}</span>
        ))}
      </div>

      {/* Session Summary (promoted to top) */}
      {summary?.content && (
        <div className="glass p-5 space-y-2 border-l-4 border-indigo-500/40">
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

      {/* Key Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard label="Dauer" value={formatDuration(durationMs)} />
        <StatCard label="Teilnehmer" value={String(participants.length)} />
        <StatCard label="Segmente" value={String(segments.filter((s) => s.is_final).length)} />
        <StatCard label="Interventionen" value={String(interventions.length)} />
        <StatCard label="Ideen" value={String(activeIdeas.length)} />
      </div>

      {/* Session KPIs */}
      {kpis && (
        <div className="glass p-5 space-y-3">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)]">Session-Kennzahlen</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <KpiCard label="Partizipations-Balance" value={`${Math.round(kpis.avgBalance * 100)}%`} rating={getTrafficLight(kpis.avgBalance, { green: 0.7, yellow: 0.5 }, true)} />
            <KpiCard label="Avg. Novelty-Rate" value={`${Math.round(kpis.avgNovelty * 100)}%`} rating={getTrafficLight(kpis.avgNovelty, { green: 0.3, yellow: 0.15 }, true)} />
            <KpiCard label="Avg. Diversität" value={`${Math.round(kpis.avgDiversity * 100)}%`} rating={getTrafficLight(kpis.avgDiversity, { green: 0.4, yellow: 0.25 }, true)} />
            <KpiCard label="Avg. Partizipationsrisiko" value={`${Math.round(kpis.avgRisk * 100)}%`} rating={getTrafficLight(kpis.avgRisk, { green: 0.3, yellow: 0.5 }, false)} />
            <KpiCard label="Exploration/Elaboration" value={`${Math.round(kpis.avgExploration * 100)}%`} />
            <KpiCard label="Piggybacking" value={`${Math.round(kpis.avgPiggybacking * 100)}%`} />
            <KpiCard label="Neue Ideen (Seeds)" value={`${kpis.seedCount}/${kpis.ideaCount}`} />
            {kpis.avgGoalCoverage !== null && (
              <KpiCard label="Zielabdeckung" value={`${Math.round(kpis.avgGoalCoverage * 100)}%`} rating={getTrafficLight(kpis.avgGoalCoverage, { green: 0.5, yellow: 0.3 }, true)} />
            )}
          </div>
        </div>
      )}

      {/* Idea Velocity KPIs */}
      {ideaVelocity.timeToFirstIdeaMs !== null && (
        <div className="glass p-5 space-y-3">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)]">Ideen-Dynamik</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <KpiCard
              label="Erste Idee nach"
              value={formatDuration(ideaVelocity.timeToFirstIdeaMs)}
              rating={getTrafficLight(ideaVelocity.timeToFirstIdeaMs, { green: 3 * 60 * 1000, yellow: 6 * 60 * 1000 }, false)}
            />
            {ideaVelocity.avgTimeBetweenIdeasMs !== null && (
              <KpiCard label="Avg. Abstand" value={formatDuration(ideaVelocity.avgTimeBetweenIdeasMs)} />
            )}
            <KpiCard label="Ideen/Minute" value={ideaVelocity.ideasPerMinute.toFixed(1)} />
            {ideaVelocity.fastestWindowCount > 0 && (
              <KpiCard label="Beste 5min" value={`${ideaVelocity.fastestWindowCount} Ideen`} />
            )}
            {ideaVelocity.longestGapMs !== null && (
              <KpiCard
                label="Längste Pause"
                value={formatDuration(ideaVelocity.longestGapMs)}
                rating={getTrafficLight(ideaVelocity.longestGapMs, { green: 5 * 60 * 1000, yellow: 8 * 60 * 1000 }, false)}
              />
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Conversation Quality */}
        <div className="glass p-5 space-y-3">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)]">Gesprächsqualität</h3>
          <div className="flex items-center gap-3">
            <div className="text-3xl font-bold tracking-tight">
              <span className={healthyPct >= 60 ? 'text-emerald-400' : healthyPct >= 40 ? 'text-amber-400' : 'text-rose-400'}>
                {healthyPct}%
              </span>
            </div>
            <p className="text-xs text-[var(--text-tertiary)]">
              der Session in gesundem Zustand
            </p>
          </div>
          <div className="w-full bg-white/[0.06] rounded-full h-2 overflow-hidden flex">
            {Object.entries(stateDurations).map(([state, ms]) => {
              const pct = totalStateMs > 0 ? (ms / totalStateMs) * 100 : 0;
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

        {/* Intervention Summary */}
        <div className="glass p-5 space-y-3">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)]">Interventionen</h3>
          {interventions.length > 0 ? (
            <>
              <div className="flex items-center gap-3">
                <div className="text-3xl font-bold tracking-tight">
                  <span className={recoveryRate >= 0.6 ? 'text-emerald-400' : recoveryRate >= 0.3 ? 'text-amber-400' : 'text-rose-400'}>
                    {Math.round(recoveryRate * 100)}%
                  </span>
                </div>
                <p className="text-xs text-[var(--text-tertiary)]">
                  Recovery-Rate
                </p>
              </div>
              <div className="space-y-1.5">
                {Object.entries(intentCounts).map(([intent, count]) => (
                  <div key={intent} className="flex items-center justify-between text-xs">
                    <span className="text-[var(--text-tertiary)]">{INTENT_LABELS[intent] || intent}</span>
                    <span className="text-[var(--text-secondary)] font-mono">{count}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-[var(--text-tertiary)]">Keine Interventionen in dieser Session.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Speaking Shares */}
        {Object.keys(volumeShare).length > 0 && (
          <div className="glass p-5 space-y-3">
            <h3 className="text-sm font-semibold text-[var(--text-secondary)]">
              Redeanteile
              {cumulative && <span className="text-[10px] text-[var(--text-tertiary)] ml-2 font-normal">(Gesamte Session)</span>}
            </h3>
            {cumulative && (
              <div className="flex gap-4 text-xs text-[var(--text-tertiary)]">
                <span>Gesamt: {cumulative.total_words} Wörter</span>
                <span>{cumulative.total_turns} Turns</span>
                <span>Balance: {Math.round(cumulative.balance * 100)}%</span>
              </div>
            )}
            <div className="space-y-2">
              {Object.entries(volumeShare)
                .sort(([, a], [, b]) => b - a)
                .map(([speaker, share]) => {
                  // volume_share keys are display names (mapped by backend)
                  const name = speaker;
                  const pct = Math.round(share * 100);
                  return (
                    <div key={speaker} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[var(--text-secondary)]">{name}</span>
                        <span className="font-mono text-[var(--text-tertiary)]">{pct}%</span>
                      </div>
                      <div className="w-full bg-white/[0.06] rounded-full h-1.5">
                        <div
                          className="bg-indigo-400 h-1.5 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Ideas + Connections */}
        <div className="glass p-5 space-y-3">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)]">Ideen</h3>
          <div className="flex items-center gap-6">
            <div>
              <div className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">
                {activeIdeas.length}
              </div>
              <p className="text-xs text-[var(--text-tertiary)]">Ideen generiert</p>
            </div>
            <div>
              <div className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">
                {connections.length}
              </div>
              <p className="text-xs text-[var(--text-tertiary)]">Verbindungen</p>
            </div>
          </div>
          {/* Novelty role breakdown */}
          {(() => {
            const roleCounts: Record<string, number> = {};
            for (const idea of activeIdeas) {
              if (idea.novelty_role) {
                roleCounts[idea.novelty_role] = (roleCounts[idea.novelty_role] || 0) + 1;
              }
            }
            const roleLabels: Record<string, { label: string; color: string }> = {
              seed: { label: '✦ Neue Ideen', color: 'text-green-400' },
              extension: { label: '↗ Erweiterungen', color: 'text-blue-400' },
              variant: { label: '≈ Varianten', color: 'text-purple-400' },
              tangent: { label: '↝ Verwandte', color: 'text-orange-400' },
            };
            const entries = Object.entries(roleCounts);
            if (entries.length === 0) return null;
            return (
              <div className="flex flex-wrap gap-3 text-xs">
                {entries.map(([role, count]) => {
                  const cfg = roleLabels[role];
                  return cfg ? (
                    <span key={role} className={`${cfg.color}`}>
                      {cfg.label}: <span className="font-mono">{count}</span>
                    </span>
                  ) : null;
                })}
              </div>
            );
          })()}
          {/* Source context breakdown */}
          {(() => {
            const srcCounts = { organic: 0, moderator_triggered: 0, ally_triggered: 0 };
            for (const idea of activeIdeas) {
              const ctx = idea.source_context || 'organic';
              if (ctx in srcCounts) srcCounts[ctx as keyof typeof srcCounts]++;
            }
            const triggered = srcCounts.moderator_triggered + srcCounts.ally_triggered;
            if (triggered === 0) return null;
            return (
              <div className="text-xs text-[var(--text-tertiary)]">
                {srcCounts.organic} spontan, {srcCounts.moderator_triggered} nach Moderation, {srcCounts.ally_triggered} nach Ally
              </div>
            );
          })()}
          {connections.length > 0 && (
            <div className="flex flex-wrap gap-2 text-xs">
              {Object.entries(
                connections.reduce<Record<string, number>>((acc, c) => {
                  const type = c.connection_type || 'unknown';
                  acc[type] = (acc[type] || 0) + 1;
                  return acc;
                }, {})
              ).map(([type, count]) => (
                <span key={type} className="bg-white/[0.06] px-2 py-1 rounded-md text-[var(--text-tertiary)]">
                  {type}: {count}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-sm p-4 text-center">
      <div className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">{value}</div>
      <p className="text-xs text-[var(--text-tertiary)] mt-1">{label}</p>
    </div>
  );
}

function KpiCard({ label, value, good, rating }: { label: string; value: string; good?: boolean; rating?: TrafficLight }) {
  const trafficDot: Record<TrafficLight, string> = {
    green: 'bg-emerald-400',
    yellow: 'bg-amber-400',
    red: 'bg-rose-400',
  };
  const textColor = rating
    ? (rating === 'green' ? 'text-emerald-400' : rating === 'yellow' ? 'text-amber-400' : 'text-rose-400')
    : (good === true ? 'text-emerald-400' : good === false ? 'text-rose-400' : 'text-[var(--text-primary)]');

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
