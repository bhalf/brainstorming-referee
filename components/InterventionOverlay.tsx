'use client';

import { ReactNode, useEffect, useRef, useState, useCallback } from 'react';
import type { Intervention, InterventionDisplayMode } from '@/lib/types';

// --- Intent label mapping (matches DashboardTab) ---

const INTENT_LABELS: Record<string, string> = {
  PARTICIPATION_REBALANCING: 'Rebalancing',
  PERSPECTIVE_BROADENING: 'Broadening',
  REACTIVATION: 'Reactivation',
  ALLY_IMPULSE: 'Ally Impulse',
  NORM_REINFORCEMENT: 'Rule Reminder',
};

function getIntentLabel(intervention: Intervention): string {
  if (intervention.intent) return INTENT_LABELS[intervention.intent] || intervention.intent;
  if (intervention.trigger === 'rule_violation') return 'Rule Reminder';
  return intervention.type === 'ally' ? 'Ally' : 'Moderator';
}

// --- Border color by intervention type ---

function getBorderColor(intervention: Intervention): string {
  if (intervention.trigger === 'rule_violation') return 'border-red-500 shadow-red-500/30';
  if (intervention.type === 'ally') return 'border-purple-500 shadow-purple-500/30';
  return 'border-amber-500 shadow-amber-500/30';
}

function getToastAccent(intervention: Intervention): string {
  if (intervention.trigger === 'rule_violation') return 'border-l-red-500 bg-red-950/80';
  if (intervention.type === 'ally') return 'border-l-purple-500 bg-purple-950/80';
  return 'border-l-amber-500 bg-amber-950/80';
}

// --- Toast auto-dismiss duration ---
const TOAST_DURATION_MS = 10_000;
const BORDER_DURATION_MS = 10_000;

export interface InterventionInteractionEvent {
  interventionId: string;
  action: 'displayed' | 'dismissed_click' | 'dismissed_timeout';
  displayDurationMs?: number;
}

interface InterventionOverlayProps {
  children: ReactNode;
  interventions: Intervention[];
  displayMode: InterventionDisplayMode;
  onInteractionEvent?: (event: InterventionInteractionEvent) => void;
}

interface ActiveToast {
  intervention: Intervention;
  exiting: boolean;
}

export default function InterventionOverlay({
  children,
  interventions,
  displayMode,
  onInteractionEvent,
}: InterventionOverlayProps) {
  const lastSeenIdRef = useRef<string | null>(null);
  const [activeToast, setActiveToast] = useState<ActiveToast | null>(null);
  const [borderIntervention, setBorderIntervention] = useState<Intervention | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const borderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const displayStartTimeRef = useRef<number>(0);

  // Stable ref for callback — prevents useEffect re-runs when prop reference changes
  const onInteractionEventRef = useRef(onInteractionEvent);
  onInteractionEventRef.current = onInteractionEvent;

  const showVisual = displayMode === 'visual' || displayMode === 'both';

  // Dismiss toast with exit animation (stable — no deps that change)
  const dismissToast = useCallback((reason: 'dismissed_click' | 'dismissed_timeout') => {
    if (dismissTimerRef.current) { clearTimeout(dismissTimerRef.current); dismissTimerRef.current = null; }
    setActiveToast(prev => {
      if (!prev) return null;
      const durationMs = Date.now() - displayStartTimeRef.current;
      onInteractionEventRef.current?.({
        interventionId: prev.intervention.id,
        action: reason,
        displayDurationMs: durationMs,
      });
      return { ...prev, exiting: true };
    });
    setTimeout(() => setActiveToast(null), 300); // match animation duration
  }, []);

  // Watch for new interventions — only re-runs when interventions array or displayMode changes
  useEffect(() => {
    if (!showVisual || interventions.length === 0) return;

    const latest = interventions[interventions.length - 1];
    if (latest.id === lastSeenIdRef.current) return;
    lastSeenIdRef.current = latest.id;

    // Clear existing timers
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    if (borderTimerRef.current) clearTimeout(borderTimerRef.current);

    // Show toast
    displayStartTimeRef.current = Date.now();
    setActiveToast({ intervention: latest, exiting: false });
    onInteractionEventRef.current?.({ interventionId: latest.id, action: 'displayed' });
    dismissTimerRef.current = setTimeout(() => {
      dismissToast('dismissed_timeout');
    }, TOAST_DURATION_MS);

    // Show border
    setBorderIntervention(latest);
    borderTimerRef.current = setTimeout(() => {
      setBorderIntervention(null);
    }, BORDER_DURATION_MS);

    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      if (borderTimerRef.current) clearTimeout(borderTimerRef.current);
    };
  }, [interventions, showVisual, dismissToast]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      if (borderTimerRef.current) clearTimeout(borderTimerRef.current);
    };
  }, []);

  const borderClasses = borderIntervention
    ? `border-3 ${getBorderColor(borderIntervention)} intervention-border-pulse shadow-lg`
    : 'border-3 border-transparent';

  return (
    <div className={`relative w-full h-full rounded-lg transition-colors duration-300 ${borderClasses}`}>
      {children}

      {/* Toast Banner */}
      {activeToast && (
        <div
          className={`absolute top-2 left-2 right-2 z-50 ${
            activeToast.exiting ? 'intervention-toast-exit' : 'intervention-toast-enter'
          }`}
        >
          <button
            onClick={() => dismissToast('dismissed_click')}
            className={`w-full text-left rounded-lg border-l-4 backdrop-blur-md px-4 py-3 shadow-xl cursor-pointer hover:brightness-110 transition-all ${getToastAccent(activeToast.intervention)}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-white/90">
                {activeToast.intervention.type === 'ally' ? 'Ally' : 'AI Moderator'}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/70">
                {getIntentLabel(activeToast.intervention)}
              </span>
            </div>
            <p className="text-sm text-white/90 leading-relaxed">
              {activeToast.intervention.text}
            </p>
          </button>
        </div>
      )}
    </div>
  );
}
