'use client';

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { SessionExport } from '@/types';
import { getSpeakerColor, formatDuration } from './utils';

interface Props {
  data: SessionExport;
}

export default function ParticipantBreakdown({ data }: Props) {
  const { session, participants, metrics, segments } = data;

  // Prefer cumulative (whole session) over windowed snapshot for review
  const lastMetric = metrics[metrics.length - 1];
  const volumeShare = lastMetric?.participation?.cumulative?.volume_share
    ?? lastMetric?.participation?.volume_share
    ?? {};
  const turnShare = lastMetric?.participation?.cumulative?.turn_share
    ?? lastMetric?.participation?.turn_share
    ?? {};

  const participantData = useMemo(() => {
    return participants.map((p, idx) => {
      const volume = Math.round((volumeShare[p.livekit_identity] ?? 0) * 100);
      const turns = Math.round((turnShare[p.livekit_identity] ?? 0) * 100);
      const segmentCount = segments.filter(
        (s) => s.speaker_identity === p.livekit_identity && s.is_final
      ).length;
      const activeDuration = p.left_at
        ? new Date(p.left_at).getTime() - new Date(p.joined_at).getTime()
        : session.ended_at
          ? new Date(session.ended_at).getTime() - new Date(p.joined_at).getTime()
          : 0;

      return {
        name: p.display_name,
        identity: p.livekit_identity,
        role: p.role,
        volume,
        turns,
        segmentCount,
        activeDuration,
        color: getSpeakerColor(idx),
      };
    }).sort((a, b) => b.volume - a.volume);
  }, [participants, volumeShare, turnShare, segments, session.ended_at]);

  if (participantData.length === 0) {
    return (
      <div className="glass p-8 text-center">
        <p className="text-sm text-[var(--text-tertiary)]">Keine Teilnehmerdaten verfügbar.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Volume Share Chart */}
      <div className="glass p-5 space-y-3">
        <h3 className="text-sm font-semibold text-[var(--text-secondary)]">Redeanteile (Volumen)</h3>
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={participantData}
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
                dataKey="name"
                tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={100}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="glass-sm p-2.5 rounded-lg text-xs space-y-1">
                      <p className="text-[var(--text-primary)] font-medium">{d.name}</p>
                      <p className="text-[var(--text-tertiary)]">Volumen: {d.volume}%</p>
                      <p className="text-[var(--text-tertiary)]">Turns: {d.turns}%</p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="volume" barSize={16} radius={[0, 6, 6, 0]}>
                {participantData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} fillOpacity={0.7} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Participant Details Table */}
      <div className="glass p-5 space-y-3">
        <h3 className="text-sm font-semibold text-[var(--text-secondary)]">Teilnehmer-Details</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[var(--text-tertiary)] border-b border-white/[0.06]">
                <th className="text-left py-2 pr-4">Name</th>
                <th className="text-left py-2 pr-4">Rolle</th>
                <th className="text-right py-2 pr-4">Redeanteil</th>
                <th className="text-right py-2 pr-4">Turn-Anteil</th>
                <th className="text-right py-2 pr-4">Beiträge</th>
                <th className="text-right py-2">Aktiv</th>
              </tr>
            </thead>
            <tbody>
              {participantData.map((p) => (
                <tr key={p.identity} className="border-b border-white/[0.03]">
                  <td className="py-2.5 pr-4">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                      <span className="text-[var(--text-primary)]">{p.name}</span>
                    </span>
                  </td>
                  <td className="py-2.5 pr-4">
                    <RoleBadge role={p.role} />
                  </td>
                  <td className="py-2.5 pr-4 text-right font-mono text-[var(--text-secondary)]">{p.volume}%</td>
                  <td className="py-2.5 pr-4 text-right font-mono text-[var(--text-secondary)]">{p.turns}%</td>
                  <td className="py-2.5 pr-4 text-right font-mono text-[var(--text-secondary)]">{p.segmentCount}</td>
                  <td className="py-2.5 text-right text-[var(--text-tertiary)]">
                    {p.activeDuration > 0 ? formatDuration(p.activeDuration) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    host: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    co_host: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    participant: 'bg-white/5 text-white/40 border-white/10',
  };
  const labels: Record<string, string> = {
    host: 'Host',
    co_host: 'Co-Host',
    participant: 'Teilnehmer',
  };

  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${styles[role] || styles.participant}`}>
      {labels[role] || role}
    </span>
  );
}
