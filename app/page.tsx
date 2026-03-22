'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import CreateSessionWizard from '@/components/setup/CreateSessionWizard';

export default function LandingPage() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (code) {
      router.push(`/join/${code}`);
    }
  };

  return (
    <div className="min-h-screen bg-ambient flex items-center justify-center p-4">
      <div className="w-full max-w-lg animate-fade-in">
        {/* Logo & Title */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 mb-5 shadow-lg shadow-indigo-500/20">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Brainstorming Platform</h1>
          <p className="text-[var(--text-secondary)] mt-2 text-sm">
            KI-gestützte Moderation für bessere Brainstorming-Sessions
          </p>
        </div>

        {showCreate ? (
          <div className="animate-fade-in-scale">
            <CreateSessionWizard />
            <button
              onClick={() => setShowCreate(false)}
              className="block mx-auto mt-6 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
            >
              Zurück
            </button>
          </div>
        ) : (
          <div className="space-y-5 stagger-children">
            {/* Create Session */}
            <button
              onClick={() => setShowCreate(true)}
              className="btn-primary w-full py-4 text-base rounded-xl"
            >
              Neue Session erstellen
            </button>

            {/* Divider */}
            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-[var(--border-glass)]" />
              <span className="text-[var(--text-tertiary)] text-xs uppercase tracking-wider">oder</span>
              <div className="flex-1 h-px bg-[var(--border-glass)]" />
            </div>

            {/* Join Session */}
            <form onSubmit={handleJoin} className="glass p-5">
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-3">
                Session beitreten
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="Join-Code (z.B. BRN-447)"
                  className="input-glass flex-1 text-center font-mono text-lg tracking-widest"
                />
                <button
                  type="submit"
                  disabled={!joinCode.trim()}
                  className="btn-glass px-5 py-3 text-sm"
                >
                  Beitreten
                </button>
              </div>
            </form>

            {/* Dashboard Link */}
            <div className="text-center pt-2">
              <button
                onClick={() => router.push('/dashboard')}
                className="text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
              >
                Dashboard öffnen
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
