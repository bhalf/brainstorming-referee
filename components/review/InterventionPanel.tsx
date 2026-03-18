'use client';

import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { SessionExport } from '@/types';
import { INTENT_LABELS, formatTimestamp, computeInterventionImpact, formatImpactValue, generateInterventionNarrative } from './utils';

interface Props {
  data: SessionExport;
}

export default function InterventionPanel({ data }: Props) {
  const { session, interventions, metrics, ideas } = data;
  const sessionStart = session.started_at || session.created_at;
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (interventions.length === 0) {
    return (
      <div className="glass p-8 text-center">
        <p className="text-sm text-[var(--text-tertiary)]">Keine Interventionen in dieser Session.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Intervention Timeline */}
      <div className="glass p-5 space-y-3">
        <h3 className="text-sm font-semibold text-[var(--text-secondary)]">Interventions-Verlauf</h3>
        <div className="space-y-2">
          {interventions.map((iv) => {
            const isExpanded = expandedId === iv.id;
            return (
              <div key={iv.id} className="glass-sm rounded-xl overflow-hidden">
                <button
                  className="w-full text-left p-3.5 flex items-start gap-3 hover:bg-white/[0.02] transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : iv.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-[var(--text-tertiary)]">
                        {formatTimestamp(iv.created_at, sessionStart)}
                      </span>
                      <IntentBadge intent={iv.intent} />
                      {iv.recovered !== undefined && iv.recovered !== null && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                          iv.recovered
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}>
                          {iv.recovered ? 'Recovered' : 'Not recovered'}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[var(--text-primary)] mt-1.5 line-clamp-2">{iv.text}</p>
                  </div>
                  <svg
                    width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className={`text-[var(--text-tertiary)] shrink-0 mt-1 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {isExpanded && (
                  <div className="px-3.5 pb-3.5 border-t border-white/[0.06] pt-3 space-y-2 animate-fade-in">
                    {/* Narrative summary */}
                    <NarrativeSummary
                      intervention={iv}
                      metrics={metrics}
                      ideas={ideas}
                      sessionStart={sessionStart}
                    />
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      {iv.trigger && (
                        <div>
                          <span className="text-[var(--text-tertiary)]">Trigger</span>
                          <p className="text-[var(--text-secondary)] mt-0.5">{iv.trigger}</p>
                        </div>
                      )}
                      {iv.audio_duration_ms !== undefined && iv.audio_duration_ms !== null && (
                        <div>
                          <span className="text-[var(--text-tertiary)]">Audio-Dauer</span>
                          <p className="text-[var(--text-secondary)] mt-0.5">{(iv.audio_duration_ms / 1000).toFixed(1)}s</p>
                        </div>
                      )}
                      {iv.recovery_score !== undefined && iv.recovery_score !== null && (
                        <div>
                          <span className="text-[var(--text-tertiary)]">Recovery-Score</span>
                          <p className="text-[var(--text-secondary)] mt-0.5">{Math.round(iv.recovery_score * 100)}%</p>
                        </div>
                      )}
                    </div>

                    {/* Metrics at Intervention (exact snapshot) */}
                    <MetricsAtIntervention metricsSnapshot={iv.metrics_at_intervention} />

                    {/* Impact Analysis for this intervention */}
                    <InterventionImpactMini intervention={iv} metrics={metrics} sessionStart={sessionStart} />

                    {/* Ideas triggered by this intervention */}
                    <TriggeredIdeas intervention={iv} ideas={ideas} sessionStart={sessionStart} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Intervention → Idea Generation Summary */}
      <InterventionIdeaSummary data={data} />

      {/* Aggregate Impact Chart */}
      <AggregateImpactChart data={data} />
    </div>
  );
}

function IntentBadge({ intent }: { intent: string }) {
  const colors: Record<string, string> = {
    PARTICIPATION_REBALANCING: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    PERSPECTIVE_BROADENING: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    REACTIVATION: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    ALLY_IMPULSE: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    NORM_REINFORCEMENT: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    GOAL_REFOCUS: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  };

  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${colors[intent] || 'bg-white/5 text-white/40 border-white/10'}`}>
      {INTENT_LABELS[intent] || intent}
    </span>
  );
}

function NarrativeSummary({
  intervention,
  metrics,
  ideas,
  sessionStart,
}: {
  intervention: SessionExport['interventions'][0];
  metrics: SessionExport['metrics'];
  ideas: SessionExport['ideas'];
  sessionStart: string;
}) {
  const impact = useMemo(
    () => computeInterventionImpact(intervention, metrics, sessionStart),
    [intervention, metrics, sessionStart]
  );

  const triggeredCount = useMemo(() => {
    const ivTime = new Date(intervention.created_at).getTime();
    const windowMs = 90 * 1000;
    return ideas.filter((idea) => {
      if (idea.is_deleted) return false;
      if (idea.source_context === 'moderator_triggered' || idea.source_context === 'ally_triggered') {
        const ideaTime = new Date(idea.created_at).getTime();
        return ideaTime >= ivTime && ideaTime <= ivTime + windowMs;
      }
      return false;
    }).length;
  }, [intervention, ideas]);

  const narrative = useMemo(
    () => generateInterventionNarrative(intervention, impact, triggeredCount),
    [intervention, impact, triggeredCount]
  );

  return (
    <div className="bg-white/[0.03] rounded-lg p-3 border border-white/[0.06]">
      <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider block mb-1">Zusammenfassung</span>
      <p className="text-xs text-[var(--text-primary)] leading-relaxed">{narrative}</p>
    </div>
  );
}

function MetricsAtIntervention({ metricsSnapshot }: { metricsSnapshot?: Record<string, unknown> }) {
  if (!metricsSnapshot) return null;

  const participation = metricsSnapshot.participation as Record<string, unknown> | undefined;
  const semantic = metricsSnapshot.semantic_dynamics as Record<string, unknown> | undefined;
  const state = metricsSnapshot.inferred_state as Record<string, unknown> | undefined;

  if (!participation && !semantic) return null;

  const rows: { label: string; value: string }[] = [];
  if (state?.state) rows.push({ label: 'Zustand', value: String(state.state).replace(/_/g, ' ') });
  if (participation?.participation_risk_score != null)
    rows.push({ label: 'Partizipationsrisiko', value: `${Math.round(Number(participation.participation_risk_score) * 100)}%` });
  if (semantic?.novelty_rate != null)
    rows.push({ label: 'Novelty-Rate', value: `${Math.round(Number(semantic.novelty_rate) * 100)}%` });
  if (semantic?.stagnation_duration_seconds != null)
    rows.push({ label: 'Stagnation', value: `${Math.round(Number(semantic.stagnation_duration_seconds))}s` });
  if (participation?.balance != null)
    rows.push({ label: 'Balance', value: `${Math.round(Number(participation.balance) * 100)}%` });

  if (rows.length === 0) return null;

  return (
    <div className="space-y-1">
      <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">Metriken zum Zeitpunkt</span>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-2">
            <span className="text-[var(--text-tertiary)]">{r.label}</span>
            <span className="font-mono text-[var(--text-secondary)]">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TriggeredIdeas({
  intervention,
  ideas,
  sessionStart,
}: {
  intervention: SessionExport['interventions'][0];
  ideas: SessionExport['ideas'];
  sessionStart: string;
}) {
  const triggered = useMemo(() => {
    const ivTime = new Date(intervention.created_at).getTime();
    const windowMs = 90 * 1000; // 90s window after intervention
    return ideas.filter((idea) => {
      if (idea.is_deleted) return false;
      if (idea.source_context === 'moderator_triggered' || idea.source_context === 'ally_triggered') {
        const ideaTime = new Date(idea.created_at).getTime();
        return ideaTime >= ivTime && ideaTime <= ivTime + windowMs;
      }
      return false;
    });
  }, [intervention, ideas]);

  if (triggered.length === 0) return null;

  const ROLE_ICONS: Record<string, string> = { seed: '✦', extension: '↗', variant: '≈', tangent: '↯' };

  return (
    <div className="space-y-1">
      <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">
        Ausgelöste Ideen ({triggered.length})
      </span>
      <div className="space-y-1">
        {triggered.map((idea) => (
          <div key={idea.id} className="text-xs flex items-center gap-2 bg-white/[0.03] rounded-lg px-2 py-1">
            {idea.novelty_role && (
              <span className="text-[var(--text-tertiary)]">{ROLE_ICONS[idea.novelty_role] || ''}</span>
            )}
            <span className="text-[var(--text-primary)]">{idea.title}</span>
            <span className="text-[10px] font-mono text-[var(--text-tertiary)] ml-auto">
              {formatTimestamp(idea.created_at, sessionStart)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function InterventionImpactMini({
  intervention,
  metrics,
  sessionStart,
}: {
  intervention: SessionExport['interventions'][0];
  metrics: SessionExport['metrics'];
  sessionStart: string;
}) {
  const impact = useMemo(
    () => computeInterventionImpact(intervention, metrics, sessionStart),
    [intervention, metrics, sessionStart]
  );

  if (!impact) {
    return (
      <p className="text-[10px] text-[var(--text-tertiary)]">
        Nicht genügend Daten für Impact-Analyse
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">Impact (3min vorher → 5min nachher)</span>
      {impact.map((row) => (
        <div key={row.metric} className="flex items-center gap-2 text-xs">
          <span className="text-[var(--text-tertiary)] w-36 shrink-0">{row.metric}</span>
          <div className="flex items-center gap-1.5 flex-1">
            <span className="font-mono text-[var(--text-tertiary)] w-12 text-right">
              {formatImpactValue(row.before, row.unit)}
            </span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--text-tertiary)]">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
            <span className={`font-mono w-12 ${row.improved ? 'text-emerald-400' : 'text-rose-400'}`}>
              {formatImpactValue(row.after, row.unit)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function InterventionIdeaSummary({ data }: { data: SessionExport }) {
  const { interventions, ideas } = data;

  const stats = useMemo(() => {
    const activeIdeas = ideas.filter((i) => !i.is_deleted);
    const modTriggered = activeIdeas.filter((i) => i.source_context === 'moderator_triggered').length;
    const allyTriggered = activeIdeas.filter((i) => i.source_context === 'ally_triggered').length;
    const organic = activeIdeas.filter((i) => !i.source_context || i.source_context === 'organic').length;
    return { total: activeIdeas.length, modTriggered, allyTriggered, organic };
  }, [ideas]);

  if (stats.total === 0 || interventions.length === 0) return null;

  const triggeredTotal = stats.modTriggered + stats.allyTriggered;
  const triggeredPct = stats.total > 0 ? Math.round((triggeredTotal / stats.total) * 100) : 0;

  return (
    <div className="glass p-5 space-y-3">
      <h3 className="text-sm font-semibold text-[var(--text-secondary)]">Interventionen → Ideengeneration</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="text-center">
          <div className="text-2xl font-bold text-[var(--text-primary)]">{stats.organic}</div>
          <p className="text-xs text-[var(--text-tertiary)]">Spontane Ideen</p>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-indigo-400">{stats.modTriggered}</div>
          <p className="text-xs text-[var(--text-tertiary)]">Nach Moderation</p>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-emerald-400">{stats.allyTriggered}</div>
          <p className="text-xs text-[var(--text-tertiary)]">Nach Ally</p>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-amber-400">{triggeredPct}%</div>
          <p className="text-xs text-[var(--text-tertiary)]">Durch Interventionen</p>
        </div>
      </div>
    </div>
  );
}

function AggregateImpactChart({ data }: { data: SessionExport }) {
  const { session, interventions, metrics } = data;
  const sessionStart = session.started_at || session.created_at;

  const aggregated = useMemo(() => {
    const allImpacts: Record<string, { before: number[]; after: number[]; unit: 'pct' | 'seconds' }> = {};

    for (const iv of interventions) {
      const impact = computeInterventionImpact(iv, metrics, sessionStart);
      if (!impact) continue;
      for (const row of impact) {
        if (!allImpacts[row.metric]) allImpacts[row.metric] = { before: [], after: [], unit: row.unit };
        allImpacts[row.metric].before.push(row.before);
        allImpacts[row.metric].after.push(row.after);
      }
    }

    return Object.entries(allImpacts).map(([metric, { before, after, unit }]) => {
      const avgBefore = before.reduce((a, b) => a + b, 0) / before.length;
      const avgAfter = after.reduce((a, b) => a + b, 0) / after.length;
      const improved = metric === 'Novelty-Rate' ? avgAfter > avgBefore : avgAfter < avgBefore;
      // Normalize stagnation to 0-100 scale for chart (cap at 120s = 100%)
      const normalize = (v: number) => unit === 'seconds' ? Math.min(Math.round((v / 120) * 100), 100) : Math.round(v * 100);
      return {
        metric,
        before: normalize(avgBefore),
        after: normalize(avgAfter),
        rawBefore: avgBefore,
        rawAfter: avgAfter,
        improved,
        n: before.length,
        unit,
      };
    });
  }, [interventions, metrics, sessionStart]);

  if (aggregated.length === 0) return null;

  return (
    <div className="glass p-5 space-y-3">
      <h3 className="text-sm font-semibold text-[var(--text-secondary)]">
        Durchschnittlicher Impact (Vorher/Nachher)
      </h3>
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={aggregated}
            layout="vertical"
            margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
            <XAxis
              type="number"
              domain={[0, 100]}
              tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <YAxis
              type="category"
              dataKey="metric"
              tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={130}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                const fmt = (v: number) => d.unit === 'seconds' ? `${Math.round(v)}s` : `${Math.round(v * 100)}%`;
                return (
                  <div className="glass-sm p-2.5 rounded-lg text-xs space-y-1">
                    <p className="text-[var(--text-primary)] font-medium">{d.metric}</p>
                    <p className="text-[var(--text-tertiary)]">Vorher: {fmt(d.rawBefore)} / Nachher: {fmt(d.rawAfter)}</p>
                    <p className="text-[var(--text-tertiary)]">n={d.n} Interventionen</p>
                  </div>
                );
              }}
            />
            <Bar dataKey="before" name="Vorher" fill="rgba(255,255,255,0.15)" barSize={14} radius={[0, 4, 4, 0]} />
            <Bar dataKey="after" name="Nachher" barSize={14} radius={[0, 4, 4, 0]}>
              {aggregated.map((entry, idx) => (
                <Cell
                  key={idx}
                  fill={entry.improved ? '#34d399' : '#fb7185'}
                  fillOpacity={0.7}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex gap-4 text-xs text-[var(--text-tertiary)]">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-2 rounded-sm bg-white/15" />
          Vorher
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-2 rounded-sm bg-emerald-400/70" />
          Nachher (verbessert)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-2 rounded-sm bg-rose-400/70" />
          Nachher (verschlechtert)
        </span>
      </div>
    </div>
  );
}
