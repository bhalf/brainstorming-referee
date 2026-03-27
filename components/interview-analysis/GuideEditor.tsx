'use client';

import { useState } from 'react';
import type { IAGuideQuestion } from '@/types/interview-analysis';
import { useIALang, t } from '@/lib/interview-analysis/i18n';

interface GuideEditorProps {
  projectId: string;
  guideQuestions: IAGuideQuestion[];
  rawText: string | null;
  onRefresh: () => void;
}

export default function GuideEditor({ projectId, guideQuestions, rawText, onRefresh }: GuideEditorProps) {
  const lang = useIALang();
  const [text, setText] = useState(rawText ?? '');
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleParse() {
    if (!text.trim()) return;
    setParsing(true);
    setError('');

    try {
      const res = await fetch(`/api/interview-analysis/projects/${projectId}/parse-guide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_text: text.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t('guide_parse_failed', lang));
      }

      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error', lang));
    } finally {
      setParsing(false);
    }
  }

  async function handleDelete() {
    try {
      await fetch(`/api/interview-analysis/projects/${projectId}/guide-questions`, {
        method: 'DELETE',
      });
      setText('');
      setConfirmDelete(false);
      onRefresh();
    } catch {
      setError(t('guide_delete_failed', lang));
    }
  }

  // Group questions by topic_area
  const grouped = new Map<string, IAGuideQuestion[]>();
  for (const q of guideQuestions) {
    const key = q.topic_area || t('guide_default_topic', lang);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(q);
  }

  const hasQuestions = guideQuestions.length > 0;

  return (
    <div className="space-y-5">
      {/* Info Box */}
      <div className="ia-card-sm p-4 flex items-start gap-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: 'var(--ia-accent-light)', color: 'var(--ia-accent)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--ia-text)' }}>
            {t('guide_title', lang)}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--ia-text-tertiary)' }}>
            {t('guide_placeholder', lang)}
          </p>
        </div>
      </div>

      {/* Text Input */}
      <div className="ia-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold" style={{ color: 'var(--ia-text-secondary)' }}>
            {t('guide_text_label', lang)}
          </label>
          {hasQuestions && (
            <span className="ia-badge ia-badge-positive" style={{ fontSize: '11px' }}>
              {guideQuestions.length} {t('guide_questions_found', lang)}
            </span>
          )}
        </div>

        <textarea
          className="ia-textarea text-sm"
          style={{ minHeight: '180px' }}
          placeholder={`Beispiel:\n\nEinstieg\n1. Erzählen Sie mir von Ihrem Hintergrund.\n2. Wie sind Sie zu diesem Thema gekommen?\n\nHauptteil\n3. Was sind die grössten Herausforderungen?\n4. Welche Lösungsansätze sehen Sie?\n...`}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        {text.trim() && (
          <p className="text-[11px] ia-data" style={{ color: 'var(--ia-text-tertiary)' }}>
            {text.trim().split(/\s+/).length.toLocaleString()} {t('words', lang)}
          </p>
        )}

        <div className="flex gap-2">
          <button
            className="ia-btn ia-btn-primary flex-1"
            disabled={parsing || !text.trim()}
            onClick={handleParse}
          >
            {parsing ? (
              <>
                <span className="ia-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                {t('guide_analyzing', lang)}
              </>
            ) : hasQuestions ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
                {t('guide_reparse', lang)}
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
                </svg>
                {t('guide_parse', lang)}
              </>
            )}
          </button>

          {hasQuestions && !confirmDelete && (
            <button
              className="ia-btn ia-btn-ghost ia-btn-danger"
              onClick={() => setConfirmDelete(true)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          )}

          {confirmDelete && (
            <>
              <button className="ia-btn ia-btn-ghost ia-btn-danger ia-btn-sm" onClick={handleDelete}>
                {t('guide_delete_confirm', lang)}
              </button>
              <button className="ia-btn ia-btn-ghost ia-btn-sm" onClick={() => setConfirmDelete(false)}>
                {t('cancel', lang)}
              </button>
            </>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'var(--ia-error-light)', color: 'var(--ia-error)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            <span className="text-xs font-medium">{error}</span>
          </div>
        )}
      </div>

      {/* Parsed Questions Display */}
      {hasQuestions && (
        <div className="space-y-3 ia-stagger">
          {Array.from(grouped.entries()).map(([topic, questions]) => (
            <div key={topic} className="ia-card-sm overflow-hidden">
              {/* Topic Header */}
              <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: '1px solid var(--ia-border)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--ia-accent)' }}>
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                <span className="text-xs font-semibold" style={{ color: 'var(--ia-text)' }}>
                  {topic}
                </span>
                <span className="text-[11px] ia-data" style={{ color: 'var(--ia-text-tertiary)' }}>
                  {questions.length}
                </span>
              </div>

              {/* Questions */}
              <div className="divide-y" style={{ borderColor: 'var(--ia-border-light)' }}>
                {questions.map((q, i) => (
                  <div key={q.id} className="px-4 py-3 flex items-start gap-3">
                    <span
                      className="text-[11px] font-mono font-semibold flex-shrink-0 w-5 h-5 rounded flex items-center justify-center mt-0.5"
                      style={{ background: 'var(--ia-bg-muted)', color: 'var(--ia-text-tertiary)' }}
                    >
                      {q.sort_order + 1}
                    </span>
                    <p className="text-[13px] leading-relaxed" style={{ color: 'var(--ia-text-secondary)' }}>
                      {q.question_text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
