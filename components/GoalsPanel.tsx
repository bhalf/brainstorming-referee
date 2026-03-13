'use client';

import type { GoalTrackingState, GoalCoverageStatus } from '@/lib/types';
import Panel from './shared/Panel';

interface GoalsPanelProps {
    goalTracking: GoalTrackingState;
}

const STATUS_CONFIG: Record<GoalCoverageStatus, { dot: string; bg: string; label: string }> = {
    not_started: { dot: 'bg-slate-500', bg: 'bg-slate-800/40', label: 'Not started' },
    mentioned: { dot: 'bg-yellow-500', bg: 'bg-yellow-900/20', label: 'Mentioned' },
    partially_covered: { dot: 'bg-blue-500', bg: 'bg-blue-900/20', label: 'Partial' },
    covered: { dot: 'bg-green-500', bg: 'bg-green-900/20', label: 'Covered' },
};

function ProgressBar({ progress }: { progress: number }) {
    const pct = Math.round(progress * 100);
    return (
        <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                />
            </div>
            <span className="text-xs text-slate-400 tabular-nums w-8 text-right">{pct}%</span>
        </div>
    );
}

export default function GoalsPanel({ goalTracking }: GoalsPanelProps) {
    const { goals, assessments, overallProgress, suggestedTopics, isAssessing } = goalTracking;

    if (goals.length === 0) return null;

    // Check if all goals have low heat for dashboard nudge
    const allLowHeat = assessments.every((a) => a.heatScore < 0.3);
    const hasOpenGoals = assessments.some(
        (a) => a.status === 'not_started' || a.status === 'mentioned'
    );

    return (
        <Panel className="!p-3">
            <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
                    Goals
                </h4>
                {isAssessing && (
                    <div className="w-3 h-3 border border-blue-500 border-t-transparent rounded-full animate-spin" />
                )}
            </div>

            <ProgressBar progress={overallProgress} />

            {/* Low heat nudge */}
            {allLowHeat && hasOpenGoals && (
                <div className="mb-2 px-2 py-1.5 bg-yellow-900/20 border border-yellow-800/30 rounded text-xs text-yellow-400">
                    Discussion topics are not being addressed
                </div>
            )}

            {/* Goal list */}
            <div className="space-y-1.5">
                {goals.map((goal) => {
                    const assessment = assessments.find((a) => a.goalId === goal.id);
                    const status = assessment?.status ?? 'not_started';
                    const config = STATUS_CONFIG[status];
                    const heat = assessment?.heatScore ?? 0;

                    return (
                        <div
                            key={goal.id}
                            className={`flex items-center gap-2 px-2 py-1.5 rounded ${config.bg}`}
                        >
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${config.dot}`} />
                            <div className="flex-1 min-w-0">
                                <span className="text-xs text-slate-200 truncate block">
                                    {goal.label}
                                </span>
                                {assessment?.notes && (
                                    <span className="text-[10px] text-slate-500 truncate block">
                                        {assessment.notes}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                {/* Mini heat indicator */}
                                <div className="w-8 h-1 bg-slate-700 rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-300"
                                        style={{
                                            width: `${Math.round(heat * 100)}%`,
                                            backgroundColor: heat > 0.5 ? '#22c55e' : heat > 0.3 ? '#eab308' : '#64748b',
                                        }}
                                    />
                                </div>
                                <span className="text-[10px] text-slate-500 w-10 text-right">
                                    {config.label}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Suggested topics */}
            {suggestedTopics.length > 0 && hasOpenGoals && (
                <div className="mt-2 pt-2 border-t border-slate-700/50">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">
                        Suggested next
                    </p>
                    {suggestedTopics.map((topic, i) => (
                        <p key={i} className="text-xs text-slate-400">
                            {topic}
                        </p>
                    ))}
                </div>
            )}
        </Panel>
    );
}
