'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { t } from '@/lib/interview-analysis/i18n';

export default function PasswordGate({ children }: { children: ReactNode }) {
  const lang = 'de' as const;
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('ia_authenticated') === 'true') {
      setAuthenticated(true);
    }
    setChecking(false);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/interview-analysis/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();

      if (data.ok) {
        sessionStorage.setItem('ia_authenticated', 'true');
        setAuthenticated(true);
      } else {
        setError(t('pw_wrong', lang));
      }
    } catch {
      setError(t('pw_error', lang));
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="ia-spinner-lg" />
      </div>
    );
  }

  if (authenticated) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="ia-card p-8 w-full max-w-sm ia-animate-in-scale">
        {/* Logo / Icon */}
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--ia-accent-light)', color: 'var(--ia-accent)' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-semibold" style={{ color: 'var(--ia-text)' }}>
              {t('pw_title', lang)}
            </h1>
            <p className="text-xs" style={{ color: 'var(--ia-text-tertiary)' }}>
              {t('pw_subtitle', lang)}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ia-text-secondary)' }}>
              {t('pw_label', lang)}
            </label>
            <input
              type="password"
              className="ia-input"
              placeholder={t('pw_placeholder', lang)}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
          </div>
          {error && (
            <p className="text-xs font-medium" style={{ color: 'var(--ia-error)' }}>{error}</p>
          )}
          <button
            type="submit"
            className="ia-btn ia-btn-primary w-full"
            disabled={loading || !password}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="ia-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                {t('pw_checking', lang)}
              </span>
            ) : t('pw_submit', lang)}
          </button>
        </form>
      </div>
    </div>
  );
}
