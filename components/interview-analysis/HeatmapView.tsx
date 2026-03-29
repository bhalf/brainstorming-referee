'use client';

import { useState, useMemo } from 'react';
import type { MatrixQuestion, IAInterview } from '@/types/interview-analysis';
import { useIALang, t, pickLang } from '@/lib/interview-analysis/i18n';

interface HeatmapViewProps {
  questions: MatrixQuestion[];
  interviews: IAInterview[];
  projectLanguage: string;
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

type ColorMode = 'coverage' | 'sentiment' | 'wordcount';
type ViewMode = 'detail' | 'overview';

export default function HeatmapView({ questions, interviews, projectLanguage }: HeatmapViewProps) {
  const lang = useIALang();
  const [viewMode, setViewMode] = useState<ViewMode>('detail');
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
    text: pickLang(q.canonical.canonical_text, q.canonical.canonical_text_alt, lang, projectLanguage),
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

  // Dynamic cell sizing based on interview count
  const cellSize = analyzedInterviews.length > 25 ? 16 : analyzedInterviews.length > 15 ? 20 : 28;
  const showColumnLabels = analyzedInterviews.length <= 25;

  // Overview data
  const overviewData = useMemo(() => {
    return analyzedInterviews.map(iv => {
      const sc: Record<string, number> = { positive: 0, negative: 0, neutral: 0, ambivalent: 0 };
      let totalAnswerWords = 0;
      let answerCount = 0;
      for (const q of questions) {
        const a = answerMap.get(q.canonical.id)?.get(iv.id);
        if (a) {
          sc[a.sentiment]++;
          totalAnswerWords += a.wordCount;
          answerCount++;
        }
      }
      const dominant = Object.entries(sc).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'neutral';
      return {
        id: iv.id,
        name: iv.name,
        group: iv.group_label,
        wordCount: iv.word_count ?? 0,
        coverage: questions.length > 0 ? answerCount / questions.length : 0,
        answerCount,
        avgLength: answerCount > 0 ? Math.round(totalAnswerWords / answerCount) : 0,
        dominantSentiment: dominant,
        sentiments: sc,
      };
    });
  }, [analyzedInterviews, questions, answerMap]);

  const [overviewSort, setOverviewSort] = useState<{ col: string; asc: boolean }>({ col: 'name', asc: true });

  const sortedOverview = useMemo(() => {
    const sorted = [...overviewData];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (overviewSort.col) {
        case 'name': cmp = a.name.localeCompare(b.name, undefined, { numeric: true }); break;
        case 'words': cmp = a.wordCount - b.wordCount; break;
        case 'coverage': cmp = a.coverage - b.coverage; break;
        case 'answers': cmp = a.answerCount - b.answerCount; break;
        case 'avgLength': cmp = a.avgLength - b.avgLength; break;
        default: cmp = 0;
      }
      return overviewSort.asc ? cmp : -cmp;
    });
    return sorted;
  }, [overviewData, overviewSort]);

  const maxOverviewWords = Math.max(...overviewData.map(d => d.wordCount), 1);
  const maxOverviewAvg = Math.max(...overviewData.map(d => d.avgLength), 1);

  function toggleOverviewSort(col: string) {
    setOverviewSort(prev => prev.col === col ? { col, asc: !prev.asc } : { col, asc: false });
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

        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="ia-toggle-group">
            {([
              { key: 'detail' as ViewMode, label: t('heatmap_detail', lang) },
              { key: 'overview' as ViewMode, label: t('heatmap_overview', lang) },
            ]).map(v => (
              <button
                key={v.key}
                className={`ia-toggle-btn ${viewMode === v.key ? 'ia-toggle-btn--active' : ''}`}
                onClick={() => setViewMode(v.key)}
              >
                {v.label}
              </button>
            ))}
          </div>

          {viewMode === 'detail' && (
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: 'var(--ia-text-tertiary)' }}>{t('heatmap_color', lang)}</span>
              <div className="ia-toggle-group">
                {([
                  { key: 'sentiment' as ColorMode, label: t('sentiment', lang) },
                  { key: 'coverage' as ColorMode, label: t('heatmap_coverage', lang) },
                  { key: 'wordcount' as ColorMode, label: t('heatmap_wordcount', lang) },
                ]).map(m => (
                  <button
                    key={m.key}
                    className={`ia-toggle-btn ${colorMode === m.key ? 'ia-toggle-btn--active' : ''}`}
                    onClick={() => setColorMode(m.key)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Overview Mode ─── */}
      {viewMode === 'overview' && (
        <div className="ia-card" style={{ overflow: 'hidden' }}>
          <div className="ia-scroll-x">
            <table className="ia-table">
              <thead>
                <tr>
                  {[
                    { col: 'name', label: 'Interview', align: 'left' as const, width: 180 },
                    { col: 'words', label: t('heatmap_col_words', lang), align: 'center' as const, width: undefined },
                    { col: 'coverage', label: t('heatmap_col_coverage', lang), align: 'center' as const, width: undefined },
                    { col: 'answers', label: t('heatmap_col_answers', lang), align: 'center' as const, width: undefined },
                    { col: 'sentiment', label: t('heatmap_col_sentiment', lang), align: 'center' as const, width: 120 },
                    { col: 'avgLength', label: t('heatmap_col_avg_length', lang), align: 'center' as const, width: undefined },
                  ].map(h => (
                    <th
                      key={h.col}
                      className="ia-table-sortable"
                      style={{ textAlign: h.align, width: h.width }}
                      onClick={() => toggleOverviewSort(h.col)}
                    >
                      <span style={{ color: overviewSort.col === h.col ? 'var(--ia-accent)' : undefined }}>
                        {h.label} {overviewSort.col === h.col ? (overviewSort.asc ? '↑' : '↓') : ''}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedOverview.map(row => {
                  const covPct = Math.round(row.coverage * 100);
                  return (
                    <tr key={row.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          {row.group && (
                            <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: 'var(--ia-accent)', opacity: 0.6 }} />
                          )}
                          <span className="text-xs truncate" style={{ color: 'var(--ia-text)', maxWidth: 160 }} title={row.name}>
                            {row.name}
                          </span>
                        </div>
                      </td>
                      <td className="ia-table-num">
                        <div className="flex items-center gap-2 justify-center">
                          <div className="ia-progress" style={{ width: 60 }}>
                            <div className="ia-progress-fill" style={{ width: `${(row.wordCount / maxOverviewWords) * 100}%`, background: 'rgba(99,102,241,0.6)' }} />
                          </div>
                          <span className="text-[11px] ia-data" style={{ color: 'var(--ia-text-secondary)', minWidth: 40 }}>
                            {row.wordCount.toLocaleString()}
                          </span>
                        </div>
                      </td>
                      <td className="ia-table-num">
                        <span
                          className="text-[11px] ia-data font-semibold"
                          style={{ color: covPct === 100 ? 'var(--ia-success)' : covPct >= 70 ? 'var(--ia-accent)' : covPct >= 40 ? 'var(--ia-warning)' : 'var(--ia-error)' }}
                        >
                          {covPct}%
                        </span>
                      </td>
                      <td className="ia-table-num">
                        <span className="text-[11px] ia-data" style={{ color: 'var(--ia-text-secondary)' }}>
                          {row.answerCount}/{questions.length}
                        </span>
                      </td>
                      <td>
                        <div className="flex rounded-full overflow-hidden mx-auto" style={{ width: 80, height: 6 }}>
                          {(['positive', 'neutral', 'ambivalent', 'negative'] as const).map(s => {
                            const total = Object.values(row.sentiments).reduce((a, b) => a + b, 0);
                            if (total === 0 || !row.sentiments[s]) return null;
                            return <div key={s} style={{ width: `${(row.sentiments[s] / total) * 100}%`, background: SENTIMENT_COLORS[s] }} />;
                          })}
                        </div>
                      </td>
                      <td className="ia-table-num">
                        <div className="flex items-center gap-2 justify-center">
                          <div className="ia-progress" style={{ width: 40 }}>
                            <div className="ia-progress-fill" style={{ width: `${(row.avgLength / maxOverviewAvg) * 100}%`, background: 'rgba(99,102,241,0.5)' }} />
                          </div>
                          <span className="text-[11px] ia-data" style={{ color: 'var(--ia-text-secondary)', minWidth: 24 }}>
                            {row.avgLength}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Detail Mode ─── */}
      {viewMode === 'detail' && <>
      {/* Heatmap Grid */}
      <div className="ia-card" style={{ overflow: 'hidden' }}>
        <div className="ia-scroll-x">
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: analyzedInterviews.length * (cellSize + 12) + 200 }}>
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
                      padding: '8px 2px',
                      borderBottom: '1px solid var(--ia-border)',
                      minWidth: cellSize + 8,
                      textAlign: 'center',
                    }}
                  >
                    {showColumnLabels ? (
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
                    ) : (
                      <div style={{ height: 4 }} title={interview.name} />
                    )}
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
                          title={pickLang(q.canonical.canonical_text, q.canonical.canonical_text_alt, lang, projectLanguage)}
                        >
                          {pickLang(q.canonical.canonical_text, q.canonical.canonical_text_alt, lang, projectLanguage)}
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
                            className="ia-heatmap-cell"
                            style={{
                              width: cellSize,
                              height: cellSize,
                              margin: '0 auto',
                              background: answer ? getCellColor(qIdx, interview.id) : 'var(--ia-bg-muted)',
                              opacity: answer ? getCellOpacity(qIdx, interview.id) : 0.4,
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
                          color: qCov === 100 ? 'var(--ia-success)' : qCov >= 70 ? 'var(--ia-accent)' : qCov >= 40 ? 'var(--ia-warning)' : 'var(--ia-error)',
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
                          color: pct === 100 ? 'var(--ia-success)' : pct >= 70 ? 'var(--ia-accent)' : pct >= 40 ? 'var(--ia-warning)' : 'var(--ia-error)',
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
            <h3 className="ia-section-title mb-3">
              {t('heatmap_gap_title', lang)}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <p className="text-xs font-medium mb-2" style={{ color: 'var(--ia-text-secondary)' }}>
                  {t('heatmap_gap_questions', lang)}
                </p>
                <div className="space-y-1.5 max-h-48 ia-scroll-y">
                  {gaps.slice(0, 10).map(g => (
                    <div key={g.idx} className="flex items-center gap-2">
                      <span className="text-[10px] font-mono w-6 flex-shrink-0" style={{ color: 'var(--ia-text-tertiary)' }}>
                        F{g.idx + 1}
                      </span>
                      <div className="flex-1 ia-progress">
                        <div
                          className="ia-progress-fill"
                          style={{
                            width: `${(g.answered / g.total) * 100}%`,
                            background: g.answered / g.total >= 0.7 ? 'var(--ia-accent)' : 'var(--ia-warning)',
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
                  <div className="space-y-1.5 max-h-48 ia-scroll-y">
                    {missingInterviews.slice(0, 10).map(ic => (
                      <div key={ic.id} className="flex items-center gap-2">
                        <span className="text-[11px] w-28 truncate flex-shrink-0" style={{ color: 'var(--ia-text-secondary)' }} title={ic.name}>
                          {ic.name}
                        </span>
                        <div className="flex-1 ia-progress">
                          <div
                            className="ia-progress-fill"
                            style={{
                              width: `${(ic.answered / ic.total) * 100}%`,
                              background: ic.answered / ic.total >= 0.7 ? 'var(--ia-accent)' : 'var(--ia-warning)',
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
      </>}
    </div>
  );
}
