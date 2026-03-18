'use client';

import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import type { SessionExport, ConversationState } from '@/types';
import { STATE_COLORS, STATE_LABELS, computeStateDurations, formatDuration } from './utils';

interface Props {
  data: SessionExport;
}

export default function StateDurationChart({ data }: Props) {
  const { metrics } = data;

  const durations = useMemo(() => computeStateDurations(metrics), [metrics]);
  const totalMs = Object.values(durations).reduce((a, b) => a + b, 0);

  const chartData = useMemo(() => {
    return (Object.entries(durations) as [ConversationState, number][])
      .filter(([, ms]) => ms > 0)
      .map(([state, ms]) => ({
        name: STATE_LABELS[state],
        value: ms,
        state,
        pct: totalMs > 0 ? Math.round((ms / totalMs) * 100) : 0,
      }));
  }, [durations, totalMs]);

  if (chartData.length === 0) {
    return (
      <div className="glass p-8 text-center">
        <p className="text-sm text-[var(--text-tertiary)]">Keine Zustandsdaten verfügbar.</p>
      </div>
    );
  }

  return (
    <div className="glass p-5 space-y-3">
      <h3 className="text-sm font-semibold text-[var(--text-secondary)]">Zustandsverteilung</h3>
      <div className="flex items-center gap-6">
        <div className="h-[200px] w-[200px] relative shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={2}
                dataKey="value"
                stroke="none"
              >
                {chartData.map((entry) => (
                  <Cell
                    key={entry.state}
                    fill={STATE_COLORS[entry.state as ConversationState]}
                    opacity={0.85}
                  />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="glass-sm p-2.5 rounded-lg text-xs">
                      <span className="text-[var(--text-primary)]">{d.name}</span>
                      <span className="text-[var(--text-tertiary)] ml-2">
                        {formatDuration(d.value)} ({d.pct}%)
                      </span>
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-lg font-bold text-[var(--text-primary)]">{formatDuration(totalMs)}</span>
            <span className="text-[10px] text-[var(--text-tertiary)]">Gesamt</span>
          </div>
        </div>

        {/* Legend */}
        <div className="space-y-2 flex-1">
          {chartData.map((entry) => (
            <div key={entry.state} className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: STATE_COLORS[entry.state as ConversationState] }}
                />
                <span className="text-[var(--text-secondary)]">{entry.name}</span>
              </span>
              <span className="text-[var(--text-tertiary)] font-mono">
                {formatDuration(entry.value)} ({entry.pct}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
