'use client';

import { useState } from 'react';
import { ConversationGoal } from '@/lib/types';

interface GoalInputProps {
  goals: ConversationGoal[];
  onChange: (goals: ConversationGoal[]) => void;
  goalRefocusEnabled: boolean;
  onGoalRefocusChange: (enabled: boolean) => void;
  goalsVisibleToAll: boolean;
  onGoalsVisibleChange: (visible: boolean) => void;
}

/** Parse text lines into ConversationGoal[]. Format: "Label" or "Label | Description". */
function parseGoals(text: string): ConversationGoal[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const pipeIndex = line.indexOf('|');
      const label = pipeIndex >= 0 ? line.slice(0, pipeIndex).trim() : line;
      const description = pipeIndex >= 0 ? line.slice(pipeIndex + 1).trim() : undefined;
      return {
        id: crypto.randomUUID(),
        label,
        ...(description ? { description } : {}),
      };
    });
}

/** Convert ConversationGoal[] back to editable text. */
function goalsToText(goals: ConversationGoal[]): string {
  return goals
    .map((g) => (g.description ? `${g.label} | ${g.description}` : g.label))
    .join('\n');
}

export default function GoalInput({
  goals,
  onChange,
  goalRefocusEnabled,
  onGoalRefocusChange,
  goalsVisibleToAll,
  onGoalsVisibleChange,
}: GoalInputProps) {
  const [isOpen, setIsOpen] = useState(goals.length > 0);
  const [text, setText] = useState(goalsToText(goals));

  const handleTextChange = (value: string) => {
    setText(value);
    onChange(parseGoals(value));
  };

  return (
    <section className="mb-5">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full text-left group"
      >
        <div>
          <span className="block text-xs font-medium text-slate-400 uppercase tracking-wide">
            Conversation Goals
            <span className="ml-1.5 text-slate-600 normal-case tracking-normal">(optional)</span>
          </span>
          <span className="block text-xs text-slate-500 mt-0.5">
            Define topics to track during the session
          </span>
        </div>
        <span className="text-slate-500 group-hover:text-slate-300 transition-colors text-sm">
          {isOpen ? '−' : '+'}
        </span>
      </button>

      {isOpen && (
        <div className="mt-3 space-y-3">
          <textarea
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder={"Topic 1\nTopic 2 | Optional description\nTopic 3"}
            rows={4}
            className="w-full px-3 py-2.5 text-sm bg-slate-900/60 border border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-colors placeholder:text-slate-600 resize-none"
          />
          {goals.length > 0 && (
            <p className="text-xs text-slate-500">
              {goals.length} goal{goals.length !== 1 ? 's' : ''} defined
            </p>
          )}

          {/* Goal Refocus Toggle */}
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="block text-xs font-medium text-slate-400">
                Active Refocusing
              </span>
              <span className="block text-xs text-slate-500 mt-0.5">
                Trigger spoken interventions when conversation drifts from goals
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={goalRefocusEnabled}
              onClick={() => onGoalRefocusChange(!goalRefocusEnabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${
                goalRefocusEnabled ? 'bg-blue-600' : 'bg-slate-600'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 ${
                  goalRefocusEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </label>

          {/* Visibility Toggle */}
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="block text-xs font-medium text-slate-400">
                Visible to All Participants
              </span>
              <span className="block text-xs text-slate-500 mt-0.5">
                Show goal progress panel to everyone (default: host only)
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={goalsVisibleToAll}
              onClick={() => onGoalsVisibleChange(!goalsVisibleToAll)}
              className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${
                goalsVisibleToAll ? 'bg-blue-600' : 'bg-slate-600'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 ${
                  goalsVisibleToAll ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </label>
        </div>
      )}
    </section>
  );
}
