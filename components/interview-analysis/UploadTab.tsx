'use client';

import { useState } from 'react';
import type { IAInterview } from '@/types/interview-analysis';
import AudioUploader from './AudioUploader';
import TranscriptUploader from './TranscriptUploader';
import { useIALang, t } from '@/lib/interview-analysis/i18n';

interface UploadTabProps {
  projectId: string;
  interviews: IAInterview[];
  onRefresh: () => void;
}

const STATUS_KEYS: Record<string, { key: string; className: string }> = {
  pending: { key: 'status_pending', className: 'ia-badge-neutral' },
  transcribing: { key: 'status_transcribing', className: 'ia-badge-ambivalent' },
  transcribed: { key: 'status_transcribed', className: 'ia-badge-positive' },
  analyzed: { key: 'status_analyzed', className: 'ia-badge-info' },
};

export default function UploadTab({ projectId, interviews, onRefresh }: UploadTabProps) {
  const lang = useIALang();
  const [showAdd, setShowAdd] = useState(false);
  const [uploadMode, setUploadMode] = useState<'audio' | 'text'>('audio');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  async function handleDelete(id: string) {
    if (!confirm(t('upload_delete_confirm', lang))) return;
    await fetch(`/api/interview-analysis/projects/${projectId}/interviews/${id}`, { method: 'DELETE' });
    onRefresh();
  }

  function startEdit(interview: IAInterview) {
    setEditingId(interview.id);
    setEditText(interview.transcript_text || '');
  }

  async function saveEdit(id: string) {
    await fetch(`/api/interview-analysis/projects/${projectId}/interviews/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript_text: editText }),
    });
    setEditingId(null);
    onRefresh();
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold" style={{ color: 'var(--ia-text)' }}>
            {t('interviews', lang)}
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--ia-text-tertiary)' }}>
            {interviews.length} Interview{interviews.length !== 1 ? 's' : ''} {t('upload_uploaded', lang)}
          </p>
        </div>
        <button className="ia-btn ia-btn-primary ia-btn-sm" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? (
            t('close', lang)
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              {t('upload_add', lang)}
            </>
          )}
        </button>
      </div>

      {/* Add Interview Panel */}
      {showAdd && (
        <div className="ia-card p-5 ia-animate-in space-y-4">
          {/* Mode Toggle */}
          <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--ia-bg-muted)' }}>
            {(['audio', 'text'] as const).map(mode => (
              <button
                key={mode}
                className="ia-btn flex-1 text-xs py-2 rounded-md transition-all"
                style={{
                  background: uploadMode === mode ? 'var(--ia-bg-card)' : 'transparent',
                  color: uploadMode === mode ? 'var(--ia-text)' : 'var(--ia-text-secondary)',
                  boxShadow: uploadMode === mode ? 'var(--ia-shadow-xs)' : 'none',
                  fontWeight: uploadMode === mode ? 600 : 500,
                }}
                onClick={() => setUploadMode(mode)}
              >
                {mode === 'audio' ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                    </svg>
                    {t('upload_audio', lang)}
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    {t('upload_transcript', lang)}
                  </>
                )}
              </button>
            ))}
          </div>

          {uploadMode === 'audio' ? (
            <AudioUploader projectId={projectId} onComplete={() => { setShowAdd(false); onRefresh(); }} />
          ) : (
            <TranscriptUploader projectId={projectId} onComplete={() => { setShowAdd(false); onRefresh(); }} />
          )}
        </div>
      )}

      {/* Interview List */}
      {interviews.length === 0 ? (
        <div className="ia-card ia-empty">
          <svg className="ia-empty-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
          </svg>
          <p className="text-sm font-medium" style={{ color: 'var(--ia-text-secondary)' }}>
            {t('upload_empty_title', lang)}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--ia-text-tertiary)' }}>
            {t('upload_empty_desc', lang)}
          </p>
        </div>
      ) : (
        <div className="space-y-2 ia-stagger">
          {interviews.map((interview) => {
            const status = STATUS_KEYS[interview.status] || STATUS_KEYS.pending;
            const isEditing = editingId === interview.id;

            return (
              <div key={interview.id} className="ia-card-sm p-4 group" style={{ position: 'relative' }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Source icon */}
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: 'var(--ia-bg-muted)', color: 'var(--ia-text-tertiary)' }}
                    >
                      {interview.source_type === 'audio' ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-medium text-sm truncate" style={{ color: 'var(--ia-text)' }}>
                        {interview.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`ia-badge ${status.className}`}>{t(status.key, lang)}</span>
                        {interview.word_count && (
                          <span className="text-[11px] ia-data" style={{ color: 'var(--ia-text-tertiary)' }}>
                            {interview.word_count.toLocaleString()} {t('words', lang)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {interview.transcript_text && (
                      <button
                        className="ia-btn ia-btn-ghost ia-btn-sm"
                        onClick={() => isEditing ? saveEdit(interview.id) : startEdit(interview)}
                      >
                        {isEditing ? t('save', lang) : t('edit', lang)}
                      </button>
                    )}
                    {isEditing && (
                      <button className="ia-btn ia-btn-ghost ia-btn-sm" onClick={() => setEditingId(null)}>
                        {t('cancel', lang)}
                      </button>
                    )}
                    <button className="ia-btn ia-btn-ghost ia-btn-sm ia-btn-danger" onClick={() => handleDelete(interview.id)}>
                      {t('delete', lang)}
                    </button>
                  </div>
                </div>

                {/* Transcript Editor */}
                {isEditing && (
                  <textarea
                    className="ia-textarea mt-3 text-xs font-mono"
                    style={{ minHeight: '200px' }}
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                  />
                )}

                {/* Transcript Preview */}
                {!isEditing && interview.transcript_text && (
                  <p className="mt-2 text-xs line-clamp-2" style={{ color: 'var(--ia-text-secondary)' }}>
                    {interview.transcript_text.slice(0, 200)}
                    {interview.transcript_text.length > 200 ? '...' : ''}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
