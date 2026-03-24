'use client';

import { useMemo } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';
import type { SessionExport } from '@/types';
import { formatTimestamp } from './utils';

interface Props {
  data: SessionExport;
}

const ROLE_COLORS: Record<string, string> = {
  seed: '#34d399',
  extension: '#38bdf8',
  variant: '#a78bfa',
  tangent: '#fb923c',
};
const ROLE_LABELS: Record<string, string> = {
  seed: '✦ Neue Idee',
  extension: '↗ Erweiterung',
  variant: '≈ Variante',
  tangent: '↝ Verwandt',
};

export default function IdeasTimelineChart({ data }: Props) {
  const { session, ideas, interventions } = data;
  const sessionStart = session.started_at || session.created_at;

  const activeIdeas = useMemo(() => ideas.filter((i) => !i.is_deleted), [ideas]);

  // Bucket ideas into 1-minute intervals
  const chartData = useMemo(() => {
    if (activeIdeas.length === 0) return [];

    const startMs = new Date(sessionStart).getTime();
    const endMs = session.ended_at ? new Date(session.ended_at).getTime() : startMs;
    const durationMin = Math.max(Math.ceil((endMs - startMs) / 60000), 1);

    const buckets: { minute: number; time: number; seed: number; extension: number; variant: number; tangent: number; cumulative: number }[] = [];
    let cumulative = 0;

    for (let m = 0; m < durationMin; m++) {
      const bucketStart = startMs + m * 60000;
      const bucketEnd = bucketStart + 60000;
      const inBucket = activeIdeas.filter((i) => {
        const t = new Date(i.created_at).getTime();
        return t >= bucketStart && t < bucketEnd;
      });

      const seed = inBucket.filter((i) => i.novelty_role === 'seed').length;
      const extension = inBucket.filter((i) => i.novelty_role === 'extension').length;
      const variant = inBucket.filter((i) => i.novelty_role === 'variant').length;
      const tangent = inBucket.filter((i) => i.novelty_role === 'tangent').length;
      cumulative += inBucket.length;

      buckets.push({
        minute: m,
        time: m * 60000,
        seed,
        extension,
        variant,
        tangent,
        cumulative,
      });
    }

    return buckets;
  }, [activeIdeas, sessionStart, session.ended_at]);

  // Intervention markers
  const interventionMarkers = useMemo(() => {
    const startMs = new Date(sessionStart).getTime();
    return interventions.map((iv) => ({
      time: new Date(iv.created_at).getTime() - startMs,
    }));
  }, [interventions, sessionStart]);

  if (chartData.length === 0 || activeIdeas.length === 0) return null;

  return (
    <div className="glass p-5 space-y-3">
      <h3 className="text-sm font-semibold text-[var(--text-secondary)]">Ideengeneration über Zeit</h3>
      <div className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />

            {interventionMarkers.map((m, i) => (
              <ReferenceLine key={i} x={m.time} stroke="#818cf8" strokeDasharray="4 4" strokeWidth={1} />
            ))}

            <XAxis
              dataKey="time"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(val) => {
                const minutes = Math.floor(val / 60000);
                return `${minutes}min`;
              }}
              tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickLine={false}
            />
            <YAxis
              yAxisId="count"
              tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickLine={false}
              allowDecimals={false}
            />
            <YAxis
              yAxisId="cumulative"
              orientation="right"
              tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={35}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                const total = d.seed + d.extension + d.variant + d.tangent;
                return (
                  <div className="glass-sm p-2.5 rounded-lg text-xs space-y-1">
                    <p className="text-[var(--text-primary)] font-medium">Minute {d.minute + 1}</p>
                    {total > 0 && <p className="text-[var(--text-tertiary)]">{total} Ideen in dieser Minute</p>}
                    {d.seed > 0 && <p className="text-green-400">✦ {d.seed} Neue</p>}
                    {d.extension > 0 && <p className="text-sky-400">↗ {d.extension} Erweiterungen</p>}
                    {d.variant > 0 && <p className="text-violet-400">≈ {d.variant} Varianten</p>}
                    {d.tangent > 0 && <p className="text-orange-400">↝ {d.tangent} Verwandte</p>}
                    <p className="text-[var(--text-tertiary)]">Kumulativ: {d.cumulative}</p>
                  </div>
                );
              }}
            />

            <Bar yAxisId="count" dataKey="seed" stackId="ideas" fill={ROLE_COLORS.seed} fillOpacity={0.7} barSize={12} />
            <Bar yAxisId="count" dataKey="extension" stackId="ideas" fill={ROLE_COLORS.extension} fillOpacity={0.7} barSize={12} />
            <Bar yAxisId="count" dataKey="variant" stackId="ideas" fill={ROLE_COLORS.variant} fillOpacity={0.7} barSize={12} />
            <Bar yAxisId="count" dataKey="tangent" stackId="ideas" fill={ROLE_COLORS.tangent} fillOpacity={0.7} barSize={12} />
            <Line yAxisId="cumulative" type="monotone" dataKey="cumulative" stroke="#e2e8f0" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-tertiary)]">
        {Object.entries(ROLE_COLORS).map(([role, color]) => (
          <span key={role} className="flex items-center gap-1.5">
            <span className="w-3 h-2 rounded-sm" style={{ backgroundColor: color, opacity: 0.7 }} />
            {ROLE_LABELS[role]}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="w-3 border-t-2 border-dashed" style={{ borderColor: '#e2e8f0' }} />
          Kumulativ
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 border-t-2 border-dashed" style={{ borderColor: '#818cf8' }} />
          Intervention
        </span>
      </div>
    </div>
  );
}
