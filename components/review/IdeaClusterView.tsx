'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { getIdeaClusters } from '@/lib/api-client';
import type { SessionExport, ClusteredIdeasResponse, Idea, NoveltyRole, IdeaType } from '@/types';

interface Props {
  sessionId: string;
  data: SessionExport;
}

const NOVELTY_STYLES: Record<NoveltyRole, { icon: string; badge: string; label: string }> = {
  seed: { icon: '✦', badge: 'bg-green-500/15 text-green-400 border-green-500/25', label: 'Neu' },
  extension: { icon: '↗', badge: 'bg-blue-500/15 text-blue-400 border-blue-500/25', label: 'Erweiterung' },
  variant: { icon: '≈', badge: 'bg-purple-500/15 text-purple-400 border-purple-500/25', label: 'Variante' },
  tangent: { icon: '↝', badge: 'bg-orange-500/15 text-orange-400 border-orange-500/25', label: 'Verwandt' },
};

const TYPE_COLORS: Record<IdeaType, string> = {
  brainstorming_idea: 'border-l-indigo-500/40',
  ally_intervention: 'border-l-emerald-500/40',
  action_item: 'border-l-amber-500/40',
};

// Theme column colors (rotating)
const THEME_COLORS = [
  { header: 'from-indigo-500/15 to-violet-500/10', border: 'border-indigo-500/20', text: 'text-indigo-400', count: 'bg-indigo-500/15 text-indigo-300' },
  { header: 'from-emerald-500/15 to-teal-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', count: 'bg-emerald-500/15 text-emerald-300' },
  { header: 'from-amber-500/15 to-orange-500/10', border: 'border-amber-500/20', text: 'text-amber-400', count: 'bg-amber-500/15 text-amber-300' },
  { header: 'from-rose-500/15 to-pink-500/10', border: 'border-rose-500/20', text: 'text-rose-400', count: 'bg-rose-500/15 text-rose-300' },
  { header: 'from-cyan-500/15 to-blue-500/10', border: 'border-cyan-500/20', text: 'text-cyan-400', count: 'bg-cyan-500/15 text-cyan-300' },
];

export default function IdeaClusterView({ sessionId, data }: Props) {
  const [clusters, setClusters] = useState<ClusteredIdeasResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedIdeaId, setSelectedIdeaId] = useState<string | null>(null);

  // Build connection lookup: idea_id -> set of connected idea_ids
  const connectionMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const conn of data.connections) {
      if (!map.has(conn.source_idea_id)) map.set(conn.source_idea_id, new Set());
      if (!map.has(conn.target_idea_id)) map.set(conn.target_idea_id, new Set());
      map.get(conn.source_idea_id)!.add(conn.target_idea_id);
      map.get(conn.target_idea_id)!.add(conn.source_idea_id);
    }
    return map;
  }, [data.connections]);

  const connectedIds = useMemo(() => {
    if (!selectedIdeaId) return new Set<string>();
    return connectionMap.get(selectedIdeaId) || new Set<string>();
  }, [selectedIdeaId, connectionMap]);

  useEffect(() => {
    getIdeaClusters(sessionId)
      .then(setClusters)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [sessionId]);

  const handleCardClick = useCallback((ideaId: string) => {
    setSelectedIdeaId((prev) => (prev === ideaId ? null : ideaId));
  }, []);

  // Fallback: show flat list grouped by nothing
  const fallbackIdeas = useMemo(
    () => data.ideas.filter((i) => !i.is_deleted),
    [data.ideas],
  );

  if (loading) {
    return (
      <div className="glass p-8 animate-pulse">
        <div className="h-5 bg-white/[0.06] rounded w-1/3 mb-4" />
        <div className="h-16 bg-white/[0.04] rounded mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-3">
              <div className="h-8 bg-white/[0.06] rounded" />
              <div className="h-24 bg-white/[0.04] rounded" />
              <div className="h-24 bg-white/[0.04] rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Fallback if endpoint failed
  if (error || !clusters || clusters.clusters.length === 0) {
    return (
      <div className="glass p-6">
        <h3 className="text-sm font-medium text-[var(--text-primary)] mb-4">
          Ideen ({fallbackIdeas.length})
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {fallbackIdeas.map((idea) => (
            <IdeaCard key={idea.id} idea={idea} highlighted={false} dimmed={false} selected={false} onClick={() => {}} />
          ))}
        </div>
      </div>
    );
  }

  const totalIdeas = clusters.clusters.reduce((sum, c) => sum + c.ideas.length, 0) + clusters.unclustered.length;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* AI Summary */}
      {clusters.summary && (
        <div className="glass p-5">
          <div className="flex items-start gap-3">
            <div className="shrink-0 mt-0.5">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
                <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Ideen-Übersicht</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-[var(--text-tertiary)]">
                  {totalIdeas} Ideen · {clusters.clusters.length} Themen
                </span>
              </div>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{clusters.summary}</p>
            </div>
          </div>
        </div>
      )}

      {/* Hint */}
      {data.connections.length > 0 && (
        <p className="text-[10px] text-[var(--text-tertiary)] px-1">
          Klicke auf eine Idee, um verwandte Ideen hervorzuheben.
        </p>
      )}

      {/* Theme Clusters */}
      <div className={`grid gap-4 ${
        clusters.clusters.length === 1 && clusters.unclustered.length === 0
          ? 'grid-cols-1'
          : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
      }`}>
        {clusters.clusters.map((cluster, ci) => {
          const color = THEME_COLORS[ci % THEME_COLORS.length];
          const isSingleLargeCluster = clusters.clusters.length === 1 && clusters.unclustered.length === 0;
          return (
            <div key={ci} className={`glass overflow-hidden border ${color.border}`}>
              {/* Theme Header */}
              <div className={`bg-gradient-to-r ${color.header} px-4 py-3 flex items-center justify-between`}>
                <h4 className={`text-sm font-semibold ${color.text}`}>{cluster.theme}</h4>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${color.count}`}>
                  {cluster.ideas.length}
                </span>
              </div>

              {/* Ideas in cluster — use grid for large single clusters */}
              <div className={isSingleLargeCluster && cluster.ideas.length > 3
                ? 'p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2'
                : 'p-3 space-y-2'
              }>
                {cluster.ideas.map((idea) => {
                  const isSelected = selectedIdeaId === idea.id;
                  const isConnected = connectedIds.has(idea.id);
                  const isDimmed = selectedIdeaId !== null && !isSelected && !isConnected;
                  return (
                    <IdeaCard
                      key={idea.id}
                      idea={idea}
                      selected={isSelected}
                      highlighted={isConnected}
                      dimmed={isDimmed}
                      onClick={() => handleCardClick(idea.id)}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Unclustered ideas */}
        {clusters.unclustered.length > 0 && (
          <div className="glass overflow-hidden border border-white/10">
            <div className="bg-gradient-to-r from-white/[0.04] to-white/[0.02] px-4 py-3 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-[var(--text-tertiary)]">Weitere Ideen</h4>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/[0.06] text-[var(--text-tertiary)]">
                {clusters.unclustered.length}
              </span>
            </div>
            <div className="p-3 space-y-2">
              {clusters.unclustered.map((idea) => (
                <IdeaCard
                  key={idea.id}
                  idea={idea}
                  selected={selectedIdeaId === idea.id}
                  highlighted={connectedIds.has(idea.id)}
                  dimmed={selectedIdeaId !== null && selectedIdeaId !== idea.id && !connectedIds.has(idea.id)}
                  onClick={() => handleCardClick(idea.id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Idea Card ---

interface IdeaCardProps {
  idea: Idea;
  selected: boolean;
  highlighted: boolean;
  dimmed: boolean;
  onClick: () => void;
}

function IdeaCard({ idea, selected, highlighted, dimmed, onClick }: IdeaCardProps) {
  const [expanded, setExpanded] = useState(false);
  const typeColor = TYPE_COLORS[idea.idea_type] || TYPE_COLORS.brainstorming_idea;
  const novelty = idea.novelty_role ? NOVELTY_STYLES[idea.novelty_role] : null;

  return (
    <div
      onClick={onClick}
      className={`
        border-l-[3px] ${typeColor} rounded-lg px-3 py-2.5 cursor-pointer transition-all duration-200
        ${selected
          ? 'bg-indigo-500/10 ring-1 ring-indigo-500/30'
          : highlighted
            ? 'bg-white/[0.08] ring-1 ring-amber-400/30'
            : 'bg-white/[0.03] hover:bg-white/[0.06]'
        }
        ${dimmed ? 'opacity-30' : 'opacity-100'}
      `}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            {novelty && (
              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${novelty.badge}`}>
                {novelty.icon} {novelty.label}
              </span>
            )}
          </div>
          <h5 className="text-[13px] font-medium text-[var(--text-primary)] leading-snug">{idea.title}</h5>
          {idea.description && (
            <p
              className={`text-[11px] text-[var(--text-tertiary)] mt-1 leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}
              onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            >
              {idea.description}
            </p>
          )}
        </div>
      </div>
      {idea.author_name && (
        <p className="text-[10px] text-[var(--text-tertiary)] mt-1.5 font-mono opacity-60">— {idea.author_name}</p>
      )}
    </div>
  );
}
