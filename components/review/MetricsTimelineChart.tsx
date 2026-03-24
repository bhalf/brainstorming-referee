'use client';

import { useMemo, useState } from 'react';
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from 'recharts';
import type { SessionExport, ConversationState } from '@/types';
import { STATE_COLORS, STATE_LABELS, formatTimestamp, INTENT_LABELS, INTENT_CHART_COLORS } from './utils';

interface Props {
  data: SessionExport;
}

// --- Metric definitions ---

type MetricKey = string;

interface MetricDef {
  label: string;
  description: string;
  color: string;
  type: 'area' | 'line' | 'dashed';
  extract: (m: any) => number;
  format: (raw: number) => string;
  normalizeMax?: 'auto';
}

// --- Participation metrics ---

const PARTICIPATION_METRICS: Record<MetricKey, MetricDef> = {
  participationRisk: {
    label: 'Partizipationsrisiko',
    description: 'Kombinierter Score aus Redeanteil-Ungleichgewicht, stillen Teilnehmern und Dominanz-Streaks. Hoch = eine Person dominiert oder mehrere schweigen.',
    color: '#fb923c',
    type: 'area',
    extract: (m) => m.participation?.participation_composite ?? m.participation?.participation_risk_score ?? 0,
    format: (v) => `${Math.round(v * 100)}%`,
  },
  balance: {
    label: 'Balance',
    description: 'Wie gleichmässig die Redeanteile verteilt sind (1 - normalisierte Standardabweichung). 100% = alle reden gleich viel.',
    color: '#a78bfa',
    type: 'line',
    extract: (m) => m.participation?.balance ?? 1,
    format: (v) => `${Math.round(v * 100)}%`,
  },
  fluencyRate: {
    label: 'Ideenfluss',
    description: 'Anzahl neuer Redebeiträge pro Minute im aktuellen Zeitfenster. Zeigt das Gesprächstempo.',
    color: '#fbbf24',
    type: 'dashed',
    extract: (m) => m.participation?.ideational_fluency_rate ?? 0,
    format: (v) => `${v.toFixed(1)}/min`,
    normalizeMax: 'auto',
  },
};

// --- Semantic metrics ---

const SEMANTIC_METRICS: Record<MetricKey, MetricDef> = {
  noveltyRate: {
    label: 'Novelty-Rate',
    description: 'Anteil der Beiträge die semantisch neu sind (geringe Ähnlichkeit zu bisherigen Embeddings). Hoch = viele frische Ideen.',
    color: '#34d399',
    type: 'area',
    extract: (m) => m.semantic_dynamics?.novelty_rate ?? 0,
    format: (v) => `${Math.round(v * 100)}%`,
  },
  clusterConcentration: {
    label: 'Cluster-Konz.',
    description: 'Wie stark die Beiträge auf wenige Themen-Cluster konzentriert sind. Hoch = Gruppe kreist um ein Thema (Konvergenz-Risiko).',
    color: '#38bdf8',
    type: 'line',
    extract: (m) => m.semantic_dynamics?.cluster_concentration ?? 0,
    format: (v) => `${Math.round(v * 100)}%`,
  },
  diversity: {
    label: 'Diversität',
    description: 'Thematische Breite der Diskussion basierend auf der Verteilung über Embedding-Cluster. Hoch = viele verschiedene Themen.',
    color: '#2dd4bf',
    type: 'line',
    extract: (m) => m.semantic_dynamics?.diversity ?? 0.5,
    format: (v) => `${Math.round(v * 100)}%`,
  },
  explorationElaboration: {
    label: 'Exploration/Elaboration',
    description: 'Verhältnis neuer Themen vs. Vertiefung bestehender. Hoch = mehr Exploration (neue Richtungen), niedrig = mehr Elaboration (Vertiefung).',
    color: '#f472b6',
    type: 'line',
    extract: (m) => m.semantic_dynamics?.exploration_elaboration_ratio ?? 0.5,
    format: (v) => `${Math.round(v * 100)}%`,
  },
  piggybackingScore: {
    label: 'Piggybacking',
    description: 'Wie sehr Beiträge nur vorherige Aussagen wiederholen statt eigenständig zu denken. Hoch = wenig originelle Beiträge.',
    color: '#e879f9',
    type: 'dashed',
    extract: (m) => m.semantic_dynamics?.piggybacking_score ?? 0,
    format: (v) => `${Math.round(v * 100)}%`,
  },
  stagnation: {
    label: 'Stagnation',
    description: 'Dauer in Sekunden seit dem letzten semantisch neuen Beitrag. Steigt wenn die Diskussion sich im Kreis dreht.',
    color: '#facc15',
    type: 'dashed',
    extract: (m) => m.semantic_dynamics?.stagnation_duration_seconds ?? 0,
    format: (v) => `${Math.round(v)}s`,
    normalizeMax: 'auto',
  },
  semanticExpansion: {
    label: 'Sem. Expansion',
    description: 'Wie weit neue Beiträge vom bisherigen semantischen Zentrum entfernt sind. Hoch = Gruppe erweitert ihren Denkraum.',
    color: '#fb7185',
    type: 'line',
    extract: (m) => m.semantic_dynamics?.semantic_expansion_score ?? 0,
    format: (v) => `${Math.round(v * 100)}%`,
  },
};

// --- Preset groups ---

interface PresetGroup {
  label: string;
  keys: MetricKey[];
}

const PARTICIPATION_PRESETS: PresetGroup[] = [
  { label: 'Alle', keys: Object.keys(PARTICIPATION_METRICS) },
  { label: 'Risiko + Balance', keys: ['participationRisk', 'balance'] },
];

const SEMANTIC_PRESETS: PresetGroup[] = [
  { label: 'Alle', keys: Object.keys(SEMANTIC_METRICS) },
  { label: 'Novelty + Diversität', keys: ['noveltyRate', 'diversity'] },
  { label: 'Konvergenz', keys: ['clusterConcentration', 'explorationElaboration', 'piggybackingScore'] },
  { label: 'Stagnation', keys: ['stagnation', 'noveltyRate', 'semanticExpansion'] },
];

// --- Main export: renders both charts ---

export default function MetricsTimelineChart({ data }: Props) {
  const { session, metrics, interventions } = data;
  const sessionStart = session.started_at || session.created_at;

  const interventionMarkers = useMemo(() => {
    return interventions.map((iv) => ({
      time: new Date(iv.created_at).getTime() - new Date(sessionStart).getTime(),
      intent: iv.intent,
      text: iv.text,
    }));
  }, [interventions, sessionStart]);

  // State bands (shared between charts)
  const stateBands = useMemo(() => {
    if (metrics.length < 2) return [];
    const startMs = new Date(sessionStart).getTime();
    const bands: { x1: number; x2: number; state: ConversationState }[] = [];
    let currentState = metrics[0].inferred_state?.state ?? null;
    let bandStart = new Date(metrics[0].computed_at).getTime() - startMs;

    for (let i = 1; i < metrics.length; i++) {
      const s = metrics[i].inferred_state?.state ?? null;
      const t = new Date(metrics[i].computed_at).getTime() - startMs;
      if (s !== currentState) {
        if (currentState) bands.push({ x1: bandStart, x2: t, state: currentState });
        currentState = s;
        bandStart = t;
      }
    }
    if (currentState) {
      const lastT = new Date(metrics[metrics.length - 1].computed_at).getTime() - startMs;
      bands.push({ x1: bandStart, x2: lastT, state: currentState });
    }
    return bands;
  }, [metrics, sessionStart]);

  if (metrics.length < 2) {
    return (
      <div className="glass p-8 text-center">
        <p className="text-sm text-[var(--text-tertiary)]">Nicht genügend Metrik-Daten für die Zeitverlaufsanzeige.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <MetricChart
        title="Partizipation"
        metricDefs={PARTICIPATION_METRICS}
        presets={PARTICIPATION_PRESETS}
        defaultKeys={['participationRisk', 'balance']}
        metrics={metrics}
        sessionStart={sessionStart}
        stateBands={stateBands}
        interventionMarkers={interventionMarkers}
      />
      <MetricChart
        title="Semantik"
        metricDefs={SEMANTIC_METRICS}
        presets={SEMANTIC_PRESETS}
        defaultKeys={['noveltyRate', 'clusterConcentration', 'diversity']}
        metrics={metrics}
        sessionStart={sessionStart}
        stateBands={stateBands}
        interventionMarkers={interventionMarkers}
      />
    </div>
  );
}

// --- Reusable chart component ---

interface MetricChartProps {
  title: string;
  metricDefs: Record<MetricKey, MetricDef>;
  presets: PresetGroup[];
  defaultKeys: MetricKey[];
  metrics: any[];
  sessionStart: string;
  stateBands: { x1: number; x2: number; state: ConversationState }[];
  interventionMarkers: { time: number; intent: string; text: string }[];
}

function MetricChart({
  title,
  metricDefs,
  presets,
  defaultKeys,
  metrics,
  sessionStart,
  stateBands,
  interventionMarkers,
}: MetricChartProps) {
  const [activeKeys, setActiveKeys] = useState<Set<MetricKey>>(() => new Set(defaultKeys));
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  const toggleKey = (key: MetricKey) => {
    setActivePreset(null);
    setActiveKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const applyPreset = (preset: PresetGroup) => {
    if (activePreset === preset.label) {
      setActivePreset(null);
      setActiveKeys(new Set(defaultKeys));
    } else {
      setActivePreset(preset.label);
      setActiveKeys(new Set(preset.keys));
    }
  };

  // Compute auto-normalize maxes for metrics that need it
  const autoMaxes = useMemo(() => {
    const maxes: Record<MetricKey, number> = {};
    for (const [key, def] of Object.entries(metricDefs)) {
      if (def.normalizeMax === 'auto') {
        let max = 1;
        for (const m of metrics) {
          const v = def.extract(m);
          if (v > max) max = v;
        }
        maxes[key] = key === 'stagnation' ? Math.ceil(max / 30) * 30 : Math.ceil(max);
      }
    }
    return maxes;
  }, [metrics, metricDefs]);

  // Build chart data
  const chartData = useMemo(() => {
    const startMs = new Date(sessionStart).getTime();
    return metrics.map((m) => {
      const elapsed = new Date(m.computed_at).getTime() - startMs;
      const point: Record<string, any> = {
        time: elapsed,
        timeLabel: formatTimestamp(m.computed_at, sessionStart),
        state: m.inferred_state?.state ?? null,
      };
      for (const [key, def] of Object.entries(metricDefs)) {
        const raw = def.extract(m);
        point[`_raw_${key}`] = raw;
        if (def.normalizeMax === 'auto' && autoMaxes[key]) {
          point[key] = Math.round((raw / autoMaxes[key]) * 100);
        } else {
          point[key] = Math.round(raw * 100);
        }
      }
      return point;
    });
  }, [metrics, sessionStart, metricDefs, autoMaxes]);

  return (
    <div className="glass p-5 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)]">{title}</h3>
          <button
            onClick={() => setShowInfo(!showInfo)}
            className={`w-5 h-5 rounded-full text-[10px] font-bold border transition-all flex items-center justify-center ${
              showInfo
                ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-400'
                : 'border-[var(--border-glass)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
            }`}
            title="Metrik-Beschreibungen anzeigen"
          >
            ?
          </button>
        </div>
        {/* Preset buttons */}
        <div className="flex gap-1.5">
          {presets.map((p) => (
            <button
              key={p.label}
              onClick={() => applyPreset(p)}
              className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all ${
                activePreset === p.label
                  ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-400'
                  : 'border-[var(--border-glass)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Metric descriptions panel */}
      {showInfo && (
        <div className="rounded-xl border border-[var(--border-glass)] bg-white/[0.03] p-4 space-y-2.5">
          {Object.entries(metricDefs).map(([key, def]) => (
            <div key={key} className="flex items-start gap-2.5 text-xs">
              <span className="w-2.5 h-2.5 rounded-full mt-0.5 shrink-0" style={{ backgroundColor: def.color }} />
              <div>
                <span className="text-[var(--text-secondary)] font-medium">{def.label}</span>
                <span className="text-[var(--text-tertiary)] ml-1.5">{def.description}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />

            {/* State background bands */}
            {stateBands.map((band, i) => (
              <ReferenceArea
                key={i}
                x1={band.x1}
                x2={band.x2}
                fill={STATE_COLORS[band.state]}
                fillOpacity={0.12}
              />
            ))}

            {/* Intervention lines */}
            {interventionMarkers.map((marker, i) => (
              <ReferenceLine
                key={i}
                x={marker.time}
                stroke={INTENT_CHART_COLORS[marker.intent] || '#3b82f6'}
                strokeDasharray="6 3"
                strokeWidth={2}
              />
            ))}

            <XAxis
              dataKey="time"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(val) => {
                const minutes = Math.floor(val / 60000);
                const seconds = Math.floor((val % 60000) / 1000);
                return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
              }}
              tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
              width={45}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div
                    className="p-3 rounded-xl text-xs space-y-1.5 min-w-[180px] border border-white/10 shadow-xl"
                    style={{ background: 'rgba(15, 15, 25, 0.95)', backdropFilter: 'blur(16px)' }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-white/50">{d.timeLabel}</span>
                      {d.state && (
                        <span className="text-white/50">
                          {STATE_LABELS[d.state as ConversationState]}
                        </span>
                      )}
                    </div>
                    <div className="space-y-1">
                      {Object.entries(metricDefs).map(([key, def]) => {
                        if (!activeKeys.has(key)) return null;
                        return (
                          <TooltipRow
                            key={key}
                            color={def.color}
                            label={def.label}
                            value={def.format(d[`_raw_${key}`])}
                          />
                        );
                      })}
                    </div>
                    {/* Nearby intervention */}
                    {(() => {
                      const timeVal = d.time as number;
                      const nearby = interventionMarkers.find(
                        (m) => Math.abs(m.time - timeVal) < 15000
                      );
                      if (!nearby) return null;
                      const color = INTENT_CHART_COLORS[nearby.intent] || '#818cf8';
                      return (
                        <div className="border-t border-white/10 pt-1.5 mt-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                            <span className="font-medium text-white/80">{INTENT_LABELS[nearby.intent] || nearby.intent}</span>
                          </div>
                          <p className="text-white/40 mt-0.5 line-clamp-2">
                            {nearby.text.length > 80 ? nearby.text.slice(0, 80) + '...' : nearby.text}
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                );
              }}
            />

            <defs>
              {Object.entries(metricDefs).map(([key, def]) => {
                if (def.type !== 'area') return null;
                return (
                  <linearGradient key={key} id={`grad_${key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={def.color} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={def.color} stopOpacity={0} />
                  </linearGradient>
                );
              })}
            </defs>

            {/* Render active metrics */}
            {Object.entries(metricDefs).map(([key, def]) => {
              if (!activeKeys.has(key)) return null;
              if (def.type === 'area') {
                return (
                  <Area
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={def.color}
                    fill={`url(#grad_${key})`}
                    strokeWidth={2}
                    dot={false}
                  />
                );
              }
              return (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={def.color}
                  strokeWidth={1.5}
                  strokeDasharray={def.type === 'dashed' ? '5 5' : undefined}
                  dot={false}
                />
              );
            })}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend: Metric toggles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1">
        {Object.entries(metricDefs).map(([key, def]) => {
          const isActive = activeKeys.has(key);
          const scaleNote = def.normalizeMax && isActive && autoMaxes[key]
            ? ` (100% = ${def.format(autoMaxes[key])})`
            : '';
          return (
            <button
              key={key}
              onClick={() => toggleKey(key)}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs text-left transition-all ${
                isActive
                  ? 'border-white/10 bg-white/[0.04]'
                  : 'border-transparent bg-transparent opacity-40 hover:opacity-60'
              }`}
              title={def.description}
            >
              <span
                className="w-3 h-3 rounded shrink-0"
                style={{ backgroundColor: def.color, opacity: isActive ? 0.8 : 0.3 }}
              />
              <span className={isActive ? 'text-[var(--text-secondary)]' : 'text-[var(--text-tertiary)]'}>
                {def.label}
                {scaleNote && <span className="text-[var(--text-tertiary)] text-[9px]">{scaleNote}</span>}
              </span>
            </button>
          );
        })}
      </div>

      {/* Legend: Intervention markers (separated) */}
      {interventionMarkers.length > 0 && (
        <div className="flex items-center gap-3 pt-0.5 text-[10px] text-[var(--text-tertiary)]">
          <span className="uppercase tracking-wider font-medium">Interventionen:</span>
          {Array.from(new Set(interventionMarkers.map((m) => m.intent))).map((intent) => (
            <span key={intent} className="flex items-center gap-1.5">
              <span className="w-3 border-t-2 border-dashed" style={{ borderColor: INTENT_CHART_COLORS[intent] || '#818cf8' }} />
              {INTENT_LABELS[intent] || intent}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function TooltipRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-white/70">{label}</span>
      </span>
      <span className="font-mono text-white/90">{value}</span>
    </div>
  );
}
