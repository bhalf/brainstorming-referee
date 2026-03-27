'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { IAProject } from '@/types/interview-analysis';
import { t } from '@/lib/interview-analysis/i18n';

export default function InterviewAnalysisPage() {
  const lang = 'de' as const;
  const [projects, setProjects] = useState<IAProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const loadProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/interview-analysis/projects');
      const data = await res.json();
      if (Array.isArray(data)) setProjects(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);

    try {
      const res = await fetch('/api/interview-analysis/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), description: newDescription.trim() || undefined }),
      });
      if (res.ok) {
        setNewName('');
        setNewDescription('');
        setShowCreate(false);
        loadProjects();
      }
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t('project_delete_confirm', lang))) return;
    await fetch(`/api/interview-analysis/projects/${id}`, { method: 'DELETE' });
    loadProjects();
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-4">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--ia-accent-light)', color: 'var(--ia-accent)' }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--ia-text)' }}>
              {t('project_title', lang)}
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--ia-text-secondary)' }}>
              {t('project_subtitle', lang)}
            </p>
          </div>
        </div>
        <button
          className="ia-btn ia-btn-primary"
          onClick={() => setShowCreate(true)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          {t('project_new', lang)}
        </button>
      </div>

      {/* Create Project Dialog */}
      {showCreate && (
        <div className="ia-card p-6 mb-6 ia-animate-in">
          <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--ia-text)' }}>
            {t('project_new_dialog', lang)}
          </h2>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ia-text-secondary)' }}>
                {t('project_name', lang)}
              </label>
              <input
                className="ia-input"
                placeholder={t('project_name_placeholder', lang)}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ia-text-secondary)' }}>
                {t('project_description', lang)}
              </label>
              <textarea
                className="ia-textarea"
                placeholder={t('project_desc_placeholder', lang)}
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button type="submit" className="ia-btn ia-btn-primary" disabled={creating || !newName.trim()}>
                {creating ? t('project_creating', lang) : t('project_create', lang)}
              </button>
              <button
                type="button"
                className="ia-btn ia-btn-secondary"
                onClick={() => { setShowCreate(false); setNewName(''); setNewDescription(''); }}
              >
                {t('cancel', lang)}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Project List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="ia-spinner-lg" />
        </div>
      ) : projects.length === 0 ? (
        <div className="ia-card ia-empty">
          <svg className="ia-empty-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          <p className="text-sm font-medium" style={{ color: 'var(--ia-text-secondary)' }}>
            {t('project_empty_title', lang)}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--ia-text-tertiary)' }}>
            {t('project_empty_desc', lang)}
          </p>
        </div>
      ) : (
        <div className="space-y-3 ia-stagger">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/interview-analysis/${project.id}`}
              className="ia-card ia-card-hover p-5 flex items-center justify-between group block"
            >
              <div className="flex items-center gap-4 flex-1 min-w-0">
                {/* Project color dot */}
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: 'var(--ia-accent)' }}
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate" style={{ color: 'var(--ia-text)' }}>
                    {project.name}
                  </h3>
                  {project.description && (
                    <p className="text-xs truncate mt-0.5" style={{ color: 'var(--ia-text-secondary)' }}>
                      {project.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="ia-badge ia-badge-info">
                      {project.interview_count ?? 0} {(project.interview_count ?? 0) !== 1 ? t('interviews', lang) : t('project_interview_singular', lang)}
                    </span>
                    <span className="text-[11px]" style={{ color: 'var(--ia-text-tertiary)' }}>
                      {new Date(project.created_at).toLocaleDateString('de-CH')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  className="ia-btn ia-btn-ghost ia-btn-sm ia-btn-danger opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => { e.preventDefault(); handleDelete(project.id); }}
                >
                  {t('delete', lang)}
                </button>
                <svg
                  width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                  style={{ color: 'var(--ia-text-tertiary)' }}
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
