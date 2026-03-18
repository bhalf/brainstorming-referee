'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, ReferenceArea,
  BarChart, Bar, Cell,
  PieChart, Pie,
} from 'recharts';
import Panel from '@/components/shared/Panel';
import MetricBar from '@/components/shared/MetricBar';
import TimelineEventRow from '@/components/replay/TimelineEventRow';
import type {
  TranscriptSegment,
  MetricSnapshot,
  Intervention,
  Idea,
  ExperimentConfig,
  ConversationStateName,
  InterventionAnnotation,
} from '@/lib/types';
import { formatTime } from '@/lib/utils/format';
import {
  type TimelineEvent,
  type TimelineEventType,
  type FilterSet,
  formatDuration,
  formatRelativeTime,
  STATE_BG_COLORS,
  STATE_BAR_COLORS,
  getSpeakerColor,
} from '@/components/replay/replayHelpers';
import { formatPercent } from '@/lib/utils/format';

// --- Types ---

interface SessionExport {
  metadata: {
    sessionId: string;
    roomName: string;
    scenario: string;
    startTime: number;
    endTime: number | null;
    language: string;
  };
  activeConfig: ExperimentConfig;
  promptVersion: string | null;
  engineVersion: string | null;
  transcriptSegments: TranscriptSegment[];
  metricSnapshots: Array<MetricSnapshot & { inferredState?: unknown; timestamp: number }>;
  interventions: Intervention[];
  ideas: Idea[];
  modelRoutingLog: Array<{
    id: string;
    timestamp: string;
    task: string;
    model: string;
    latencyMs: number;
    success: boolean;
    error: string | null;
  }>;
}

// --- Recharts color constants ---

const STATE_HEX_COLORS: Record<ConversationStateName, string> = {
  HEALTHY_EXPLORATION: '#22c55e',
  HEALTHY_ELABORATION: '#10b981',
  DOMINANCE_RISK: '#ef4444',
  CONVERGENCE_RISK: '#eab308',
  STALLED_DISCUSSION: '#f97316',
};

const METRIC_COLORS = {
  participation: '#f97316',
  novelty: '#22c55e',
  stagnation: '#eab308',
  spread: '#3b82f6',
};

// --- Chart data types ---

interface MetricChartPoint {
  time: number;
  timeLabel: string;
  participation: number;
  novelty: number;
  stagnation: number;
  spread: number;
  state?: string;
}

interface ImpactEntry {
  metric: string;
  before: number;
  after: number;
  improved: boolean;
  beforeCount: number;
  afterCount: number;
}

// --- Helpers ---

function computeInterventionImpact(
  intervention: Intervention,
  snapshots: Array<MetricSnapshot & { timestamp: number }>,
): ImpactEntry[] | null {
  // Before: [t-180s, t-30s] — exclude last 30s (reaction time)
  const beforeWindow = snapshots.filter(
    s => s.timestamp >= intervention.timestamp - 180_000 && s.timestamp < intervention.timestamp - 30_000,
  );
  // After: [t+30s, t+300s] — exclude first 30s (speech + reaction), measure up to 5min
  const afterWindow = snapshots.filter(
    s => s.timestamp > intervention.timestamp + 30_000 && s.timestamp <= intervention.timestamp + 300_000,
  );
  if (beforeWindow.length < 2 || afterWindow.length < 2) return null;

  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

  const metrics: { key: string; label: string; extract: (s: MetricSnapshot) => number; lowerIsBetter: boolean }[] = [
    { key: 'participation', label: 'Participation Risk', extract: s => s.participation?.participationRiskScore ?? 0, lowerIsBetter: true },
    { key: 'novelty', label: 'Novelty Rate', extract: s => s.semanticDynamics?.noveltyRate ?? 0, lowerIsBetter: false },
    { key: 'stagnation', label: 'Stagnation', extract: s => Math.min(1, s.stagnationDuration / 120), lowerIsBetter: true },
    { key: 'spread', label: 'Topic Spread', extract: s => s.semanticDynamics ? 1 - s.semanticDynamics.clusterConcentration : 0, lowerIsBetter: false },
  ];

  return metrics.map(m => {
    const before = avg(beforeWindow.map(m.extract));
    const after = avg(afterWindow.map(m.extract));
    const improved = m.lowerIsBetter ? after < before : after > before;
    return { metric: m.label, before, after, improved, beforeCount: beforeWindow.length, afterCount: afterWindow.length };
  });
}

// --- Metrics Timeline Chart Component ---

const SPEAKER_HEX_COLORS = ['#38bdf8', '#a78bfa', '#fbbf24', '#a3e635', '#fb7185', '#2dd4bf', '#f97316', '#e879f9'];

function MetricsTimelineChart({
  snapshots,
  interventions,
  startTime,
  speakers,
}: {
  snapshots: Array<MetricSnapshot & { inferredState?: unknown; timestamp: number }>;
  interventions: Intervention[];
  startTime: number;
  speakers: string[];
}) {
  const [showSpeakers, setShowSpeakers] = useState(false);

  const chartData = useMemo(() => {
    return snapshots.map(snap => {
      const point: Record<string, number | string | undefined> = {
        time: snap.timestamp - startTime,
        participation: snap.participation?.participationRiskScore ?? 0,
        novelty: snap.semanticDynamics?.noveltyRate ?? 0,
        stagnation: Math.min(1, snap.stagnationDuration / 120),
        spread: snap.semanticDynamics ? 1 - snap.semanticDynamics.clusterConcentration : 0,
        state: (snap.inferredState as { state?: string } | undefined)?.state,
      };
      // Add per-speaker volume share
      if (snap.participation?.volumeShare) {
        for (const [speaker, share] of Object.entries(snap.participation.volumeShare)) {
          point[`spk_${speaker}`] = share;
        }
      }
      return point;
    });
  }, [snapshots, startTime]);

  // Build state background bands
  const stateBands = useMemo(() => {
    const bands: { x1: number; x2: number; state: ConversationStateName }[] = [];
    let currentState: string | null = null;
    let bandStart = 0;

    for (const point of chartData) {
      const t = point.time as number;
      const s = point.state as string | undefined;
      if (s && s !== currentState) {
        if (currentState && bandStart < t) {
          bands.push({ x1: bandStart, x2: t, state: currentState as ConversationStateName });
        }
        currentState = s;
        bandStart = t;
      }
    }
    // Close the last band
    if (currentState && chartData.length > 0) {
      bands.push({ x1: bandStart, x2: chartData[chartData.length - 1].time as number, state: currentState as ConversationStateName });
    }
    return bands;
  }, [chartData]);

  if (chartData.length < 2) return null;

  const formatXTick = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <Panel className="mb-6">
      <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">
        Metrics Timeline
      </h3>
      <div className="flex flex-wrap gap-3 mb-2 items-center">
        <span className="flex items-center gap-1 text-xs text-slate-400">
          <span className="w-2.5 h-0.5 rounded" style={{ background: METRIC_COLORS.participation }} /> Participation Risk
        </span>
        <span className="flex items-center gap-1 text-xs text-slate-400">
          <span className="w-2.5 h-0.5 rounded" style={{ background: METRIC_COLORS.novelty }} /> Novelty Rate
        </span>
        <span className="flex items-center gap-1 text-xs text-slate-400">
          <span className="w-2.5 h-0.5 rounded" style={{ background: METRIC_COLORS.stagnation }} /> Stagnation
        </span>
        <span className="flex items-center gap-1 text-xs text-slate-400">
          <span className="w-2.5 h-0.5 rounded" style={{ background: METRIC_COLORS.spread }} /> Topic Spread
        </span>
        {speakers.length > 0 && (
          <button
            onClick={() => setShowSpeakers(s => !s)}
            className={`ml-auto text-[10px] px-2 py-0.5 rounded border ${showSpeakers ? 'border-blue-500 text-blue-400 bg-blue-500/10' : 'border-slate-600 text-slate-500 hover:text-slate-400'}`}
          >
            {showSpeakers ? 'Hide Speakers' : 'Show Speakers'}
          </button>
        )}
      </div>
      {showSpeakers && (
        <div className="flex flex-wrap gap-2 mb-2">
          {speakers.map((s, i) => (
            <span key={s} className="flex items-center gap-1 text-[10px] text-slate-500">
              <span className="w-2 h-0.5 rounded" style={{ background: SPEAKER_HEX_COLORS[i % SPEAKER_HEX_COLORS.length] }} /> {s}
            </span>
          ))}
        </div>
      )}
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
          <defs>
            <linearGradient id="grad-participation" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={METRIC_COLORS.participation} stopOpacity={0.3} />
              <stop offset="100%" stopColor={METRIC_COLORS.participation} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="grad-novelty" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={METRIC_COLORS.novelty} stopOpacity={0.3} />
              <stop offset="100%" stopColor={METRIC_COLORS.novelty} stopOpacity={0} />
            </linearGradient>
          </defs>

          {/* State background bands */}
          {stateBands.map((band, i) => (
            <ReferenceArea
              key={`band-${i}`}
              x1={band.x1}
              x2={band.x2}
              fill={STATE_HEX_COLORS[band.state] ?? '#475569'}
              fillOpacity={0.08}
            />
          ))}

          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="time"
            tickFormatter={formatXTick}
            stroke="#64748b"
            tick={{ fontSize: 10 }}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, 1]}
            stroke="#64748b"
            tick={{ fontSize: 10 }}
            tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
            width={40}
          />
          <Tooltip
            contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }}
            labelFormatter={(v) => `Time: ${formatXTick(Number(v))}`}
            formatter={(value, name) => [`${(Number(value) * 100).toFixed(1)}%`, name]}
          />

          <Area type="monotone" dataKey="participation" name="Participation Risk" stroke={METRIC_COLORS.participation} fill="url(#grad-participation)" strokeWidth={1.5} dot={false} />
          <Area type="monotone" dataKey="novelty" name="Novelty Rate" stroke={METRIC_COLORS.novelty} fill="url(#grad-novelty)" strokeWidth={1.5} dot={false} />
          <Line type="monotone" dataKey="stagnation" name="Stagnation" stroke={METRIC_COLORS.stagnation} strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
          <Line type="monotone" dataKey="spread" name="Topic Spread" stroke={METRIC_COLORS.spread} strokeWidth={1.5} dot={false} />

          {/* Per-speaker volume share curves */}
          {showSpeakers && speakers.map((speaker, i) => (
            <Line
              key={`spk-${speaker}`}
              type="monotone"
              dataKey={`spk_${speaker}`}
              name={speaker}
              stroke={SPEAKER_HEX_COLORS[i % SPEAKER_HEX_COLORS.length]}
              strokeWidth={1}
              dot={false}
              opacity={0.5}
              strokeDasharray="2 2"
            />
          ))}

          {/* Intervention markers */}
          {interventions.map((int, i) => (
            <ReferenceLine
              key={`int-${i}`}
              x={int.timestamp - startTime}
              stroke={int.type === 'ally' ? '#a855f7' : '#6366f1'}
              strokeDasharray="3 3"
              strokeWidth={1.5}
              label={{
                value: int.type === 'ally' ? 'A' : 'M',
                position: 'top',
                fill: int.type === 'ally' ? '#a855f7' : '#6366f1',
                fontSize: 10,
                fontWeight: 600,
              }}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </Panel>
  );
}

// --- Intervention Impact Chart ---

function InterventionImpactChart({
  interventions,
  snapshots,
}: {
  interventions: Intervention[];
  snapshots: Array<MetricSnapshot & { timestamp: number }>;
}) {
  const impactData = useMemo(() => {
    const results: { intervention: Intervention; impacts: ImpactEntry[] }[] = [];
    for (const int of interventions) {
      const impact = computeInterventionImpact(int, snapshots);
      if (impact) results.push({ intervention: int, impacts: impact });
    }
    return results;
  }, [interventions, snapshots]);

  if (impactData.length === 0) return null;

  return (
    <Panel>
      <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">
        Intervention Impact
      </h3>
      <p className="text-xs text-slate-500 mb-3">
        Avg. metrics 3min before vs 5min after each intervention (30s gap)
      </p>
      <div className="space-y-4 max-h-96 overflow-y-auto">
        {impactData.map(({ intervention, impacts }) => {
          const intentLabels: Record<string, string> = {
            PARTICIPATION_REBALANCING: 'Rebalancing',
            PERSPECTIVE_BROADENING: 'Broadening',
            REACTIVATION: 'Reactivation',
            ALLY_IMPULSE: 'Ally Impulse',
            NORM_REINFORCEMENT: 'Rule Reminder',
          };
          const label = intervention.intent
            ? intentLabels[intervention.intent] || intervention.intent
            : intervention.trigger;
          const sampleInfo = impacts[0] ? `n=${impacts[0].beforeCount} / n=${impacts[0].afterCount}` : '';

          return (
            <div key={intervention.id}>
              <div className="flex items-center gap-1.5 mb-2">
                <span className={`text-xs font-medium ${intervention.type === 'ally' ? 'text-purple-400' : 'text-blue-400'}`}>
                  {intervention.type === 'ally' ? 'Ally' : 'Moderator'}
                </span>
                <span className="text-xs text-slate-500">{label}</span>
                <span className="text-[10px] text-slate-600 ml-auto font-mono">{sampleInfo}</span>
              </div>
              <ResponsiveContainer width="100%" height={100}>
                <BarChart
                  data={impacts}
                  layout="vertical"
                  margin={{ top: 0, right: 10, bottom: 0, left: 60 }}
                  barGap={2}
                >
                  <XAxis type="number" domain={[0, 1]} tick={{ fontSize: 9 }} stroke="#64748b" tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} />
                  <YAxis type="category" dataKey="metric" tick={{ fontSize: 9 }} stroke="#64748b" width={55} />
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }}
                    formatter={(value) => [`${(Number(value) * 100).toFixed(1)}%`]}
                  />
                  <Bar dataKey="before" name="Before" fill="#475569" radius={[2, 2, 2, 2]} barSize={8} />
                  <Bar dataKey="after" name="After" radius={[2, 2, 2, 2]} barSize={8}>
                    {impacts.map((entry, i) => (
                      <Cell key={i} fill={entry.improved ? '#22c55e' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// --- Health Summary Recharts Bar ---

function HealthSummaryChart({
  metricHealthSummary,
}: {
  metricHealthSummary: {
    sessionDurationMs: number;
    metrics: { label: string; badMs: number; threshold: string }[];
  };
}) {
  const barData = metricHealthSummary.metrics.map(m => ({
    label: m.label,
    pct: (m.badMs / metricHealthSummary.sessionDurationMs) * 100,
    badMs: m.badMs,
    threshold: m.threshold,
  }));

  return (
    <Panel>
      <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">
        Metric Health Summary
      </h3>
      <p className="text-xs text-slate-500 mb-3">
        Time in unhealthy range over {formatDuration(metricHealthSummary.sessionDurationMs)}
      </p>
      <ResponsiveContainer width="100%" height={barData.length * 28 + 20}>
        <BarChart
          data={barData}
          layout="vertical"
          margin={{ top: 0, right: 10, bottom: 0, left: 0 }}
        >
          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 9 }} stroke="#64748b" tickFormatter={(v: number) => `${v}%`} />
          <YAxis type="category" dataKey="label" tick={{ fontSize: 9 }} stroke="#64748b" width={90} />
          <Tooltip
            contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }}
            formatter={(value, _name, props) => {
              const p = (props as { payload?: { badMs?: number; threshold?: string } }).payload;
              return [`${Number(value).toFixed(1)}% (${formatDuration(p?.badMs ?? 0)}) — threshold: ${p?.threshold ?? ''}`];
            }}
          />
          <Bar dataKey="pct" name="Unhealthy %" radius={[0, 4, 4, 0]} barSize={14}>
            {barData.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.pct > 50 ? '#ef4444' : entry.pct > 20 ? '#eab308' : '#22c55e'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Panel>
  );
}

// --- Intervention Success Rate Card ---

const INTENT_LABELS_MAP: Record<string, string> = {
  PARTICIPATION_REBALANCING: 'Rebalancing',
  PERSPECTIVE_BROADENING: 'Broadening',
  REACTIVATION: 'Reactivation',
  ALLY_IMPULSE: 'Ally Impulse',
  NORM_REINFORCEMENT: 'Rule Reminder',
};

function InterventionSuccessCard({ interventions }: { interventions: Intervention[] }) {
  const stats = useMemo(() => {
    const byIntent: Record<string, { total: number; recovered: number }> = {};
    let totalAll = 0;
    let recoveredAll = 0;

    for (const int of interventions) {
      const intent = int.intent ?? 'unknown';
      if (!byIntent[intent]) byIntent[intent] = { total: 0, recovered: 0 };
      byIntent[intent].total++;
      totalAll++;
      if (int.recoveryResult === 'recovered') {
        byIntent[intent].recovered++;
        recoveredAll++;
      }
    }

    return { byIntent, totalAll, recoveredAll };
  }, [interventions]);

  if (stats.totalAll === 0) return null;

  const overallRate = stats.totalAll > 0 ? (stats.recoveredAll / stats.totalAll) * 100 : 0;
  const rateColor = overallRate >= 60 ? 'text-green-400' : overallRate >= 30 ? 'text-yellow-400' : 'text-red-400';

  return (
    <Panel>
      <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">
        Intervention Success Rate
      </h3>
      <div className={`text-2xl font-bold ${rateColor} mb-3`}>
        {overallRate.toFixed(0)}% <span className="text-sm font-normal text-slate-500">({stats.recoveredAll}/{stats.totalAll} recovered)</span>
      </div>
      <div className="space-y-1.5">
        {Object.entries(stats.byIntent).map(([intent, { total, recovered }]) => {
          const rate = total > 0 ? (recovered / total) * 100 : 0;
          const color = rate >= 60 ? 'text-green-400' : rate >= 30 ? 'text-yellow-400' : 'text-red-400';
          return (
            <div key={intent} className="flex justify-between text-xs">
              <span className="text-slate-400">{INTENT_LABELS_MAP[intent] ?? intent}</span>
              <span className={`font-mono ${color}`}>
                {recovered}/{total} ({rate.toFixed(0)}%)
              </span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// --- State Duration Donut Chart ---

function StateDurationChart({
  stateDurations,
}: {
  stateDurations: {
    totalMs: number;
    entries: { state: ConversationStateName; durationMs: number; pct: number }[];
  };
}) {
  const pieData = stateDurations.entries.map(e => ({
    name: e.state.replace(/_/g, ' '),
    value: e.pct,
    durationMs: e.durationMs,
    fill: STATE_HEX_COLORS[e.state] ?? '#475569',
  }));

  return (
    <Panel>
      <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">
        State Duration Breakdown
      </h3>
      <ResponsiveContainer width="100%" height={160}>
        <PieChart>
          <Pie
            data={pieData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={65}
            strokeWidth={2}
            stroke="#1e293b"
          >
            {pieData.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }}
            formatter={(value, name, props) => {
              const p = (props as { payload?: { durationMs?: number } }).payload;
              return [`${Number(value).toFixed(1)}% (${formatDuration(p?.durationMs ?? 0)})`, name];
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      {/* Legend */}
      <div className="space-y-1.5 mt-2">
        {stateDurations.entries.map(e => (
          <div key={e.state} className="flex justify-between items-center text-xs">
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block w-2 h-2 rounded-sm"
                style={{ background: STATE_HEX_COLORS[e.state] ?? '#475569' }}
              />
              <span className="text-slate-300">{e.state.replace(/_/g, ' ')}</span>
            </div>
            <span className="text-slate-400 font-mono">
              {formatDuration(e.durationMs)} ({e.pct.toFixed(1)}%)
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// --- Main Component ---

export default function SessionReplayView({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [data, setData] = useState<SessionExport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterSet>(new Set(['segment', 'intervention', 'state_change']));
  const [expandedInterventions, setExpandedInterventions] = useState<Set<string>>(new Set());
  const [selectedSnapshot, setSelectedSnapshot] = useState<number | null>(null);
  const [annotations, setAnnotations] = useState<Map<string, InterventionAnnotation>>(new Map());
  const [savingAnnotation, setSavingAnnotation] = useState<string | null>(null);
  const [ideasExpanded, setIdeasExpanded] = useState(false);

  // Load session export data and researcher annotations in parallel on mount
  useEffect(() => {
    async function load() {
      try {
        const [sessionRes, annotRes] = await Promise.all([
          fetch(`/api/session/export?sessionId=${encodeURIComponent(sessionId)}`),
          fetch(`/api/annotations?sessionId=${encodeURIComponent(sessionId)}`),
        ]);

        if (!sessionRes.ok) {
          setError(sessionRes.status === 404 ? 'Session not found' : `Error ${sessionRes.status}`);
          return;
        }
        setData(await sessionRes.json());

        if (annotRes.ok) {
          const annotData = await annotRes.json();
          const map = new Map<string, InterventionAnnotation>();
          for (const a of annotData.annotations || []) {
            map.set(a.interventionId, a);
          }
          setAnnotations(map);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load session');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [sessionId]);

  const saveAnnotation = useCallback(async (
    interventionId: string,
    updates: Partial<Pick<InterventionAnnotation, 'rating' | 'relevance' | 'effectiveness' | 'notes'>>,
  ) => {
    setSavingAnnotation(interventionId);
    const existing = annotations.get(interventionId);
    const merged = {
      interventionId,
      sessionId,
      rating: updates.rating ?? existing?.rating ?? null,
      relevance: updates.relevance ?? existing?.relevance ?? null,
      effectiveness: updates.effectiveness ?? existing?.effectiveness ?? null,
      notes: updates.notes ?? existing?.notes ?? null,
      annotator: 'researcher',
    };

    try {
      const res = await fetch('/api/annotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(merged),
      });
      if (res.ok) {
        const { id } = await res.json();
        setAnnotations(prev => {
          const next = new Map(prev);
          next.set(interventionId, {
            id,
            ...merged,
            sessionId,
            createdAt: existing?.createdAt ?? Date.now(),
            updatedAt: Date.now(),
          } as InterventionAnnotation);
          return next;
        });
      }
    } catch { /* silent */ }
    setSavingAnnotation(null);
  }, [sessionId, annotations]);

  // Extract unique speaker names from transcript segments
  const speakers = useMemo(() => {
    if (!data) return [];
    const set = new Set<string>();
    for (const s of data.transcriptSegments) set.add(s.speaker);
    return Array.from(set);
  }, [data]);

  // Merge segments, interventions, and state changes into a single sorted timeline
  const timelineEvents = useMemo(() => {
    if (!data) return [];
    const events: TimelineEvent[] = [];

    for (const seg of data.transcriptSegments) {
      if (seg.isFinal) {
        events.push({ type: 'segment', timestamp: seg.timestamp, segment: seg });
      }
    }

    for (const int of data.interventions) {
      events.push({ type: 'intervention', timestamp: int.timestamp, intervention: int });
    }

    let lastState: string | null = null;
    for (const snap of data.metricSnapshots) {
      const inferred = snap.inferredState as { state?: ConversationStateName; confidence?: number } | undefined;
      if (inferred?.state && inferred.state !== lastState) {
        events.push({
          type: 'state_change',
          timestamp: snap.timestamp,
          stateChange: { state: inferred.state, confidence: inferred.confidence ?? 0 },
        });
        lastState = inferred.state;
      }
    }

    events.sort((a, b) => a.timestamp - b.timestamp);
    return events;
  }, [data]);

  const filteredEvents = useMemo(
    () => timelineEvents.filter(e => filters.has(e.type)),
    [timelineEvents, filters],
  );

  const toggleFilter = useCallback((type: TimelineEventType) => {
    setFilters(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const toggleIntervention = useCallback((id: string) => {
    setExpandedInterventions(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Compute cumulative time each metric spent in unhealthy range across the session
  const metricHealthSummary = useMemo(() => {
    if (!data || data.metricSnapshots.length < 2) return null;
    const snaps = data.metricSnapshots;
    const sessionDurationMs = (snaps[snaps.length - 1].timestamp - snaps[0].timestamp);
    if (sessionDurationMs <= 0) return null;

    let partRiskBadMs = 0;
    let repBadMs = 0;
    let stagBadMs = 0;
    let divBadMs = 0;
    let noveltyBadMs = 0;
    let clusterBadMs = 0;

    for (let i = 1; i < snaps.length; i++) {
      const prev = snaps[i - 1];
      const dt = snaps[i].timestamp - prev.timestamp;

      if (prev.participation && prev.participation.participationRiskScore > 0.55) partRiskBadMs += dt;
      if (prev.semanticRepetitionRate > 0.5) repBadMs += dt;
      if (prev.stagnationDuration > 60) stagBadMs += dt;
      if (prev.diversityDevelopment < 0.3) divBadMs += dt;

      const sd = prev.semanticDynamics;
      if (sd && sd.noveltyRate < 0.3) noveltyBadMs += dt;
      if (sd && sd.clusterConcentration > 0.7) clusterBadMs += dt;
    }

    return {
      sessionDurationMs,
      metrics: [
        { label: 'Part. Risk', badMs: partRiskBadMs, threshold: '> 0.55' },
        { label: 'Repetition', badMs: repBadMs, threshold: '> 50%' },
        { label: 'Stagnation', badMs: stagBadMs, threshold: '> 60s' },
        { label: 'Low Diversity', badMs: divBadMs, threshold: '< 30%' },
        { label: 'Low Novelty', badMs: noveltyBadMs, threshold: '< 0.30' },
        { label: 'High Cluster', badMs: clusterBadMs, threshold: '> 0.70' },
      ],
    };
  }, [data]);

  const stateDurations = useMemo(() => {
    if (!data || data.metricSnapshots.length < 2) return null;
    const snaps = data.metricSnapshots;
    const durations: Record<string, number> = {};
    const totalMs = snaps[snaps.length - 1].timestamp - snaps[0].timestamp;
    if (totalMs <= 0) return null;

    for (let i = 1; i < snaps.length; i++) {
      const prev = snaps[i - 1];
      const inferred = prev.inferredState as { state?: string } | undefined;
      const state = inferred?.state ?? 'UNKNOWN';
      const dt = snaps[i].timestamp - prev.timestamp;
      durations[state] = (durations[state] ?? 0) + dt;
    }

    const DISPLAY_ORDER: ConversationStateName[] = [
      'DOMINANCE_RISK', 'CONVERGENCE_RISK', 'STALLED_DISCUSSION',
      'HEALTHY_EXPLORATION', 'HEALTHY_ELABORATION',
    ];

    return {
      totalMs,
      entries: DISPLAY_ORDER
        .filter(s => (durations[s] ?? 0) > 0)
        .map(state => ({
          state: state as ConversationStateName,
          durationMs: durations[state] ?? 0,
          pct: ((durations[state] ?? 0) / totalMs) * 100,
        })),
    };
  }, [data]);

  // --- Render ---

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Loading session...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || 'No data'}</p>
          <button onClick={() => router.push('/')} className="text-blue-400 hover:text-blue-300 text-sm">
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const { metadata, activeConfig } = data;
  const duration = metadata.endTime ? metadata.endTime - metadata.startTime : null;
  const interventionCount = data.interventions.length;
  const segmentCount = data.transcriptSegments.filter(s => s.isFinal).length;
  const recoveredCount = data.interventions.filter(i => i.recoveryResult === 'recovered').length;

  const activeSnapshot = selectedSnapshot !== null
    ? data.metricSnapshots[selectedSnapshot]
    : data.metricSnapshots[data.metricSnapshots.length - 1] ?? null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 py-6 max-w-7xl">

        {/* Header */}
        <header className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => router.push('/')}
              className="text-slate-400 hover:text-white transition-colors text-sm"
            >
              &larr; Back
            </button>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              Session Replay
            </h1>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-slate-400">
            <span>Room: <span className="text-white">{metadata.roomName}</span></span>
            <span>Scenario: <span className="text-white">{metadata.scenario}</span></span>
            <span>Language: <span className="text-white">{metadata.language}</span></span>
            {duration && <span>Duration: <span className="text-white">{formatDuration(duration)}</span></span>}
            <span>Started: <span className="text-white">{formatTime(metadata.startTime)}</span></span>
            {data.promptVersion && <span>Prompt: <span className="text-white">{data.promptVersion}</span></span>}
          </div>
        </header>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <StatCard label="Speakers" value={speakers.length.toString()} />
          <StatCard label="Segments" value={segmentCount.toString()} />
          <StatCard label="Interventions" value={interventionCount.toString()} />
          <StatCard label="Recovery" value={interventionCount > 0 ? `${((recoveredCount / interventionCount) * 100).toFixed(0)}%` : 'N/A'} />
          <StatCard label="Ideas" value={data.ideas.length.toString()} />
        </div>

        {/* Metrics Timeline Chart (full width) */}
        {data.metricSnapshots.length >= 2 && (
          <MetricsTimelineChart
            snapshots={data.metricSnapshots}
            interventions={data.interventions}
            startTime={metadata.startTime}
            speakers={speakers}
          />
        )}

        {/* Main Layout: Timeline + Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Timeline (2/3) */}
          <div className="lg:col-span-2">
            {/* Filters */}
            <div className="flex gap-2 mb-4">
              <FilterButton
                label={`Segments (${segmentCount})`}
                active={filters.has('segment')}
                onClick={() => toggleFilter('segment')}
                color="blue"
              />
              <FilterButton
                label={`Interventions (${interventionCount})`}
                active={filters.has('intervention')}
                onClick={() => toggleFilter('intervention')}
                color="purple"
              />
              <FilterButton
                label="State Changes"
                active={filters.has('state_change')}
                onClick={() => toggleFilter('state_change')}
                color="emerald"
              />
            </div>

            {/* Timeline */}
            <div className="space-y-1">
              {filteredEvents.length === 0 ? (
                <div className="text-center text-slate-500 py-12">No events match filters</div>
              ) : (
                filteredEvents.map((event, i) => (
                  <TimelineEventRow
                    key={`${event.type}-${event.timestamp}-${i}`}
                    event={event}
                    startTime={metadata.startTime}
                    speakers={speakers}
                    expanded={event.intervention ? expandedInterventions.has(event.intervention.id) : false}
                    onToggle={event.intervention ? () => toggleIntervention(event.intervention!.id) : undefined}
                    annotation={event.intervention ? annotations.get(event.intervention.id) : undefined}
                    onSaveAnnotation={saveAnnotation}
                    isSaving={event.intervention ? savingAnnotation === event.intervention.id : false}
                  />
                ))
              )}
            </div>
          </div>

          {/* Sidebar (1/3) */}
          <div className="space-y-4">
            {/* Metric Snapshots Scrubber */}
            <Panel>
              <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">
                Metric Snapshots ({data.metricSnapshots.length})
              </h3>
              {data.metricSnapshots.length > 0 && activeSnapshot ? (
                <>
                  <div className="mb-4">
                    <input
                      type="range"
                      min={0}
                      max={data.metricSnapshots.length - 1}
                      value={selectedSnapshot ?? data.metricSnapshots.length - 1}
                      onChange={e => setSelectedSnapshot(Number(e.target.value))}
                      className="w-full accent-blue-500"
                    />
                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                      <span>{formatRelativeTime(data.metricSnapshots[0].timestamp, metadata.startTime)}</span>
                      <span className="text-slate-300 font-mono">
                        {formatRelativeTime(activeSnapshot.timestamp, metadata.startTime)}
                      </span>
                      <span>{formatRelativeTime(data.metricSnapshots[data.metricSnapshots.length - 1].timestamp, metadata.startTime)}</span>
                    </div>
                  </div>

                  {/* State Badge */}
                  {(activeSnapshot as MetricSnapshot & { inferredState?: { state: ConversationStateName; confidence: number } }).inferredState && (
                    <div className={`text-center text-xs font-medium px-3 py-1.5 rounded-md border mb-3 ${STATE_BG_COLORS[(activeSnapshot as MetricSnapshot & { inferredState: { state: ConversationStateName } }).inferredState.state]}`}>
                      {(activeSnapshot as MetricSnapshot & { inferredState: { state: ConversationStateName; confidence: number } }).inferredState.state.replace(/_/g, ' ')}
                      <span className="ml-1 opacity-70">
                        ({formatPercent((activeSnapshot as MetricSnapshot & { inferredState: { confidence: number } }).inferredState.confidence)})
                      </span>
                    </div>
                  )}

                  {/* Metric Bars */}
                  <div className="space-y-3">
                    <MetricBar
                      label="Part. Risk"
                      icon="P"
                      value={activeSnapshot.participation?.participationRiskScore ?? 0}
                      displayValue={formatPercent(activeSnapshot.participation?.participationRiskScore ?? 0)}
                      threshold={0.55}
                      higherIsBetter={false}
                      statusText={(activeSnapshot.participation?.participationRiskScore ?? 0) > 0.55 ? 'At Risk' : 'Balanced'}
                    />
                    <MetricBar
                      label="Repetition"
                      icon="R"
                      value={activeSnapshot.semanticRepetitionRate}
                      displayValue={formatPercent(activeSnapshot.semanticRepetitionRate)}
                      threshold={0.5}
                      higherIsBetter={false}
                      statusText={activeSnapshot.semanticRepetitionRate > 0.5 ? 'High repetition' : 'Novel'}
                    />
                    <MetricBar
                      label="Stagnation"
                      icon="S"
                      value={Math.min(1, activeSnapshot.stagnationDuration / 120)}
                      displayValue={`${activeSnapshot.stagnationDuration.toFixed(0)}s`}
                      threshold={0.5}
                      higherIsBetter={false}
                      statusText={activeSnapshot.stagnationDuration > 60 ? 'Stalled' : 'Active'}
                    />
                    <MetricBar
                      label="Diversity"
                      icon="D"
                      value={activeSnapshot.diversityDevelopment}
                      displayValue={formatPercent(activeSnapshot.diversityDevelopment)}
                      threshold={0.3}
                      higherIsBetter={true}
                      statusText={activeSnapshot.diversityDevelopment < 0.3 ? 'Low diversity' : 'Diverse'}
                    />
                  </div>
                </>
              ) : (
                <p className="text-slate-500 text-xs">No metric data</p>
              )}
            </Panel>

            {/* Metric Health Summary (Recharts) */}
            {metricHealthSummary && (
              <HealthSummaryChart metricHealthSummary={metricHealthSummary} />
            )}

            {/* Intervention Impact (Recharts) */}
            {data.interventions.length > 0 && data.metricSnapshots.length >= 2 && (
              <InterventionImpactChart
                interventions={data.interventions}
                snapshots={data.metricSnapshots}
              />
            )}

            {/* Intervention Success Rate */}
            {data.interventions.length > 0 && (
              <InterventionSuccessCard interventions={data.interventions} />
            )}

            {/* State Duration Breakdown (Recharts Donut) */}
            {stateDurations && (
              <StateDurationChart stateDurations={stateDurations} />
            )}

            {/* Ideas (collapsible) */}
            {data.ideas.length > 0 && (
              <Panel>
                <button
                  onClick={() => setIdeasExpanded(prev => !prev)}
                  className="flex items-center justify-between w-full text-left"
                >
                  <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                    Ideas ({data.ideas.length})
                  </h3>
                  <span className="text-slate-500 text-xs">{ideasExpanded ? 'Collapse' : 'Expand'}</span>
                </button>
                {!ideasExpanded && (
                  <div className="mt-2 space-y-1">
                    {data.ideas.slice(0, 3).map(idea => (
                      <div key={idea.id} className="text-xs text-slate-400 truncate">
                        {idea.title}
                      </div>
                    ))}
                    {data.ideas.length > 3 && (
                      <div className="text-xs text-slate-500">+{data.ideas.length - 3} more</div>
                    )}
                  </div>
                )}
                {ideasExpanded && (
                  <div className="mt-3 space-y-2 max-h-96 overflow-y-auto">
                    {data.ideas.map(idea => (
                      <div key={idea.id} className="bg-slate-800/50 rounded p-2">
                        <div className="text-sm text-white font-medium">{idea.title}</div>
                        {idea.description && (
                          <div className="text-xs text-slate-400 mt-0.5">{idea.description}</div>
                        )}
                        <div className="text-xs text-slate-500 mt-1">
                          {idea.author} &middot; {idea.source}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            )}

            {/* Model Routing */}
            {data.modelRoutingLog.length > 0 && (
              <Panel>
                <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">
                  Model Routing ({data.modelRoutingLog.length})
                </h3>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {data.modelRoutingLog.map(entry => (
                    <div key={entry.id} className="flex justify-between text-xs">
                      <span className="text-slate-300">{entry.task}</span>
                      <span className="text-slate-500">
                        {entry.model} &middot; {entry.latencyMs}ms
                        {!entry.success && <span className="text-red-400 ml-1">FAIL</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </Panel>
            )}

            {/* Export */}
            <Panel>
              <button
                onClick={() => {
                  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `session-${sessionId}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="w-full py-2 bg-slate-600 hover:bg-slate-500 rounded-lg text-sm font-medium transition-colors"
              >
                Download JSON Export
              </button>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Compact stat display card used in the session overview grid. */
function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-center">
      <div className="text-lg font-bold text-white">{value}</div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  );
}

const FILTER_ACTIVE_STYLES: Record<string, string> = {
  blue: 'bg-blue-500/20 border-blue-500/50 text-blue-300',
  purple: 'bg-purple-500/20 border-purple-500/50 text-purple-300',
  emerald: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300',
};

function FilterButton({ label, active, onClick, color }: {
  label: string;
  active: boolean;
  onClick: () => void;
  color: string;
}) {
  const activeClass = active
    ? (FILTER_ACTIVE_STYLES[color] ?? FILTER_ACTIVE_STYLES.blue)
    : 'bg-slate-800/50 border-slate-700 text-slate-500';
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${activeClass}`}
    >
      {label}
    </button>
  );
}
