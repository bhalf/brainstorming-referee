'use client';

import React from 'react';
import type { MatrixQuestion, IAInterview } from '@/types/interview-analysis';
import { useIALang, t } from '@/lib/interview-analysis/i18n';

interface DashboardViewProps {
  questions: MatrixQuestion[];
  interviews: IAInterview[];
}

const SENTIMENT_COLORS: Record<string, string> = {
  positive: '#22C55E',
  negative: '#EF4444',
  neutral: '#94A3B8',
  ambivalent: '#F59E0B',
};

export default function DashboardView({ questions, interviews }: DashboardViewProps) {
  const lang = useIALang();
  const analyzedInterviews = interviews.filter(i => ['transcribed', 'analyzed'].includes(i.status));
  const allAnswers = questions.flatMap(q => q.answers);
  const totalWords = analyzedInterviews.reduce((sum, i) => sum + (i.word_count ?? 0), 0);
  const avgWords = analyzedInterviews.length > 0 ? Math.round(totalWords / analyzedInterviews.length) : 0;

  // Sentiment distribution across all answers
  const sentimentCounts: Record<string, number> = { positive: 0, negative: 0, neutral: 0, ambivalent: 0 };
  for (const a of allAnswers) {
    const s = a.sentiment ?? 'neutral';
    sentimentCounts[s] = (sentimentCounts[s] || 0) + 1;
  }
  const maxSentiment = Math.max(...Object.values(sentimentCounts), 1);

  // Coverage per question (sorted by coverage ascending = worst first)
  const coverageData = questions
    .map((q, idx) => ({
      label: `F${idx + 1}`,
      text: q.canonical.canonical_text,
      topic: q.canonical.topic_area,
      count: q.answers.length,
      total: q.total_interviews,
      pct: q.total_interviews > 0 ? Math.round((q.answers.length / q.total_interviews) * 100) : 0,
    }))
    .sort((a, b) => a.pct - b.pct);

  // Sentiment per question (stacked horizontal bars)
  const sentimentPerQuestion = questions.map((q, idx) => {
    const counts: Record<string, number> = { positive: 0, negative: 0, neutral: 0, ambivalent: 0 };
    for (const a of q.answers) {
      const s = a.sentiment ?? 'neutral';
      counts[s] = (counts[s] || 0) + 1;
    }
    return {
      label: `F${idx + 1}`,
      text: q.canonical.canonical_text,
      total: q.answers.length,
      ...counts,
    };
  });

  // Interview word counts
  const interviewStats = analyzedInterviews
    .map(i => ({ name: i.name, words: i.word_count ?? 0 }))
    .sort((a, b) => b.words - a.words);
  const maxInterviewWords = Math.max(...interviewStats.map(i => i.words), 1);

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard label={t('interviews', lang)} value={analyzedInterviews.length} icon="users" />
        <KPICard label={t('questions', lang)} value={questions.length} icon="help" />
        <KPICard label={t('answers', lang)} value={allAnswers.length} icon="message" />
        <KPICard label={t('dashboard_words_avg', lang)} value={avgWords.toLocaleString('de-DE')} sublabel={`${totalWords.toLocaleString('de-DE')} ${t('total', lang)}`} icon="text" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Sentiment Distribution */}
        <div className="ia-card p-5">
          <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--ia-text)' }}>
            {t('dashboard_sentiment_dist', lang)}
          </h3>
          <p className="text-xs mb-4" style={{ color: 'var(--ia-text-tertiary)' }}>
            {t('dashboard_over_all', lang)} {allAnswers.length} {t('answers', lang)}
          </p>
          <div className="space-y-3">
            {Object.entries(SENTIMENT_COLORS).map(([key, color]) => {
              const count = sentimentCounts[key] || 0;
              const pct = allAnswers.length > 0 ? Math.round((count / allAnswers.length) * 100) : 0;
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium" style={{ color: 'var(--ia-text-secondary)' }}>
                      {t(key, lang)}
                    </span>
                    <span className="text-xs ia-data" style={{ color: 'var(--ia-text)' }}>
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--ia-bg-muted)' }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${(count / maxSentiment) * 100}%`, background: color, opacity: 0.85 }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Coverage Overview */}
        <div className="ia-card p-5">
          <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--ia-text)' }}>
            {t('dashboard_coverage_title', lang)}
          </h3>
          <p className="text-xs mb-4" style={{ color: 'var(--ia-text-tertiary)' }}>
            {t('dashboard_coverage_desc', lang)}
          </p>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {coverageData.map(c => (
              <div key={c.label} className="group">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono w-6 text-right flex-shrink-0" style={{ color: 'var(--ia-text-tertiary)' }}>
                    {c.label}
                  </span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--ia-bg-muted)' }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${c.pct}%`,
                        background: c.pct === 100 ? '#22C55E' : c.pct >= 70 ? 'var(--ia-accent)' : c.pct >= 40 ? '#F59E0B' : '#EF4444',
                      }}
                    />
                  </div>
                  <span className="text-[10px] ia-data w-14 text-right flex-shrink-0" style={{ color: 'var(--ia-text-secondary)' }}>
                    {c.count}/{c.total}
                  </span>
                </div>
                <p className="text-[10px] ml-8 truncate opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--ia-text-tertiary)' }}>
                  {c.text}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Sentiment per Question (stacked bars) */}
        <div className="ia-card p-5">
          <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--ia-text)' }}>
            {t('dashboard_sentiment_q', lang)}
          </h3>
          <p className="text-xs mb-4" style={{ color: 'var(--ia-text-tertiary)' }}>
            {t('dashboard_sentiment_q_desc', lang)}
          </p>
          <div className="space-y-2.5 max-h-72 overflow-y-auto">
            {sentimentPerQuestion.map(q => (
              <div key={q.label} className="group">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono w-6 text-right flex-shrink-0" style={{ color: 'var(--ia-text-tertiary)' }}>
                    {q.label}
                  </span>
                  <div className="flex-1 h-3 rounded-full overflow-hidden flex" style={{ background: 'var(--ia-bg-muted)' }}>
                    {q.total > 0 && Object.entries(SENTIMENT_COLORS).map(([key, color]) => {
                      const count = q[key as keyof typeof q] as number;
                      if (!count) return null;
                      return (
                        <div
                          key={key}
                          className="h-full transition-all"
                          style={{ width: `${(count / q.total) * 100}%`, background: color, opacity: 0.85 }}
                          title={`${t(key, lang)}: ${count}`}
                        />
                      );
                    })}
                  </div>
                  <span className="text-[10px] ia-data w-6 text-right flex-shrink-0" style={{ color: 'var(--ia-text-secondary)' }}>
                    {q.total}
                  </span>
                </div>
                <p className="text-[10px] ml-8 truncate opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--ia-text-tertiary)' }}>
                  {q.text}
                </p>
              </div>
            ))}
          </div>
          {/* Legend */}
          <div className="flex gap-3 mt-3 pt-3" style={{ borderTop: '1px solid var(--ia-border)' }}>
            {Object.entries(SENTIMENT_COLORS).map(([key, color]) => (
              <div key={key} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ background: color, opacity: 0.85 }} />
                <span className="text-[10px]" style={{ color: 'var(--ia-text-tertiary)' }}>{t(key, lang)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Interview Lengths */}
        <div className="ia-card p-5">
          <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--ia-text)' }}>
            {t('dashboard_lengths', lang)}
          </h3>
          <p className="text-xs mb-4" style={{ color: 'var(--ia-text-tertiary)' }}>
            {t('dashboard_lengths_desc', lang)}
          </p>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {interviewStats.map(i => (
              <div key={i.name} className="flex items-center gap-2">
                <span className="text-[11px] w-28 truncate flex-shrink-0" style={{ color: 'var(--ia-text-secondary)' }} title={i.name}>
                  {i.name}
                </span>
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--ia-bg-muted)' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${(i.words / maxInterviewWords) * 100}%`, background: 'var(--ia-accent)', opacity: 0.7 }}
                  />
                </div>
                <span className="text-[10px] ia-data w-14 text-right flex-shrink-0" style={{ color: 'var(--ia-text-secondary)' }}>
                  {i.words.toLocaleString('de-DE')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function KPICard({ label, value, sublabel, icon }: { label: string; value: string | number; sublabel?: string; icon: string }) {
  const icons: Record<string, React.ReactNode> = {
    users: <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />,
    help: <><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
    message: <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></>,
    text: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></>,
  };

  return (
    <div className="ia-card p-4">
      <div className="flex items-center gap-2 mb-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--ia-text-tertiary)' }}>
          {icons[icon]}
        </svg>
        <span className="text-[11px] font-medium" style={{ color: 'var(--ia-text-tertiary)' }}>
          {label}
        </span>
      </div>
      <div className="text-xl font-semibold ia-data" style={{ color: 'var(--ia-text)' }}>
        {value}
      </div>
      {sublabel && (
        <div className="text-[10px] mt-0.5" style={{ color: 'var(--ia-text-tertiary)' }}>
          {sublabel}
        </div>
      )}
    </div>
  );
}
