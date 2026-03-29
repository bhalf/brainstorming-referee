'use client';

import { useState, useEffect, useMemo } from 'react';
import type { MatrixQuestion, MatrixFilter, Sentiment, AnswerConfidence, AnswerMatchType, IAInterview } from '@/types/interview-analysis';
import AnswerCard from './AnswerCard';
import { useIALang, t, pickLang } from '@/lib/interview-analysis/i18n';

interface MatrixViewProps {
  questions: MatrixQuestion[];
  interviews: IAInterview[];
  projectId: string;
  projectLanguage: string;
  onGenerateSummary: (canonicalQuestionId: string) => Promise<void>;
  onRefresh: () => void;
}

export default function MatrixView({ questions, interviews, projectId, projectLanguage, onGenerateSummary, onRefresh }: MatrixViewProps) {
  const lang = useIALang();
  const [filter, setFilter] = useState<MatrixFilter>({});
  const startExpanded = interviews.length < 15;
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(
    new Set(startExpanded ? questions.map(q => q.canonical.id) : [])
  );
  useEffect(() => {
    setExpandedQuestions(new Set(interviews.length < 15 ? questions.map(q => q.canonical.id) : []));
  }, [questions, interviews.length]);
  const [generatingSummary, setGeneratingSummary] = useState<string | null>(null);
  const [reassigning, setReassigning] = useState<string | null>(null); // mappingId being reassigned
  const [merging, setMerging] = useState<string | null>(null); // canonicalId being merged
  const [actionLoading, setActionLoading] = useState(false);

  // Interview name lookup
  const interviewNameMap = new Map(interviews.map(i => [i.id, i.name]));
  const hasAnyGuideQuestion = questions.some(q => q.canonical.guide_question_id);

  // Derived filter options
  const groupLabels = useMemo(
    () => [...new Set(interviews.map(i => i.group_label).filter((g): g is string => !!g))].sort(),
    [interviews]
  );
  const topicAreas = useMemo(
    () => [...new Set(questions.map(q => q.canonical.topic_area).filter((t): t is string => !!t))].sort(),
    [questions]
  );
  const groupInterviewIds = useMemo(() => {
    if (!filter.group_label) return null;
    return new Set(interviews.filter(i => i.group_label === filter.group_label).map(i => i.id));
  }, [filter.group_label, interviews]);

  function toggleQuestion(id: string) {
    setExpandedQuestions(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleGenerateSummary(canonicalQuestionId: string) {
    setGeneratingSummary(canonicalQuestionId);
    try {
      await onGenerateSummary(canonicalQuestionId);
    } finally {
      setGeneratingSummary(null);
    }
  }

  async function handleReassign(mappingId: string, targetCanonicalId: string) {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/interview-analysis/projects/${projectId}/canonical-questions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappingId, targetCanonicalId }),
      });
      if (res.ok) {
        setReassigning(null);
        onRefresh();
      }
    } finally {
      setActionLoading(false);
    }
  }

  async function handleMerge(sourceId: string, targetId: string) {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/interview-analysis/projects/${projectId}/canonical-questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId, targetId }),
      });
      if (res.ok) {
        setMerging(null);
        onRefresh();
      }
    } finally {
      setActionLoading(false);
    }
  }

  // Apply filters
  const filteredQuestions = questions
    .filter(q => !filter.topic_area || q.canonical.topic_area === filter.topic_area)
    .map(q => {
      let answers = q.answers;
      if (filter.sentiment) answers = answers.filter(a => a.sentiment === filter.sentiment);
      if (filter.interview_id) answers = answers.filter(a => a.interview_id === filter.interview_id);
      if (groupInterviewIds) answers = answers.filter(a => groupInterviewIds.has(a.interview_id));
      if (filter.min_word_count) answers = answers.filter(a => (a.word_count ?? 0) >= (filter.min_word_count ?? 0));
      if (filter.confidence) answers = answers.filter(a => a.confidence === filter.confidence);
      if (filter.match_type) answers = answers.filter(a => a.match_type === filter.match_type);
      if (filter.has_follow_ups) answers = answers.filter(a => a.follow_ups && a.follow_ups.length > 0);
      if (filter.min_answer_length === 'short') answers = answers.filter(a => (a.word_count ?? 0) < 50);
      if (filter.min_answer_length === 'medium') answers = answers.filter(a => (a.word_count ?? 0) >= 50 && (a.word_count ?? 0) <= 200);
      if (filter.min_answer_length === 'long') answers = answers.filter(a => (a.word_count ?? 0) > 200);
      if (filter.search) {
        const s = filter.search.toLowerCase();
        answers = answers.filter(a => a.answer_text.toLowerCase().includes(s));
      }
      return { ...q, answers };
    });

  const allInterviews = Array.from(
    new Map(questions.flatMap(q => q.answers.map(a => [a.interview_id, a.interview_name]))).entries()
  );

  const hasActiveFilter = Object.values(filter).some(Boolean);

  return (
    <div className="space-y-5">
      {/* Filter Bar */}
      <div className="ia-card-sm p-3 space-y-2">
        <div className="flex flex-wrap gap-2 items-center">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--ia-text-tertiary)' }}>
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>

          <select
            className="ia-select"
            value={filter.sentiment ?? ''}
            onChange={(e) => setFilter(f => ({ ...f, sentiment: (e.target.value || undefined) as Sentiment | undefined }))}
          >
            <option value="">{t('sentiment', lang)}</option>
            <option value="positive">{t('positive', lang)}</option>
            <option value="negative">{t('negative', lang)}</option>
            <option value="ambivalent">{t('ambivalent', lang)}</option>
            <option value="neutral">{t('neutral', lang)}</option>
          </select>

          <select
            className="ia-select"
            value={filter.interview_id ?? ''}
            onChange={(e) => setFilter(f => ({ ...f, interview_id: e.target.value || undefined }))}
          >
            <option value="">Interview</option>
            {allInterviews.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>

          {groupLabels.length > 0 && (
            <select
              className="ia-select"
              value={filter.group_label ?? ''}
              onChange={(e) => setFilter(f => ({ ...f, group_label: e.target.value || undefined }))}
            >
              <option value="">{t('matrix_all_groups', lang)}</option>
              {groupLabels.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          )}

          {topicAreas.length > 1 && (
            <select
              className="ia-select"
              value={filter.topic_area ?? ''}
              onChange={(e) => setFilter(f => ({ ...f, topic_area: e.target.value || undefined }))}
            >
              <option value="">{t('matrix_all_topics', lang)}</option>
              {topicAreas.map(t2 => <option key={t2} value={t2}>{t2}</option>)}
            </select>
          )}

          <input
            className="ia-input"
            style={{ width: '200px', height: '32px', fontSize: '13px' }}
            placeholder={t('matrix_search_placeholder', lang)}
            value={filter.search ?? ''}
            onChange={(e) => setFilter(f => ({ ...f, search: e.target.value || undefined }))}
          />

          {hasActiveFilter && (
            <button
              className="ia-btn ia-btn-ghost ia-btn-sm ia-btn-danger"
              onClick={() => setFilter({})}
            >
              {t('matrix_reset', lang)}
            </button>
          )}
        </div>

        {/* Second row: advanced filters + expand/collapse */}
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div className="flex flex-wrap gap-2 items-center">
            <select
              className="ia-select"
              style={{ fontSize: '12px' }}
              value={filter.confidence ?? ''}
              onChange={(e) => setFilter(f => ({ ...f, confidence: (e.target.value || undefined) as AnswerConfidence | undefined }))}
            >
              <option value="">{t('matrix_filter_confidence', lang)}</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <select
              className="ia-select"
              style={{ fontSize: '12px' }}
              value={filter.match_type ?? ''}
              onChange={(e) => setFilter(f => ({ ...f, match_type: (e.target.value || undefined) as AnswerMatchType | undefined }))}
            >
              <option value="">{t('matrix_filter_match_type', lang)}</option>
              <option value="direct">{t('match_direct', lang)}</option>
              <option value="paraphrased">{t('match_paraphrased', lang)}</option>
              <option value="implicit">{t('match_implicit', lang)}</option>
              <option value="scattered">{t('match_scattered', lang)}</option>
            </select>

            <select
              className="ia-select"
              style={{ fontSize: '12px' }}
              value={filter.min_answer_length ?? ''}
              onChange={(e) => setFilter(f => ({ ...f, min_answer_length: (e.target.value || undefined) as MatrixFilter['min_answer_length'] }))}
            >
              <option value="">{t('matrix_filter_length', lang)}</option>
              <option value="short">{t('matrix_length_short', lang)}</option>
              <option value="medium">{t('matrix_length_medium', lang)}</option>
              <option value="long">{t('matrix_length_long', lang)}</option>
            </select>

            <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: 'var(--ia-text-secondary)' }}>
              <input
                type="checkbox"
                checked={!!filter.has_follow_ups}
                onChange={(e) => setFilter(f => ({ ...f, has_follow_ups: e.target.checked || undefined }))}
                style={{ accentColor: 'var(--ia-accent)' }}
              />
              {t('matrix_filter_follow_ups', lang)}
            </label>
          </div>

          <div className="flex items-center gap-1">
            <button
              className="ia-btn ia-btn-ghost ia-btn-sm"
              style={{ fontSize: '11px' }}
              onClick={() => setExpandedQuestions(new Set(filteredQuestions.map(q => q.canonical.id)))}
            >
              {t('matrix_expand_all', lang)}
            </button>
            <button
              className="ia-btn ia-btn-ghost ia-btn-sm"
              style={{ fontSize: '11px' }}
              onClick={() => setExpandedQuestions(new Set())}
            >
              {t('matrix_collapse_all', lang)}
            </button>
          </div>
        </div>
      </div>

      {/* Questions */}
      {filteredQuestions.length === 0 ? (
        <div className="ia-card ia-empty">
          <svg className="ia-empty-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <p className="text-sm font-medium" style={{ color: 'var(--ia-text-secondary)' }}>
            {t('matrix_empty_title', lang)}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--ia-text-tertiary)' }}>
            {t('matrix_empty_desc', lang)}
          </p>
        </div>
      ) : (
        <div className="space-y-4 ia-stagger">
          {filteredQuestions.map((q, idx) => {
            const isExpanded = expandedQuestions.has(q.canonical.id);
            const coverage = Math.round((q.answers.length / Math.max(q.total_interviews, 1)) * 100);

            return (
              <div key={q.canonical.id} className="ia-card overflow-hidden">
                {/* Question Header */}
                <button
                  className="w-full text-left p-5 flex items-start justify-between gap-4 transition-colors"
                  style={{ background: isExpanded ? 'var(--ia-bg-card)' : undefined }}
                  onClick={() => toggleQuestion(q.canonical.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className="ia-badge ia-badge-info font-mono"
                        style={{ fontSize: '11px' }}
                      >
                        F{idx + 1}
                      </span>
                      {q.canonical.guide_question_id ? (
                        <span className="ia-badge ia-badge-positive" style={{ fontSize: '10px' }}>{t('badge_guide', lang)}</span>
                      ) : hasAnyGuideQuestion ? (
                        <span className="ia-badge ia-badge-ambivalent" style={{ fontSize: '10px' }}>{t('badge_additional', lang)}</span>
                      ) : null}
                      {q.canonical.topic_area && (
                        <span className="ia-badge ia-badge-neutral">{q.canonical.topic_area}</span>
                      )}
                    </div>
                    <h3 className="font-semibold text-sm" style={{ color: 'var(--ia-text)' }}>
                      {pickLang(q.canonical.canonical_text, q.canonical.canonical_text_alt, lang, projectLanguage)}
                    </h3>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0 pt-1">
                    <div className="text-right">
                      <span className="text-xs ia-data font-semibold" style={{ color: 'var(--ia-text)' }}>
                        {q.answers.length}/{q.total_interviews}
                      </span>
                      <span className="text-[10px] ml-1" style={{ color: 'var(--ia-text-tertiary)' }}>
                        ({coverage}%)
                      </span>
                    </div>
                    {/* Coverage bar */}
                    <div
                      className="w-20 h-1.5 rounded-full overflow-hidden"
                      style={{ background: 'var(--ia-bg-muted)' }}
                    >
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${coverage}%`,
                          background: coverage === 100
                            ? 'var(--ia-success)'
                            : 'linear-gradient(90deg, var(--ia-accent), var(--ia-accent-muted))',
                        }}
                      />
                    </div>
                    <svg
                      width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                      style={{
                        color: 'var(--ia-text-tertiary)',
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease',
                      }}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </button>

                {/* Compact Summary (when collapsed) */}
                {!isExpanded && q.answers.length > 0 && (() => {
                  const sc: Record<string, number> = { positive: 0, negative: 0, neutral: 0, ambivalent: 0 };
                  let totalWords = 0;
                  for (const a of q.answers) {
                    sc[a.sentiment ?? 'neutral']++;
                    totalWords += a.word_count ?? 0;
                  }
                  const total = q.answers.length;
                  const avgWords = Math.round(totalWords / total);
                  return (
                    <div className="px-5 pb-3 flex items-center gap-3" style={{ marginTop: -8 }}>
                      {/* Sentiment mini bar */}
                      <div className="flex rounded-full overflow-hidden" style={{ width: 120, height: 6 }}>
                        {(['positive', 'neutral', 'ambivalent', 'negative'] as const).map(s => {
                          const pct = (sc[s] / total) * 100;
                          if (pct === 0) return null;
                          const colors: Record<string, string> = { positive: 'var(--ia-success)', negative: 'var(--ia-error)', neutral: 'var(--ia-text-tertiary)', ambivalent: 'var(--ia-warning)' };
                          return <div key={s} style={{ width: `${pct}%`, background: colors[s] }} />;
                        })}
                      </div>
                      <span className="text-[11px] ia-data" style={{ color: 'var(--ia-text-tertiary)' }}>
                        {total} {t('answers', lang)}
                      </span>
                      <span className="text-[11px] ia-data" style={{ color: 'var(--ia-text-tertiary)' }}>
                        {t('matrix_avg_words', lang)}: {avgWords}
                      </span>
                    </div>
                  );
                })()}

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="px-5 pb-5 space-y-4">
                    {/* Divider */}
                    <div style={{ borderTop: '1px solid var(--ia-border)' }} />

                    {/* Mapped Questions Section */}
                    {q.mappings.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--ia-text-tertiary)' }}>
                            <path d="M16 3h5v5" /><path d="M8 3H3v5" /><path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3" /><path d="m15 9 6-6" />
                          </svg>
                          <span className="text-xs font-semibold" style={{ color: 'var(--ia-text-secondary)' }}>
                            {t('matrix_mapped_questions', lang)} ({q.mappings.length})
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {q.mappings.map(m => {
                            const interviewName = interviewNameMap.get(m.ia_questions?.interview_id) ?? t('unknown', lang);
                            const isReassigningThis = reassigning === m.id;

                            return (
                              <div key={m.id} className="flex items-start gap-2 group">
                                <div
                                  className="flex-1 text-xs px-2.5 py-1.5 rounded-md"
                                  style={{ background: 'var(--ia-bg-muted)', color: 'var(--ia-text-secondary)' }}
                                >
                                  <span className="font-medium" style={{ color: 'var(--ia-text)' }}>
                                    {interviewName}:
                                  </span>{' '}
                                  &quot;{m.ia_questions?.original_text ?? m.question_id}&quot;
                                  {m.similarity != null && (
                                    <span className="ml-1.5 ia-data" style={{ color: 'var(--ia-text-tertiary)', fontSize: '10px' }}>
                                      {Math.round(m.similarity * 100)}%
                                    </span>
                                  )}
                                </div>

                                {isReassigningThis ? (
                                  <div className="flex items-center gap-1.5 flex-shrink-0">
                                    <select
                                      className="ia-select"
                                      style={{ fontSize: '11px', height: '28px', maxWidth: '220px' }}
                                      defaultValue=""
                                      disabled={actionLoading}
                                      onChange={(e) => {
                                        if (e.target.value) handleReassign(m.id, e.target.value);
                                      }}
                                    >
                                      <option value="" disabled>{t('matrix_select_target', lang)}</option>
                                      {questions
                                        .filter(other => other.canonical.id !== q.canonical.id)
                                        .map((other, oIdx) => (
                                          <option key={other.canonical.id} value={other.canonical.id}>
                                            F{questions.indexOf(other) + 1}: {other.canonical.canonical_text.slice(0, 50)}
                                            {other.canonical.canonical_text.length > 50 ? '...' : ''}
                                          </option>
                                        ))
                                      }
                                    </select>
                                    <button
                                      className="ia-btn ia-btn-ghost ia-btn-sm"
                                      style={{ fontSize: '10px', padding: '2px 6px' }}
                                      onClick={() => setReassigning(null)}
                                    >
                                      {t('cancel', lang)}
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    className="ia-btn ia-btn-ghost ia-btn-sm opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                                    style={{ fontSize: '10px', padding: '2px 8px' }}
                                    onClick={() => setReassigning(m.id)}
                                    title={t('matrix_move_tooltip', lang)}
                                  >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
                                    </svg>
                                    {t('matrix_move', lang)}
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Merge Button */}
                        {merging === q.canonical.id ? (
                          <div className="flex items-center gap-2 mt-2">
                            <select
                              className="ia-select"
                              style={{ fontSize: '11px', height: '28px', flex: 1 }}
                              defaultValue=""
                              disabled={actionLoading}
                              onChange={(e) => {
                                if (e.target.value) handleMerge(q.canonical.id, e.target.value);
                              }}
                            >
                              <option value="" disabled>{t('matrix_merge_with', lang)}</option>
                              {questions
                                .filter(other => other.canonical.id !== q.canonical.id)
                                .map((other) => (
                                  <option key={other.canonical.id} value={other.canonical.id}>
                                    F{questions.indexOf(other) + 1}: {other.canonical.canonical_text.slice(0, 60)}
                                    {other.canonical.canonical_text.length > 60 ? '...' : ''}
                                    {` (${other.mappings.length} ${t('matrix_mappings_count', lang)}, ${other.answers.length} ${t('answers', lang)})`}
                                  </option>
                                ))
                              }
                            </select>
                            <button
                              className="ia-btn ia-btn-ghost ia-btn-sm"
                              style={{ fontSize: '10px' }}
                              onClick={() => setMerging(null)}
                            >
                              {t('cancel', lang)}
                            </button>
                          </div>
                        ) : (
                          <button
                            className="ia-btn ia-btn-ghost ia-btn-sm mt-2"
                            style={{ fontSize: '11px' }}
                            onClick={() => setMerging(q.canonical.id)}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                              <polyline points="15 3 21 3 21 9" />
                              <line x1="10" y1="14" x2="21" y2="3" />
                            </svg>
                            {t('matrix_merge_button', lang)}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Answer Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {q.answers.map((answer) => (
                        <AnswerCard
                          key={answer.id}
                          interviewName={answer.interview_name}
                          answerText={answer.answer_text}
                          sentiment={answer.sentiment}
                          wordCount={answer.word_count}
                          confidence={answer.confidence}
                          matchType={answer.match_type}
                          originalQuestionText={answer.original_question_text}
                          followUps={answer.follow_ups}
                        />
                      ))}
                    </div>

                    {/* AI Summary */}
                    {q.summary ? (
                      <div className="ia-summary">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--ia-accent)' }}>
                              <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
                            </svg>
                            <span className="text-xs font-semibold" style={{ color: 'var(--ia-accent)' }}>
                              {t('matrix_summary_title', lang)}
                            </span>
                          </div>
                          <button
                            className="ia-btn ia-btn-ghost ia-btn-sm"
                            onClick={() => handleGenerateSummary(q.canonical.id)}
                            disabled={generatingSummary === q.canonical.id}
                          >
                            {generatingSummary === q.canonical.id ? (
                              <span className="ia-spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
                            ) : t('matrix_summary_regenerate', lang)}
                          </button>
                        </div>
                        <p className="text-[13px] leading-relaxed" style={{ color: 'var(--ia-text-secondary)' }}>
                          {pickLang(q.summary.summary_text, q.summary.summary_text_alt, lang, projectLanguage)}
                        </p>
                      </div>
                    ) : (
                      <button
                        className="ia-btn ia-btn-secondary w-full"
                        onClick={() => handleGenerateSummary(q.canonical.id)}
                        disabled={generatingSummary === q.canonical.id}
                      >
                        {generatingSummary === q.canonical.id ? (
                          <>
                            <span className="ia-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                            {t('matrix_summary_generating', lang)}
                          </>
                        ) : (
                          <>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
                            </svg>
                            {t('matrix_summary_generate', lang)}
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
