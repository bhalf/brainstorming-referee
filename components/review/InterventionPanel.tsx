'use client';

import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { SessionExport } from '@/types';
import { INTENT_LABELS, INTENT_CHART_COLORS, formatTimestamp, computeInterventionImpact, formatImpactValue } from './utils';

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
      <div className="glass p-5 space-y-1.5">
        <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">Interventions-Verlauf</h3>
        {interventions.map((iv) => {
          const isExpanded = expandedId === iv.id;
          return (
            <InterventionRow
              key={iv.id}
              intervention={iv}
              metrics={metrics}
              ideas={ideas}
              sessionStart={sessionStart}
              isExpanded={isExpanded}
              onToggle={() => setExpandedId(isExpanded ? null : iv.id)}
            />
          );
        })}
      </div>

      <InterventionIdeaSummary data={data} />
      <AggregateImpactChart data={data} />
    </div>
  );
}

// --- Single Intervention Row ---

function InterventionRow({
  intervention: iv,
  metrics,
  ideas,
  sessionStart,
  isExpanded,
  onToggle,
}: {
  intervention: SessionExport['interventions'][0];
  metrics: SessionExport['metrics'];
  ideas: SessionExport['ideas'];
  sessionStart: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const impact = useMemo(
    () => computeInterventionImpact(iv, metrics, sessionStart),
    [iv, metrics, sessionStart]
  );

  const triggered = useMemo(() => {
    const ivTime = new Date(iv.created_at).getTime();
    const windowMs = 90 * 1000;
    return ideas.filter((idea) => {
      if (idea.is_deleted) return false;
      if (idea.source_context === 'moderator_triggered' || idea.source_context === 'ally_triggered') {
        const ideaTime = new Date(idea.created_at).getTime();
        return ideaTime >= ivTime && ideaTime <= ivTime + windowMs;
      }
      return false;
    });
  }, [iv, ideas]);

  return (
    <div className={`rounded-lg overflow-hidden transition-colors ${isExpanded ? 'ring-1 ring-white/[0.08]' : 'hover:bg-white/[0.02]'}`}>
      {/* Preview — always visible */}
      <button
        className="w-full text-left px-3 py-2.5 cursor-pointer"
        onClick={onToggle}
      >
        {/* Top row: meta */}
        <div className="flex items-center gap-2.5 mb-1.5">
          <span className="text-xs font-mono text-[var(--text-tertiary)] shrink-0">
            {formatTimestamp(iv.created_at, sessionStart)}
          </span>
          <IntentBadge intent={iv.intent} />
          {/* Backend recovery status */}
          {iv.recovered !== undefined && iv.recovered !== null && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${
              iv.recovered
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'bg-rose-500/10 text-rose-400'
            }`}>
              {iv.recovered ? 'Erholt' : 'Nicht erholt'}
            </span>
          )}
          <span className="flex-1" />
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            className={`text-[var(--text-tertiary)] shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
        {/* Full intervention text */}
        <p className="text-[13px] text-[var(--text-primary)] leading-relaxed">{iv.text}</p>
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <ExpandedDetails
          intervention={iv}
          impact={impact}
          triggered={triggered}
        />
      )}
    </div>
  );
}

function IntentBadge({ intent }: { intent: string }) {
  const color = INTENT_CHART_COLORS[intent] || '#888';
  return (
    <span
      className="text-[10px] px-2 py-0.5 rounded-full border shrink-0 font-medium"
      style={{
        backgroundColor: `${color}15`,
        color: color,
        borderColor: `${color}30`,
      }}
    >
      {INTENT_LABELS[intent] || intent}
    </span>
  );
}

// --- Expanded Details ---

/** Extract before/after metrics from backend-stored snapshots (point-in-time). */
function extractBackendImpact(intervention: SessionExport['interventions'][0]) {
  const before = intervention.metrics_at_intervention as Record<string, Record<string, number>> | undefined;
  const after = intervention.metrics_at_postcheck as Record<string, Record<string, number>> | undefined;
  if (!before || !after) return null;

  const pb = before.participation ?? {};
  const pa = after.participation ?? {};
  const sb = before.semantic_dynamics ?? {};
  const sa = after.semantic_dynamics ?? {};

  const rows: Array<{ metric: string; before: number; after: number; unit: 'pct' | 'seconds'; improved: boolean }> = [
    {
      metric: 'Partizipations-Komposit',
      before: pb.participation_composite ?? 0,
      after: pa.participation_composite ?? 0,
      unit: 'pct',
      improved: (pa.participation_composite ?? 0) < (pb.participation_composite ?? 0),
    },
    {
      metric: 'Novelty-Rate',
      before: sb.novelty_rate ?? 0,
      after: sa.novelty_rate ?? 0,
      unit: 'pct',
      improved: (sa.novelty_rate ?? 0) > (sb.novelty_rate ?? 0),
    },
    {
      metric: 'Stagnation',
      before: sb.stagnation_duration_seconds ?? 0,
      after: sa.stagnation_duration_seconds ?? 0,
      unit: 'seconds',
      improved: (sa.stagnation_duration_seconds ?? 0) < (sb.stagnation_duration_seconds ?? 0),
    },
    {
      metric: 'Cluster-Konzentration',
      before: sb.cluster_concentration ?? 0,
      after: sa.cluster_concentration ?? 0,
      unit: 'pct',
      improved: (sa.cluster_concentration ?? 0) < (sb.cluster_concentration ?? 0),
    },
  ];
  return rows;
}

function ExpandedDetails({
  intervention,
  impact,
  triggered,
}: {
  intervention: SessionExport['interventions'][0];
  impact: ReturnType<typeof computeInterventionImpact>;
  triggered: SessionExport['ideas'];
}) {
  // Prefer backend point-in-time values; fall back to frontend Ø windows
  const backendImpact = useMemo(() => extractBackendImpact(intervention), [intervention]);
  const displayImpact = backendImpact ?? impact;
  const isBackendData = backendImpact !== null;

  return (
    <div className="px-3 pb-3 animate-fade-in border-t border-white/[0.06] pt-2.5 space-y-2.5">
      {/* Backend Recovery info */}
      <div className="flex items-center gap-4 text-[11px]">
        {intervention.recovery_score != null && (
          <span className="text-[var(--text-tertiary)]">
            Recovery-Score: <span className="font-mono text-[var(--text-secondary)]">{Math.round(intervention.recovery_score * 100)}%</span>
          </span>
        )}
        {intervention.trigger && (
          <span className="text-[var(--text-tertiary)]">
            Trigger: <span className="text-[var(--text-secondary)]">{intervention.trigger}</span>
          </span>
        )}
        {triggered.length > 0 && (
          <span className="text-[var(--text-tertiary)]">
            {triggered.length} {triggered.length === 1 ? 'Idee' : 'Ideen'} ausgelöst
          </span>
        )}
      </div>

      {/* Impact table */}
      {displayImpact && displayImpact.length > 0 ? (
        <div>
          <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider font-medium">
            Metrik-Vergleich
            <span className="normal-case tracking-normal font-normal opacity-60 ml-1.5">
              {isBackendData ? 'bei Intervention → bei Postcheck' : 'Ø 3 min vorher → Ø 5 min nachher'}
            </span>
          </span>
          <div className="mt-1.5 space-y-0.5">
            {displayImpact.map((row) => (
              <div key={row.metric} className="flex items-center text-[11px] py-0.5">
                <span className="text-[var(--text-tertiary)] w-[140px] shrink-0">{row.metric}</span>
                <span className="font-mono text-[var(--text-tertiary)] w-10 text-right">{formatImpactValue(row.before, row.unit)}</span>
                <span className="text-[var(--text-tertiary)] opacity-40 mx-1.5">→</span>
                <span className={`font-mono w-10 ${row.improved ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {formatImpactValue(row.after, row.unit)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-[var(--text-tertiary)]">Nicht genügend Daten für Metrik-Vergleich</p>
      )}
    </div>
  );
}

// --- Intervention → Idea Summary ---

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

// --- Aggregate Impact Chart ---

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

    const maxStagnation = Object.entries(allImpacts)
      .filter(([, d]) => d.unit === 'seconds')
      .flatMap(([, d]) => [...d.before, ...d.after])
      .reduce((max, v) => Math.max(max, v), 60);

    return Object.entries(allImpacts).map(([metric, { before, after, unit }]) => {
      const avgBefore = before.reduce((a, b) => a + b, 0) / before.length;
      const avgAfter = after.reduce((a, b) => a + b, 0) / after.length;
      const improved = metric === 'Novelty-Rate' ? avgAfter > avgBefore : avgAfter < avgBefore;
      const normalize = (v: number) => unit === 'seconds' ? Math.min(Math.round((v / maxStagnation) * 100), 100) : Math.round(v * 100);
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
              cursor={false}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                const fmt = (v: number) => d.unit === 'seconds' ? `${Math.round(v)}s` : `${Math.round(v * 100)}%`;
                return (
                  <div className="p-2.5 rounded-lg text-xs space-y-1" style={{ background: 'rgba(15, 15, 25, 0.95)', border: '1px solid rgba(255,255,255,0.1)' }}>
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
