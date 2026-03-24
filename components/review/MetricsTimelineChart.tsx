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

interface ChartPoint {
  time: number;
  timeLabel: string;
  participationRisk: number;
  noveltyRate: number;
  stagnation: number;
  clusterConcentration: number;
  // Additional metrics
  balance: number;
  explorationElaboration: number;
  diversity: number;
  piggybackingScore: number;
  fluencyRate: number;
  semanticExpansion: number;
  state: ConversationState | null;
}

type MetricToggle = 'participationRisk' | 'noveltyRate' | 'stagnation' | 'clusterConcentration'
  | 'balance' | 'explorationElaboration' | 'diversity' | 'piggybackingScore' | 'fluencyRate' | 'semanticExpansion';

const METRIC_CONFIG: Record<MetricToggle, { label: string; color: string; type: 'area' | 'line' | 'dashed'; defaultOn: boolean }> = {
  participationRisk: { label: 'Partizipationsrisiko', color: '#fb923c', type: 'area', defaultOn: true },
  noveltyRate: { label: 'Novelty-Rate', color: '#34d399', type: 'area', defaultOn: true },
  stagnation: { label: 'Stagnation (s)', color: '#facc15', type: 'dashed', defaultOn: false },
  clusterConcentration: { label: 'Cluster-Konz.', color: '#38bdf8', type: 'line', defaultOn: true },
  balance: { label: 'Balance', color: '#a78bfa', type: 'line', defaultOn: true },
  explorationElaboration: { label: 'Exploration/Elaboration', color: '#f472b6', type: 'line', defaultOn: false },
  diversity: { label: 'Diversität', color: '#2dd4bf', type: 'line', defaultOn: false },
  piggybackingScore: { label: 'Piggybacking', color: '#e879f9', type: 'dashed', defaultOn: false },
  fluencyRate: { label: 'Ideenfluss (seg/min)', color: '#fbbf24', type: 'dashed', defaultOn: false },
  semanticExpansion: { label: 'Sem. Expansion', color: '#fb7185', type: 'line', defaultOn: false },
};

export default function MetricsTimelineChart({ data }: Props) {
  const { session, metrics, interventions } = data;
  const sessionStart = session.started_at || session.created_at;

  const [activeMetrics, setActiveMetrics] = useState<Set<MetricToggle>>(() => {
    return new Set(Object.entries(METRIC_CONFIG).filter(([, c]) => c.defaultOn).map(([k]) => k as MetricToggle));
  });

  const toggleMetric = (key: MetricToggle) => {
    setActiveMetrics((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Stagnation uses absolute seconds on a secondary axis (not normalized)
  const maxStagnation = useMemo(() => {
    let max = 60;
    for (const m of metrics) {
      const s = m.semantic_dynamics?.stagnation_duration_seconds ?? 0;
      if (s > max) max = s;
    }
    // Round up to nearest 30s for clean axis
    return Math.ceil(max / 30) * 30;
  }, [metrics]);

  const maxFluency = useMemo(() => {
    let max = 5;
    for (const m of metrics) {
      const f = m.participation?.ideational_fluency_rate ?? 0;
      if (f > max) max = f;
    }
    return Math.ceil(max);
  }, [metrics]);

  const chartData = useMemo<ChartPoint[]>(() => {
    return metrics.map((m) => {
      const elapsed = new Date(m.computed_at).getTime() - new Date(sessionStart).getTime();
      return {
        time: elapsed,
        timeLabel: formatTimestamp(m.computed_at, sessionStart),
        participationRisk: Math.round((m.participation?.participation_composite ?? m.participation?.participation_risk_score ?? 0) * 100),
        noveltyRate: Math.round((m.semantic_dynamics?.novelty_rate ?? 0) * 100),
        // Stagnation: normalize to 0-100 scale using maxStagnation for chart display
        stagnation: Math.round(
          ((m.semantic_dynamics?.stagnation_duration_seconds ?? 0) / maxStagnation) * 100
        ),
        clusterConcentration: Math.round((m.semantic_dynamics?.cluster_concentration ?? 0) * 100),
        balance: Math.round((m.participation?.balance ?? 1) * 100),
        explorationElaboration: Math.round((m.semantic_dynamics?.exploration_elaboration_ratio ?? 0.5) * 100),
        diversity: Math.round((m.semantic_dynamics?.diversity ?? 0.5) * 100),
        piggybackingScore: Math.round((m.semantic_dynamics?.piggybacking_score ?? 0) * 100),
        fluencyRate: Math.round(((m.participation?.ideational_fluency_rate ?? 0) / Math.max(maxFluency, 1)) * 100),
        semanticExpansion: Math.round((m.semantic_dynamics?.semantic_expansion_score ?? 0) * 100),
        state: m.inferred_state?.state ?? null,
        // Raw values for tooltip
        _rawStagnation: m.semantic_dynamics?.stagnation_duration_seconds ?? 0,
        _rawFluency: m.participation?.ideational_fluency_rate ?? 0,
        _rawBalance: m.participation?.balance ?? 1,
        _rawDiversity: m.semantic_dynamics?.diversity ?? 0.5,
        _rawPiggybacking: m.semantic_dynamics?.piggybacking_score ?? 0,
        _rawExploration: m.semantic_dynamics?.exploration_elaboration_ratio ?? 0.5,
        _rawExpansion: m.semantic_dynamics?.semantic_expansion_score ?? 0,
      };
    });
  }, [metrics, sessionStart, maxStagnation, maxFluency]);

  // State-colored background bands
  const stateBands = useMemo(() => {
    if (chartData.length < 2) return [];
    const bands: { x1: number; x2: number; state: ConversationState }[] = [];
    let currentState = chartData[0].state;
    let bandStart = chartData[0].time;

    for (let i = 1; i < chartData.length; i++) {
      if (chartData[i].state !== currentState) {
        if (currentState) {
          bands.push({ x1: bandStart, x2: chartData[i].time, state: currentState });
        }
        currentState = chartData[i].state;
        bandStart = chartData[i].time;
      }
    }
    if (currentState) {
      bands.push({ x1: bandStart, x2: chartData[chartData.length - 1].time, state: currentState });
    }
    return bands;
  }, [chartData]);

  // Intervention markers
  const interventionMarkers = useMemo(() => {
    return interventions.map((iv) => ({
      time: new Date(iv.created_at).getTime() - new Date(sessionStart).getTime(),
      intent: iv.intent,
      text: iv.text,
    }));
  }, [interventions, sessionStart]);

  if (chartData.length < 2) {
    return (
      <div className="glass p-8 text-center">
        <p className="text-sm text-[var(--text-tertiary)]">Nicht genügend Metrik-Daten für die Zeitverlaufsanzeige.</p>
      </div>
    );
  }

  return (
    <div className="glass p-5 space-y-3">
      <h3 className="text-sm font-semibold text-[var(--text-secondary)]">Metriken-Zeitverlauf</h3>
      <div className="h-[360px] w-full">
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
                fillOpacity={0.06}
              />
            ))}

            {/* Intervention lines (color-coded by intent) */}
            {interventionMarkers.map((marker, i) => (
              <ReferenceLine
                key={i}
                x={marker.time}
                stroke={INTENT_CHART_COLORS[marker.intent] || '#818cf8'}
                strokeDasharray="4 4"
                strokeWidth={1.5}
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
                  <div className="glass-sm p-3 rounded-xl text-xs space-y-1.5 min-w-[200px]">
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--text-tertiary)]">{d.timeLabel}</span>
                      {d.state && (
                        <span className="text-[var(--text-tertiary)]">
                          {STATE_LABELS[d.state as ConversationState]}
                        </span>
                      )}
                    </div>
                    <div className="space-y-1">
                      {activeMetrics.has('participationRisk') && <TooltipRow color="#fb923c" label="Partizipationsrisiko" value={`${d.participationRisk}%`} />}
                      {activeMetrics.has('noveltyRate') && <TooltipRow color="#34d399" label="Novelty-Rate" value={`${d.noveltyRate}%`} />}
                      {activeMetrics.has('stagnation') && <TooltipRow color="#facc15" label="Stagnation" value={`${Math.round(d._rawStagnation)}s`} />}
                      {activeMetrics.has('clusterConcentration') && <TooltipRow color="#38bdf8" label="Cluster-Konz." value={`${d.clusterConcentration}%`} />}
                      {activeMetrics.has('balance') && <TooltipRow color="#a78bfa" label="Balance" value={`${Math.round(d._rawBalance * 100)}%`} />}
                      {activeMetrics.has('explorationElaboration') && <TooltipRow color="#f472b6" label="Expl./Elab." value={`${Math.round(d._rawExploration * 100)}%`} />}
                      {activeMetrics.has('diversity') && <TooltipRow color="#2dd4bf" label="Diversität" value={`${Math.round(d._rawDiversity * 100)}%`} />}
                      {activeMetrics.has('piggybackingScore') && <TooltipRow color="#e879f9" label="Piggybacking" value={`${Math.round(d._rawPiggybacking * 100)}%`} />}
                      {activeMetrics.has('fluencyRate') && <TooltipRow color="#fbbf24" label="Ideenfluss" value={`${d._rawFluency.toFixed(1)}/min`} />}
                      {activeMetrics.has('semanticExpansion') && <TooltipRow color="#fb7185" label="Sem. Expansion" value={`${Math.round(d._rawExpansion * 100)}%`} />}
                    </div>
                    {/* Show nearby intervention info */}
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
                            <span className="font-medium">{INTENT_LABELS[nearby.intent] || nearby.intent}</span>
                          </div>
                          <p className="text-[var(--text-tertiary)] mt-0.5 line-clamp-2">
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
              <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#fb923c" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#fb923c" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="noveltyGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
              </linearGradient>
            </defs>

            {/* Render active metrics */}
            {activeMetrics.has('participationRisk') && (
              <Area type="monotone" dataKey="participationRisk" stroke="#fb923c" fill="url(#riskGradient)" strokeWidth={2} dot={false} name="Partizipationsrisiko" />
            )}
            {activeMetrics.has('noveltyRate') && (
              <Area type="monotone" dataKey="noveltyRate" stroke="#34d399" fill="url(#noveltyGradient)" strokeWidth={2} dot={false} name="Novelty-Rate" />
            )}
            {activeMetrics.has('stagnation') && (
              <Line type="monotone" dataKey="stagnation" stroke="#facc15" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="Stagnation" />
            )}
            {activeMetrics.has('clusterConcentration') && (
              <Line type="monotone" dataKey="clusterConcentration" stroke="#38bdf8" strokeWidth={1.5} dot={false} name="Cluster-Konzentration" />
            )}
            {activeMetrics.has('balance') && (
              <Line type="monotone" dataKey="balance" stroke="#a78bfa" strokeWidth={1.5} dot={false} name="Balance" />
            )}
            {activeMetrics.has('explorationElaboration') && (
              <Line type="monotone" dataKey="explorationElaboration" stroke="#f472b6" strokeWidth={1.5} dot={false} name="Exploration/Elaboration" />
            )}
            {activeMetrics.has('diversity') && (
              <Line type="monotone" dataKey="diversity" stroke="#2dd4bf" strokeWidth={1.5} dot={false} name="Diversität" />
            )}
            {activeMetrics.has('piggybackingScore') && (
              <Line type="monotone" dataKey="piggybackingScore" stroke="#e879f9" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="Piggybacking" />
            )}
            {activeMetrics.has('fluencyRate') && (
              <Line type="monotone" dataKey="fluencyRate" stroke="#fbbf24" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="Ideenfluss" />
            )}
            {activeMetrics.has('semanticExpansion') && (
              <Line type="monotone" dataKey="semanticExpansion" stroke="#fb7185" strokeWidth={1.5} dot={false} name="Sem. Expansion" />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Toggleable Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs pt-1">
        {Object.entries(METRIC_CONFIG).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => toggleMetric(key as MetricToggle)}
            className={`flex items-center gap-1.5 transition-opacity ${activeMetrics.has(key as MetricToggle) ? 'opacity-100' : 'opacity-30'}`}
          >
            {cfg.type === 'area' ? (
              <span className="w-3 h-2 rounded-sm" style={{ backgroundColor: cfg.color, opacity: 0.6 }} />
            ) : cfg.type === 'dashed' ? (
              <span className="w-3 border-t-2 border-dashed" style={{ borderColor: cfg.color }} />
            ) : (
              <span className="w-3 border-t-2" style={{ borderColor: cfg.color }} />
            )}
            <span className="text-[var(--text-tertiary)]">{cfg.label}</span>
          </button>
        ))}
        {Array.from(new Set(interventionMarkers.map((m) => m.intent))).map((intent) => (
          <span key={intent} className="flex items-center gap-1.5 text-[var(--text-tertiary)]">
            <span className="w-3 border-t-2 border-dashed" style={{ borderColor: INTENT_CHART_COLORS[intent] || '#818cf8' }} />
            {INTENT_LABELS[intent] || intent}
          </span>
        ))}
      </div>

      {/* Stagnation scale note */}
      {activeMetrics.has('stagnation') && (
        <p className="text-[10px] text-[var(--text-tertiary)]">
          Stagnation: 0% = 0s, 100% = {maxStagnation}s (max. in dieser Session)
        </p>
      )}
      {activeMetrics.has('fluencyRate') && (
        <p className="text-[10px] text-[var(--text-tertiary)]">
          Ideenfluss: 0% = 0/min, 100% = {maxFluency}/min (max. in dieser Session)
        </p>
      )}
    </div>
  );
}

function TooltipRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        {label}
      </span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
