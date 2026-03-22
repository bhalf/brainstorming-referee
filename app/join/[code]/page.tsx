'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { joinSession } from '@/lib/api-client';

export default function JoinPage() {
  const params = useParams();
  const router = useRouter();
  const code = (params.code as string).toUpperCase();

  const [displayName, setDisplayName] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = displayName.trim();
    if (!name || name.length < 2) return;

    setIsJoining(true);
    setError(null);

    try {
      const result = await joinSession(code, name);
      // Pass identity and name via URL params — no sessionStorage needed
      // Use the display_name from the API (may have been deduplicated by backend)
      const params = new URLSearchParams({
        identity: result.participant.livekit_identity,
        name: result.participant.display_name || name,
      });
      router.push(`/session/${result.session.id}?${params.toString()}`);
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('404')) {
          setError('Session nicht gefunden. Bitte prüfe den Join-Code.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Beitreten fehlgeschlagen');
      }
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-ambient flex items-center justify-center p-4">
      <div className="w-full max-w-sm animate-fade-in">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 mb-4 shadow-lg shadow-indigo-500/20">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Session beitreten</h1>
        </div>

        {/* Join Code Display */}
        <div className="glass p-5 text-center mb-6">
          <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-2">Join-Code</p>
          <p className="text-3xl font-mono font-bold tracking-[0.2em] bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
            {code}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Dein Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value.slice(0, 30))}
              placeholder="z.B. Anna"
              autoFocus
              maxLength={30}
              minLength={2}
              className="input-glass text-center text-lg"
              required
            />
          </div>

          {error && (
            <div className="glass-sm p-3 border-rose-500/20 bg-rose-500/5 animate-fade-in">
              <p className="text-sm text-rose-400">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isJoining || displayName.trim().length < 2}
            className="btn-primary w-full py-3.5 text-base"
          >
            {isJoining ? (
              <span className="inline-flex items-center gap-2">
                <span className="spinner w-4 h-4 border-white/30 border-t-white" />
                Beitreten...
              </span>
            ) : 'Beitreten'}
          </button>
        </form>

        {/* Back */}
        <button
          onClick={() => router.push('/')}
          className="block mx-auto mt-6 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
        >
          Zurück zur Startseite
        </button>
      </div>
    </div>
  );
}
