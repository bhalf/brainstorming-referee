'use client';

import { useEffect, useRef } from 'react';
import { Intervention } from '@/lib/types';
import { formatTime } from '@/lib/utils/format';
import EmptyState from './shared/EmptyState';

interface ChatFeedProps {
  interventions: Intervention[];
  maxHeight?: string;
}

export default function ChatFeed({ interventions, maxHeight = '100%' }: ChatFeedProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [interventions]);

  const getTriggerLabel = (intervention: Intervention): string => {
    // Prefer v2 intent labels over legacy trigger labels
    if (intervention.intent) {
      const intentLabels: Record<string, string> = {
        PARTICIPATION_REBALANCING: 'Rebalancing',
        PERSPECTIVE_BROADENING: 'Broadening',
        REACTIVATION: 'Reactivation',
        ALLY_IMPULSE: 'Ally Impulse',
        NORM_REINFORCEMENT: 'Rule Reminder',
      };
      return intentLabels[intervention.intent] || intervention.intent;
    }
    const labels: Record<string, string> = {
      imbalance: 'Participation',
      repetition: 'Repetition',
      stagnation: 'Stagnation',
      escalation: 'Escalation',
      manual: 'Manual',
      rule_violation: 'Rule Violation',
    };
    return labels[intervention.trigger] || intervention.trigger;
  };

  const getRecoveryBadge = (result?: string) => {
    if (!result || result === 'pending') return null;
    const styles: Record<string, string> = {
      recovered: 'bg-green-900/50 text-green-400',
      partial: 'bg-yellow-900/50 text-yellow-400',
      not_recovered: 'bg-red-900/50 text-red-400',
    };
    const labels: Record<string, string> = {
      recovered: 'Recovered',
      partial: 'Partial',
      not_recovered: 'Not recovered',
    };
    return (
      <span className={`text-xs px-1.5 py-0.5 rounded ${styles[result] || ''}`}>
        {labels[result] || result}
      </span>
    );
  };

  const getTypeColor = (type: string): string => {
    return type === 'moderator'
      ? 'border-blue-500 bg-blue-900/20'
      : 'border-purple-500 bg-purple-900/20';
  };

  if (interventions.length === 0) {
    return (
      <EmptyState
        icon="💬"
        title="AI Moderator messages will appear here"
      />
    );
  }

  return (
    <div className="h-full overflow-y-auto pr-2 space-y-3" style={{ maxHeight }}>
      {interventions.map((intervention) => (
        <div
          key={intervention.id}
          className={`rounded-lg p-3 border-l-4 ${getTypeColor(intervention.type)}`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-300">
                {intervention.type === 'moderator' ? '🤖 Moderator (Process)' : '💡 Ally (Impulse)'}
              </span>
              {intervention.spoken && (
                <span className="text-xs px-1.5 py-0.5 bg-green-900/50 text-green-400 rounded">
                  🔊
                </span>
              )}
            </div>
            <span className="text-xs text-slate-500">{formatTime(intervention.timestamp)}</span>
          </div>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs px-2 py-0.5 bg-slate-700 text-slate-400 rounded">
              {getTriggerLabel(intervention)}
            </span>
            {getRecoveryBadge(intervention.recoveryResult)}
          </div>
          <p className="text-sm text-slate-200 leading-relaxed">{intervention.text}</p>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}

