'use client';

import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { SessionExport } from '@/types';
import { INTENT_LABELS, formatTimestamp, computeInterventionImpact } from './utils';

interface Props {
  data: SessionExport;
}

export default function InterventionPanel({ data }: Props) {
  const { session, interventions, metrics } = data;
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

                    {/* Impact Analysis for this intervention */}
                    <InterventionImpactMini intervention={iv} metrics={metrics} sessionStart={sessionStart} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

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
      <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">Impact</span>
      {impact.map((row) => (
        <div key={row.metric} className="flex items-center gap-2 text-xs">
          <span className="text-[var(--text-tertiary)] w-36 shrink-0">{row.metric}</span>
          <div className="flex items-center gap-1.5 flex-1">
            <span className="font-mono text-[var(--text-tertiary)] w-10 text-right">
              {Math.round(row.before * 100)}
            </span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--text-tertiary)]">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
            <span className={`font-mono w-10 ${row.improved ? 'text-emerald-400' : 'text-rose-400'}`}>
              {Math.round(row.after * 100)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function AggregateImpactChart({ data }: { data: SessionExport }) {
  const { session, interventions, metrics } = data;
  const sessionStart = session.started_at || session.created_at;

  const aggregated = useMemo(() => {
    const allImpacts: Record<string, { before: number[]; after: number[] }> = {};

    for (const iv of interventions) {
      const impact = computeInterventionImpact(iv, metrics, sessionStart);
      if (!impact) continue;
      for (const row of impact) {
        if (!allImpacts[row.metric]) allImpacts[row.metric] = { before: [], after: [] };
        allImpacts[row.metric].before.push(row.before);
        allImpacts[row.metric].after.push(row.after);
      }
    }

    return Object.entries(allImpacts).map(([metric, { before, after }]) => {
      const avgBefore = before.reduce((a, b) => a + b, 0) / before.length;
      const avgAfter = after.reduce((a, b) => a + b, 0) / after.length;
      const improved = metric === 'Novelty-Rate' ? avgAfter > avgBefore : avgAfter < avgBefore;
      return {
        metric,
        before: Math.round(avgBefore * 100),
        after: Math.round(avgAfter * 100),
        improved,
        n: before.length,
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
                return (
                  <div className="glass-sm p-2.5 rounded-lg text-xs space-y-1">
                    <p className="text-[var(--text-primary)] font-medium">{d.metric}</p>
                    <p className="text-[var(--text-tertiary)]">Vorher: {d.before}% / Nachher: {d.after}%</p>
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
