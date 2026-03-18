'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createWorkspace } from '@/lib/api-client';

export default function WorkspaceLandingPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const workspace = await createWorkspace({
        name: name.trim(),
        slug: slug.trim() || undefined,
      });
      router.push(`/workspace/${workspace.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Workspace konnte nicht erstellt werden');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-ambient flex items-center justify-center">
      <div className="max-w-md w-full mx-4 animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-500/10 mb-5">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Workspace erstellen</h1>
          <p className="text-[var(--text-tertiary)] text-sm mt-2">
            Organisieren Sie Ihre Brainstorming-Sessions im Team.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="glass p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              Workspace-Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Innovation Lab"
              className="input-glass"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              URL-Slug <span className="text-[var(--text-tertiary)] font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              placeholder="innovation-lab"
              className="input-glass font-mono text-sm"
            />
            <p className="text-xs text-[var(--text-tertiary)] mt-1.5">
              Wird automatisch generiert wenn leer gelassen.
            </p>
          </div>

          {error && (
            <div className="glass-sm p-3 border-rose-500/20 bg-rose-500/5">
              <p className="text-sm text-rose-400">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !name.trim()}
            className="btn-primary w-full py-3 text-sm"
          >
            {isSubmitting ? (
              <span className="inline-flex items-center gap-2">
                <span className="spinner w-4 h-4 border-white/30 border-t-white" />
                Erstelle...
              </span>
            ) : 'Workspace erstellen'}
          </button>
        </form>

        <div className="text-center mt-6">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
          >
            Zurück zum Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
