'use client';

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import type { IACode, IACodeAssignmentWithCode, MatrixQuestion, Sentiment } from '@/types/interview-analysis';
import { useIALang, t, pickLang } from '@/lib/interview-analysis/i18n';

interface CodingWorkspaceProps {
  projectId: string;
  projectLanguage: string;
  questions: MatrixQuestion[];
  codes: IACode[];
  assignments: IACodeAssignmentWithCode[];
  selectedCode: IACode | null;
  onAssign: (codeId: string, answerId: string, startOffset: number, endOffset: number, selectedText: string) => Promise<void>;
  onRemoveAssignment: (assignmentId: string) => Promise<void>;
}

interface Selection {
  answerId: string;
  start: number;
  end: number;
  text: string;
  rect: DOMRect;
}

const SENTIMENT_COLORS: Record<string, string> = {
  positive: 'var(--ia-success)',
  negative: 'var(--ia-error)',
  ambivalent: 'var(--ia-warning)',
  neutral: 'var(--ia-border)',
};

export default function CodingWorkspace({
  projectId,
  projectLanguage,
  questions,
  codes,
  assignments,
  selectedCode,
  onAssign,
  onRemoveAssignment,
}: CodingWorkspaceProps) {
  const lang = useIALang();
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [codeSearch, setCodeSearch] = useState('');
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{ name: string; existing_code_id: string | null }>>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedQuestion = useMemo(
    () => questions.find(q => q.canonical.id === selectedQuestionId) ?? null,
    [questions, selectedQuestionId]
  );

  // Auto-select first question
  useEffect(() => {
    if (!selectedQuestionId && questions.length > 0) {
      setSelectedQuestionId(questions[0].canonical.id);
    }
  }, [questions, selectedQuestionId]);

  // Filter assignments by selected question's answers
  const questionAnswerIds = useMemo(() => {
    if (!selectedQuestion) return new Set<string>();
    return new Set(selectedQuestion.answers.map(a => a.id));
  }, [selectedQuestion]);

  const filteredAssignments = useMemo(
    () => assignments.filter(a => questionAnswerIds.has(a.answer_id)),
    [assignments, questionAnswerIds]
  );

  // Group assignments by answer_id
  const assignmentsByAnswer = useMemo(() => {
    const map = new Map<string, IACodeAssignmentWithCode[]>();
    for (const a of filteredAssignments) {
      const list = map.get(a.answer_id) ?? [];
      list.push(a);
      map.set(a.answer_id, list);
    }
    return map;
  }, [filteredAssignments]);

  // Code lookup for filtering
  const filteredCodes = useMemo(() => {
    if (!codeSearch.trim()) return codes;
    const lower = codeSearch.toLowerCase();
    return codes.filter(c => c.name.toLowerCase().includes(lower));
  }, [codes, codeSearch]);

  function getSelectionOffsets(container: HTMLElement): { start: number; end: number; text: string } | null {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return null;

    const range = sel.getRangeAt(0);
    if (!container.contains(range.startContainer)) return null;

    const preRange = document.createRange();
    preRange.setStart(container, 0);
    preRange.setEnd(range.startContainer, range.startOffset);
    const start = preRange.toString().length;
    const text = sel.toString();
    const end = start + text.length;

    return { start, end, text };
  }

  const handleMouseUp = useCallback((answerId: string, e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    // Small delay to let selection finalize
    setTimeout(() => {
      const offsets = getSelectionOffsets(target);
      if (offsets && offsets.text.trim().length > 0) {
        const rect = window.getSelection()!.getRangeAt(0).getBoundingClientRect();

        // If a code is already selected (quick-assign mode), assign immediately
        if (selectedCode) {
          onAssign(selectedCode.id, answerId, offsets.start, offsets.end, offsets.text);
          window.getSelection()?.removeAllRanges();
          return;
        }

        setSelection({ answerId, start: offsets.start, end: offsets.end, text: offsets.text, rect });
        setCodeSearch('');
        setSuggestions([]);
      } else {
        setSelection(null);
      }
    }, 10);
  }, [selectedCode, onAssign]);

  async function handleAssignFromPopover(codeId: string) {
    if (!selection) return;
    await onAssign(codeId, selection.answerId, selection.start, selection.end, selection.text);
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  }

  async function handleSuggest() {
    if (!selection) return;
    setSuggesting(true);
    try {
      const res = await fetch(`/api/interview-analysis/projects/${projectId}/suggest-codes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: selection.text }),
      });
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.suggestions ?? []);
      }
    } catch { /* ignore */ }
    setSuggesting(false);
  }

  function renderHighlightedText(text: string, answerAssignments: IACodeAssignmentWithCode[]) {
    if (answerAssignments.length === 0) return text;

    const sorted = [...answerAssignments].sort((a, b) => a.start_offset - b.start_offset);
    const segments: Array<{ text: string; assignment?: IACodeAssignmentWithCode }> = [];
    let pos = 0;

    for (const a of sorted) {
      if (a.start_offset > pos) {
        segments.push({ text: text.slice(pos, a.start_offset) });
      }
      if (a.start_offset >= pos) {
        segments.push({ text: text.slice(a.start_offset, a.end_offset), assignment: a });
        pos = a.end_offset;
      }
    }
    if (pos < text.length) {
      segments.push({ text: text.slice(pos) });
    }

    return segments.map((seg, i) => {
      if (!seg.assignment) return <span key={i}>{seg.text}</span>;
      const code = seg.assignment.code;
      return (
        <span
          key={i}
          className="relative group/hl cursor-pointer"
          style={{ backgroundColor: `${code.color}30`, borderBottom: `2px solid ${code.color}` }}
          title={code.name}
        >
          {seg.text}
          {/* Remove button on hover */}
          <button
            className="hidden group-hover/hl:inline-flex absolute -top-5 right-0 ia-badge text-[9px] px-1 py-0 items-center gap-0.5"
            style={{ backgroundColor: code.color, color: 'white', cursor: 'pointer' }}
            onClick={(e) => { e.stopPropagation(); onRemoveAssignment(seg.assignment!.id); }}
          >
            {code.name} ×
          </button>
        </span>
      );
    });
  }

  return (
    <div className="flex-1 flex flex-col gap-4 min-w-0" ref={containerRef}>
      {/* Question selector */}
      <div className="flex items-center gap-3">
        <select
          className="ia-input text-sm flex-1"
          value={selectedQuestionId ?? ''}
          onChange={e => { setSelectedQuestionId(e.target.value || null); setSelection(null); }}
        >
          <option value="">{t('coding_select_question', lang)}</option>
          {questions.map(q => (
            <option key={q.canonical.id} value={q.canonical.id}>
              {pickLang(q.canonical.canonical_text, q.canonical.canonical_text_alt, lang, projectLanguage)}
              {' '}({q.answers.length} {t('answers', lang)})
            </option>
          ))}
        </select>

        {selectedCode && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md" style={{ backgroundColor: `${selectedCode.color}15`, border: `1px solid ${selectedCode.color}40` }}>
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: selectedCode.color }} />
            <span className="text-xs font-medium" style={{ color: selectedCode.color }}>{selectedCode.name}</span>
            <span className="text-[10px]" style={{ color: 'var(--ia-text-tertiary)' }}>({t('coding_active_code', lang)})</span>
          </div>
        )}
      </div>

      {/* Hint */}
      {selectedCode && (
        <p className="text-xs" style={{ color: 'var(--ia-text-tertiary)' }}>
          {t('coding_select_text', lang)}
        </p>
      )}

      {/* No question selected */}
      {!selectedQuestion && (
        <div className="ia-card p-8 text-center">
          <p className="text-sm" style={{ color: 'var(--ia-text-tertiary)' }}>
            {t('coding_no_question_selected', lang)}
          </p>
        </div>
      )}

      {/* Answers */}
      {selectedQuestion && selectedQuestion.answers.map(answer => {
        const answerAssignments = assignmentsByAnswer.get(answer.id) ?? [];
        const sentimentColor = SENTIMENT_COLORS[answer.sentiment ?? 'neutral'];

        return (
          <div key={answer.id} className="ia-card p-4 relative overflow-hidden">
            {/* Sentiment bar */}
            <div className="ia-sentiment-bar" style={{ background: sentimentColor }} />

            {/* Header */}
            <div className="ia-answer-card-header">
              <span className="ia-answer-card-name">
                {answer.interview_name}
              </span>
              <div className="flex items-center gap-1.5">
                {answerAssignments.length > 0 && (
                  <span className="ia-badge ia-badge-neutral" style={{ fontSize: '10px' }}>
                    {answerAssignments.length} {t('coding_assignments', lang).toLowerCase()}
                  </span>
                )}
                <span className="text-[11px]" style={{ color: 'var(--ia-text-tertiary)' }}>
                  {answer.word_count ?? '–'} {t('words', lang)}
                </span>
              </div>
            </div>

            {/* Answer text with highlights */}
            <div
              className="text-[13px] leading-relaxed pl-1 select-text"
              style={{ color: 'var(--ia-text-secondary)', userSelect: 'text' }}
              onMouseUp={(e) => handleMouseUp(answer.id, e)}
            >
              {renderHighlightedText(answer.answer_text, answerAssignments)}
            </div>

            {/* Code badges */}
            {answerAssignments.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2 pl-1">
                {[...new Map(answerAssignments.map(a => [a.code_id, a.code])).values()].map(code => (
                  <span
                    key={code.id}
                    className="ia-badge"
                    style={{ fontSize: '10px', backgroundColor: `${code.color}20`, color: code.color, border: `1px solid ${code.color}40` }}
                  >
                    {code.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Assign code popover */}
      {selection && !selectedCode && (
        <div
          className="fixed ia-popover"
          style={{
            top: Math.min(selection.rect.bottom + 8, window.innerHeight - 300),
            left: Math.min(selection.rect.left, window.innerWidth - 280),
            width: 260,
          }}
        >
          <p className="text-[11px] mb-2 truncate" style={{ color: 'var(--ia-text-tertiary)' }}>
            &quot;{selection.text.slice(0, 60)}{selection.text.length > 60 ? '...' : ''}&quot;
          </p>

          {/* Search */}
          <input
            className="ia-input text-xs w-full mb-2"
            placeholder={t('coding_search_codes', lang)}
            value={codeSearch}
            onChange={e => setCodeSearch(e.target.value)}
            autoFocus
          />

          {/* Code list */}
          <div className="flex flex-col gap-0.5 max-h-40 ia-scroll-y mb-2">
            {filteredCodes.map(code => (
              <button
                key={code.id}
                className="flex items-center gap-2 px-2 py-1 rounded text-left hover:opacity-80 transition-colors"
                style={{ backgroundColor: `${code.color}10` }}
                onClick={() => handleAssignFromPopover(code.id)}
              >
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: code.color }} />
                <span className="text-xs truncate" style={{ color: 'var(--ia-text)' }}>{code.name}</span>
              </button>
            ))}
            {filteredCodes.length === 0 && (
              <p className="text-[11px] text-center py-2" style={{ color: 'var(--ia-text-tertiary)' }}>
                {t('coding_no_codes', lang)}
              </p>
            )}
          </div>

          {/* AI suggest */}
          <button
            className="ia-btn ia-btn-ghost ia-btn-sm w-full text-xs flex items-center justify-center gap-1"
            onClick={handleSuggest}
            disabled={suggesting}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2a10 10 0 1 0 10 10" /><path d="M12 6v6l4 2" />
            </svg>
            {suggesting ? t('coding_ai_suggesting', lang) : t('coding_ai_suggest', lang)}
          </button>

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="mt-2 pt-2">
              <div className="ia-divider" style={{ margin: '0 0 8px 0' }} />
              <p className="ia-stat-label" style={{ fontSize: '10px', marginBottom: 4 }}>
                {t('coding_ai_suggest', lang)}
              </p>
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  className="flex items-center gap-2 px-2 py-1 rounded text-left w-full hover:opacity-80 transition-colors"
                  style={{ backgroundColor: s.existing_code_id ? `${codes.find(c => c.id === s.existing_code_id)?.color ?? '#6366F1'}10` : 'var(--ia-surface-2)' }}
                  onClick={() => {
                    if (s.existing_code_id) {
                      handleAssignFromPopover(s.existing_code_id);
                    }
                    // For new codes, user needs to create in codebook first
                  }}
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: s.existing_code_id ? (codes.find(c => c.id === s.existing_code_id)?.color ?? '#6366F1') : 'var(--ia-text-tertiary)' }}
                  />
                  <span className="text-xs truncate" style={{ color: 'var(--ia-text)' }}>
                    {s.name}
                    {!s.existing_code_id && <span className="text-[10px] ml-1" style={{ color: 'var(--ia-text-tertiary)' }}>({t('coding_new_code', lang)})</span>}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Close */}
          <button
            className="ia-btn ia-btn-ghost ia-btn-sm w-full text-xs mt-1"
            onClick={() => { setSelection(null); window.getSelection()?.removeAllRanges(); }}
          >
            {t('close', lang)}
          </button>
        </div>
      )}
    </div>
  );
}
