'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { joinSession } from '@/lib/api-client';

export default function JoinPage() {
  const params = useParams();
  const router = useRouter();
  const code = (params.code as string).toUpperCase();

  // Detect observer suffix (-OBS)
  const isObserver = useMemo(() => code.endsWith('-OBS'), [code]);
  const displayCode = isObserver ? code.slice(0, -4) : code;

  const [displayName, setDisplayName] = useState(isObserver ? 'Observer' : '');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = displayName.trim();
    if (!name || name.length < 2) return;

    setIsJoining(true);
    setError(null);

    try {
      // Send full code including -OBS suffix — backend handles stripping
      const result = await joinSession(code, name);
      const urlParams = new URLSearchParams({
        identity: result.participant.livekit_identity,
        name: result.participant.display_name || name,
        ...(result.participant.role === 'observer' ? { role: 'observer' } : {}),
      });
      router.push(`/session/${result.session.id}?${urlParams.toString()}`);
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
              {isObserver ? (
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 100 6 3 3 0 000-6z"/>
              ) : (
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/>
              )}
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isObserver ? 'Session beobachten' : 'Session beitreten'}
          </h1>
        </div>

        {/* Observer Badge */}
        {isObserver && (
          <div className="glass-sm p-3 mb-6 border-amber-500/20 bg-amber-500/5 text-center animate-fade-in">
            <p className="text-xs font-medium text-amber-400">Observer-Modus</p>
            <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
              Du siehst alles live, bist aber unsichtbar und beeinflusst keine Metriken.
            </p>
          </div>
        )}

        {/* Join Code Display */}
        <div className="glass p-5 text-center mb-6">
          <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-2">Join-Code</p>
          <p className="text-3xl font-mono font-bold tracking-[0.2em] bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
            {displayCode}
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
              placeholder={isObserver ? 'Observer' : 'z.B. Anna'}
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
                {isObserver ? 'Verbinden...' : 'Beitreten...'}
              </span>
            ) : isObserver ? 'Als Beobachter beitreten' : 'Beitreten'}
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
