'use client';

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
  if (coverage >= 0.5) return 'Teilweise abgedeckt';
  if (coverage >= 0.2) return 'Wenig abgedeckt';
  return 'Nicht abgedeckt';
}

export default function TopicsTab({ data }: Props) {
  const { topics } = data;

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
  const totalSegments = topics.reduce((sum, t) => sum + t.segment_count, 0);
  const maxSegments = Math.max(...topics.map((t) => t.segment_count), 1);

  return (
    <div className="space-y-5">
      {/* Core Question + Overview */}
      <div className="glass p-5 space-y-3">
        <h3 className="text-sm font-semibold text-[var(--text-secondary)]">Kernfrage</h3>
        <p className="text-base text-[var(--text-primary)] leading-relaxed">{coreQuestion}</p>
        <div className="flex items-center gap-6 pt-1">
          <div>
            <div className="text-3xl font-bold tracking-tight">
              <span className={avgCoverage >= 0.6 ? 'text-emerald-400' : avgCoverage >= 0.3 ? 'text-amber-400' : 'text-rose-400'}>
                {Math.round(avgCoverage * 100)}%
              </span>
            </div>
            <p className="text-xs text-[var(--text-tertiary)]">Durchschnittliche Abdeckung</p>
          </div>
          <div>
            <div className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">
              {coveredCount}/{topics.length}
            </div>
            <p className="text-xs text-[var(--text-tertiary)]">Dimensionen abgedeckt</p>
          </div>
          <div>
            <div className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">
              {totalSegments}
            </div>
            <p className="text-xs text-[var(--text-tertiary)]">Segmente zugeordnet</p>
          </div>
        </div>
      </div>

      {/* Coverage Bar Overview */}
      <div className="glass p-5 space-y-3">
        <h3 className="text-sm font-semibold text-[var(--text-secondary)]">Abdeckung pro Subdimension</h3>
        <div className="w-full bg-white/[0.06] rounded-full h-2.5 overflow-hidden flex">
          {topics.map((topic) => {
            const pct = (1 / topics.length) * 100;
            return (
              <div
                key={topic.id}
                className={`h-full ${getCoverageColor(topic.coverage)}`}
                style={{ width: `${pct}%` }}
                title={`${topic.subdimension}: ${Math.round(topic.coverage * 100)}%`}
              />
            );
          })}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-tertiary)]">
          {[
            { label: 'Gut abgedeckt', color: 'bg-emerald-400' },
            { label: 'Teilweise', color: 'bg-blue-400' },
            { label: 'Wenig', color: 'bg-amber-400' },
            { label: 'Nicht abgedeckt', color: 'bg-white/10' },
          ].map((item) => (
            <span key={item.label} className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${item.color}`} />
              {item.label}
            </span>
          ))}
        </div>
      </div>

      {/* Individual Subdimensions */}
      <div className="space-y-2">
        {[...topics]
          .sort((a, b) => b.coverage - a.coverage)
          .map((topic) => {
            const covPct = Math.round(topic.coverage * 100);
            const segBarPct = Math.round((topic.segment_count / maxSegments) * 100);
            return (
              <div key={topic.id} className="glass-sm p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="text-sm font-medium text-[var(--text-primary)]">{topic.subdimension}</h4>
                    {topic.description && (
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5">{topic.description}</p>
                    )}
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border shrink-0 ${
                    covPct >= 80 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                    covPct >= 50 ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                    covPct >= 20 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                    'bg-white/5 text-white/40 border-white/10'
                  }`}>
                    {getCoverageLabel(topic.coverage)}
                  </span>
                </div>

                {/* Coverage bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--text-tertiary)]">Abdeckung</span>
                    <span className="font-mono text-[var(--text-secondary)]">{covPct}%</span>
                  </div>
                  <div className="w-full bg-white/[0.06] rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${getCoverageColor(topic.coverage)}`}
                      style={{ width: `${Math.min(100, covPct)}%` }}
                    />
                  </div>
                </div>

                {/* Segment count bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--text-tertiary)]">Segmente</span>
                    <span className="font-mono text-[var(--text-secondary)]">{topic.segment_count}</span>
                  </div>
                  <div className="w-full bg-white/[0.06] rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full transition-all bg-indigo-400"
                      style={{ width: `${segBarPct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
