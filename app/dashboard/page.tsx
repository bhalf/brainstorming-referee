'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getSessions } from '@/lib/api-client';
import type { Session } from '@/types';

type StatusGroup = 'active' | 'scheduled' | 'ended';

const GROUP_ORDER: StatusGroup[] = ['active', 'scheduled', 'ended'];

const GROUP_CONFIG: Record<StatusGroup, { title: string; emptyLabel: string }> = {
  active: { title: 'Aktive Sessions', emptyLabel: 'Keine aktiven Sessions' },
  scheduled: { title: 'Geplante Sessions', emptyLabel: 'Keine geplanten Sessions' },
  ended: { title: 'Beendete Sessions', emptyLabel: 'Keine beendeten Sessions' },
};

const STATUS_CONFIG: Record<string, { dot: string; label: string; badge: string }> = {
  scheduled: {
    dot: 'bg-amber-400 shadow-amber-400/40',
    label: 'Geplant',
    badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  },
  active: {
    dot: 'bg-emerald-400 shadow-emerald-400/40',
    label: 'Aktiv',
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  },
  idle: {
    dot: 'bg-amber-400',
    label: 'Pausiert',
    badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  },
  paused: {
    dot: 'bg-indigo-400',
    label: 'Pausiert (Host)',
    badge: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  },
  ended: {
    dot: 'bg-white/20',
    label: 'Beendet',
    badge: 'bg-white/5 text-white/40 border-white/10',
  },
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback: ignore
    }
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 font-mono text-xs bg-white/[0.06] hover:bg-white/[0.1] text-[var(--text-secondary)] px-2.5 py-1.5 rounded-lg transition-all border border-transparent hover:border-[var(--border-glass)]"
      title="Join-Code kopieren"
    >
      {text}
      {copied ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
          <path d="M20 6L9 17l-5-5"/>
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-tertiary)]">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
        </svg>
      )}
    </button>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSessions()
      .then(setSessions)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // Group sessions by status (idle/paused groups with active)
  const grouped = sessions.reduce<Record<StatusGroup, Session[]>>(
    (acc, s) => {
      const group: StatusGroup =
        s.status === 'active' || s.status === 'idle' || s.status === 'paused' ? 'active'
        : s.status === 'scheduled' ? 'scheduled'
        : 'ended';
      acc[group].push(s);
      return acc;
    },
    { active: [], scheduled: [], ended: [] },
  );

  const handleSessionClick = (session: Session) => {
    if (session.status === 'active' || session.status === 'idle' || session.status === 'paused') {
      router.push(`/session/${session.id}`);
    } else if (session.status === 'ended') {
      router.push(`/review/${session.id}`);
    }
  };

  return (
    <div className="min-h-screen bg-ambient">
      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 animate-fade-in">
          <div>
            <button
              onClick={() => router.push('/')}
              className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] text-sm mb-2 transition-colors inline-flex items-center gap-1"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              Startseite
            </button>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-[var(--text-tertiary)] text-sm mt-1">Deine Brainstorming-Sessions</p>
          </div>
          <button
            onClick={() => router.push('/')}
            className="btn-primary text-sm px-5 py-2.5"
          >
            Neue Session
          </button>
        </div>

        {/* Workspace Banner */}
        <div className="glass-sm p-4 mb-6 flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400 shrink-0">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
            </svg>
            <p className="text-sm text-[var(--text-secondary)]">
              Arbeiten Sie im Team? Erstellen Sie einen Workspace für gemeinsame Sessions und Mitgliederverwaltung.
            </p>
          </div>
          <button
            onClick={() => router.push('/workspace')}
            className="btn-glass text-xs px-4 py-2 shrink-0 ml-4"
          >
            Workspace erstellen
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-20">
            <div className="spinner" />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="glass-sm p-4 border-rose-500/20 bg-rose-500/5 animate-fade-in">
            <p className="text-rose-400 text-sm">{error}</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && sessions.length === 0 && (
          <div className="text-center py-20 animate-fade-in">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/5 mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-tertiary)]">
                <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M12 8v8M8 12h8" />
              </svg>
            </div>
            <p className="text-[var(--text-secondary)] text-base">Noch keine Sessions</p>
            <p className="text-[var(--text-tertiary)] text-sm mt-1">Erstelle deine erste Session, um loszulegen.</p>
          </div>
        )}

        {/* Grouped Session List */}
        {!loading && sessions.length > 0 && (
          <div className="space-y-8 animate-fade-in">
            {GROUP_ORDER.map((group) => {
              const items = grouped[group];
              if (items.length === 0) return null;

              const config = GROUP_CONFIG[group];

              return (
                <section key={group}>
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-3 px-1">
                    {config.title}
                    <span className="ml-2 text-[var(--text-tertiary)]/60">{items.length}</span>
                  </h2>
                  <div className="space-y-2">
                    {items.map((session) => {
                      const status = STATUS_CONFIG[session.status] || STATUS_CONFIG.ended;
                      const isActive = session.status === 'active';
                      const isIdle = session.status === 'idle';
                      const isPaused = session.status === 'paused';
                      const isEnded = session.status === 'ended';
                      const isClickable = isActive || isIdle || isPaused || isEnded;

                      return (
                        <div
                          key={session.id}
                          role={isClickable ? 'button' : undefined}
                          tabIndex={isClickable ? 0 : undefined}
                          onClick={() => isClickable && handleSessionClick(session)}
                          onKeyDown={(e) => isClickable && e.key === 'Enter' && handleSessionClick(session)}
                          className={`w-full text-left p-4 glass-sm transition-all duration-200 ${
                            isClickable
                              ? 'glass-hover cursor-pointer'
                              : 'cursor-default'
                          } ${isEnded ? 'opacity-70' : ''}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2.5">
                                <h3 className="font-medium text-[var(--text-primary)] truncate">{session.title}</h3>
                                {isActive && (
                                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
                                  </span>
                                )}
                                {isIdle && (
                                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-1.5">
                                <span className="text-xs text-[var(--text-tertiary)]">
                                  {new Date(session.created_at).toLocaleDateString('de-CH', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                                <span className="text-xs text-[var(--text-tertiary)]">{session.language}</span>
                                {session.moderation_level !== 'none' && (
                                  <span className="text-xs text-[var(--text-tertiary)]">
                                    {session.moderation_level === 'moderation_ally' ? 'Moderation + Impuls' : 'Moderation'}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0 ml-4">
                              {session.status !== 'ended' && (
                                <CopyButton text={session.join_code} />
                              )}
                              {isEnded && (
                                <span className="text-xs text-indigo-400 font-medium">Review</span>
                              )}
                              <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${status.badge}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                                {status.label}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
