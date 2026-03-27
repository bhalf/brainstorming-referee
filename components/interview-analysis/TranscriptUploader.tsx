'use client';

import { useState, useRef } from 'react';
import { useIALang, t } from '@/lib/interview-analysis/i18n';

interface TranscriptUploaderProps {
  projectId: string;
  onComplete: () => void;
}

export default function TranscriptUploader({ projectId, onComplete }: TranscriptUploaderProps) {
  const lang = useIALang();
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [docxFile, setDocxFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFileLoad(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'docx') {
      // .docx files are handled server-side
      setDocxFile(file);
      setText('');
      if (!name) setName(file.name.replace(/\.[^.]+$/, ''));
    } else {
      // .txt, .srt, .vtt — read client-side
      setDocxFile(null);
      const content = await file.text();
      setText(content);
      if (!name) setName(file.name.replace(/\.[^.]+$/, ''));
    }
  }

  async function handleSave() {
    if (!name.trim()) return;
    if (!text.trim() && !docxFile) return;
    setSaving(true);
    setError('');

    try {
      if (docxFile) {
        // Upload .docx to server for parsing
        const formData = new FormData();
        formData.append('file', docxFile);
        formData.append('name', name.trim());

        const res = await fetch(`/api/interview-analysis/projects/${projectId}/upload-docx`, {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || t('transcript_upload_failed', lang));
        }
      } else {
        // Direct text save
        const res = await fetch(`/api/interview-analysis/projects/${projectId}/interviews`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            transcript_text: text.trim(),
            source_type: 'text',
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || t('transcript_save_failed', lang));
        }
      }

      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error', lang));
    } finally {
      setSaving(false);
    }
  }

  const hasContent = text.trim().length > 0 || docxFile !== null;

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ia-text-secondary)' }}>
          {t('transcript_name', lang)}
        </label>
        <input
          className="ia-input"
          placeholder={t('transcript_name_placeholder', lang)}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-medium" style={{ color: 'var(--ia-text-secondary)' }}>
            {t('transcript_label', lang)}
          </label>
          <button
            className="ia-btn ia-btn-ghost ia-btn-sm"
            onClick={() => fileRef.current?.click()}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            {t('transcript_load_file', lang)}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".docx,.txt,.srt,.vtt"
            className="hidden"
            onChange={handleFileLoad}
          />
        </div>

        {docxFile ? (
          <div
            className="ia-card-sm p-4 flex items-center gap-3 cursor-pointer"
            onClick={() => fileRef.current?.click()}
          >
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--ia-accent-light)', color: 'var(--ia-accent)' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--ia-text)' }}>
                {docxFile.name}
              </p>
              <p className="text-[11px]" style={{ color: 'var(--ia-text-tertiary)' }}>
                {(docxFile.size / 1024).toFixed(0)} KB — {t('transcript_docx_info', lang)}
              </p>
            </div>
            <span className="text-[11px] font-medium" style={{ color: 'var(--ia-accent)' }}>
              {t('transcript_change', lang)}
            </span>
          </div>
        ) : (
          <>
            <textarea
              className="ia-textarea text-sm font-mono"
              style={{ minHeight: '200px' }}
              placeholder={t('transcript_placeholder', lang)}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            {text && (
              <p className="text-[11px] mt-1 ia-data" style={{ color: 'var(--ia-text-tertiary)' }}>
                {text.trim().split(/\s+/).length.toLocaleString()} {t('words', lang)}
              </p>
            )}
          </>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'var(--ia-error-light)', color: 'var(--ia-error)' }}>
          <span className="text-xs font-medium">{error}</span>
        </div>
      )}

      <button
        className="ia-btn ia-btn-primary w-full"
        disabled={saving || !name.trim() || !hasContent}
        onClick={handleSave}
      >
        {saving ? (
          <>
            <span className="ia-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
            {docxFile ? t('transcript_uploading', lang) : t('transcript_saving', lang)}
          </>
        ) : t('transcript_save', lang)}
      </button>
    </div>
  );
}
