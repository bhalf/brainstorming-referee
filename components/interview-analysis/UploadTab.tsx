'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import type { IAInterview } from '@/types/interview-analysis';
import AudioUploader from './AudioUploader';
import TranscriptUploader from './TranscriptUploader';
import { useIALang, t } from '@/lib/interview-analysis/i18n';

interface UploadTabProps {
  projectId: string;
  interviews: IAInterview[];
  projectLanguage: string;
  onRefresh: () => void;
}

const STATUS_KEYS: Record<string, { key: string; className: string }> = {
  pending: { key: 'status_pending', className: 'ia-badge-neutral' },
  transcribing: { key: 'status_transcribing', className: 'ia-badge-ambivalent' },
  transcribed: { key: 'status_transcribed', className: 'ia-badge-positive' },
  analyzed: { key: 'status_analyzed', className: 'ia-badge-info' },
};

const GROUP_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16',
];

function groupColor(label: string): string {
  let hash = 0;
  for (let i = 0; i < label.length; i++) hash = (hash * 31 + label.charCodeAt(i)) | 0;
  return GROUP_COLORS[Math.abs(hash) % GROUP_COLORS.length];
}

/** Try to detect common prefixes from interview names to auto-assign groups */
function detectGroupsFromNames(interviews: IAInterview[]): Map<string, string> | null {
  // Try common separators: "-", "_", " "
  for (const sep of ['-', '_', ' ']) {
    const prefixMap = new Map<string, string[]>();
    for (const iv of interviews) {
      const idx = iv.name.indexOf(sep);
      if (idx > 0) {
        const prefix = iv.name.slice(0, idx).trim();
        if (!prefixMap.has(prefix)) prefixMap.set(prefix, []);
        prefixMap.get(prefix)!.push(iv.id);
      }
    }
    // Valid if we have at least 2 groups with at least 2 members each
    const groups = [...prefixMap.entries()].filter(([, ids]) => ids.length >= 2);
    if (groups.length >= 2) {
      const result = new Map<string, string>();
      for (const [prefix, ids] of groups) {
        for (const id of ids) result.set(id, prefix);
      }
      return result;
    }
  }
  return null;
}

export default function UploadTab({ projectId, interviews, projectLanguage, onRefresh }: UploadTabProps) {
  const lang = useIALang();
  const [showAdd, setShowAdd] = useState(false);
  const [uploadMode, setUploadMode] = useState<'audio' | 'text'>('audio');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [groupDropdownId, setGroupDropdownId] = useState<string | null>(null);
  const [newGroupText, setNewGroupText] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const existingGroups = useMemo(
    () => [...new Set(interviews.map(i => i.group_label).filter((g): g is string => !!g))].sort(),
    [interviews]
  );

  // Close dropdown on outside click
  useEffect(() => {
    if (!groupDropdownId) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setGroupDropdownId(null);
        setNewGroupText('');
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [groupDropdownId]);

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

  async function assignGroup(interviewId: string, groupLabel: string | null) {
    setGroupDropdownId(null);
    setNewGroupText('');
    await fetch(`/api/interview-analysis/projects/${projectId}/interviews/${interviewId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group_label: groupLabel }),
    });
    onRefresh();
  }

  async function handleDetectGroups() {
    const detected = detectGroupsFromNames(interviews);
    if (!detected || detected.size === 0) return;

    const ids = [...detected.keys()];
    // Group by label for batch updates
    const byLabel = new Map<string, string[]>();
    for (const [id, label] of detected) {
      if (!byLabel.has(label)) byLabel.set(label, []);
      byLabel.get(label)!.push(id);
    }

    await Promise.all(
      [...byLabel.entries()].map(([label, interviewIds]) =>
        fetch(`/api/interview-analysis/projects/${projectId}/interviews/batch-group`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ interviewIds, group_label: label }),
        })
      )
    );
    onRefresh();
  }

  const canDetectGroups = useMemo(() => detectGroupsFromNames(interviews) !== null, [interviews]);

  const sortedInterviews = useMemo(() => {
    return [...interviews].sort((a, b) => {
      const aGroup = a.group_label ?? '\uffff';
      const bGroup = b.group_label ?? '\uffff';
      const groupCmp = aGroup.localeCompare(bGroup, undefined, { numeric: true, sensitivity: 'base' });
      if (groupCmp !== 0) return groupCmp;
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [interviews]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="ia-section-header">
        <div>
          <h2 className="ia-section-title">
            {t('interviews', lang)}
          </h2>
          <p className="ia-section-subtitle">
            {interviews.length} Interview{interviews.length !== 1 ? 's' : ''} {t('upload_uploaded', lang)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canDetectGroups && (
            <button
              className="ia-btn ia-btn-secondary ia-btn-sm"
              onClick={handleDetectGroups}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              {t('group_detect_prefix', lang)}
            </button>
          )}
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
      </div>

      {/* Add Interview Panel */}
      {showAdd && (
        <div className="ia-card p-5 ia-animate-in space-y-4">
          {/* Mode Toggle */}
          <div className="ia-toggle-group" style={{ display: 'flex' }}>
            {(['audio', 'text'] as const).map(mode => (
              <button
                key={mode}
                className={`ia-toggle-btn flex-1 ${uploadMode === mode ? 'ia-toggle-btn--active' : ''}`}
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
            <AudioUploader projectId={projectId} transcriptionLanguage={projectLanguage} onComplete={() => { setShowAdd(false); onRefresh(); }} />
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
        <div className="space-y-3 ia-stagger">
          {sortedInterviews.map((interview, idx) => {
            const prevGroup = idx > 0 ? sortedInterviews[idx - 1].group_label : undefined;
            const showGroupHeader = interview.group_label && interview.group_label !== prevGroup;
            const status = STATUS_KEYS[interview.status] || STATUS_KEYS.pending;
            const isEditing = editingId === interview.id;
            const isGroupOpen = groupDropdownId === interview.id;

            return (
              <div key={interview.id}>
                {showGroupHeader && (
                  <div className="ia-group-header" style={idx > 0 ? { marginTop: 12 } : undefined}>
                    <span className="ia-group-dot" style={{ background: groupColor(interview.group_label!) }} />
                    <span className="ia-group-name" style={{ color: groupColor(interview.group_label!) }}>
                      {interview.group_label}
                    </span>
                  </div>
                )}
              <div className="ia-interview-card" style={{ position: 'relative', overflow: isGroupOpen ? 'visible' : undefined, zIndex: isGroupOpen ? 10 : undefined }}>
                <div className="ia-interview-card-icon">
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
                <div className="ia-interview-card-body">
                  <h3 className="ia-interview-card-name">{interview.name}</h3>
                  <div className="ia-interview-card-meta">
                    <span className={`ia-badge ${status.className}`}>{t(status.key, lang)}</span>
                    {interview.word_count && (
                      <span className="ia-data">{interview.word_count.toLocaleString()} {t('words', lang)}</span>
                    )}
                    {/* Group Badge */}
                    <div style={{ position: 'relative' }}>
                      <button
                        className="ia-badge"
                        style={{
                          background: interview.group_label
                            ? `${groupColor(interview.group_label)}20`
                            : 'var(--ia-bg-muted)',
                          color: interview.group_label
                            ? groupColor(interview.group_label)
                            : 'var(--ia-text-tertiary)',
                          border: `1px solid ${interview.group_label ? `${groupColor(interview.group_label)}40` : 'var(--ia-border)'}`,
                          cursor: 'pointer',
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setGroupDropdownId(isGroupOpen ? null : interview.id);
                          setNewGroupText('');
                        }}
                      >
                        {interview.group_label || t('group_assign', lang)}
                      </button>

                      {/* Group Dropdown */}
                      {isGroupOpen && (
                        <div ref={dropdownRef} className="ia-popover" style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, minWidth: 180, padding: '4px' }}>
                          <button
                            className="ia-btn ia-btn-ghost w-full justify-start text-xs py-1.5 px-2 rounded"
                            style={{ color: 'var(--ia-text-secondary)' }}
                            onClick={() => assignGroup(interview.id, null)}
                          >
                            {t('group_none', lang)}
                          </button>
                          {existingGroups.map(g => (
                            <button
                              key={g}
                              className="ia-btn ia-btn-ghost w-full justify-start text-xs py-1.5 px-2 rounded"
                              style={{ color: groupColor(g) }}
                              onClick={() => assignGroup(interview.id, g)}
                            >
                              <span className="ia-group-dot" style={{ background: groupColor(g), display: 'inline-block', marginRight: 6 }} />
                              {g}
                            </button>
                          ))}
                          <div className="ia-divider" style={{ margin: '4px 0' }} />
                          <form
                            className="flex gap-1 px-1"
                            onSubmit={(e) => {
                              e.preventDefault();
                              if (newGroupText.trim()) assignGroup(interview.id, newGroupText.trim());
                            }}
                          >
                            <input
                              className="ia-input text-xs flex-1"
                              style={{ padding: '4px 8px' }}
                              placeholder={t('group_new_placeholder', lang)}
                              value={newGroupText}
                              onChange={(e) => setNewGroupText(e.target.value)}
                              autoFocus
                            />
                            <button type="submit" className="ia-btn ia-btn-primary text-xs" style={{ padding: '4px 8px' }} disabled={!newGroupText.trim()}>+</button>
                          </form>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="ia-interview-card-actions">
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

                {/* Transcript Editor */}
                {isEditing && (
                  <textarea
                    className="ia-textarea text-xs font-mono"
                    style={{ minHeight: '200px', width: '100%', marginTop: 12 }}
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                  />
                )}

              </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
