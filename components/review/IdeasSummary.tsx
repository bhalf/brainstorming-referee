'use client';

import { useMemo } from 'react';
import type { SessionExport } from '@/types';
import { formatDuration, computeIdeaVelocityKPIs } from './utils';

interface Props {
  data: SessionExport;
}

const ROLE_CONFIG: { role: string; icon: string; label: string }[] = [
  { role: 'seed', icon: '✦', label: 'Neue Ideen' },
  { role: 'extension', icon: '↗', label: 'Erweiterungen' },
  { role: 'variant', icon: '≈', label: 'Varianten' },
  { role: 'tangent', icon: '↝', label: 'Verwandte' },
];

export default function IdeasSummary({ data }: Props) {
  const { session, ideas, connections } = data;
  const sessionStart = session.started_at || session.created_at;

  const activeIdeas = useMemo(() => ideas.filter((i) => !i.is_deleted), [ideas]);

  const velocity = useMemo(
    () => computeIdeaVelocityKPIs(ideas, sessionStart, session.ended_at),
    [ideas, sessionStart, session.ended_at]
  );

  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const idea of activeIdeas) {
      if (idea.novelty_role) counts[idea.novelty_role] = (counts[idea.novelty_role] || 0) + 1;
    }
    return counts;
  }, [activeIdeas]);

  if (activeIdeas.length === 0) return null;

  return (
    <div className="glass p-5 space-y-3">
      {/* Top row: counts + role breakdown */}
      <div className="flex items-center gap-4 flex-wrap">
        <div>
          <span className="text-2xl font-bold text-[var(--text-primary)]">{activeIdeas.length}</span>
          <span className="text-xs text-[var(--text-tertiary)] ml-1.5">Ideen</span>
        </div>
        {connections.length > 0 && (
          <div>
            <span className="text-2xl font-bold text-[var(--text-primary)]">{connections.length}</span>
            <span className="text-xs text-[var(--text-tertiary)] ml-1.5">Verbindungen</span>
          </div>
        )}
        <span className="w-px h-6 bg-white/[0.08]" />
        {ROLE_CONFIG.map(({ role, icon, label }) => {
          const count = roleCounts[role];
          if (!count) return null;
          return (
            <span key={role} className="text-xs text-[var(--text-tertiary)]">
              {icon} {count} {label}
            </span>
          );
        })}
      </div>

      {/* Timing KPIs */}
      {velocity.timeToFirstIdeaMs !== null && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="text-center">
            <div className="text-lg font-bold text-[var(--text-primary)]">
              {formatDuration(velocity.timeToFirstIdeaMs)}
            </div>
            <p className="text-[10px] text-[var(--text-tertiary)]">Erste Idee nach</p>
          </div>
          {velocity.avgTimeBetweenIdeasMs !== null && (
            <div className="text-center">
              <div className="text-lg font-bold text-[var(--text-primary)]">
                {formatDuration(velocity.avgTimeBetweenIdeasMs)}
              </div>
              <p className="text-[10px] text-[var(--text-tertiary)]">Avg. Abstand</p>
            </div>
          )}
          {velocity.fastestWindowCount > 0 && (
            <div className="text-center">
              <div className="text-lg font-bold text-[var(--text-primary)]">
                {velocity.fastestWindowCount}
              </div>
              <p className="text-[10px] text-[var(--text-tertiary)]">Beste 5-min Phase</p>
            </div>
          )}
          {velocity.longestGapMs !== null && (
            <div className="text-center">
              <div className="text-lg font-bold text-[var(--text-primary)]">
                {formatDuration(velocity.longestGapMs)}
              </div>
              <p className="text-[10px] text-[var(--text-tertiary)]">Längste Pause</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
