'use client';

import { useState, useMemo, useEffect } from 'react';
import type { MatrixQuestion, IAInterview } from '@/types/interview-analysis';
import { useIALang, t, type IALang } from '@/lib/interview-analysis/i18n';

interface ComparisonViewProps {
  questions: MatrixQuestion[];
  interviews: IAInterview[];
}

const SENTIMENT_COLORS: Record<string, string> = {
  positive: '#22C55E',
  negative: '#EF4444',
  neutral: '#94A3B8',
  ambivalent: '#F59E0B',
};

const SENTIMENT_KEYS: Record<string, string> = {
  positive: 'positive',
  negative: 'negative',
  neutral: 'neutral',
  ambivalent: 'ambivalent',
};

export default function ComparisonView({ questions, interviews }: ComparisonViewProps) {
  const lang = useIALang();
  const analyzedInterviews = useMemo(
    () => interviews.filter(i => ['transcribed', 'analyzed'].includes(i.status)),
    [interviews]
  );

  const [leftId, setLeftId] = useState<string>(analyzedInterviews[0]?.id ?? '');
  const [rightId, setRightId] = useState<string>(analyzedInterviews[1]?.id ?? analyzedInterviews[0]?.id ?? '');
  const [showOnlyDiffs, setShowOnlyDiffs] = useState(false);

  useEffect(() => {
    setLeftId(analyzedInterviews[0]?.id ?? '');
    setRightId(analyzedInterviews[1]?.id ?? analyzedInterviews[0]?.id ?? '');
  }, [analyzedInterviews]);

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
      <div className="ia-card p-4">
        <div className="flex items-center gap-3 flex-wrap">
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
                  borderLeft: hasDiff ? '3px solid #F59E0B' : '3px solid transparent',
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
                    {q.canonical.canonical_text}
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
        className="text-[12px] leading-relaxed"
        style={{
          color: 'var(--ia-text-secondary)',
          ...(!expanded && isLong
            ? { display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }
            : {}),
        }}
      >
        {answer.text}
      </p>
      {isLong && (
        <button
          className="text-[11px] mt-1 font-medium"
          style={{ color: 'var(--ia-accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? t('comparison_less', lang) : t('show_more', lang)}
        </button>
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
    <div className="ia-card p-4" style={{ borderTop: `3px solid ${color}` }}>
      <div className="text-xs font-semibold truncate mb-3" style={{ color: 'var(--ia-text)' }} title={name}>
        {name}
      </div>
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div>
          <div className="text-[10px]" style={{ color: 'var(--ia-text-tertiary)' }}>{t('comparison_coverage', lang)}</div>
          <div className="text-sm font-semibold ia-data" style={{ color: 'var(--ia-text)' }}>
            {coveragePct}%
          </div>
        </div>
        <div>
          <div className="text-[10px]" style={{ color: 'var(--ia-text-tertiary)' }}>{t('answers', lang)}</div>
          <div className="text-sm font-semibold ia-data" style={{ color: 'var(--ia-text)' }}>
            {answered}
          </div>
        </div>
        <div>
          <div className="text-[10px]" style={{ color: 'var(--ia-text-tertiary)' }}>{t('words', lang)}</div>
          <div className="text-sm font-semibold ia-data" style={{ color: 'var(--ia-text)' }}>
            {words.toLocaleString('de-DE')}
          </div>
        </div>
      </div>
      {/* Mini sentiment bars */}
      {totalSentiments > 0 && (
        <div className="flex h-2 rounded-full overflow-hidden" style={{ background: 'var(--ia-bg-muted)' }}>
          {Object.entries(SENTIMENT_COLORS).map(([key, c]) => {
            const count = sentiments[key] || 0;
            if (!count) return null;
            return (
              <div
                key={key}
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
