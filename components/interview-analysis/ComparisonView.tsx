'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import type { MatrixQuestion, IAInterview, IAComparisonSummary } from '@/types/interview-analysis';
import { useIALang, t, pickLang, type IALang } from '@/lib/interview-analysis/i18n';

type SummaryState = 'idle' | 'loading' | 'loaded' | 'error';

interface ComparisonViewProps {
  questions: MatrixQuestion[];
  interviews: IAInterview[];
  projectLanguage: string;
  projectId: string;
}

const SENTIMENT_COLORS: Record<string, string> = {
  positive: 'var(--ia-success)',
  negative: 'var(--ia-error)',
  neutral: 'var(--ia-text-tertiary)',
  ambivalent: 'var(--ia-warning)',
};

const SENTIMENT_KEYS: Record<string, string> = {
  positive: 'positive',
  negative: 'negative',
  neutral: 'neutral',
  ambivalent: 'ambivalent',
};

export default function ComparisonView({ questions, interviews, projectLanguage, projectId }: ComparisonViewProps) {
  const lang = useIALang();
  const analyzedInterviews = useMemo(
    () => interviews.filter(i => ['transcribed', 'analyzed'].includes(i.status)),
    [interviews]
  );

  const [leftId, setLeftId] = useState<string>(analyzedInterviews[0]?.id ?? '');
  const [rightId, setRightId] = useState<string>(analyzedInterviews[1]?.id ?? analyzedInterviews[0]?.id ?? '');
  const [showOnlyDiffs, setShowOnlyDiffs] = useState(false);

  // AI Summary state
  const [summaryState, setSummaryState] = useState<SummaryState>('idle');
  const [summary, setSummary] = useState<IAComparisonSummary | null>(null);
  const [summaryAlt, setSummaryAlt] = useState<IAComparisonSummary | null>(null);
  const [summaryError, setSummaryError] = useState('');
  const [summaryPairKey, setSummaryPairKey] = useState('');

  useEffect(() => {
    setLeftId(analyzedInterviews[0]?.id ?? '');
    setRightId(analyzedInterviews[1]?.id ?? analyzedInterviews[0]?.id ?? '');
  }, [analyzedInterviews]);

  // Reset summary when pair changes
  const currentPairKey = useMemo(() => [leftId, rightId].sort().join('|'), [leftId, rightId]);
  useEffect(() => {
    if (currentPairKey !== summaryPairKey) {
      setSummaryState('idle');
      setSummary(null);
      setSummaryAlt(null);
      setSummaryError('');
    }
  }, [currentPairKey, summaryPairKey]);

  const fetchSummary = useCallback(async (force = false) => {
    if (leftId === rightId) return;
    setSummaryState('loading');
    setSummaryError('');
    try {
      const res = await fetch(`/api/interview-analysis/projects/${projectId}/compare-interviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interviewAId: leftId, interviewBId: rightId, force }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Request failed');
      }
      const data = await res.json();
      setSummary(data.summary);
      setSummaryAlt(data.summary_alt ?? null);
      setSummaryPairKey(currentPairKey);
      setSummaryState('loaded');
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : 'Unknown error');
      setSummaryState('error');
    }
  }, [leftId, rightId, projectId, currentPairKey]);

  // Build answer lookups
  const answersByInterview = useMemo(() => {
    const map = new Map<string, Map<string, { text: string; sentiment: string; wordCount: number }>>();
    for (const interview of analyzedInterviews) {
      map.set(interview.id, new Map());
    }
    for (const q of questions) {
      for (const a of q.answers) {
        const iMap = map.get(a.interview_id);
        if (iMap) {
          iMap.set(q.canonical.id, {
            text: a.answer_text,
            sentiment: a.sentiment ?? 'neutral',
            wordCount: a.word_count ?? 0,
          });
        }
      }
    }
    return map;
  }, [questions, analyzedInterviews]);

  const leftAnswers = answersByInterview.get(leftId);
  const rightAnswers = answersByInterview.get(rightId);
  const leftInterview = analyzedInterviews.find(i => i.id === leftId);
  const rightInterview = analyzedInterviews.find(i => i.id === rightId);

  // Stats
  const leftStats = useMemo(() => {
    if (!leftAnswers) return { total: 0, words: 0, sentiments: {} as Record<string, number> };
    const sentiments: Record<string, number> = {};
    let words = 0;
    for (const a of leftAnswers.values()) {
      sentiments[a.sentiment] = (sentiments[a.sentiment] || 0) + 1;
      words += a.wordCount;
    }
    return { total: leftAnswers.size, words, sentiments };
  }, [leftAnswers]);

  const rightStats = useMemo(() => {
    if (!rightAnswers) return { total: 0, words: 0, sentiments: {} as Record<string, number> };
    const sentiments: Record<string, number> = {};
    let words = 0;
    for (const a of rightAnswers.values()) {
      sentiments[a.sentiment] = (sentiments[a.sentiment] || 0) + 1;
      words += a.wordCount;
    }
    return { total: rightAnswers.size, words, sentiments };
  }, [rightAnswers]);

  // Filtered questions
  const displayQuestions = useMemo(() => {
    if (!showOnlyDiffs) return questions;
    return questions.filter(q => {
      const lA = leftAnswers?.get(q.canonical.id);
      const rA = rightAnswers?.get(q.canonical.id);
      // Show if sentiment differs or one side is missing
      if (!lA && !rA) return false;
      if (!lA || !rA) return true;
      return lA.sentiment !== rA.sentiment;
    });
  }, [questions, leftAnswers, rightAnswers, showOnlyDiffs]);

  if (analyzedInterviews.length < 2) {
    return (
      <div className="ia-card ia-empty">
        <svg className="ia-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="2" y="3" width="8" height="18" rx="1" /><rect x="14" y="3" width="8" height="18" rx="1" />
        </svg>
        <p className="text-sm" style={{ color: 'var(--ia-text-secondary)' }}>
          {t('comparison_min2', lang)}
        </p>
      </div>
    );
  }

  function swapInterviews() {
    setLeftId(rightId);
    setRightId(leftId);
  }

  return (
    <div className="space-y-5">
      {/* Selector Row */}
      <div className="ia-filter-bar">
          <div className="flex-1 min-w-[180px]">
            <label className="text-[10px] font-semibold mb-1 block" style={{ color: 'var(--ia-text-tertiary)' }}>
              {t('comparison_a', lang)}
            </label>
            <select
              className="ia-select w-full"
              value={leftId}
              onChange={e => setLeftId(e.target.value)}
            >
              {analyzedInterviews.map(i => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>
          </div>

          <button
            className="ia-btn ia-btn-ghost mt-4"
            onClick={swapInterviews}
            title={t('comparison_swap', lang)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </button>

          <div className="flex-1 min-w-[180px]">
            <label className="text-[10px] font-semibold mb-1 block" style={{ color: 'var(--ia-text-tertiary)' }}>
              {t('comparison_b', lang)}
            </label>
            <select
              className="ia-select w-full"
              value={rightId}
              onChange={e => setRightId(e.target.value)}
            >
              {analyzedInterviews.map(i => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 mt-4">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showOnlyDiffs}
                onChange={e => setShowOnlyDiffs(e.target.checked)}
                style={{ accentColor: 'var(--ia-accent)' }}
              />
              <span className="text-xs" style={{ color: 'var(--ia-text-secondary)' }}>
                {t('comparison_only_diff', lang)}
              </span>
            </label>
          </div>
      </div>

      {/* Comparison Stats */}
      {leftId !== rightId && (
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            name={leftInterview?.name ?? ''}
            answered={leftStats.total}
            totalQuestions={questions.length}
            words={leftStats.words}
            sentiments={leftStats.sentiments}
            color="var(--ia-accent)"
            lang={lang}
          />
          <StatCard
            name={rightInterview?.name ?? ''}
            answered={rightStats.total}
            totalQuestions={questions.length}
            words={rightStats.words}
            sentiments={rightStats.sentiments}
            color="#8B5CF6"
            lang={lang}
          />
        </div>
      )}

      {/* AI Comparison Summary */}
      {leftId !== rightId && (() => {
        // API normalizes IDs (a < b), so stances may be swapped relative to left/right
        const swapped = leftId > rightId;
        return (
          <AISummarySection
            summaryState={summaryState}
            summary={summary}
            summaryAlt={summaryAlt}
            summaryError={summaryError}
            onGenerate={() => fetchSummary(false)}
            onRegenerate={() => fetchSummary(true)}
            leftName={leftInterview?.name ?? ''}
            rightName={rightInterview?.name ?? ''}
            swapStances={swapped}
            lang={lang}
            projectLanguage={projectLanguage}
          />
        );
      })()}

      {/* Question-by-Question Comparison */}
      {leftId === rightId ? (
        <div className="ia-card p-6 text-center">
          <p className="text-sm" style={{ color: 'var(--ia-text-secondary)' }}>
            {t('comparison_select_different', lang)}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayQuestions.length === 0 && showOnlyDiffs && (
            <div className="ia-card p-6 text-center">
              <p className="text-sm" style={{ color: 'var(--ia-text-secondary)' }}>
                {t('comparison_no_diff', lang)}
              </p>
            </div>
          )}
          {displayQuestions.map((q, idx) => {
            const qIdx = questions.indexOf(q);
            const lA = leftAnswers?.get(q.canonical.id);
            const rA = rightAnswers?.get(q.canonical.id);
            const hasDiff = lA?.sentiment !== rA?.sentiment || (!lA !== !rA);

            return (
              <div
                key={q.canonical.id}
                className="ia-card"
                style={{
                  borderLeft: hasDiff ? '3px solid var(--ia-warning)' : '3px solid transparent',
                }}
              >
                {/* Question Header */}
                <div
                  className="px-5 py-3 flex items-center gap-2"
                  style={{ borderBottom: '1px solid var(--ia-border)' }}
                >
                  <span
                    className="text-[10px] font-mono ia-data"
                    style={{
                      color: 'var(--ia-text-tertiary)',
                      background: 'var(--ia-bg-muted)',
                      padding: '2px 6px',
                      borderRadius: 4,
                    }}
                  >
                    F{qIdx + 1}
                  </span>
                  <span className="text-xs font-medium" style={{ color: 'var(--ia-text)' }}>
                    {pickLang(q.canonical.canonical_text, q.canonical.canonical_text_alt, lang, projectLanguage)}
                  </span>
                  {q.canonical.topic_area && (
                    <span className="ia-badge ia-badge-info text-[10px] ml-auto flex-shrink-0">
                      {q.canonical.topic_area}
                    </span>
                  )}
                </div>

                {/* Side-by-side Answers */}
                <div className="grid grid-cols-2 divide-x" style={{ borderColor: 'var(--ia-border)' }}>
                  <AnswerCell answer={lA} interviewName={leftInterview?.name ?? ''} side="left" lang={lang} />
                  <AnswerCell answer={rA} interviewName={rightInterview?.name ?? ''} side="right" lang={lang} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AnswerCell({
  answer,
  interviewName,
  side,
  lang,
}: {
  answer: { text: string; sentiment: string; wordCount: number } | undefined;
  interviewName: string;
  side: 'left' | 'right';
  lang: IALang;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!answer) {
    return (
      <div className="p-4 flex items-center justify-center" style={{ minHeight: 60 }}>
        <span className="text-[11px] italic" style={{ color: 'var(--ia-text-tertiary)' }}>
          {t('no_answer', lang)}
        </span>
      </div>
    );
  }

  const isLong = answer.text.length > 200;

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-2">
        <span
          className="ia-badge text-[10px]"
          style={{
            background: (SENTIMENT_COLORS[answer.sentiment] ?? SENTIMENT_COLORS.neutral) + '20',
            color: SENTIMENT_COLORS[answer.sentiment] ?? SENTIMENT_COLORS.neutral,
          }}
        >
          {t(SENTIMENT_KEYS[answer.sentiment] ?? answer.sentiment, lang)}
        </span>
        <span className="text-[10px] ia-data" style={{ color: 'var(--ia-text-tertiary)' }}>
          {answer.wordCount} {t('words', lang)}
        </span>
      </div>
      <p
        className="ia-answer-card-text"
        style={{
          ...(!expanded && isLong
            ? { display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }
            : {}),
        }}
      >
        {answer.text}
      </p>
      {isLong && (
        <button
          className="text-[11px] mt-1 font-medium ia-text-accent"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? t('comparison_less', lang) : t('show_more', lang)}
        </button>
      )}
    </div>
  );
}

function AISummarySection({
  summaryState,
  summary,
  summaryAlt,
  summaryError,
  onGenerate,
  onRegenerate,
  leftName,
  rightName,
  swapStances,
  lang,
  projectLanguage,
}: {
  summaryState: SummaryState;
  summary: IAComparisonSummary | null;
  summaryAlt: IAComparisonSummary | null;
  summaryError: string;
  onGenerate: () => void;
  onRegenerate: () => void;
  leftName: string;
  rightName: string;
  swapStances: boolean;
  lang: IALang;
  projectLanguage: string;
}) {
  const displaySummary = useMemo(() => {
    if (!summary && !summaryAlt) return null;
    const isAltLang = (lang === 'en' && projectLanguage !== 'en') || (lang === 'de' && projectLanguage !== 'de');
    return (isAltLang && summaryAlt) ? summaryAlt : summary;
  }, [summary, summaryAlt, lang, projectLanguage]);

  if (summaryState === 'idle') {
    return (
      <div className="ia-card p-5 text-center">
        <button className="ia-btn ia-btn-primary" onClick={onGenerate}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
          </svg>
          {t('comparison_ai_generate', lang)}
        </button>
      </div>
    );
  }

  if (summaryState === 'loading') {
    return (
      <div className="ia-card p-6 text-center space-y-3">
        <span className="ia-spinner" style={{ width: 24, height: 24, borderWidth: 3 }} />
        <p className="text-sm" style={{ color: 'var(--ia-text-secondary)' }}>
          {t('comparison_ai_generating', lang)}
        </p>
      </div>
    );
  }

  if (summaryState === 'error') {
    return (
      <div className="ia-card p-5 space-y-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'var(--ia-error-light)', color: 'var(--ia-error)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          <span className="text-xs font-medium">{t('comparison_ai_error', lang)}</span>
        </div>
        {summaryError && (
          <p className="text-[11px]" style={{ color: 'var(--ia-text-tertiary)' }}>{summaryError}</p>
        )}
        <button className="ia-btn ia-btn-ghost ia-btn-sm" onClick={onGenerate}>
          {t('comparison_ai_regenerate', lang)}
        </button>
      </div>
    );
  }

  if (!displaySummary) return null;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="ia-section-header">
        <h3 className="ia-section-title">
          {t('comparison_ai_title', lang)}
        </h3>
        <button className="ia-btn ia-btn-ghost ia-btn-sm" onClick={onRegenerate}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          {t('comparison_ai_regenerate', lang)}
        </button>
      </div>

      {/* Overall Summary */}
      {displaySummary.overall_summary && (
        <div
          className="ia-card p-4"
          style={{ borderLeft: '3px solid var(--ia-accent)', background: 'var(--ia-accent-light)' }}
        >
          <div className="text-[10px] font-semibold mb-1.5" style={{ color: 'var(--ia-accent)' }}>
            {t('comparison_overall', lang)}
          </div>
          <p className="text-[13px] leading-relaxed" style={{ color: 'var(--ia-text)' }}>
            {displaySummary.overall_summary}
          </p>
        </div>
      )}

      {/* Key Differences */}
      {displaySummary.key_differences?.length > 0 && (
        <div className="ia-card overflow-hidden">
          <div className="px-4 py-2.5" style={{ borderBottom: '1px solid var(--ia-border)' }}>
            <span className="text-[11px] font-semibold" style={{ color: 'var(--ia-text)' }}>
              {t('comparison_key_diff', lang)}
            </span>
            <span className="ia-badge ia-badge-neutral text-[10px] ml-2">{displaySummary.key_differences.length}</span>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--ia-border-light)' }}>
            {displaySummary.key_differences.map((diff, i) => (
              <div key={i} className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="ia-badge ia-badge-warning text-[10px]">{diff.topic}</span>
                </div>
                <p className="text-[12px] leading-relaxed" style={{ color: 'var(--ia-text-secondary)' }}>
                  {diff.description}
                </p>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div className="p-2.5 rounded-lg" style={{ background: 'var(--ia-bg-muted)' }}>
                    <div className="text-[10px] font-semibold mb-1" style={{ color: 'var(--ia-accent)' }}>
                      {leftName}
                    </div>
                    <p className="text-[11px] leading-relaxed" style={{ color: 'var(--ia-text-secondary)' }}>
                      {swapStances ? diff.interview_b_stance : diff.interview_a_stance}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg" style={{ background: 'var(--ia-bg-muted)' }}>
                    <div className="text-[10px] font-semibold mb-1" style={{ color: '#8B5CF6' }}>
                      {rightName}
                    </div>
                    <p className="text-[11px] leading-relaxed" style={{ color: 'var(--ia-text-secondary)' }}>
                      {swapStances ? diff.interview_a_stance : diff.interview_b_stance}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Similarities */}
      {displaySummary.similarities?.length > 0 && (
        <div className="ia-card overflow-hidden">
          <div className="px-4 py-2.5" style={{ borderBottom: '1px solid var(--ia-border)' }}>
            <span className="text-[11px] font-semibold" style={{ color: 'var(--ia-text)' }}>
              {t('comparison_similarities', lang)}
            </span>
            <span className="ia-badge ia-badge-neutral text-[10px] ml-2">{displaySummary.similarities.length}</span>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--ia-border-light)' }}>
            {displaySummary.similarities.map((sim, i) => (
              <div key={i} className="px-4 py-3">
                <span className="ia-badge ia-badge-positive text-[10px] mb-1.5">{sim.topic}</span>
                <p className="text-[12px] leading-relaxed mt-1" style={{ color: 'var(--ia-text-secondary)' }}>
                  {sim.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notable Patterns */}
      {displaySummary.notable_patterns?.length > 0 && (
        <div className="ia-card p-4">
          <div className="text-[11px] font-semibold mb-2" style={{ color: 'var(--ia-text)' }}>
            {t('comparison_patterns', lang)}
          </div>
          <ul className="space-y-1.5">
            {displaySummary.notable_patterns.map((pattern, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-[10px] mt-0.5" style={{ color: 'var(--ia-accent)' }}>&#9679;</span>
                <span className="text-[12px] leading-relaxed" style={{ color: 'var(--ia-text-secondary)' }}>
                  {pattern}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StatCard({
  name,
  answered,
  totalQuestions,
  words,
  sentiments,
  color,
  lang,
}: {
  name: string;
  answered: number;
  totalQuestions: number;
  words: number;
  sentiments: Record<string, number>;
  color: string;
  lang: IALang;
}) {
  const coveragePct = totalQuestions > 0 ? Math.round((answered / totalQuestions) * 100) : 0;
  const totalSentiments = Object.values(sentiments).reduce((a, b) => a + b, 0);

  return (
    <div className="ia-stat-card" style={{ borderTop: `3px solid ${color}` }}>
      <div className="text-xs font-semibold truncate" style={{ color: 'var(--ia-text)' }} title={name}>
        {name}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <div className="ia-stat-label">{t('comparison_coverage', lang)}</div>
          <div className="ia-stat-value" style={{ fontSize: 14 }}>
            {coveragePct}%
          </div>
        </div>
        <div>
          <div className="ia-stat-label">{t('answers', lang)}</div>
          <div className="ia-stat-value" style={{ fontSize: 14 }}>
            {answered}
          </div>
        </div>
        <div>
          <div className="ia-stat-label">{t('words', lang)}</div>
          <div className="ia-stat-value" style={{ fontSize: 14 }}>
            {words.toLocaleString('de-DE')}
          </div>
        </div>
      </div>
      {/* Mini sentiment bars */}
      {totalSentiments > 0 && (
        <div className="ia-progress flex" style={{ height: 8 }}>
          {Object.entries(SENTIMENT_COLORS).map(([key, c]) => {
            const count = sentiments[key] || 0;
            if (!count) return null;
            return (
              <div
                key={key}
                className="ia-progress-fill"
                style={{ width: `${(count / totalSentiments) * 100}%`, background: c, opacity: 0.8 }}
                title={`${t(SENTIMENT_KEYS[key] ?? key, lang)}: ${count}`}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
