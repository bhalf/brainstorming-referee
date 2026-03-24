'use client';

import { useState, useMemo } from 'react';
import type { SessionExport } from '@/types';

interface Props {
  data: SessionExport;
}

function getCoverageColor(coverage: number): string {
  if (coverage >= 0.8) return 'bg-emerald-400';
  if (coverage >= 0.5) return 'bg-blue-400';
  if (coverage >= 0.2) return 'bg-amber-400';
  return 'bg-white/10';
}

function getCoverageLabel(coverage: number): string {
  if (coverage >= 0.8) return 'Gut abgedeckt';
  if (coverage >= 0.5) return 'Teilweise';
  if (coverage >= 0.2) return 'Wenig';
  return 'Offen';
}

function getCoverageBadgeStyle(coverage: number): string {
  if (coverage >= 0.8) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  if (coverage >= 0.5) return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
  if (coverage >= 0.2) return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
  return 'bg-white/5 text-white/40 border-white/10';
}

export default function TopicsTab({ data }: Props) {
  const { session, topics, segments } = data;
  const sessionStart = session.started_at || session.created_at;
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);

  const finalSegments = useMemo(() => segments.filter((s) => s.is_final), [segments]);

  // Segment classification stats
  const segmentStats = useMemo(() => {
    let assigned = 0;
    let offTopic = 0;
    for (const s of finalSegments) {
      if (s.topic_subdimension) assigned++;
      else offTopic++;
    }
    return { assigned, offTopic, total: finalSegments.length };
  }, [finalSegments]);

  // Build segment lookup by subdimension
  const segmentsBySubdim = useMemo(() => {
    const map = new Map<string, typeof finalSegments>();
    for (const s of finalSegments) {
      if (!s.topic_subdimension) continue;
      const key = s.topic_subdimension;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return map;
  }, [finalSegments]);

  // Count segments assigned to subdimensions NOT in current topic map
  const unmatchedCount = useMemo(() => {
    const topicSubdims = new Set(topics.map((t) => t.subdimension));
    let count = 0;
    for (const [subdim, segs] of segmentsBySubdim) {
      if (!topicSubdims.has(subdim)) count += segs.length;
    }
    return count;
  }, [topics, segmentsBySubdim]);

  if (topics.length === 0) {
    return (
      <div className="glass p-8 text-center">
        <p className="text-sm text-[var(--text-tertiary)]">Keine Themenanalyse für diese Session verfügbar.</p>
      </div>
    );
  }

  const coreQuestion = topics[0]?.core_question || '';
  const avgCoverage = topics.reduce((sum, t) => sum + t.coverage, 0) / topics.length;
  const coveredCount = topics.filter((t) => t.coverage >= 0.5).length;
  const sortedTopics = [...topics].sort((a, b) => b.coverage - a.coverage);

  return (
    <div className="space-y-5">
      {/* Core Question + KPIs */}
      <div className="glass p-5 space-y-3">
        <h3 className="text-sm font-semibold text-[var(--text-secondary)]">Kernfrage</h3>
        <p className="text-base text-[var(--text-primary)] leading-relaxed">{coreQuestion}</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div className="text-center">
            <div className={`text-2xl font-bold ${avgCoverage >= 0.6 ? 'text-emerald-400' : avgCoverage >= 0.3 ? 'text-amber-400' : 'text-rose-400'}`}>
              {Math.round(avgCoverage * 100)}%
            </div>
            <p className="text-xs text-[var(--text-tertiary)]">Ø Abdeckung</p>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-[var(--text-primary)]">
              {coveredCount}<span className="text-[var(--text-tertiary)] text-lg">/{topics.length}</span>
            </div>
            <p className="text-xs text-[var(--text-tertiary)]">Dimensionen abgedeckt</p>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-[var(--text-primary)]">
              {segmentStats.assigned}<span className="text-[var(--text-tertiary)] text-lg">/{segmentStats.total}</span>
            </div>
            <p className="text-xs text-[var(--text-tertiary)]">Segmente zugeordnet</p>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-[var(--text-tertiary)]">
              {segmentStats.offTopic}
            </div>
            <p className="text-xs text-[var(--text-tertiary)]">Off-Topic</p>
          </div>
        </div>
      </div>

      {/* Subdimensions */}
      <div className="space-y-2">
        {sortedTopics.map((topic) => {
          const covPct = Math.round(topic.coverage * 100);
          const isExpanded = expandedTopic === topic.id;
          const matchingSegments = segmentsBySubdim.get(topic.subdimension) || [];

          return (
            <div key={topic.id} className="glass-sm overflow-hidden">
              <button
                className="w-full text-left p-4 hover:bg-white/[0.02] transition-colors"
                onClick={() => setExpandedTopic(isExpanded ? null : topic.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5">
                      <h4 className="text-sm font-medium text-[var(--text-primary)]">{topic.subdimension}</h4>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border shrink-0 ${getCoverageBadgeStyle(topic.coverage)}`}>
                        {getCoverageLabel(topic.coverage)}
                      </span>
                    </div>
                    {topic.description && (
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5">{topic.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-mono text-[var(--text-tertiary)]">
                      {matchingSegments.length} Seg.
                    </span>
                    <svg
                      width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      className={`text-[var(--text-tertiary)] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </div>

                {/* Single coverage bar */}
                <div className="mt-2.5 flex items-center gap-3">
                  <div className="flex-1 bg-white/[0.06] rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${getCoverageColor(topic.coverage)}`}
                      style={{ width: `${Math.min(100, covPct)}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono text-[var(--text-secondary)] w-8 text-right">{covPct}%</span>
                </div>
              </button>

              {/* Expanded: segments */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-white/[0.06] pt-3 animate-fade-in">
                  {matchingSegments.length > 0 ? (
                    <>
                      <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider mb-2">
                        Zugeordnete Segmente
                        {matchingSegments.length > 15 && (
                          <span className="normal-case tracking-normal ml-1.5 opacity-60">
                            (15 von {matchingSegments.length} angezeigt)
                          </span>
                        )}
                      </p>
                      <div className="space-y-1 max-h-[200px] overflow-y-auto">
                        {matchingSegments.slice(0, 15).map((seg) => {
                          const elapsed = new Date(seg.created_at).getTime() - new Date(sessionStart).getTime();
                          const mins = Math.floor(elapsed / 60000);
                          const secs = Math.floor((elapsed % 60000) / 1000);
                          return (
                            <div key={seg.id} className="text-xs flex gap-2 bg-white/[0.02] rounded-lg px-2 py-1.5">
                              <span className="text-[var(--text-tertiary)] font-mono shrink-0 w-8 text-right">
                                {mins}:{String(secs).padStart(2, '0')}
                              </span>
                              <span className="text-indigo-400 shrink-0">{seg.speaker_name}</span>
                              <span className="text-[var(--text-primary)] line-clamp-2">{seg.text}</span>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-[var(--text-tertiary)]">
                      Keine zugeordneten Segmente verfügbar.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Note about unmatched segments from earlier topic map versions */}
      {unmatchedCount > 0 && (
        <p className="text-xs text-[var(--text-tertiary)] px-1">
          {unmatchedCount} Segmente wurden früheren Themenversionen zugeordnet und sind hier nicht einzeln aufgelistet.
        </p>
      )}
    </div>
  );
}
