'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { acceptInvite } from '@/lib/api-client';
import type { WorkspaceMember } from '@/types';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Mitglied',
};

function JoinWorkspaceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState<WorkspaceMember | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Kein Einladungs-Token gefunden.');
      setLoading(false);
      return;
    }

    acceptInvite(token)
      .then(setMember)
      .catch((err) => {
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('expired') || msg.includes('abgelaufen')) {
          setError('Diese Einladung ist nicht mehr gültig. Bitten Sie den Admin um eine neue.');
        } else if (msg.includes('already') || msg.includes('bereits')) {
          setError('Diese Einladung wurde bereits verwendet.');
        } else {
          setError('Ungültige Einladung.');
        }
      })
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-ambient flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="spinner mx-auto mb-4" />
          <p className="text-[var(--text-tertiary)] text-sm">Einladung wird verarbeitet...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-ambient flex items-center justify-center">
        <div className="text-center max-w-sm mx-4 animate-fade-in">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-rose-500/10 mb-5">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-rose-400">
              <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <h2 className="text-lg font-bold mb-2">Einladung fehlgeschlagen</h2>
          <p className="text-sm text-[var(--text-tertiary)] mb-6">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="btn-glass text-sm px-5 py-2.5"
          >
            Zur Startseite
          </button>
        </div>
      </div>
    );
  }

  if (member) {
    return (
      <div className="min-h-screen bg-ambient flex items-center justify-center">
        <div className="text-center max-w-sm mx-4 animate-fade-in-scale">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/10 mb-5">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold tracking-tight mb-2">Willkommen!</h2>
          <p className="text-[var(--text-secondary)] text-sm">
            Sie sind jetzt {ROLE_LABELS[member.role] ?? member.role} im Workspace.
          </p>

          <button
            onClick={() => router.push(`/workspace/${member.workspace_id}`)}
            className="btn-primary text-sm px-6 py-2.5 mt-8"
          >
            Zum Workspace
          </button>
        </div>
      </div>
    );
  }

  return null;
}

export default function JoinWorkspacePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-ambient flex items-center justify-center">
        <div className="spinner" />
      </div>
    }>
      <JoinWorkspaceContent />
    </Suspense>
  );
}
