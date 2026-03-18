'use client';

import { useState } from 'react';
import type { SessionGoal, GoalStatus } from '@/types';

interface GoalsPanelProps {
  goals: SessionGoal[];
}

const STATUS_CONFIG: Record<GoalStatus, { dot: string; label: string; text: string }> = {
  not_started: {
    dot: 'bg-white/20',
    label: 'Nicht begonnen',
    text: 'text-[var(--text-tertiary)]',
  },
  mentioned: {
    dot: 'bg-amber-400',
    label: 'Erwähnt',
    text: 'text-amber-400',
  },
  partially_covered: {
    dot: 'bg-blue-400',
    label: 'Teilweise behandelt',
    text: 'text-blue-400',
  },
  covered: {
    dot: 'bg-emerald-400',
    label: 'Abgedeckt',
    text: 'text-emerald-400',
  },
};

function getHeatColor(heat: number): string {
  if (heat >= 0.75) return 'bg-emerald-500';
  if (heat >= 0.5) return 'bg-blue-500';
  if (heat >= 0.25) return 'bg-amber-500';
  return 'bg-white/10';
}

function getHeatGlow(heat: number): string {
  if (heat >= 0.75) return 'shadow-emerald-500/20';
  if (heat >= 0.5) return 'shadow-blue-500/20';
  if (heat >= 0.25) return 'shadow-amber-500/20';
  return '';
}

/** Build hierarchy: parents sorted by sort_order, children grouped under parents */
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

function getGoalHint(goal: SessionGoal): string | null {
  if (goal.status === 'covered') return null;
  if (goal.status === 'not_started' && goal.heat_score < 0.1)
    return 'Noch nicht angesprochen — sollte thematisiert werden.';
  if (goal.status === 'not_started')
    return 'Kaum besprochen — mehr Aufmerksamkeit nötig.';
  if (goal.status === 'mentioned' && goal.heat_score < 0.3)
    return 'Nur kurz erwähnt — vertiefen!';
  if (goal.status === 'partially_covered' && goal.heat_score < 0.5)
    return 'Teilweise besprochen — noch Lücken.';
  if (goal.heat_score > 0.7)
    return 'Wird gerade aktiv besprochen.';
  return null;
}

function GoalMetrics({ goal, indent = false }: { goal: SessionGoal; indent?: boolean }) {
  const ml = indent ? 'ml-3' : 'ml-5';
  return (
    <div className={`${ml} space-y-2`}>
      <div>
        <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className={`h-full ${getHeatColor(goal.heat_score)} rounded-full transition-all duration-700 ease-out`}
            style={{ width: `${goal.heat_score * 100}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] text-[var(--text-tertiary)]">Wärme</span>
          <span className="text-[10px] font-mono text-[var(--text-tertiary)]">{(goal.heat_score * 100).toFixed(0)}%</span>
        </div>
      </div>
      {goal.coverage_score > 0 && (
        <div>
          <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${goal.coverage_score * 100}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[10px] text-[var(--text-tertiary)]">Abdeckung</span>
            <span className="text-[10px] font-mono text-[var(--text-tertiary)]">{(goal.coverage_score * 100).toFixed(0)}%</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function GoalsPanel({ goals }: GoalsPanelProps) {
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set());

  if (goals.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-[var(--text-tertiary)]">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-3 opacity-50">
          <path d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <p className="text-sm">Keine Gesprächsziele definiert</p>
      </div>
    );
  }

  const { parents, childrenMap } = buildGoalHierarchy(goals);

  // For summary: count only leaf goals (subgoals, or parents without children)
  const leafGoals = goals.filter(
    (g) => g.parent_id !== null || !childrenMap.has(g.id)
  );
  const coveredCount = leafGoals.filter((g) => g.status === 'covered').length;
  const avgHeat = leafGoals.reduce((sum, g) => sum + g.heat_score, 0) / leafGoals.length;

  const toggleExpanded = (id: string) => {
    setExpandedGoals((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4 scrollbar-thin">
      {/* Overall Summary */}
      <div className="glass-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">Ziele-Übersicht</h3>
          <span className="text-sm font-semibold text-[var(--text-primary)] font-mono">
            {coveredCount}/{leafGoals.length}
          </span>
        </div>
        <div className="flex gap-1">
          {parents.map((goal) => {
            const cfg = STATUS_CONFIG[goal.status];
            return (
              <div
                key={goal.id}
                className="flex-1 h-2 rounded-full overflow-hidden bg-white/[0.06]"
                title={`${goal.label}: ${cfg.label}`}
              >
                <div
                  className={`h-full ${getHeatColor(goal.heat_score)} rounded-full transition-all duration-700 ease-out`}
                  style={{ width: `${Math.max(goal.heat_score * 100, 4)}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-[10px] text-[var(--text-tertiary)]">Durchschnittliche Wärme</span>
          <span className="text-xs font-mono text-[var(--text-secondary)]">{(avgHeat * 100).toFixed(0)}%</span>
        </div>
        <p className="text-[11px] mt-2 text-[var(--text-secondary)]">
          {coveredCount === leafGoals.length
            ? 'Alle Ziele wurden abgedeckt!'
            : coveredCount === 0 && avgHeat < 0.2
              ? 'Noch kein Ziel richtig angesprochen.'
              : `Noch ${leafGoals.length - coveredCount} ${leafGoals.length - coveredCount === 1 ? 'Ziel' : 'Ziele'} offen.`
          }
        </p>
      </div>

      {/* Hierarchical Goals */}
      <div className="space-y-2">
        {parents.map((goal) => {
          const cfg = STATUS_CONFIG[goal.status];
          const children = childrenMap.get(goal.id) || [];
          const hasChildren = children.length > 0;
          const isExpanded = expandedGoals.has(goal.id);

          return (
            <div key={goal.id} className={`glass-sm transition-all ${getHeatGlow(goal.heat_score)} shadow-lg`}>
              {/* Parent goal header */}
              <div className="p-3.5">
                <div className="flex items-center gap-2.5 mb-2">
                  {/* Expand toggle for goals with subgoals */}
                  {hasChildren ? (
                    <button
                      onClick={() => toggleExpanded(goal.id)}
                      className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors flex-shrink-0"
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </button>
                  ) : (
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot} ${goal.status === 'covered' ? 'ring-2 ring-emerald-400/30' : ''}`} />
                  )}
                  <h4 className="text-sm font-medium text-[var(--text-primary)] flex-1">{goal.label}</h4>
                  {hasChildren && (
                    <span className="text-[10px] text-[var(--text-tertiary)] bg-white/[0.05] px-1.5 py-0.5 rounded">
                      {children.filter((c) => c.status === 'covered').length}/{children.length}
                    </span>
                  )}
                  <span className={`text-[10px] font-medium ${cfg.text}`}>{cfg.label}</span>
                </div>

                {goal.description && (
                  <p className="text-xs text-[var(--text-tertiary)] mb-2.5 ml-5">{goal.description}</p>
                )}

                {/* Show metrics for goals without subgoals */}
                {!hasChildren && <GoalMetrics goal={goal} />}

                {/* Show aggregated metrics for parents */}
                {hasChildren && !isExpanded && <GoalMetrics goal={goal} />}

                {/* Natural language hint */}
                {getGoalHint(goal) && (
                  <p className="text-[11px] text-amber-400/80 mt-2 ml-5">{getGoalHint(goal)}</p>
                )}

                {goal.notes && !hasChildren && (
                  <p className="text-[11px] text-[var(--text-secondary)] mt-2 ml-5 italic">{goal.notes}</p>
                )}
              </div>

              {/* Expanded subgoals */}
              {hasChildren && isExpanded && (
                <div className="border-t border-white/[0.05] px-3.5 pb-3.5 pt-2 space-y-2">
                  {children.map((sub) => {
                    const subCfg = STATUS_CONFIG[sub.status];
                    return (
                      <div key={sub.id} className="pl-3 border-l-2 border-indigo-500/20">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${subCfg.dot} ${sub.status === 'covered' ? 'ring-2 ring-emerald-400/30' : ''}`} />
                          <h5 className="text-xs font-medium text-[var(--text-primary)] flex-1">{sub.label}</h5>
                          <span className={`text-[10px] font-medium ${subCfg.text}`}>{subCfg.label}</span>
                        </div>
                        {sub.description && (
                          <p className="text-[11px] text-[var(--text-tertiary)] mb-1.5 ml-4">{sub.description}</p>
                        )}
                        <GoalMetrics goal={sub} indent />
                        {getGoalHint(sub) && (
                          <p className="text-[11px] text-amber-400/80 mt-1.5 ml-3">{getGoalHint(sub)}</p>
                        )}
                        {sub.notes && (
                          <p className="text-[11px] text-[var(--text-secondary)] mt-1.5 ml-3 italic">{sub.notes}</p>
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
