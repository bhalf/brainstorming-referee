'use client';

import { useState } from 'react';
import type { FeatureKey } from '@/types';

const DURATION_PRESETS = [15, 30, 45, 60, 90];

interface GoalFormData {
  label: string;
  description: string;
  expanded: boolean;
  subgoals: { label: string; description: string }[];
}

interface StepGoalsProps {
  plannedDuration: number | '';
  goals: GoalFormData[];
  autoHost: boolean;
  participantMetrics: boolean;
  selectedFeatures: FeatureKey[];
  onPlannedDurationChange: (value: number | '') => void;
  onGoalsChange: (goals: GoalFormData[]) => void;
  onAutoHostChange: (value: boolean) => void;
  onParticipantMetricsChange: (value: boolean) => void;
  onBack: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}

export default function StepGoals({
  plannedDuration,
  goals,
  autoHost,
  participantMetrics,
  selectedFeatures,
  onPlannedDurationChange,
  onGoalsChange,
  onAutoHostChange,
  onParticipantMetricsChange,
  onBack,
  onSubmit,
  isSubmitting,
}: StepGoalsProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const showGoals = selectedFeatures.includes('goals');
  const showMetricsToggle = selectedFeatures.includes('metrics');

  // --- Goal handlers ---
  const handleAddGoal = () => {
    onGoalsChange([...goals, { label: '', description: '', expanded: true, subgoals: [] }]);
  };

  const handleRemoveGoal = (index: number) => {
    onGoalsChange(goals.filter((_, i) => i !== index));
  };

  const handleGoalChange = (index: number, field: 'label' | 'description', value: string) => {
    onGoalsChange(goals.map((g, i) => (i === index ? { ...g, [field]: value } : g)));
  };

  const toggleGoalExpanded = (index: number) => {
    onGoalsChange(goals.map((g, i) => (i === index ? { ...g, expanded: !g.expanded } : g)));
  };

  const handleAddSubgoal = (goalIndex: number) => {
    onGoalsChange(
      goals.map((g, i) =>
        i === goalIndex
          ? { ...g, expanded: true, subgoals: [...g.subgoals, { label: '', description: '' }] }
          : g
      )
    );
  };

  const handleRemoveSubgoal = (goalIndex: number, subIndex: number) => {
    onGoalsChange(
      goals.map((g, i) =>
        i === goalIndex
          ? { ...g, subgoals: g.subgoals.filter((_, si) => si !== subIndex) }
          : g
      )
    );
  };

  const handleSubgoalChange = (
    goalIndex: number,
    subIndex: number,
    field: 'label' | 'description',
    value: string
  ) => {
    onGoalsChange(
      goals.map((g, i) =>
        i === goalIndex
          ? {
              ...g,
              subgoals: g.subgoals.map((s, si) =>
                si === subIndex ? { ...s, [field]: value } : s
              ),
            }
          : g
      )
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center mb-2">
        <h2 className="text-xl font-bold tracking-tight">Details</h2>
        <p className="text-sm text-[var(--text-tertiary)] mt-1">Alles optional — du kannst direkt erstellen</p>
      </div>

      {/* Planned Duration */}
      <div>
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
          Geplante Dauer
        </label>
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            {DURATION_PRESETS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => onPlannedDurationChange(plannedDuration === d ? '' : d)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  plannedDuration === d
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                    : 'bg-white/[0.03] text-[var(--text-tertiary)] border border-[var(--border-glass)] hover:bg-white/[0.06]'
                }`}
              >
                {d} min
              </button>
            ))}
          </div>
          <span className="text-[var(--text-tertiary)] text-xs">oder</span>
          <input
            type="number"
            value={plannedDuration}
            onChange={(e) => onPlannedDurationChange(e.target.value ? parseInt(e.target.value) : '')}
            placeholder="..."
            min={5}
            max={180}
            className="input-glass w-20 text-center text-sm"
          />
          <span className="text-xs text-[var(--text-tertiary)]">min</span>
        </div>
        <p className="text-xs text-[var(--text-tertiary)] mt-1.5">
          Aktiviert zeitbasierte Ziel-Erinnerungen durch den KI-Moderator
        </p>
      </div>

      {/* Goals */}
      {showGoals && (
        <div className="space-y-3 animate-fade-in">
          <label className="block text-sm font-medium text-[var(--text-secondary)]">Gesprächsziele</label>
          {goals.map((goal, gi) => (
            <div key={gi} className="rounded-xl border border-[var(--border-glass)] bg-white/[0.02] overflow-hidden">
              {/* Goal header */}
              <div className="flex items-center gap-2 p-3">
                <button
                  type="button"
                  onClick={() => toggleGoalExpanded(gi)}
                  className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors flex-shrink-0"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`transition-transform duration-200 ${goal.expanded ? 'rotate-90' : ''}`}
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
                <input
                  type="text"
                  value={goal.label}
                  onChange={(e) => handleGoalChange(gi, 'label', e.target.value)}
                  placeholder={`Ziel ${gi + 1}`}
                  className="input-glass flex-1 text-sm"
                />
                {goal.subgoals.length > 0 && (
                  <span className="text-[10px] text-[var(--text-tertiary)] bg-white/[0.05] px-1.5 py-0.5 rounded flex-shrink-0">
                    {goal.subgoals.length} Teilziel{goal.subgoals.length !== 1 ? 'e' : ''}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handleRemoveGoal(gi)}
                  className="text-[var(--text-tertiary)] hover:text-rose-400 transition-colors px-1 flex-shrink-0"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Expanded: description + subgoals */}
              {goal.expanded && (
                <div className="px-3 pb-3 space-y-2.5 animate-fade-in">
                  <div className="ml-6">
                    <textarea
                      value={goal.description}
                      onChange={(e) => handleGoalChange(gi, 'description', e.target.value)}
                      placeholder="Beschreibung (optional)"
                      className="input-glass text-xs w-full resize-none"
                      rows={2}
                    />
                  </div>

                  {/* Subgoals */}
                  <div className="ml-6 border-l-2 border-indigo-500/20 pl-3 space-y-2">
                    {goal.subgoals.map((sub, si) => (
                      <div key={si} className="space-y-1">
                        <div className="flex gap-2 items-center">
                          <input
                            type="text"
                            value={sub.label}
                            onChange={(e) => handleSubgoalChange(gi, si, 'label', e.target.value)}
                            placeholder={`Teilziel ${si + 1}`}
                            className="input-glass flex-1 text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveSubgoal(gi, si)}
                            className="text-[var(--text-tertiary)] hover:text-rose-400 transition-colors px-1 flex-shrink-0"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </div>
                        <input
                          type="text"
                          value={sub.description}
                          onChange={(e) => handleSubgoalChange(gi, si, 'description', e.target.value)}
                          placeholder="Beschreibung (optional)"
                          className="input-glass text-xs w-full opacity-60 focus:opacity-100"
                        />
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => handleAddSubgoal(gi)}
                      className="text-xs text-indigo-400/70 hover:text-indigo-300 transition-colors inline-flex items-center gap-1 pt-0.5"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      Teilziel hinzufügen
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={handleAddGoal}
            className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors inline-flex items-center gap-1"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Ziel hinzufügen
          </button>
        </div>
      )}

      {/* Advanced Settings — collapsible */}
      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
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
            className={`transition-transform duration-200 ${showAdvanced ? 'rotate-90' : ''}`}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          Erweiterte Einstellungen
        </button>

        {showAdvanced && (
          <div className="space-y-2 mt-3 animate-fade-in">
            <label className="flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all select-none border-[var(--border-glass)] bg-white/[0.02] hover:bg-white/[0.04] hover:border-[var(--border-glass-hover)]">
              <input
                type="checkbox"
                checked={!autoHost}
                onChange={(e) => onAutoHostChange(!e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded accent-indigo-500"
              />
              <div>
                <span className="text-[var(--text-primary)] text-sm font-medium">Kein Host unter Teilnehmern</span>
                <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                  Niemand erhält Host-Rechte. Teilnehmer können nur beitreten und zuhören.
                </p>
              </div>
            </label>
            {showMetricsToggle && (
              <label className="flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all select-none border-[var(--border-glass)] bg-white/[0.02] hover:bg-white/[0.04] hover:border-[var(--border-glass-hover)]">
                <input
                  type="checkbox"
                  checked={!participantMetrics}
                  onChange={(e) => onParticipantMetricsChange(!e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded accent-indigo-500"
                />
                <div>
                  <span className="text-[var(--text-primary)] text-sm font-medium">Metriken vor Teilnehmern verbergen</span>
                  <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                    Teilnehmer sehen keine Echtzeit-Metriken. Nur Hosts und Co-Hosts haben Zugriff.
                  </p>
                </div>
              </label>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="btn-glass flex-1 py-3.5 text-base"
        >
          Zurück
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting}
          className="btn-primary flex-1 py-3.5 text-base"
        >
          {isSubmitting ? (
            <span className="inline-flex items-center gap-2">
              <span className="spinner w-4 h-4 border-white/30 border-t-white" />
              Erstelle...
            </span>
          ) : 'Session erstellen'}
        </button>
      </div>
    </div>
  );
}
