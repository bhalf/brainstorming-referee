'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Intervention, InterventionIntent } from '@/types';

interface InterventionOverlayProps {
  intervention: Intervention | null;
  onDismiss: () => void;
  isTTSPlaying?: boolean;
  children: React.ReactNode;
}

/** Intent-based styling — bigpicture.md §10.3 */
const INTENT_STYLES: Record<InterventionIntent, { gradient: string; border: string; ring: string; icon: string; label: string; reason: string }> = {
  PARTICIPATION_REBALANCING: {
    gradient: 'from-blue-600/95 to-blue-800/95',
    border: 'border-blue-400/40',
    ring: 'ring-blue-500/30',
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
    label: 'Beteiligungsausgleich',
    reason: 'Ungleichmässige Beteiligung erkannt — einige Teilnehmer dominieren das Gespräch.',
  },
  PERSPECTIVE_BROADENING: {
    gradient: 'from-violet-600/95 to-purple-800/95',
    border: 'border-violet-400/40',
    ring: 'ring-violet-500/30',
    icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
    label: 'Perspektivenerweiterung',
    reason: 'Diskussion konvergiert auf wenige Themen — neue Perspektiven werden benötigt.',
  },
  REACTIVATION: {
    gradient: 'from-amber-600/95 to-orange-800/95',
    border: 'border-amber-400/40',
    ring: 'ring-amber-500/30',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
    label: 'Reaktivierung',
    reason: 'Gespräch stagniert — seit längerer Zeit keine neuen inhaltlichen Beiträge.',
  },
  ALLY_IMPULSE: {
    gradient: 'from-emerald-600/95 to-green-800/95',
    border: 'border-emerald-400/40',
    ring: 'ring-emerald-500/30',
    icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
    label: 'Ally-Impuls',
    reason: 'Moderationsimpuls durch Ally — unterstützt die Gesprächsdynamik.',
  },
  NORM_REINFORCEMENT: {
    gradient: 'from-yellow-600/95 to-amber-800/95',
    border: 'border-yellow-400/40',
    ring: 'ring-yellow-500/30',
    icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z',
    label: 'Regel-Check',
    reason: 'Brainstorming-Regel wurde verletzt.',
  },
  GOAL_REFOCUS: {
    gradient: 'from-indigo-600/95 to-blue-800/95',
    border: 'border-indigo-400/40',
    ring: 'ring-indigo-500/30',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
    label: 'Ziel-Refokus',
    reason: 'Diskussion weicht von den definierten Zielen ab.',
  },
};

const TRIGGER_LABELS: Record<string, string> = {
  state: 'Zustandsbasiert',
  rule_violation: 'Regelverstoss erkannt',
  rule_violation_soft: 'Hinweis',
  goal_refocus: 'Zielabweichung erkannt',
  goal_check: 'Zielabweichung erkannt',
  goal_negative_loop: 'Ziel-Wiederholung',
  escalation: 'Eskalation',
};

const MIN_DISMISS_MS = 12_000;

export default function InterventionOverlay({ intervention, onDismiss, isTTSPlaying = false, children }: InterventionOverlayProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dismissFeedback, setDismissFeedback] = useState(false);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevInterventionId = useRef<string | null>(null);

  const hasText = !!intervention?.text?.trim();

  // Dynamic dismiss duration based on text length and audio duration.
  // After TTS finishes, keep overlay visible long enough to re-read the text.
  const dismissMs = useMemo(() => {
    if (!intervention?.text?.trim()) return MIN_DISMISS_MS;
    const wordCount = intervention.text.trim().split(/\s+/).length;
    const readingMs = wordCount * 400; // ~150 wpm comfortable reading speed
    const audioMs = intervention.audio_duration_ms ?? 0;
    // After audio ends, keep overlay for at least 5s + half the reading time
    // so users can re-read and absorb the message
    const postAudioBuffer = Math.max(5_000, readingMs * 0.5);
    return Math.max(audioMs + postAudioBuffer, readingMs, MIN_DISMISS_MS);
  }, [intervention?.text, intervention?.audio_duration_ms]);

  // Track when intervention is dismissed to show feedback
  useEffect(() => {
    if (intervention) {
      prevInterventionId.current = intervention.id;
    } else if (prevInterventionId.current) {
      // Intervention just disappeared — show brief feedback
      setDismissFeedback(true);
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = setTimeout(() => setDismissFeedback(false), 2000);
      prevInterventionId.current = null;
    }
  }, [intervention]);

  useEffect(() => {
    return () => { if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current); };
  }, []);

  useEffect(() => {
    if (!intervention) return;

    // Clear any existing timer
    if (timerRef.current) clearTimeout(timerRef.current);

    // Don't start dismiss timer while TTS is playing or while waiting for text
    if (isTTSPlaying || !hasText) return;

    // Start dismiss timer (resets when text arrives via UPDATE)
    timerRef.current = setTimeout(onDismiss, dismissMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [intervention, onDismiss, isTTSPlaying, hasText, dismissMs]);

  const style = intervention ? INTENT_STYLES[intervention.intent] : null;

  return (
    <div className="relative h-full">
      {/* Subtle glow border when intervention is active */}
      <div className={`h-full transition-all duration-500 ${
        intervention && style ? `ring-1 ${style.ring}` : ''
      }`}>
        {children}
      </div>

      {/* Dismiss confirmation toast */}
      {dismissFeedback && !intervention && (
        <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/90 text-white text-xs font-medium shadow-lg animate-fade-in">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Eingriff zugestellt
        </div>
      )}

      {/* Toast overlay */}
      {intervention && style && (
        <div
          className={`absolute top-3 left-3 right-3 bg-gradient-to-br ${style.gradient} ${style.border} border rounded-2xl p-5 shadow-2xl shadow-black/50 cursor-pointer z-10 intervention-toast-enter`}
          onClick={onDismiss}
        >
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0 mt-0.5">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={style.icon} />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-white/80">
                  {style.label}
                </span>
                <span className="text-[10px] text-white/50 px-1.5 py-0.5 rounded-md bg-white/10">
                  {TRIGGER_LABELS[intervention.trigger] || intervention.trigger}
                </span>
              </div>
              <p className="text-white/70 text-xs leading-relaxed mb-2">{style.reason}</p>
              {intervention.text?.trim() ? (
                <p className="text-white text-base leading-relaxed font-medium">{intervention.text}</p>
              ) : (
                <p className="text-white/50 text-sm leading-relaxed italic flex items-center gap-2">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-white/40 animate-pulse" />
                  Generiert Antwort...
                </p>
              )}
              <div className="flex items-center gap-2 mt-2.5">
                <p className="text-[10px] text-white/40 font-mono">
                  {intervention.created_at && !isNaN(new Date(intervention.created_at).getTime())
                    ? new Date(intervention.created_at).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })
                    : 'Jetzt'}
                </p>
                {isTTSPlaying && (
                  <span className="text-[10px] text-white/60 flex items-center gap-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-white/60 animate-pulse" />
                    Spricht...
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Progress bar for auto-dismiss (paused during TTS or while waiting for text) */}
          <div className="mt-3 h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-white/40 rounded-full"
              style={{
                animation: (isTTSPlaying || !hasText) ? 'none' : `shrink ${dismissMs}ms linear forwards`,
              }}
            />
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}
