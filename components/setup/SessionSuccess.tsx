'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { joinSession } from '@/lib/api-client';
import type { Session } from '@/types';

interface SessionSuccessProps {
  session: Session;
}

export default function SessionSuccess({ session }: SessionSuccessProps) {
  const router = useRouter();
  const [hostName, setHostName] = useState('');
  const [isJoiningAsHost, setIsJoiningAsHost] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const handleStartAsHost = async () => {
    if (!hostName.trim()) return;
    setIsJoiningAsHost(true);
    setJoinError(null);
    try {
      const result = await joinSession(session.join_code, hostName.trim());
      const params = new URLSearchParams({
        identity: result.participant.livekit_identity,
        name: hostName.trim(),
      });
      router.push(`/session/${session.id}?${params.toString()}`);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Beitreten fehlgeschlagen');
      setIsJoiningAsHost(false);
    }
  };

  return (
    <div className="max-w-md mx-auto text-center animate-fade-in-scale">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/10 mb-5">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold tracking-tight">Session erstellt</h2>
      <p className="text-[var(--text-secondary)] text-sm mt-2">{session.title}</p>

      <div className="glass p-6 mt-6">
        <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-3">Join-Code</p>
        <p className="text-4xl font-mono font-bold tracking-[0.2em] bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
          {session.join_code}
        </p>
        <button
          onClick={() => navigator.clipboard.writeText(session.join_code)}
          className="mt-4 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors inline-flex items-center gap-1.5"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
          Code kopieren
        </button>
      </div>

      {/* Host name input */}
      <div className="glass p-5 mt-4 text-left">
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Dein Name</label>
        <input
          type="text"
          value={hostName}
          onChange={(e) => setHostName(e.target.value)}
          placeholder="z.B. Anna"
          className="input-glass text-center text-lg"
          onKeyDown={(e) => e.key === 'Enter' && handleStartAsHost()}
          autoFocus
        />
        {joinError && (
          <p className="text-sm text-rose-400 mt-2">{joinError}</p>
        )}
      </div>

      <div className="flex gap-3 justify-center mt-6">
        <button
          onClick={() => {
            const url = `${window.location.origin}/join/${session.join_code}`;
            navigator.clipboard.writeText(url);
          }}
          className="btn-glass text-sm px-4 py-2.5"
        >
          Link kopieren
        </button>
        <button
          onClick={handleStartAsHost}
          disabled={isJoiningAsHost || !hostName.trim()}
          className="btn-primary text-sm px-5 py-2.5"
        >
          {isJoiningAsHost ? (
            <span className="inline-flex items-center gap-2">
              <span className="spinner w-4 h-4 border-white/30 border-t-white" />
              Beitreten...
            </span>
          ) : 'Session starten'}
        </button>
      </div>
    </div>
  );
}
