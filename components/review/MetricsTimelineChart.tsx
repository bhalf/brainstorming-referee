'use client';

import { useMemo } from 'react';
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
import { STATE_COLORS, STATE_LABELS, formatTimestamp, INTENT_LABELS } from './utils';

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
  state: ConversationState | null;
}

export default function MetricsTimelineChart({ data }: Props) {
  const { session, metrics, interventions } = data;
  const sessionStart = session.started_at || session.created_at;

  const maxStagnation = useMemo(() => {
    let max = 60;
    for (const m of metrics) {
      const s = m.semantic_dynamics?.stagnation_duration_seconds ?? 0;
      if (s > max) max = s;
    }
    return max;
  }, [metrics]);

  const chartData = useMemo<ChartPoint[]>(() => {
    return metrics.map((m) => {
      const elapsed = new Date(m.computed_at).getTime() - new Date(sessionStart).getTime();
      return {
        time: elapsed,
        timeLabel: formatTimestamp(m.computed_at, sessionStart),
        participationRisk: Math.round((m.participation?.participation_risk_score ?? 0) * 100),
        noveltyRate: Math.round((m.semantic_dynamics?.novelty_rate ?? 0) * 100),
        stagnation: Math.round(
          ((m.semantic_dynamics?.stagnation_duration_seconds ?? 0) / maxStagnation) * 100
        ),
        clusterConcentration: Math.round((m.semantic_dynamics?.cluster_concentration ?? 0) * 100),
        state: m.inferred_state?.state ?? null,
      };
    });
  }, [metrics, sessionStart, maxStagnation]);

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

            {/* Intervention lines */}
            {interventionMarkers.map((marker, i) => (
              <ReferenceLine
                key={i}
                x={marker.time}
                stroke={marker.intent === 'ALLY_IMPULSE' ? '#a78bfa' : '#818cf8'}
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: '',
                  position: 'top',
                }}
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
                const d = payload[0].payload as ChartPoint;
                return (
                  <div className="glass-sm p-3 rounded-xl text-xs space-y-1.5 min-w-[180px]">
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--text-tertiary)]">{d.timeLabel}</span>
                      {d.state && (
                        <span className="text-[var(--text-tertiary)]">
                          {STATE_LABELS[d.state]}
                        </span>
                      )}
                    </div>
                    <div className="space-y-1">
                      <TooltipRow color="#fb923c" label="Partizipationsrisiko" value={`${d.participationRisk}%`} />
                      <TooltipRow color="#34d399" label="Novelty-Rate" value={`${d.noveltyRate}%`} />
                      <TooltipRow color="#facc15" label="Stagnation" value={`${d.stagnation}%`} />
                      <TooltipRow color="#38bdf8" label="Cluster-Konz." value={`${d.clusterConcentration}%`} />
                    </div>
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

            <Area
              type="monotone"
              dataKey="participationRisk"
              stroke="#fb923c"
              fill="url(#riskGradient)"
              strokeWidth={2}
              dot={false}
              name="Partizipationsrisiko"
            />
            <Area
              type="monotone"
              dataKey="noveltyRate"
              stroke="#34d399"
              fill="url(#noveltyGradient)"
              strokeWidth={2}
              dot={false}
              name="Novelty-Rate"
            />
            <Line
              type="monotone"
              dataKey="stagnation"
              stroke="#facc15"
              strokeWidth={1.5}
              strokeDasharray="5 5"
              dot={false}
              name="Stagnation"
            />
            <Line
              type="monotone"
              dataKey="clusterConcentration"
              stroke="#38bdf8"
              strokeWidth={1.5}
              dot={false}
              name="Cluster-Konzentration"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-[var(--text-tertiary)] pt-1">
        <LegendItem color="#fb923c" label="Partizipationsrisiko" type="area" />
        <LegendItem color="#34d399" label="Novelty-Rate" type="area" />
        <LegendItem color="#facc15" label="Stagnation" type="dashed" />
        <LegendItem color="#38bdf8" label="Cluster-Konzentration" type="line" />
        <LegendItem color="#818cf8" label="Intervention" type="dashed" />
      </div>
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

function LegendItem({ color, label, type }: { color: string; label: string; type: 'area' | 'line' | 'dashed' }) {
  return (
    <span className="flex items-center gap-1.5">
      {type === 'area' ? (
        <span className="w-3 h-2 rounded-sm" style={{ backgroundColor: color, opacity: 0.6 }} />
      ) : type === 'dashed' ? (
        <span className="w-3 border-t-2 border-dashed" style={{ borderColor: color }} />
      ) : (
        <span className="w-3 border-t-2" style={{ borderColor: color }} />
      )}
      {label}
    </span>
  );
}
