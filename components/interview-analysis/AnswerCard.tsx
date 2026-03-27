'use client';

import { useState } from 'react';
import type { Sentiment, AnswerConfidence, AnswerMatchType } from '@/types/interview-analysis';
import { useIALang, t } from '@/lib/interview-analysis/i18n';

interface AnswerCardProps {
  interviewName: string;
  answerText: string;
  sentiment: Sentiment | null;
  wordCount: number | null;
  confidence: AnswerConfidence | null;
  matchType: AnswerMatchType | null;
  originalQuestionText: string | null;
  followUps: Array<{ question: string; answer: string }>;
}

const SENTIMENT_CONFIG: Record<string, { className: string; barColor: string }> = {
  positive: { className: 'ia-badge-positive', barColor: 'var(--ia-success)' },
  negative: { className: 'ia-badge-negative', barColor: 'var(--ia-error)' },
  ambivalent: { className: 'ia-badge-ambivalent', barColor: 'var(--ia-warning)' },
  neutral: { className: 'ia-badge-neutral', barColor: 'var(--ia-border)' },
};

const CONFIDENCE_COLORS: Record<string, string> = {
  high: 'var(--ia-success)',
  medium: 'var(--ia-warning)',
  low: 'var(--ia-error)',
};

export default function AnswerCard({
  interviewName,
  answerText,
  sentiment,
  wordCount,
  confidence,
  matchType,
  originalQuestionText,
  followUps,
}: AnswerCardProps) {
  const lang = useIALang();
  const [expanded, setExpanded] = useState(false);

  const config = SENTIMENT_CONFIG[sentiment ?? 'neutral'];
  const truncateLength = 200;
  const needsTruncation = answerText.length > truncateLength;

  return (
    <div
      className="ia-card-sm p-4 cursor-pointer transition-all relative overflow-hidden"
      style={{ borderColor: expanded ? 'var(--ia-border-strong)' : undefined }}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Sentiment bar */}
      <div className="ia-sentiment-bar" style={{ background: config.barColor }} />

      {/* Header */}
      <div className="flex items-center justify-between mb-2 pl-1">
        <span className="text-xs font-semibold" style={{ color: 'var(--ia-text)' }}>
          {interviewName}
        </span>
        <div className="flex items-center gap-1.5">
          {matchType && (
            <span className="ia-badge ia-badge-neutral" style={{ fontSize: '10px' }}>
              {t('match_' + matchType, lang)}
            </span>
          )}
          {confidence && (
            <span
              className="inline-block w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: CONFIDENCE_COLORS[confidence] ?? 'var(--ia-border)' }}
              title={`Confidence: ${confidence}`}
            />
          )}
          <span className={`ia-badge ${config.className}`}>{t(sentiment ?? 'neutral', lang)}</span>
        </div>
      </div>

      {/* Original question from transcript */}
      {originalQuestionText && (
        <div className="mb-2 pl-1">
          <p className="text-[11px] italic" style={{ color: 'var(--ia-text-tertiary)' }}>
            {t('original_question', lang)}: &quot;{originalQuestionText}&quot;
          </p>
        </div>
      )}

      {/* Answer Text */}
      <p className="text-[13px] leading-relaxed pl-1" style={{ color: 'var(--ia-text-secondary)' }}>
        {expanded || !needsTruncation
          ? answerText
          : `${answerText.slice(0, truncateLength)}...`}
      </p>

      {/* Follow-ups (expanded only) */}
      {expanded && followUps.length > 0 && (
        <div className="mt-3 space-y-2 ml-1 pl-3" style={{ borderLeft: '2px solid var(--ia-border)' }}>
          {followUps.map((fu, i) => (
            <div key={i}>
              <p className="text-[11px] font-medium" style={{ color: 'var(--ia-text-tertiary)' }}>
                {t('follow_up', lang)}: {fu.question}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--ia-text-secondary)' }}>
                {fu.answer}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-2 pl-1">
        <span className="text-[11px] ia-data" style={{ color: 'var(--ia-text-tertiary)' }}>
          {wordCount != null ? wordCount.toLocaleString() : '–'} {t('words', lang)}
        </span>
        {needsTruncation && (
          <span className="text-[11px] font-medium" style={{ color: 'var(--ia-accent)' }}>
            {expanded ? t('show_less', lang) : t('show_more', lang)}
          </span>
        )}
      </div>
    </div>
  );
}
