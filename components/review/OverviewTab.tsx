'use client';

import type { SessionExport } from '@/types';
import {
  formatDuration,
  getSessionDurationMs,
  computeRecoveryRate,
  computeStateDurations,
  STATE_LABELS,
  INTENT_LABELS,
} from './utils';

interface Props {
  data: SessionExport;
}

export default function OverviewTab({ data }: Props) {
  const { session, participants, segments, metrics, interventions, ideas, connections, summary } = data;

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

  // Intervention breakdown by intent
  const intentCounts: Record<string, number> = {};
  for (const iv of interventions) {
    intentCounts[iv.intent] = (intentCounts[iv.intent] || 0) + 1;
  }

  return (
    <div className="space-y-5">
      {/* Key Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard label="Dauer" value={formatDuration(durationMs)} />
        <StatCard label="Teilnehmer" value={String(participants.length)} />
        <StatCard label="Segmente" value={String(segments.filter((s) => s.is_final).length)} />
        <StatCard label="Interventionen" value={String(interventions.length)} />
        <StatCard label="Ideen" value={String(ideas.filter((i) => !i.is_deleted).length)} />
      </div>

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
            <h3 className="text-sm font-semibold text-[var(--text-secondary)]">Redeanteile</h3>
            <div className="space-y-2">
              {Object.entries(volumeShare)
                .sort(([, a], [, b]) => b - a)
                .map(([speaker, share]) => {
                  const participant = participants.find((p) => p.livekit_identity === speaker);
                  const name = participant?.display_name || speaker;
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
                {ideas.filter((i) => !i.is_deleted).length}
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
            const activeIdeas = ideas.filter((i) => !i.is_deleted);
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
              tangent: { label: '↯ Tangenten', color: 'text-orange-400' },
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

      {/* Session Summary */}
      {summary?.content && (
        <div className="glass p-5 space-y-2">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)]">Zusammenfassung</h3>
          <p className="text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">
            {summary.content}
          </p>
        </div>
      )}
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
