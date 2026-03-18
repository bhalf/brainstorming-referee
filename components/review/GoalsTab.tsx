'use client';

import { useMemo } from 'react';
import type { SessionExport, SessionGoal } from '@/types';

interface Props {
  data: SessionExport;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  not_started: { label: 'Nicht gestartet', color: 'bg-white/5 text-white/40 border-white/10' },
  mentioned: { label: 'Erwähnt', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  partially_covered: { label: 'Teilweise', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
  covered: { label: 'Abgedeckt', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
};

const RELEVANCE_LABELS: Record<string, string> = {
  direct_answer: 'Direkt',
  partial: 'Teilweise',
  tangential: 'Tangential',
};

function buildGoalHierarchy(goals: SessionGoal[]) {
  const parents = goals
    .filter((g) => !g.parent_id)
    .sort((a, b) => a.sort_order - b.sort_order);
  const childrenMap = new Map<string, SessionGoal[]>();
  for (const g of goals) {
    if (g.parent_id) {
      const existing = childrenMap.get(g.parent_id) || [];
      existing.push(g);
      childrenMap.set(g.parent_id, existing.sort((a, b) => a.sort_order - b.sort_order));
    }
  }
  return { parents, childrenMap };
}

function GoalMetricBars({ goal }: { goal: SessionGoal }) {
  const heatPct = Math.round(goal.heat_score * 100);
  const covPct = Math.round(goal.coverage_score * 100);

  return (
    <div className="space-y-1.5">
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--text-tertiary)]">Relevanz</span>
          <span className="font-mono text-[var(--text-secondary)]">{heatPct}%</span>
        </div>
        <div className="w-full bg-white/[0.06] rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full transition-all ${
              heatPct >= 60 ? 'bg-emerald-400' : heatPct >= 30 ? 'bg-amber-400' : 'bg-rose-400'
            }`}
            style={{ width: `${Math.min(100, heatPct)}%` }}
          />
        </div>
      </div>
      {goal.coverage_score > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--text-tertiary)]">Abdeckung</span>
            <span className="font-mono text-[var(--text-secondary)]">{covPct}%</span>
          </div>
          <div className="w-full bg-white/[0.06] rounded-full h-1.5">
            <div
              className="h-1.5 rounded-full transition-all bg-indigo-400"
              style={{ width: `${Math.min(100, covPct)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function GoalsTab({ data }: Props) {
  const { goals, ideas } = data;

  if (goals.length === 0) {
    return (
      <div className="glass p-8 text-center">
        <p className="text-sm text-[var(--text-tertiary)]">Keine Ziele für diese Session definiert.</p>
      </div>
    );
  }

  const { parents, childrenMap } = buildGoalHierarchy(goals);

  // Coverage stats from leaf goals only — use continuous coverage_score average
  const leafGoals = goals.filter(
    (g) => g.parent_id !== null || !childrenMap.has(g.id)
  );
  const avgCoverageScore = leafGoals.length > 0
    ? leafGoals.reduce((sum, g) => sum + g.coverage_score, 0) / leafGoals.length
    : 0;
  const overallCoverage = Math.round(avgCoverageScore * 100);
  const coveredCount = leafGoals.filter((g) => g.coverage_score >= 0.5).length;

  // Ideas linked to goals
  const ideasByGoal = useMemo(() => {
    const map = new Map<string, typeof ideas>();
    for (const idea of ideas) {
      if (idea.is_deleted || !idea.linked_goal_id) continue;
      const existing = map.get(idea.linked_goal_id) || [];
      existing.push(idea);
      map.set(idea.linked_goal_id, existing);
    }
    return map;
  }, [ideas]);

  return (
    <div className="space-y-5">
      {/* Overall Coverage */}
      <div className="glass p-5 space-y-3">
        <h3 className="text-sm font-semibold text-[var(--text-secondary)]">Zielabdeckung</h3>
        <div className="flex items-center gap-4">
          <div className="text-3xl font-bold tracking-tight">
            <span className={overallCoverage >= 60 ? 'text-emerald-400' : overallCoverage >= 30 ? 'text-amber-400' : 'text-rose-400'}>
              {overallCoverage}%
            </span>
          </div>
          <div className="text-xs text-[var(--text-tertiary)]">
            <p>Durchschnittliche Abdeckung (gewichtet)</p>
            <p>{coveredCount} von {leafGoals.length} Zielen &ge;50% abgedeckt</p>
          </div>
        </div>
      </div>

      {/* Hierarchical Goals */}
      <div className="space-y-2">
        {parents.map((goal) => {
          const statusCfg = STATUS_CONFIG[goal.status] || STATUS_CONFIG.not_started;
          const children = childrenMap.get(goal.id) || [];
          const hasChildren = children.length > 0;
          const linkedIdeas = ideasByGoal.get(goal.id) || [];

          return (
            <div key={goal.id} className="glass-sm p-4 space-y-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="text-sm font-medium text-[var(--text-primary)]">{goal.label}</h4>
                  {goal.description && (
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">{goal.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {hasChildren && (
                    <span className="text-[10px] text-[var(--text-tertiary)] bg-white/[0.05] px-1.5 py-0.5 rounded">
                      {children.filter((c) => c.status === 'covered').length}/{children.length}
                    </span>
                  )}
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${statusCfg.color}`}>
                    {statusCfg.label}
                  </span>
                </div>
              </div>

              {/* Parent metrics (always shown) */}
              <GoalMetricBars goal={goal} />

              {/* Linked ideas for parent goal */}
              {!hasChildren && linkedIdeas.length > 0 && (
                <GoalLinkedIdeas ideas={linkedIdeas} />
              )}

              {goal.notes && !hasChildren && (
                <p className="text-xs text-[var(--text-tertiary)] bg-white/[0.03] p-2.5 rounded-lg">
                  {goal.notes}
                </p>
              )}

              {/* Subgoals */}
              {hasChildren && (
                <div className="border-t border-white/[0.05] pt-2.5 mt-2.5 space-y-2.5">
                  {children.map((sub) => {
                    const subCfg = STATUS_CONFIG[sub.status] || STATUS_CONFIG.not_started;
                    const subLinkedIdeas = ideasByGoal.get(sub.id) || [];
                    return (
                      <div key={sub.id} className="pl-3 border-l-2 border-indigo-500/20">
                        <div className="flex items-start justify-between gap-3 mb-1.5">
                          <div className="min-w-0">
                            <h5 className="text-xs font-medium text-[var(--text-primary)]">{sub.label}</h5>
                            {sub.description && (
                              <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">{sub.description}</p>
                            )}
                          </div>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border shrink-0 ${subCfg.color}`}>
                            {subCfg.label}
                          </span>
                        </div>
                        <GoalMetricBars goal={sub} />
                        {subLinkedIdeas.length > 0 && (
                          <GoalLinkedIdeas ideas={subLinkedIdeas} />
                        )}
                        {sub.notes && (
                          <p className="text-[11px] text-[var(--text-tertiary)] bg-white/[0.03] p-2 rounded-lg mt-1.5">
                            {sub.notes}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GoalLinkedIdeas({ ideas }: { ideas: SessionExport['ideas'] }) {
  const ROLE_ICONS: Record<string, string> = { seed: '✦', extension: '↗', variant: '≈', tangent: '↯' };

  return (
    <div className="space-y-1 mt-1.5">
      <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">
        Verknüpfte Ideen ({ideas.length})
      </span>
      <div className="space-y-1">
        {ideas.map((idea) => (
          <div key={idea.id} className="text-xs flex items-center gap-2 bg-white/[0.03] rounded-lg px-2 py-1">
            {idea.novelty_role && (
              <span className="text-[var(--text-tertiary)]">{ROLE_ICONS[idea.novelty_role] || ''}</span>
            )}
            <span className="text-[var(--text-primary)] flex-1 min-w-0 truncate">{idea.title}</span>
            {idea.goal_relevance && (
              <span className="text-[10px] text-[var(--text-tertiary)]">
                {RELEVANCE_LABELS[idea.goal_relevance] || idea.goal_relevance}
              </span>
            )}
            {idea.goal_quality != null && (
              <span className="text-[10px] font-mono text-[var(--text-tertiary)]">
                {Math.round(idea.goal_quality * 100)}%
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
