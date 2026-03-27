'use client';

import { useState } from 'react';
import type { MatrixQuestion, IAInterview } from '@/types/interview-analysis';
import { useIALang, t } from '@/lib/interview-analysis/i18n';

interface HeatmapViewProps {
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

type ColorMode = 'coverage' | 'sentiment' | 'wordcount';

export default function HeatmapView({ questions, interviews }: HeatmapViewProps) {
  const lang = useIALang();
  const [colorMode, setColorMode] = useState<ColorMode>('sentiment');
  const [hoveredCell, setHoveredCell] = useState<{ qIdx: number; iIdx: number } | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const analyzedInterviews = interviews.filter(i => ['transcribed', 'analyzed'].includes(i.status));

  // Build lookup: questionIdx → interviewId → answer
  const answerMap = new Map<string, Map<string, { sentiment: string; wordCount: number; text: string }>>();
  for (const q of questions) {
    const byInterview = new Map<string, { sentiment: string; wordCount: number; text: string }>();
    for (const a of q.answers) {
      byInterview.set(a.interview_id, {
        sentiment: a.sentiment ?? 'neutral',
        wordCount: a.word_count ?? 0,
        text: a.answer_text,
      });
    }
    answerMap.set(q.canonical.id, byInterview);
  }

  // Max word count for scaling
  const allWordCounts = questions.flatMap(q => q.answers.map(a => a.word_count ?? 0));
  const maxWordCount = Math.max(...allWordCounts, 1);

  function getCellColor(qIdx: number, interviewId: string): string {
    const answer = answerMap.get(questions[qIdx].canonical.id)?.get(interviewId);
    if (!answer) return 'transparent';

    if (colorMode === 'coverage') {
      return 'var(--ia-accent)';
    }
    if (colorMode === 'sentiment') {
      return SENTIMENT_COLORS[answer.sentiment] ?? SENTIMENT_COLORS.neutral;
    }
    // wordcount — opacity based on relative word count
    const intensity = Math.max(0.2, answer.wordCount / maxWordCount);
    return `rgba(99, 102, 241, ${intensity})`;
  }

  function getCellOpacity(qIdx: number, interviewId: string): number {
    const answer = answerMap.get(questions[qIdx].canonical.id)?.get(interviewId);
    if (!answer) return 0;
    if (colorMode === 'coverage') return 0.75;
    if (colorMode === 'sentiment') return 0.8;
    return 1;
  }

  // Coverage stats
  const totalCells = questions.length * analyzedInterviews.length;
  const filledCells = questions.reduce((sum, q) => sum + q.answers.length, 0);
  const coveragePct = totalCells > 0 ? Math.round((filledCells / totalCells) * 100) : 0;

  // Per-interview coverage
  const interviewCoverage = analyzedInterviews.map(i => {
    const answered = questions.filter(q =>
      answerMap.get(q.canonical.id)?.has(i.id)
    ).length;
    return { id: i.id, name: i.name, answered, total: questions.length };
  });

  // Per-question coverage
  const questionCoverage = questions.map((q, idx) => ({
    idx,
    text: q.canonical.canonical_text,
    answered: q.answers.length,
    total: analyzedInterviews.length,
  }));

  function handleMouseEnter(e: React.MouseEvent, qIdx: number, iIdx: number) {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top - 8 });
    setHoveredCell({ qIdx, iIdx });
  }

  if (questions.length === 0 || analyzedInterviews.length === 0) {
    return (
      <div className="ia-card ia-empty">
        <svg className="ia-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
        </svg>
        <p className="text-sm" style={{ color: 'var(--ia-text-secondary)' }}>
          {t('heatmap_empty', lang)}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header with stats and controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-2xl font-semibold ia-data" style={{ color: 'var(--ia-text)' }}>
              {coveragePct}%
            </span>
            <span className="text-xs ml-1.5" style={{ color: 'var(--ia-text-tertiary)' }}>
              {t('heatmap_total_coverage', lang)}
            </span>
          </div>
          <div className="h-8 w-px" style={{ background: 'var(--ia-border)' }} />
          <div className="text-xs" style={{ color: 'var(--ia-text-secondary)' }}>
            {filledCells} / {totalCells} {t('heatmap_cells_filled', lang)}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--ia-text-tertiary)' }}>{t('heatmap_color', lang)}</span>
          {([
            { key: 'sentiment' as ColorMode, label: t('sentiment', lang) },
            { key: 'coverage' as ColorMode, label: t('heatmap_coverage', lang) },
            { key: 'wordcount' as ColorMode, label: t('heatmap_wordcount', lang) },
          ]).map(m => (
            <button
              key={m.key}
              className={`ia-btn ia-btn-sm ${colorMode === m.key ? 'ia-btn-primary' : 'ia-btn-secondary'}`}
              onClick={() => setColorMode(m.key)}
              style={{ height: 26, fontSize: 11 }}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="ia-card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: analyzedInterviews.length * 44 + 200 }}>
            <thead>
              <tr>
                <th
                  style={{
                    position: 'sticky',
                    left: 0,
                    zIndex: 2,
                    background: 'var(--ia-bg-card)',
                    padding: '10px 12px',
                    textAlign: 'left',
                    borderBottom: '1px solid var(--ia-border)',
                    width: 200,
                    minWidth: 200,
                  }}
                >
                  <span className="text-[10px] font-semibold" style={{ color: 'var(--ia-text-tertiary)' }}>
                    {t('heatmap_question', lang)}
                  </span>
                </th>
                {analyzedInterviews.map((interview, iIdx) => (
                  <th
                    key={interview.id}
                    style={{
                      padding: '8px 4px',
                      borderBottom: '1px solid var(--ia-border)',
                      minWidth: 40,
                      textAlign: 'center',
                    }}
                  >
                    <div
                      className="text-[9px] font-medium"
                      style={{
                        color: 'var(--ia-text-tertiary)',
                        writingMode: 'vertical-lr',
                        transform: 'rotate(180deg)',
                        maxHeight: 80,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        margin: '0 auto',
                      }}
                      title={interview.name}
                    >
                      {interview.name.length > 15 ? interview.name.slice(0, 14) + '…' : interview.name}
                    </div>
                  </th>
                ))}
                <th
                  style={{
                    padding: '8px 12px',
                    borderBottom: '1px solid var(--ia-border)',
                    textAlign: 'center',
                    minWidth: 50,
                  }}
                >
                  <span className="text-[10px] font-semibold" style={{ color: 'var(--ia-text-tertiary)' }}>%</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {questions.map((q, qIdx) => {
                const qCov = analyzedInterviews.length > 0
                  ? Math.round((q.answers.length / analyzedInterviews.length) * 100)
                  : 0;
                return (
                  <tr key={q.canonical.id}>
                    <td
                      style={{
                        position: 'sticky',
                        left: 0,
                        zIndex: 1,
                        background: 'var(--ia-bg-card)',
                        padding: '6px 12px',
                        borderBottom: '1px solid var(--ia-border)',
                        maxWidth: 200,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="text-[10px] font-mono flex-shrink-0"
                          style={{ color: 'var(--ia-text-tertiary)', width: 22 }}
                        >
                          F{qIdx + 1}
                        </span>
                        <span
                          className="text-[11px] truncate"
                          style={{ color: 'var(--ia-text-secondary)' }}
                          title={q.canonical.canonical_text}
                        >
                          {q.canonical.canonical_text}
                        </span>
                      </div>
                    </td>
                    {analyzedInterviews.map((interview, iIdx) => {
                      const answer = answerMap.get(q.canonical.id)?.get(interview.id);
                      const isHovered =
                        hoveredCell?.qIdx === qIdx && hoveredCell?.iIdx === iIdx;
                      return (
                        <td
                          key={interview.id}
                          style={{
                            padding: 2,
                            borderBottom: '1px solid var(--ia-border)',
                            textAlign: 'center',
                          }}
                          onMouseEnter={e => handleMouseEnter(e, qIdx, iIdx)}
                          onMouseLeave={() => setHoveredCell(null)}
                        >
                          <div
                            style={{
                              width: 28,
                              height: 28,
                              margin: '0 auto',
                              borderRadius: 4,
                              background: answer ? getCellColor(qIdx, interview.id) : 'var(--ia-bg-muted)',
                              opacity: answer ? getCellOpacity(qIdx, interview.id) : 0.4,
                              transition: 'all 0.15s ease',
                              transform: isHovered ? 'scale(1.2)' : 'scale(1)',
                              boxShadow: isHovered ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
                              cursor: answer ? 'pointer' : 'default',
                            }}
                          />
                        </td>
                      );
                    })}
                    <td
                      style={{
                        padding: '6px 12px',
                        borderBottom: '1px solid var(--ia-border)',
                        textAlign: 'center',
                      }}
                    >
                      <span
                        className="text-[10px] ia-data font-semibold"
                        style={{
                          color: qCov === 100 ? '#22C55E' : qCov >= 70 ? 'var(--ia-accent)' : qCov >= 40 ? '#F59E0B' : '#EF4444',
                        }}
                      >
                        {qCov}%
                      </span>
                    </td>
                  </tr>
                );
              })}
              {/* Bottom row: per-interview coverage */}
              <tr>
                <td
                  style={{
                    position: 'sticky',
                    left: 0,
                    zIndex: 1,
                    background: 'var(--ia-bg-card)',
                    padding: '8px 12px',
                    borderTop: '2px solid var(--ia-border-strong)',
                  }}
                >
                  <span className="text-[10px] font-semibold" style={{ color: 'var(--ia-text-tertiary)' }}>
                    {t('heatmap_coverage_label', lang)}
                  </span>
                </td>
                {interviewCoverage.map(ic => {
                  const pct = ic.total > 0 ? Math.round((ic.answered / ic.total) * 100) : 0;
                  return (
                    <td
                      key={ic.id}
                      style={{
                        padding: '8px 4px',
                        textAlign: 'center',
                        borderTop: '2px solid var(--ia-border-strong)',
                      }}
                    >
                      <span
                        className="text-[10px] ia-data font-semibold"
                        style={{
                          color: pct === 100 ? '#22C55E' : pct >= 70 ? 'var(--ia-accent)' : pct >= 40 ? '#F59E0B' : '#EF4444',
                        }}
                      >
                        {pct}%
                      </span>
                    </td>
                  );
                })}
                <td style={{ borderTop: '2px solid var(--ia-border-strong)' }} />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Tooltip */}
      {hoveredCell && (() => {
        const q = questions[hoveredCell.qIdx];
        const interview = analyzedInterviews[hoveredCell.iIdx];
        const answer = answerMap.get(q.canonical.id)?.get(interview.id);
        return (
          <div
            style={{
              position: 'fixed',
              left: tooltipPos.x,
              top: tooltipPos.y,
              transform: 'translate(-50%, -100%)',
              zIndex: 50,
              maxWidth: 320,
              pointerEvents: 'none',
            }}
          >
            <div
              className="ia-card-sm"
              style={{
                padding: '10px 14px',
                boxShadow: '0 8px 25px rgba(0,0,0,0.12)',
              }}
            >
              <div className="text-[11px] font-semibold mb-1" style={{ color: 'var(--ia-text)' }}>
                {interview.name} — F{hoveredCell.qIdx + 1}
              </div>
              {answer ? (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="ia-badge text-[10px]"
                      style={{
                        background: SENTIMENT_COLORS[answer.sentiment] + '20',
                        color: SENTIMENT_COLORS[answer.sentiment],
                      }}
                    >
                      {t(SENTIMENT_KEYS[answer.sentiment] ?? 'neutral', lang)}
                    </span>
                    <span className="text-[10px] ia-data" style={{ color: 'var(--ia-text-tertiary)' }}>
                      {answer.wordCount} {t('words', lang)}
                    </span>
                  </div>
                  <p
                    className="text-[11px]"
                    style={{
                      color: 'var(--ia-text-secondary)',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      lineHeight: 1.4,
                    }}
                  >
                    {answer.text}
                  </p>
                </>
              ) : (
                <p className="text-[11px]" style={{ color: 'var(--ia-text-tertiary)' }}>
                  {t('no_answer', lang)}
                </p>
              )}
            </div>
          </div>
        );
      })()}

      {/* Legend */}
      {colorMode === 'sentiment' && (
        <div className="flex items-center gap-4 px-1">
          {Object.entries(SENTIMENT_COLORS).map(([key, color]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div style={{ width: 12, height: 12, borderRadius: 3, background: color, opacity: 0.8 }} />
              <span className="text-[10px]" style={{ color: 'var(--ia-text-tertiary)' }}>
                {t(SENTIMENT_KEYS[key] ?? key, lang)}
              </span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <div style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--ia-bg-muted)', opacity: 0.4 }} />
            <span className="text-[10px]" style={{ color: 'var(--ia-text-tertiary)' }}>{t('no_answer', lang)}</span>
          </div>
        </div>
      )}
      {colorMode === 'coverage' && (
        <div className="flex items-center gap-4 px-1">
          <div className="flex items-center gap-1.5">
            <div style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--ia-accent)', opacity: 0.75 }} />
            <span className="text-[10px]" style={{ color: 'var(--ia-text-tertiary)' }}>{t('heatmap_answered', lang)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--ia-bg-muted)', opacity: 0.4 }} />
            <span className="text-[10px]" style={{ color: 'var(--ia-text-tertiary)' }}>{t('heatmap_not_answered', lang)}</span>
          </div>
        </div>
      )}
      {colorMode === 'wordcount' && (
        <div className="flex items-center gap-2 px-1">
          <span className="text-[10px]" style={{ color: 'var(--ia-text-tertiary)' }}>{t('heatmap_few', lang)}</span>
          <div className="flex gap-0.5">
            {[0.2, 0.4, 0.6, 0.8, 1.0].map(o => (
              <div key={o} style={{ width: 16, height: 12, borderRadius: 2, background: `rgba(99, 102, 241, ${o})` }} />
            ))}
          </div>
          <span className="text-[10px]" style={{ color: 'var(--ia-text-tertiary)' }}>{t('heatmap_many', lang)}</span>
          <div className="ml-2 flex items-center gap-1.5">
            <div style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--ia-bg-muted)', opacity: 0.4 }} />
            <span className="text-[10px]" style={{ color: 'var(--ia-text-tertiary)' }}>{t('no_answer', lang)}</span>
          </div>
        </div>
      )}

      {/* Gap Analysis */}
      {(() => {
        const gaps = questionCoverage
          .filter(q => q.answered < q.total)
          .sort((a, b) => a.answered - b.answered);

        if (gaps.length === 0) return null;

        const missingInterviews = interviewCoverage
          .filter(ic => ic.answered < ic.total)
          .sort((a, b) => a.answered - b.answered);

        return (
          <div className="ia-card p-5">
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--ia-text)' }}>
              {t('heatmap_gap_title', lang)}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <p className="text-xs font-medium mb-2" style={{ color: 'var(--ia-text-secondary)' }}>
                  {t('heatmap_gap_questions', lang)}
                </p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {gaps.slice(0, 10).map(g => (
                    <div key={g.idx} className="flex items-center gap-2">
                      <span className="text-[10px] font-mono w-6 flex-shrink-0" style={{ color: 'var(--ia-text-tertiary)' }}>
                        F{g.idx + 1}
                      </span>
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--ia-bg-muted)' }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(g.answered / g.total) * 100}%`,
                            background: g.answered / g.total >= 0.7 ? 'var(--ia-accent)' : '#F59E0B',
                          }}
                        />
                      </div>
                      <span className="text-[10px] ia-data flex-shrink-0" style={{ color: 'var(--ia-text-tertiary)' }}>
                        {g.answered}/{g.total}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {missingInterviews.length > 0 && (
                <div>
                  <p className="text-xs font-medium mb-2" style={{ color: 'var(--ia-text-secondary)' }}>
                    {t('heatmap_gap_interviews', lang)}
                  </p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {missingInterviews.slice(0, 10).map(ic => (
                      <div key={ic.id} className="flex items-center gap-2">
                        <span className="text-[11px] w-28 truncate flex-shrink-0" style={{ color: 'var(--ia-text-secondary)' }} title={ic.name}>
                          {ic.name}
                        </span>
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--ia-bg-muted)' }}>
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${(ic.answered / ic.total) * 100}%`,
                              background: ic.answered / ic.total >= 0.7 ? 'var(--ia-accent)' : '#F59E0B',
                            }}
                          />
                        </div>
                        <span className="text-[10px] ia-data flex-shrink-0" style={{ color: 'var(--ia-text-tertiary)' }}>
                          {ic.answered}/{ic.total}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
