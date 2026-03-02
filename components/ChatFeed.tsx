'use client';

import { useEffect, useRef } from 'react';
import { Intervention } from '@/lib/types';

interface ChatFeedProps {
  interventions: Intervention[];
  maxHeight?: string;
}

export default function ChatFeed({ interventions, maxHeight = '100%' }: ChatFeedProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [interventions]);

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  const getTriggerLabel = (trigger: string): string => {
    const labels: Record<string, string> = {
      imbalance: 'Participation',
      repetition: 'Repetition',
      stagnation: 'Stagnation',
      escalation: 'Escalation',
      manual: 'Manual',
    };
    return labels[trigger] || trigger;
  };

  const getTypeColor = (type: string): string => {
    return type === 'moderator'
      ? 'border-blue-500 bg-blue-900/20'
      : 'border-purple-500 bg-purple-900/20';
  };

  if (interventions.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500 text-sm">
        <div className="text-center">
          <p className="mb-2">💬</p>
          <p>AI Moderator messages will appear here</p>
        </div>
      </div>
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
          <div className="mb-2">
            <span className="text-xs px-2 py-0.5 bg-slate-700 text-slate-400 rounded">
              {getTriggerLabel(intervention.trigger)}
            </span>
          </div>
          <p className="text-sm text-slate-200 leading-relaxed">{intervention.text}</p>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}

