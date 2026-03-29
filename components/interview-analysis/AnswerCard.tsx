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
  codeBadges?: Array<{ name: string; color: string }>;
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
  codeBadges,
}: AnswerCardProps) {
  const lang = useIALang();
  const [expanded, setExpanded] = useState(false);

  const config = SENTIMENT_CONFIG[sentiment ?? 'neutral'];
  const truncateLength = 200;
  const needsTruncation = answerText.length > truncateLength;

  return (
    <div
      className="ia-answer-card"
      style={{ borderColor: expanded ? 'var(--ia-border-strong)' : undefined }}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Sentiment bar */}
      <div className="ia-sentiment-bar" style={{ background: config.barColor }} />

      {/* Header */}
      <div className="ia-answer-card-header">
        <span className="ia-answer-card-name">{interviewName}</span>
        <div className="ia-answer-card-badges">
          {matchType && (
            <span className="ia-badge ia-badge-neutral" style={{ fontSize: '10px' }}>
              {t('match_' + matchType, lang)}
            </span>
          )}
          {confidence && (
            <span
              className="ia-status-dot"
              style={{ background: CONFIDENCE_COLORS[confidence] ?? 'var(--ia-border)' }}
              title={t('confidence_' + confidence, lang)}
            />
          )}
          <span className={`ia-badge ${config.className}`}>{t(sentiment ?? 'neutral', lang)}</span>
        </div>
      </div>

      {/* Original question from transcript */}
      {originalQuestionText && (
        <p className="text-[11px] italic mb-2 pl-1" style={{ color: 'var(--ia-text-tertiary)' }}>
          {t('original_question', lang)}: &quot;{originalQuestionText}&quot;
        </p>
      )}

      {/* Answer Text */}
      <div className="ia-answer-card-text">
        {expanded || !needsTruncation
          ? answerText
          : `${answerText.slice(0, truncateLength)}...`}
      </div>

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

      {/* Code badges */}
      {codeBadges && codeBadges.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2.5 pl-1">
          {codeBadges.map((badge, i) => (
            <span
              key={i}
              className="ia-badge"
              style={{ fontSize: '10px', backgroundColor: `${badge.color}20`, color: badge.color, border: `1px solid ${badge.color}40` }}
            >
              {badge.name}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="ia-answer-card-footer">
        <span className="text-[11px] ia-data" style={{ color: 'var(--ia-text-tertiary)' }}>
          {wordCount != null ? wordCount.toLocaleString() : '–'} {t('words', lang)}
        </span>
        {needsTruncation && (
          <span className="text-[11px] font-medium ia-text-accent">
            {expanded ? t('show_less', lang) : t('show_more', lang)}
          </span>
        )}
      </div>
    </div>
  );
}
