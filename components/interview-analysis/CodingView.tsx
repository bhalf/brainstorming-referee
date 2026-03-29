'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { IACode, IACodeAssignmentWithCode, MatrixQuestion, IAInterview } from '@/types/interview-analysis';
import { useIALang, t } from '@/lib/interview-analysis/i18n';
import CodebookPanel from './CodebookPanel';
import CodingWorkspace from './CodingWorkspace';
import CodeStatistics from './CodeStatistics';

interface CodingViewProps {
  projectId: string;
  projectLanguage: string;
  questions: MatrixQuestion[];
  interviews: IAInterview[];
}

export default function CodingView({ projectId, projectLanguage, questions, interviews }: CodingViewProps) {
  const lang = useIALang();
  const [codes, setCodes] = useState<IACode[]>([]);
  const [assignments, setAssignments] = useState<IACodeAssignmentWithCode[]>([]);
  const [selectedCode, setSelectedCode] = useState<IACode | null>(null);
  const [activePanel, setActivePanel] = useState<'workspace' | 'statistics'>('workspace');
  const [loading, setLoading] = useState(true);

  const loadCodes = useCallback(async () => {
    try {
      const res = await fetch(`/api/interview-analysis/projects/${projectId}/codes`);
      if (res.ok) {
        const data = await res.json();
        setCodes(Array.isArray(data) ? data : []);
      }
    } catch { /* ignore */ }
  }, [projectId]);

  const loadAssignments = useCallback(async () => {
    try {
      const res = await fetch(`/api/interview-analysis/projects/${projectId}/code-assignments`);
      if (res.ok) {
        const data = await res.json();
        setAssignments(Array.isArray(data) ? data : []);
      }
    } catch { /* ignore */ }
  }, [projectId]);

  useEffect(() => {
    Promise.all([loadCodes(), loadAssignments()]).finally(() => setLoading(false));
  }, [loadCodes, loadAssignments]);

  // Assignment counts per code
  const assignmentCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of assignments) {
      map.set(a.code_id, (map.get(a.code_id) ?? 0) + 1);
    }
    return map;
  }, [assignments]);

  // Code CRUD callbacks
  const handleCreateCode = useCallback(async (name: string, parentId: string | null, color: string) => {
    try {
      const res = await fetch(`/api/interview-analysis/projects/${projectId}/codes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, parent_id: parentId, color }),
      });
      if (res.ok) await loadCodes();
    } catch { /* ignore */ }
  }, [projectId, loadCodes]);

  const handleUpdateCode = useCallback(async (id: string, updates: Partial<IACode>) => {
    try {
      const res = await fetch(`/api/interview-analysis/projects/${projectId}/codes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      });
      if (res.ok) {
        await loadCodes();
        // Update selectedCode if it was the one that changed
        if (selectedCode?.id === id) {
          const updated = await res.json();
          setSelectedCode(updated);
        }
      }
    } catch { /* ignore */ }
  }, [projectId, loadCodes, selectedCode]);

  const handleDeleteCode = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/interview-analysis/projects/${projectId}/codes`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        await Promise.all([loadCodes(), loadAssignments()]);
        if (selectedCode?.id === id) setSelectedCode(null);
      }
    } catch { /* ignore */ }
  }, [projectId, loadCodes, loadAssignments, selectedCode]);

  // Assignment callbacks
  const handleAssign = useCallback(async (codeId: string, answerId: string, startOffset: number, endOffset: number, selectedText: string) => {
    try {
      const res = await fetch(`/api/interview-analysis/projects/${projectId}/code-assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code_id: codeId, answer_id: answerId, start_offset: startOffset, end_offset: endOffset, selected_text: selectedText }),
      });
      if (res.ok) await loadAssignments();
    } catch { /* ignore */ }
  }, [projectId, loadAssignments]);

  const handleRemoveAssignment = useCallback(async (assignmentId: string) => {
    try {
      const res = await fetch(`/api/interview-analysis/projects/${projectId}/code-assignments`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: assignmentId }),
      });
      if (res.ok) await loadAssignments();
    } catch { /* ignore */ }
  }, [projectId, loadAssignments]);

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '40vh' }}>
        <div className="ia-skeleton" style={{ width: 40, height: 40, borderRadius: '50%' }} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Stats bar */}
      <div className="ia-section-header">
        <div className="ia-toggle-group">
          <button
            className={`ia-toggle-btn ${activePanel === 'workspace' ? 'ia-toggle-btn--active' : ''}`}
            onClick={() => setActivePanel('workspace')}
          >
            {t('coding_workspace', lang)}
          </button>
          <button
            className={`ia-toggle-btn ${activePanel === 'statistics' ? 'ia-toggle-btn--active' : ''}`}
            onClick={() => setActivePanel('statistics')}
          >
            {t('coding_statistics', lang)}
          </button>
        </div>
        <div className="flex items-center gap-3 ml-auto text-xs" style={{ color: 'var(--ia-text-tertiary)' }}>
          <span>{codes.length} {t('coding_code_count', lang)}</span>
          <span>{assignments.length} {t('coding_total_assignments', lang)}</span>
        </div>
      </div>

      {activePanel === 'workspace' ? (
        <div className="flex gap-4 items-start">
          {/* Codebook sidebar */}
          <CodebookPanel
            codes={codes}
            assignmentCounts={assignmentCounts}
            selectedCodeId={selectedCode?.id ?? null}
            onSelectCode={setSelectedCode}
            onCreateCode={handleCreateCode}
            onUpdateCode={handleUpdateCode}
            onDeleteCode={handleDeleteCode}
          />

          {/* Coding workspace */}
          <CodingWorkspace
            projectId={projectId}
            projectLanguage={projectLanguage}
            questions={questions}
            codes={codes}
            assignments={assignments}
            selectedCode={selectedCode}
            onAssign={handleAssign}
            onRemoveAssignment={handleRemoveAssignment}
          />
        </div>
      ) : (
        <CodeStatistics
          projectId={projectId}
          codes={codes}
        />
      )}
    </div>
  );
}
