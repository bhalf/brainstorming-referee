'use client';

import { useState, useMemo } from 'react';
import type { SessionExport } from '@/types';
import { formatTimestamp, formatDuration, computeIdeaVelocityKPIs } from './utils';

interface Props {
  data: SessionExport;
}

type SortKey = 'created_at' | 'title' | 'author' | 'novelty_role';

const NOVELTY_ROLE_CONFIG: Record<string, { label: string; badge: string; icon: string }> = {
  seed: { label: 'Neue Idee', badge: 'bg-green-500/15 text-green-400 border-green-500/25', icon: '✦' },
  extension: { label: 'Erweiterung', badge: 'bg-blue-500/15 text-blue-400 border-blue-500/25', icon: '↗' },
  variant: { label: 'Variante', badge: 'bg-purple-500/15 text-purple-400 border-purple-500/25', icon: '≈' },
  tangent: { label: 'Verwandt', badge: 'bg-orange-500/15 text-orange-400 border-orange-500/25', icon: '↝' },
};

const SOURCE_CONTEXT_CONFIG: Record<string, { label: string; badge: string }> = {
  organic: { label: 'Spontan', badge: 'bg-white/5 text-white/40 border-white/10' },
  moderator_triggered: { label: 'Nach Moderation', badge: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
  ally_triggered: { label: 'Nach Ally', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
};

const RELEVANCE_CONFIG: Record<string, { label: string; badge: string }> = {
  direct_answer: { label: 'Direkt', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  partial: { label: 'Teilweise', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  tangential: { label: 'Tangential', badge: 'bg-white/5 text-white/40 border-white/10' },
};

const ROLE_ORDER: Record<string, number> = { seed: 0, tangent: 1, extension: 2, variant: 3 };

export default function IdeasTab({ data }: Props) {
  const { session, ideas, connections, goals } = data;
  const sessionStart = session.started_at || session.created_at;
  const [sortBy, setSortBy] = useState<SortKey>('created_at');

  const activeIdeas = useMemo(() => ideas.filter((i) => !i.is_deleted), [ideas]);

  const ideaVelocity = useMemo(
    () => computeIdeaVelocityKPIs(ideas, sessionStart, session.ended_at),
    [ideas, sessionStart, session.ended_at]
  );

  const sorted = useMemo(() => {
    return [...activeIdeas].sort((a, b) => {
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      if (sortBy === 'author') return (a.author_name || '').localeCompare(b.author_name || '');
      if (sortBy === 'novelty_role') return (ROLE_ORDER[a.novelty_role || ''] ?? 9) - (ROLE_ORDER[b.novelty_role || ''] ?? 9);
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }, [activeIdeas, sortBy]);

  // Connection type counts
  const connectionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of connections) {
      const type = c.connection_type || 'unknown';
      counts[type] = (counts[type] || 0) + 1;
    }
    return counts;
  }, [connections]);

  // Count connections per idea
  const ideaConnectionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of connections) {
      counts[c.source_idea_id] = (counts[c.source_idea_id] || 0) + 1;
      counts[c.target_idea_id] = (counts[c.target_idea_id] || 0) + 1;
    }
    return counts;
  }, [connections]);

  // Goal lookup map
  const goalMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of goals) {
      map.set(g.id, g.label);
    }
    return map;
  }, [goals]);

  if (activeIdeas.length === 0) {
    return (
      <div className="glass p-8 text-center">
        <p className="text-sm text-[var(--text-tertiary)]">Keine Ideen in dieser Session extrahiert.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary Stats */}
      <div className="flex gap-4 flex-wrap">
        <div className="glass-sm px-4 py-3 text-center">
          <div className="text-xl font-bold text-[var(--text-primary)]">{activeIdeas.length}</div>
          <p className="text-xs text-[var(--text-tertiary)]">Ideen</p>
        </div>
        <div className="glass-sm px-4 py-3 text-center">
          <div className="text-xl font-bold text-[var(--text-primary)]">{connections.length}</div>
          <p className="text-xs text-[var(--text-tertiary)]">Verbindungen</p>
        </div>
        {(['seed', 'extension', 'variant', 'tangent'] as const).map((role) => {
          const count = activeIdeas.filter((i) => i.novelty_role === role).length;
          if (count === 0) return null;
          const cfg = NOVELTY_ROLE_CONFIG[role];
          return (
            <div key={role} className="glass-sm px-4 py-3 text-center">
              <div className="text-xl font-bold text-[var(--text-primary)]">{count}</div>
              <p className="text-xs text-[var(--text-tertiary)]">{cfg.icon} {cfg.label}</p>
            </div>
          );
        })}
      </div>

      {/* Idea Velocity KPIs */}
      {ideaVelocity.timeToFirstIdeaMs !== null && (
        <div className="glass p-4 space-y-2">
          <h3 className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">Ideen-Timing</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div>
              <div className="text-lg font-bold text-[var(--text-primary)]">
                {formatDuration(ideaVelocity.timeToFirstIdeaMs)}
              </div>
              <p className="text-[10px] text-[var(--text-tertiary)]">Erste Idee nach</p>
            </div>
            {ideaVelocity.avgTimeBetweenIdeasMs !== null && (
              <div>
                <div className="text-lg font-bold text-[var(--text-primary)]">
                  {formatDuration(ideaVelocity.avgTimeBetweenIdeasMs)}
                </div>
                <p className="text-[10px] text-[var(--text-tertiary)]">Avg. Abstand</p>
              </div>
            )}
            {ideaVelocity.fastestWindowCount > 0 && (
              <div>
                <div className="text-lg font-bold text-[var(--text-primary)]">
                  {ideaVelocity.fastestWindowCount}
                </div>
                <p className="text-[10px] text-[var(--text-tertiary)]">Beste 5min Phase</p>
              </div>
            )}
            {ideaVelocity.longestGapMs !== null && (
              <div>
                <div className="text-lg font-bold text-[var(--text-primary)]">
                  {formatDuration(ideaVelocity.longestGapMs)}
                </div>
                <p className="text-[10px] text-[var(--text-tertiary)]">Längste Pause</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sort Controls */}
      <div className="flex gap-1.5">
        {([
          { key: 'created_at' as const, label: 'Zeitlich' },
          { key: 'title' as const, label: 'Alphabetisch' },
          { key: 'author' as const, label: 'Nach Autor' },
          { key: 'novelty_role' as const, label: 'Nach Rolle' },
        ]).map((opt) => (
          <button
            key={opt.key}
            onClick={() => setSortBy(opt.key)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
              sortBy === opt.key
                ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-400'
                : 'border-[var(--border-glass)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Ideas List */}
      <div className="space-y-2">
        {sorted.map((idea) => {
          const connCount = ideaConnectionCounts[idea.id] || 0;
          const linkedGoalLabel = idea.linked_goal_id ? goalMap.get(idea.linked_goal_id) : null;
          return (
            <div key={idea.id} className="glass-sm p-4 space-y-1.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="text-sm font-medium text-[var(--text-primary)]">{idea.title}</h4>
                  {idea.description && (
                    <p className="text-xs text-[var(--text-secondary)] mt-1">{idea.description}</p>
                  )}
                </div>
                <span className="text-[10px] font-mono text-[var(--text-tertiary)] shrink-0">
                  {formatTimestamp(idea.created_at, sessionStart)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-[var(--text-tertiary)] flex-wrap">
                {idea.author_name && (
                  <span>von {idea.author_name}</span>
                )}
                {connCount > 0 && (
                  <span>{connCount} Verbindung{connCount !== 1 ? 'en' : ''}</span>
                )}
                <span className="bg-white/[0.06] px-1.5 py-0.5 rounded">{idea.idea_type}</span>
                {idea.novelty_role && (() => {
                  const cfg = NOVELTY_ROLE_CONFIG[idea.novelty_role];
                  return cfg ? (
                    <span className={`px-1.5 py-0.5 rounded border ${cfg.badge}`}>{cfg.icon} {cfg.label}</span>
                  ) : null;
                })()}
                {idea.source_context && idea.source_context !== 'organic' && (() => {
                  const cfg = SOURCE_CONTEXT_CONFIG[idea.source_context];
                  return cfg ? (
                    <span className={`px-1.5 py-0.5 rounded border ${cfg.badge}`}>{cfg.label}</span>
                  ) : null;
                })()}
              </div>
              {/* Goal linking */}
              {linkedGoalLabel && (
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="text-[var(--text-tertiary)]">Ziel:</span>
                  <span className="text-[var(--text-secondary)]">{linkedGoalLabel}</span>
                  {idea.goal_relevance && (() => {
                    const cfg = RELEVANCE_CONFIG[idea.goal_relevance];
                    return cfg ? (
                      <span className={`px-1.5 py-0.5 rounded border ${cfg.badge}`}>{cfg.label}</span>
                    ) : null;
                  })()}
                  {idea.goal_quality != null && (
                    <span className="font-mono text-[var(--text-tertiary)]">{Math.round(idea.goal_quality * 100)}%</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
