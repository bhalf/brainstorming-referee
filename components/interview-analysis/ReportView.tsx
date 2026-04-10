'use client';

import { useState, useEffect, useRef } from 'react';
import { useIALang, t } from '@/lib/interview-analysis/i18n';

interface ReportViewProps {
  projectId: string;
  projectLanguage: string;
}

interface AIAnalysis {
  summary: string;
  notable_patterns: string;
  selected_quotes: Array<{
    answer_id: string;
    participant: string;
    quote: string;
    relevance: string;
    verified?: boolean;
  }>;
  quality_notes: string | null;
}

interface ReportQuote {
  interview_name: string;
  group_label: string | null;
  text: string;
  sentiment: string | null;
  word_count: number | null;
}

interface ReportQuestion {
  canonical_question_id: string;
  number: number;
  canonical_text: string;
  canonical_text_alt: string | null;
  topic_area: string | null;
  is_guide_question: boolean;
  total_answers: number;
  total_interviews: number;
  coverage_pct: number;
  sentiment_distribution: Record<string, number>;
  summary_text: string | null;
  summary_text_alt: string | null;
  quotes: ReportQuote[];
  all_answers: Array<{
    interview_name: string;
    group_label: string | null;
    text: string;
    sentiment: string | null;
    confidence: string | null;
    match_type: string | null;
  }>;
}

interface ReportData {
  project: { name: string; description: string | null; language: string };
  meta: {
    total_interviews: number;
    interview_names: string[];
    total_guide_questions: number;
    total_additional_questions: number;
    total_canonical_questions: number;
    all_questions_asked: boolean;
    questions_with_gaps: Array<{ question: string; coverage: string }>;
    additional_topics: Array<{ text: string; topic: string | null }>;
  };
  questions: ReportQuestion[];
}

const SENTIMENT_LABELS: Record<string, { de: string; en: string; color: string }> = {
  positive: { de: 'Positiv', en: 'Positive', color: 'var(--ia-success)' },
  negative: { de: 'Negativ', en: 'Negative', color: 'var(--ia-error)' },
  neutral: { de: 'Neutral', en: 'Neutral', color: 'var(--ia-text-tertiary)' },
  ambivalent: { de: 'Ambivalent', en: 'Ambivalent', color: 'var(--ia-warning)' },
};

export default function ReportView({ projectId, projectLanguage }: ReportViewProps) {
  const lang = useIALang();
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedQuotes, setExpandedQuotes] = useState<Set<number>>(new Set());
  const [aiAnalyses, setAiAnalyses] = useState<Record<string, AIAnalysis>>({});
  const [generatingAll, setGeneratingAll] = useState(false);
  const [genProgress, setGenProgress] = useState('');
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/interview-analysis/projects/${projectId}/report`);
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to load report');
        }
        setData(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error');
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId]);

  async function generateAllAnalyses() {
    if (!data) return;
    setGeneratingAll(true);
    const questionsToAnalyze = data.questions.filter(q => q.total_answers > 0);

    for (let i = 0; i < questionsToAnalyze.length; i++) {
      const q = questionsToAnalyze[i];
      setGenProgress(`${i + 1}/${questionsToAnalyze.length}`);
      await generateAnalysisForQuestion(q.canonical_question_id);
    }
    setGeneratingAll(false);
    setGenProgress('');
  }

  async function generateAnalysisForQuestion(canonicalQuestionId: string) {
    try {
      const res = await fetch(`/api/interview-analysis/projects/${projectId}/report/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canonicalQuestionId }),
      });
      if (res.ok) {
        const analysis = await res.json();
        setAiAnalyses(prev => ({ ...prev, [canonicalQuestionId]: analysis }));
      }
    } catch { /* ignore */ }
  }

  function toggleAllQuotes(qNum: number) {
    setExpandedQuotes(prev => {
      const next = new Set(prev);
      if (next.has(qNum)) next.delete(qNum);
      else next.add(qNum);
      return next;
    });
  }

  async function handleCopyReport() {
    if (!data) return;
    const text = buildPlainTextReport(data, aiAnalyses);
    await navigator.clipboard.writeText(text);
    alert(lang === 'en' ? 'Report copied to clipboard!' : 'Bericht in Zwischenablage kopiert!');
  }

  function handleDownloadReport() {
    if (!data) return;
    const text = buildPlainTextReport(data, aiAnalyses);
    const blob = new Blob([text], { type: 'text/plain; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.project.name.replace(/[^a-zA-Z0-9äöüÄÖÜ ]/g, '_')}_Report.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="ia-card p-8 text-center">
        <span className="ia-spinner" style={{ width: 24, height: 24, borderWidth: 3 }} />
        <p className="text-sm mt-3" style={{ color: 'var(--ia-text-secondary)' }}>
          {lang === 'en' ? 'Loading report...' : 'Bericht wird geladen...'}
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="ia-card p-6" style={{ background: 'var(--ia-error-light)', color: 'var(--ia-error)' }}>
        <p className="text-sm font-medium">{error || 'No data'}</p>
      </div>
    );
  }

  const isEn = lang === 'en';
  const guideQuestions = data.questions.filter(q => q.is_guide_question);
  const additionalQuestions = data.questions.filter(q => !q.is_guide_question);

  return (
    <div className="space-y-6">
      {/* Header + Actions */}
      <div className="ia-section-header">
        <div>
          <h2 className="ia-section-title">
            {isEn ? 'Scientific Report' : 'Wissenschaftlicher Bericht'}
          </h2>
          <p className="ia-section-subtitle">
            {isEn
              ? `${data.meta.total_interviews} interviews, ${data.meta.total_canonical_questions} questions analyzed`
              : `${data.meta.total_interviews} Interviews, ${data.meta.total_canonical_questions} Fragen analysiert`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="ia-btn ia-btn-primary ia-btn-sm"
            onClick={generateAllAnalyses}
            disabled={generatingAll}
          >
            {generatingAll ? (
              <>
                <span className="ia-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                {isEn ? `Analyzing ${genProgress}...` : `Analyse ${genProgress}...`}
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                {Object.keys(aiAnalyses).length > 0
                  ? (isEn ? 'Re-analyze' : 'Erneut analysieren')
                  : (isEn ? 'Generate AI Analysis' : 'KI-Analyse generieren')}
              </>
            )}
          </button>
          <button className="ia-btn ia-btn-secondary ia-btn-sm" onClick={handleCopyReport}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            {isEn ? 'Copy' : 'Kopieren'}
          </button>
          <button className="ia-btn ia-btn-secondary ia-btn-sm" onClick={handleDownloadReport}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {isEn ? 'Download' : 'Herunterladen'}
          </button>
        </div>
      </div>

      <div ref={reportRef} className="space-y-6">
        {/* Guide Questions */}
        {guideQuestions.length > 0 && (
          <>
            <div className="ia-card-sm px-4 py-2" style={{ background: 'var(--ia-accent-light)' }}>
              <h3 className="text-xs font-semibold" style={{ color: 'var(--ia-accent)' }}>
                {isEn ? `Guide Questions (${guideQuestions.length})` : `Leitfaden-Fragen (${guideQuestions.length})`}
              </h3>
            </div>
            {guideQuestions.map(q => renderQuestion(q))}
          </>
        )}

        {/* Additional Questions */}
        {additionalQuestions.length > 0 && (
          <>
            <div className="ia-card-sm px-4 py-2" style={{ background: 'var(--ia-warning-light)' }}>
              <h3 className="text-xs font-semibold" style={{ color: 'var(--ia-warning)' }}>
                {isEn ? `Additional Questions (${additionalQuestions.length})` : `Zusätzliche Fragen (${additionalQuestions.length})`}
              </h3>
            </div>
            {additionalQuestions.map(q => renderQuestion(q))}
          </>
        )}

        {/* Metadata Section */}
        <div className="ia-card p-5 space-y-4">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--ia-text)' }}>
            {isEn ? 'Appendix: Methodology Notes' : 'Anhang: Methodische Hinweise'}
          </h3>

          <div className="space-y-2 text-xs" style={{ color: 'var(--ia-text-secondary)' }}>
            <p><strong>{isEn ? 'Total interviews:' : 'Gesamtanzahl Interviews:'}</strong> {data.meta.total_interviews}</p>
            <p><strong>{isEn ? 'Participants:' : 'Teilnehmende:'}</strong> {data.meta.interview_names.join(', ')}</p>
            <p><strong>{isEn ? 'Guide questions:' : 'Leitfaden-Fragen:'}</strong> {data.meta.total_guide_questions}</p>
            <p><strong>{isEn ? 'Additional questions discovered:' : 'Zusätzlich entdeckte Fragen:'}</strong> {data.meta.total_additional_questions}</p>

            {!data.meta.all_questions_asked && (
              <div className="mt-3">
                <p className="font-semibold" style={{ color: 'var(--ia-warning)' }}>
                  {isEn ? 'Questions with incomplete coverage:' : 'Fragen mit unvollständiger Abdeckung:'}
                </p>
                <ul className="list-disc ml-4 mt-1 space-y-0.5">
                  {data.meta.questions_with_gaps.map((g, i) => (
                    <li key={i}>{g.question} ({g.coverage})</li>
                  ))}
                </ul>
              </div>
            )}

            {data.meta.additional_topics.length > 0 && (
              <div className="mt-3">
                <p className="font-semibold">
                  {isEn ? 'Topics raised by participants (not in guide):' : 'Von Teilnehmenden angesprochene Themen (nicht im Leitfaden):'}
                </p>
                <ul className="list-disc ml-4 mt-1 space-y-0.5">
                  {data.meta.additional_topics.map((t, i) => (
                    <li key={i}>{t.text}{t.topic ? ` (${t.topic})` : ''}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  function renderQuestion(q: ReportQuestion) {
    const isExpanded = expandedQuotes.has(q.number);
    const ai = aiAnalyses[q.canonical_question_id];

    return (
      <div key={q.number} className="ia-card p-5 space-y-4">
        {/* Question Header */}
        <div>
          <div className="flex items-start gap-3">
            <span className="ia-badge ia-badge-neutral" style={{ fontSize: '11px', flexShrink: 0 }}>
              F{q.number}
            </span>
            <div className="flex-1">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--ia-text)' }}>
                {q.canonical_text}
              </h3>
              {q.topic_area && (
                <span className="text-[11px]" style={{ color: 'var(--ia-text-tertiary)' }}>
                  {q.topic_area}
                </span>
              )}
            </div>
            <span className="ia-data text-[11px]" style={{ flexShrink: 0 }}>
              {q.total_answers}/{q.total_interviews} ({q.coverage_pct}%)
            </span>
          </div>
        </div>

        {/* Sentiment Bar */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium" style={{ color: 'var(--ia-text-secondary)', width: 60 }}>
            Sentiment
          </span>
          <div className="flex-1 flex h-2 rounded-full overflow-hidden" style={{ background: 'var(--ia-bg-muted)' }}>
            {Object.entries(q.sentiment_distribution).map(([s, count]) => {
              if (count === 0) return null;
              const pct = (count / q.total_answers) * 100;
              return (
                <div
                  key={s}
                  style={{
                    width: `${pct}%`,
                    background: SENTIMENT_LABELS[s]?.color ?? 'var(--ia-text-tertiary)',
                  }}
                  title={`${SENTIMENT_LABELS[s]?.[lang] ?? s}: ${count} (${Math.round(pct)}%)`}
                />
              );
            })}
          </div>
          <div className="flex gap-2 text-[10px]" style={{ color: 'var(--ia-text-tertiary)' }}>
            {Object.entries(q.sentiment_distribution).map(([s, count]) => {
              if (count === 0) return null;
              return (
                <span key={s} style={{ color: SENTIMENT_LABELS[s]?.color }}>
                  {count}×{SENTIMENT_LABELS[s]?.[lang]?.[0] ?? s[0]}
                </span>
              );
            })}
          </div>
        </div>

        {/* AI Analysis (if generated) */}
        {ai ? (
          <>
            {/* AI Summary */}
            <div className="px-3 py-2.5 rounded-lg" style={{ background: 'var(--ia-accent-light)' }}>
              <p className="text-[11px] font-medium mb-1" style={{ color: 'var(--ia-accent)' }}>
                {isEn ? 'Summary (AI-verified)' : 'Zusammenfassung (KI-verifiziert)'}
              </p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--ia-text-secondary)' }}>
                {ai.summary}
              </p>
            </div>

            {/* Notable Patterns */}
            <div className="px-3 py-2.5 rounded-lg" style={{ background: 'var(--ia-warning-light)' }}>
              <p className="text-[11px] font-medium mb-1" style={{ color: 'var(--ia-warning)' }}>
                {isEn ? 'Notable Patterns' : 'Auffällige Muster'}
              </p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--ia-text-secondary)' }}>
                {ai.notable_patterns}
              </p>
            </div>

            {/* AI-Selected Quotes */}
            <div>
              <p className="text-[11px] font-medium mb-2" style={{ color: 'var(--ia-text-tertiary)' }}>
                {isEn ? `Selected Quotes (${ai.selected_quotes.length})` : `Ausgewählte Zitate (${ai.selected_quotes.length})`}
              </p>
              <div className="space-y-2">
                {ai.selected_quotes.map((quote, i) => (
                  <div key={i} className="px-3 py-2 rounded-lg border" style={{ borderColor: 'var(--ia-border)', background: 'var(--ia-bg)' }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-semibold" style={{ color: 'var(--ia-text)' }}>
                        {quote.participant}
                      </span>
                      {quote.verified === false && (
                        <span className="ia-badge" style={{ fontSize: '9px', background: 'var(--ia-error-light)', color: 'var(--ia-error)' }}>
                          {isEn ? 'unverified' : 'ungeprüft'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs leading-relaxed italic" style={{ color: 'var(--ia-text-secondary)' }}>
                      &ldquo;{quote.quote}&rdquo;
                    </p>
                    <p className="text-[10px] mt-1" style={{ color: 'var(--ia-text-tertiary)' }}>
                      {quote.relevance}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Quality Notes */}
            {ai.quality_notes && (
              <div className="px-3 py-2 rounded-lg" style={{ background: 'var(--ia-error-light)' }}>
                <p className="text-[11px] font-medium mb-1" style={{ color: 'var(--ia-error)' }}>
                  {isEn ? 'Quality Notes' : 'Qualitätshinweise'}
                </p>
                <p className="text-[11px] leading-relaxed" style={{ color: 'var(--ia-text-secondary)' }}>
                  {ai.quality_notes}
                </p>
              </div>
            )}

            {/* Show all raw answers */}
            <div>
              <button
                className="ia-btn ia-btn-ghost text-[11px]"
                style={{ padding: '2px 6px' }}
                onClick={() => toggleAllQuotes(q.number)}
              >
                {isExpanded
                  ? (isEn ? 'Hide all answers' : 'Alle Antworten ausblenden')
                  : (isEn ? `Show all ${q.all_answers.length} raw answers` : `Alle ${q.all_answers.length} Rohantworten zeigen`)}
              </button>
              {isExpanded && (
                <div className="space-y-2 mt-2">
                  {q.all_answers.map((answer, i) => (
                    <div key={i} className="px-3 py-2 rounded-lg" style={{ background: 'var(--ia-bg-muted)' }}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] font-semibold" style={{ color: 'var(--ia-text)' }}>
                          {answer.interview_name}
                        </span>
                        {answer.sentiment && (
                          <span className="text-[10px]" style={{ color: SENTIMENT_LABELS[answer.sentiment]?.color }}>
                            {SENTIMENT_LABELS[answer.sentiment]?.[lang] ?? answer.sentiment}
                          </span>
                        )}
                      </div>
                      <p className="text-xs leading-relaxed" style={{ color: 'var(--ia-text-secondary)' }}>
                        {answer.text}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Fallback: Pipeline summary + basic quotes (before AI analysis is generated) */}
            {q.summary_text && (
              <div className="px-3 py-2.5 rounded-lg" style={{ background: 'var(--ia-bg-muted)' }}>
                <p className="text-[11px] font-medium mb-1" style={{ color: 'var(--ia-text-tertiary)' }}>
                  {isEn ? 'Summary (pipeline)' : 'Zusammenfassung (Pipeline)'}
                </p>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--ia-text-secondary)' }}>
                  {q.summary_text}
                </p>
              </div>
            )}

            {/* Basic Quotes */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-medium" style={{ color: 'var(--ia-text-tertiary)' }}>
                  {isEn ? `Quotes (${q.quotes.length} auto-selected)` : `Zitate (${q.quotes.length} automatisch)`}
                </p>
                {q.all_answers.length > q.quotes.length && (
                  <button
                    className="ia-btn ia-btn-ghost text-[11px]"
                    style={{ padding: '2px 6px' }}
                    onClick={() => toggleAllQuotes(q.number)}
                  >
                    {isExpanded
                      ? (isEn ? 'Show selected' : 'Nur ausgewählte')
                      : (isEn ? `Show all ${q.all_answers.length}` : `Alle ${q.all_answers.length} zeigen`)}
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {(isExpanded ? q.all_answers : q.quotes).map((quote, i) => (
                  <div key={i} className="px-3 py-2 rounded-lg border" style={{ borderColor: 'var(--ia-border)', background: 'var(--ia-bg)' }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-semibold" style={{ color: 'var(--ia-text)' }}>
                        {quote.interview_name}
                      </span>
                      {quote.group_label && (
                        <span className="ia-badge ia-badge-neutral" style={{ fontSize: '9px' }}>
                          {quote.group_label}
                        </span>
                      )}
                      {quote.sentiment && (
                        <span className="text-[10px]" style={{ color: SENTIMENT_LABELS[quote.sentiment]?.color }}>
                          {SENTIMENT_LABELS[quote.sentiment]?.[lang] ?? quote.sentiment}
                        </span>
                      )}
                    </div>
                    <p className="text-xs leading-relaxed italic" style={{ color: 'var(--ia-text-secondary)' }}>
                      &ldquo;{quote.text}&rdquo;
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }
}

// ── Plain text export ──────────────────────────────────────────────────────────

function buildPlainTextReport(data: ReportData, aiAnalyses: Record<string, AIAnalysis> = {}): string {
  const lines: string[] = [];
  const sep = '═'.repeat(80);
  const subsep = '─'.repeat(60);

  const hasAI = Object.keys(aiAnalyses).length > 0;
  lines.push(sep);
  lines.push(`INTERVIEW ANALYSIS REPORT`);
  lines.push(`Project: ${data.project.name}`);
  if (data.project.description) lines.push(`Description: ${data.project.description}`);
  lines.push(`Project language: ${data.project.language}`);
  lines.push(`Interviews: ${data.meta.total_interviews}`);
  lines.push(`Questions analyzed: ${data.meta.total_canonical_questions} (${data.meta.total_guide_questions} guide + ${data.meta.total_additional_questions} additional)`);
  lines.push(`Generated: ${new Date().toISOString().split('T')[0]}`);
  if (hasAI) lines.push(`Analysis: AI-verified (GPT-5.4, temperature 0.15)`);
  lines.push(sep);
  lines.push('');

  const guideQs = data.questions.filter(q => q.is_guide_question);
  const additionalQs = data.questions.filter(q => !q.is_guide_question);

  if (guideQs.length > 0) {
    lines.push('GUIDE QUESTIONS');
    lines.push(subsep);
    lines.push('');
    for (const q of guideQs) {
      lines.push(...formatQuestion(q, data.meta.total_interviews, aiAnalyses[q.canonical_question_id]));
    }
  }

  if (additionalQs.length > 0) {
    lines.push('');
    lines.push('ADDITIONAL QUESTIONS (raised by participants)');
    lines.push(subsep);
    lines.push('');
    for (const q of additionalQs) {
      lines.push(...formatQuestion(q, data.meta.total_interviews, aiAnalyses[q.canonical_question_id]));
    }
  }

  // Appendix
  lines.push('');
  lines.push(sep);
  lines.push('APPENDIX: METHODOLOGY NOTES');
  lines.push(sep);
  lines.push('');
  lines.push(`Total interviews conducted: ${data.meta.total_interviews}`);
  lines.push(`Participants: ${data.meta.interview_names.join(', ')}`);
  lines.push(`Guide questions: ${data.meta.total_guide_questions}`);
  lines.push(`Additional questions discovered: ${data.meta.total_additional_questions}`);
  lines.push('');

  if (!data.meta.all_questions_asked) {
    lines.push('Questions with incomplete coverage:');
    for (const g of data.meta.questions_with_gaps) {
      lines.push(`  - ${g.question} (${g.coverage})`);
    }
    lines.push('');
  }

  if (data.meta.additional_topics.length > 0) {
    lines.push('Topics raised by participants (not in guide):');
    for (const t of data.meta.additional_topics) {
      lines.push(`  - ${t.text}${t.topic ? ` [${t.topic}]` : ''}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function formatQuestion(q: ReportQuestion, totalInterviews: number, ai?: AIAnalysis): string[] {
  const lines: string[] = [];

  lines.push(`Question ${q.number}: ${q.canonical_text}`);
  if (q.topic_area) lines.push(`Topic: ${q.topic_area}`);
  lines.push(`Coverage: ${q.total_answers}/${totalInterviews} (${q.coverage_pct}%)`);

  const sentParts = Object.entries(q.sentiment_distribution)
    .filter(([, c]) => c > 0)
    .map(([s, c]) => `${s}: ${c}`);
  lines.push(`Sentiment: ${sentParts.join(', ')}`);
  lines.push('');

  if (ai) {
    // AI-verified analysis
    lines.push('Summary:');
    lines.push(ai.summary);
    lines.push('');

    lines.push('Notable Patterns:');
    lines.push(ai.notable_patterns);
    lines.push('');

    lines.push(`Quotes (${ai.selected_quotes.length}):`);
    for (const quote of ai.selected_quotes) {
      const verifiedTag = quote.verified === false ? ' [UNVERIFIED]' : '';
      lines.push(`  [${quote.participant}]${verifiedTag}`);
      lines.push(`  "${quote.quote}"`);
      lines.push(`  → ${quote.relevance}`);
      lines.push('');
    }

    if (ai.quality_notes) {
      lines.push('Quality Notes:');
      lines.push(ai.quality_notes);
      lines.push('');
    }
  } else {
    // Fallback: pipeline summary
    if (q.summary_text) {
      lines.push('Summary:');
      lines.push(q.summary_text);
      lines.push('');
    }

    lines.push(`Quotes (${q.quotes.length}/${q.all_answers.length}):`);
    for (const quote of q.quotes) {
      lines.push(`  [${quote.interview_name}${quote.group_label ? ` | ${quote.group_label}` : ''} | ${quote.sentiment ?? 'n/a'}]`);
      lines.push(`  "${quote.text}"`);
      lines.push('');
    }
  }

  lines.push('─'.repeat(40));
  lines.push('');

  return lines;
}
