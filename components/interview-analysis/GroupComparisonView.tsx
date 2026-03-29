'use client';

import { useState, useMemo, useEffect } from 'react';
import type { MatrixQuestion, IAInterview, Sentiment } from '@/types/interview-analysis';
import { useIALang, t, pickLang } from '@/lib/interview-analysis/i18n';

interface GroupComparisonViewProps {
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

const GROUP_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16',
];

function groupColor(label: string): string {
  let hash = 0;
  for (let i = 0; i < label.length; i++) hash = (hash * 31 + label.charCodeAt(i)) | 0;
  return GROUP_COLORS[Math.abs(hash) % GROUP_COLORS.length];
}

interface GroupData {
  label: string;
  interviews: IAInterview[];
  answersByQuestion: Map<string, { sentiment: Sentiment | null; text: string; interview_name: string }[]>;
  totalWords: number;
  sentimentCounts: Record<string, number>;
  coverage: number; // % of questions answered
}

function buildGroupData(
  groupLabel: string,
  groupInterviews: IAInterview[],
  questions: MatrixQuestion[],
): GroupData {
  const interviewIds = new Set(groupInterviews.map(i => i.id));
  const answersByQuestion = new Map<string, { sentiment: Sentiment | null; text: string; interview_name: string }[]>();
  const sentimentCounts: Record<string, number> = { positive: 0, negative: 0, neutral: 0, ambivalent: 0 };
  let questionsWithAnswers = 0;

  for (const q of questions) {
    const groupAnswers = q.answers.filter(a => interviewIds.has(a.interview_id));
    answersByQuestion.set(q.canonical.id, groupAnswers.map(a => ({
      sentiment: a.sentiment,
      text: a.answer_text,
      interview_name: a.interview_name,
    })));
    if (groupAnswers.length > 0) questionsWithAnswers++;
    for (const a of groupAnswers) {
      const s = a.sentiment ?? 'neutral';
      sentimentCounts[s] = (sentimentCounts[s] || 0) + 1;
    }
  }

  return {
    label: groupLabel,
    interviews: groupInterviews,
    answersByQuestion,
    totalWords: groupInterviews.reduce((sum, i) => sum + (i.word_count ?? 0), 0),
    sentimentCounts,
    coverage: questions.length > 0 ? questionsWithAnswers / questions.length : 0,
  };
}

function SentimentBar({ counts, height = 6 }: { counts: Record<string, number>; height?: number }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) return <div style={{ height, borderRadius: height / 2, background: 'var(--ia-bg-muted)' }} />;

  return (
    <div style={{ display: 'flex', borderRadius: height / 2, overflow: 'hidden', height }}>
      {(['positive', 'neutral', 'ambivalent', 'negative'] as const).map(s => {
        const pct = (counts[s] ?? 0) / total * 100;
        if (pct === 0) return null;
        return <div key={s} style={{ width: `${pct}%`, background: SENTIMENT_COLORS[s] }} />;
      })}
    </div>
  );
}

function SentimentDot({ sentiment }: { sentiment: Sentiment | null }) {
  const s = sentiment ?? 'neutral';
  return (
    <span
      style={{
        display: 'inline-block',
        width: 8, height: 8, borderRadius: '50%',
        background: SENTIMENT_COLORS[s],
        flexShrink: 0,
      }}
    />
  );
}

export default function GroupComparisonView({ questions, interviews, projectLanguage }: GroupComparisonViewProps) {
  const lang = useIALang();
  const [section, setSection] = useState<'overview' | 'inter' | 'intra'>('overview');
  const [groupA, setGroupA] = useState('');
  const [groupB, setGroupB] = useState('');
  const [intraGroup, setIntraGroup] = useState('');
  const [onlyDiff, setOnlyDiff] = useState(false);

  const groupLabels = useMemo(
    () => [...new Set(interviews.map(i => i.group_label).filter((g): g is string => !!g))].sort(),
    [interviews]
  );

  const groupsMap = useMemo(() => {
    const map = new Map<string, GroupData>();
    for (const label of groupLabels) {
      const gInterviews = interviews.filter(i => i.group_label === label);
      map.set(label, buildGroupData(label, gInterviews, questions));
    }
    return map;
  }, [groupLabels, interviews, questions]);

  // Auto-select groups
  useEffect(() => {
    if (groupLabels.length >= 2 && !groupA) {
      setGroupA(groupLabels[0]);
      setGroupB(groupLabels[1]);
    }
    if (groupLabels.length >= 1 && !intraGroup) {
      setIntraGroup(groupLabels[0]);
    }
  }, [groupLabels, groupA, intraGroup]);

  if (groupLabels.length === 0) {
    return (
      <div className="ia-card ia-empty">
        <svg className="ia-empty-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        <p className="text-sm font-medium" style={{ color: 'var(--ia-text-secondary)' }}>
          {t('groups_no_groups', lang)}
        </p>
      </div>
    );
  }

  const sections = [
    { key: 'overview' as const, label: t('groups_overview', lang) },
    { key: 'inter' as const, label: t('groups_inter', lang) },
    { key: 'intra' as const, label: t('groups_intra', lang) },
  ];

  return (
    <div className="space-y-5">
      {/* Section Toggle */}
      <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--ia-bg-muted)' }}>
        {sections.map(s => (
          <button
            key={s.key}
            className="ia-btn flex-1 text-xs py-2 rounded-md transition-all"
            style={{
              background: section === s.key ? 'var(--ia-bg-card)' : 'transparent',
              color: section === s.key ? 'var(--ia-text)' : 'var(--ia-text-secondary)',
              boxShadow: section === s.key ? 'var(--ia-shadow-xs)' : 'none',
              fontWeight: section === s.key ? 600 : 500,
            }}
            onClick={() => setSection(s.key)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* ─── Section A: Overview ─── */}
      {section === 'overview' && (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
          {groupLabels.map(label => {
            const g = groupsMap.get(label)!;
            const color = groupColor(label);
            return (
              <div key={label} className="ia-card p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ background: color }}
                  />
                  <h3 className="font-semibold text-sm" style={{ color: 'var(--ia-text)' }}>
                    {label}
                  </h3>
                </div>

                <div className="space-y-3">
                  {/* Members */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: 'var(--ia-text-secondary)' }}>
                      {t('groups_members', lang)}
                    </span>
                    <span className="text-xs font-medium ia-data" style={{ color: 'var(--ia-text)' }}>
                      {g.interviews.length}
                    </span>
                  </div>

                  {/* Words */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: 'var(--ia-text-secondary)' }}>
                      {t('groups_words', lang)}
                    </span>
                    <span className="text-xs font-medium ia-data" style={{ color: 'var(--ia-text)' }}>
                      {g.totalWords.toLocaleString()}
                    </span>
                  </div>

                  {/* Coverage */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: 'var(--ia-text-secondary)' }}>
                      {t('group_coverage', lang)}
                    </span>
                    <span className="text-xs font-medium ia-data" style={{ color: 'var(--ia-text)' }}>
                      {Math.round(g.coverage * 100)}%
                    </span>
                  </div>

                  {/* Sentiment */}
                  <div>
                    <span className="text-xs block mb-1.5" style={{ color: 'var(--ia-text-secondary)' }}>
                      {t('groups_sentiment_dist', lang)}
                    </span>
                    <SentimentBar counts={g.sentimentCounts} />
                    <div className="flex gap-3 mt-1.5">
                      {(['positive', 'negative', 'neutral', 'ambivalent'] as const).map(s => {
                        const c = g.sentimentCounts[s] ?? 0;
                        if (c === 0) return null;
                        return (
                          <span key={s} className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--ia-text-tertiary)' }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: SENTIMENT_COLORS[s], display: 'inline-block' }} />
                            {c}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Member names */}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {g.interviews.map(iv => (
                      <span key={iv.id} className="ia-badge ia-badge-neutral" style={{ fontSize: '10px' }}>
                        {iv.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Section B: Inter-Group Comparison ─── */}
      {section === 'inter' && (
        <div className="space-y-4">
          {/* Group Selectors */}
          <div className="flex items-center gap-3 flex-wrap">
            <div>
              <label className="block text-[10px] font-semibold mb-1" style={{ color: groupA ? groupColor(groupA) : 'var(--ia-text-secondary)', letterSpacing: '0.05em' }}>
                {t('groups_select_a', lang)}
              </label>
              <select
                className="ia-select text-xs"
                value={groupA}
                onChange={e => setGroupA(e.target.value)}
              >
                {groupLabels.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            <button
              className="ia-btn ia-btn-ghost ia-btn-sm mt-4"
              onClick={() => { const tmp = groupA; setGroupA(groupB); setGroupB(tmp); }}
              title={t('groups_swap', lang)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </button>

            <div>
              <label className="block text-[10px] font-semibold mb-1" style={{ color: groupB ? groupColor(groupB) : 'var(--ia-text-secondary)', letterSpacing: '0.05em' }}>
                {t('groups_select_b', lang)}
              </label>
              <select
                className="ia-select text-xs"
                value={groupB}
                onChange={e => setGroupB(e.target.value)}
              >
                {groupLabels.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            <label className="flex items-center gap-1.5 mt-4 text-xs cursor-pointer" style={{ color: 'var(--ia-text-secondary)' }}>
              <input
                type="checkbox"
                checked={onlyDiff}
                onChange={e => setOnlyDiff(e.target.checked)}
                style={{ accentColor: 'var(--ia-accent)' }}
              />
              {t('groups_only_diff', lang)}
            </label>
          </div>

          {/* Comparison Table */}
          {groupA && groupB && groupA !== groupB && (
            <InterGroupTable
              groupA={groupsMap.get(groupA)!}
              groupB={groupsMap.get(groupB)!}
              questions={questions}
              onlyDiff={onlyDiff}
              lang={lang}
              projectLanguage={projectLanguage}
            />
          )}
        </div>
      )}

      {/* ─── Section C: Intra-Group Agreement ─── */}
      {section === 'intra' && (
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-semibold mb-1" style={{ color: 'var(--ia-text-secondary)', letterSpacing: '0.05em' }}>
              {t('groups_select_group', lang)}
            </label>
            <select
              className="ia-select text-xs"
              value={intraGroup}
              onChange={e => setIntraGroup(e.target.value)}
            >
              {groupLabels.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          {intraGroup && groupsMap.has(intraGroup) && (
            <IntraGroupView
              group={groupsMap.get(intraGroup)!}
              questions={questions}
              lang={lang}
              projectLanguage={projectLanguage}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Inter-Group Table ────────────────────────────────────────────────────────

function InterGroupTable({
  groupA, groupB, questions, onlyDiff, lang, projectLanguage,
}: {
  groupA: GroupData; groupB: GroupData; questions: MatrixQuestion[];
  onlyDiff: boolean; lang: 'de' | 'en'; projectLanguage: string;
}) {
  const rows = questions.map(q => {
    const aAnswers = groupA.answersByQuestion.get(q.canonical.id) ?? [];
    const bAnswers = groupB.answersByQuestion.get(q.canonical.id) ?? [];
    const aSentiments = sentimentCounts(aAnswers);
    const bSentiments = sentimentCounts(bAnswers);
    const dominant_a = dominantSentiment(aSentiments);
    const dominant_b = dominantSentiment(bSentiments);
    const isDifferent = dominant_a !== dominant_b;
    return { q, aAnswers, bAnswers, aSentiments, bSentiments, isDifferent };
  });

  const filtered = onlyDiff ? rows.filter(r => r.isDifferent) : rows;

  if (filtered.length === 0) {
    return (
      <div className="ia-card p-6 text-center">
        <p className="text-sm" style={{ color: 'var(--ia-text-secondary)' }}>
          {t('groups_no_diff', lang)}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {filtered.map(({ q, aSentiments, bSentiments, isDifferent }) => (
        <div
          key={q.canonical.id}
          className="ia-card-sm p-4"
          style={isDifferent ? { borderLeft: `3px solid ${SENTIMENT_COLORS.ambivalent}` } : undefined}
        >
          <p className="text-xs font-medium mb-3" style={{ color: 'var(--ia-text)' }}>
            {pickLang(q.canonical.canonical_text, q.canonical.canonical_text_alt, lang, projectLanguage)}
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] font-semibold block mb-1" style={{ color: groupColor(groupA.label) }}>
                {groupA.label}
              </span>
              <SentimentBar counts={aSentiments} />
              <SentimentLegend counts={aSentiments} />
            </div>
            <div>
              <span className="text-[10px] font-semibold block mb-1" style={{ color: groupColor(groupB.label) }}>
                {groupB.label}
              </span>
              <SentimentBar counts={bSentiments} />
              <SentimentLegend counts={bSentiments} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SentimentLegend({ counts }: { counts: Record<string, number> }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  return (
    <div className="flex gap-2 mt-1">
      {(['positive', 'negative', 'neutral', 'ambivalent'] as const).map(s => {
        const c = counts[s] ?? 0;
        if (c === 0) return null;
        return (
          <span key={s} className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--ia-text-tertiary)' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: SENTIMENT_COLORS[s], display: 'inline-block' }} />
            {c}
          </span>
        );
      })}
    </div>
  );
}

function sentimentCounts(answers: { sentiment: Sentiment | null }[]): Record<string, number> {
  const c: Record<string, number> = { positive: 0, negative: 0, neutral: 0, ambivalent: 0 };
  for (const a of answers) c[a.sentiment ?? 'neutral']++;
  return c;
}

function dominantSentiment(counts: Record<string, number>): string {
  let max = 0;
  let dominant = 'neutral';
  for (const [s, c] of Object.entries(counts)) {
    if (c > max) { max = c; dominant = s; }
  }
  return dominant;
}

// ─── Intra-Group View ─────────────────────────────────────────────────────────

function IntraGroupView({
  group, questions, lang, projectLanguage,
}: {
  group: GroupData; questions: MatrixQuestion[]; lang: 'de' | 'en'; projectLanguage: string;
}) {
  let agreeCount = 0;
  let totalWithAnswers = 0;

  const rows = questions.map(q => {
    const answers = group.answersByQuestion.get(q.canonical.id) ?? [];
    if (answers.length === 0) return { q, answers, allAgree: null as boolean | null };
    totalWithAnswers++;
    const sentiments = new Set(answers.map(a => a.sentiment ?? 'neutral'));
    const allAgree = sentiments.size <= 1;
    if (allAgree) agreeCount++;
    return { q, answers, allAgree };
  });

  const agreementScore = totalWithAnswers > 0 ? agreeCount / totalWithAnswers : 0;

  return (
    <div className="space-y-4">
      {/* Agreement Score Card */}
      <div className="ia-card p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--ia-text)' }}>
              {t('groups_agreement', lang)}
            </h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--ia-text-tertiary)' }}>
              {t('groups_agreement_desc', lang)}
            </p>
          </div>
          <div
            className="text-2xl font-bold ia-data"
            style={{
              color: agreementScore >= 0.7 ? SENTIMENT_COLORS.positive
                : agreementScore >= 0.4 ? SENTIMENT_COLORS.ambivalent
                : SENTIMENT_COLORS.negative,
            }}
          >
            {Math.round(agreementScore * 100)}%
          </div>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: 'var(--ia-bg-muted)', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${agreementScore * 100}%`,
              borderRadius: 4,
              background: agreementScore >= 0.7 ? SENTIMENT_COLORS.positive
                : agreementScore >= 0.4 ? SENTIMENT_COLORS.ambivalent
                : SENTIMENT_COLORS.negative,
              transition: 'width 0.3s',
            }}
          />
        </div>
        <div className="flex justify-between mt-1.5 text-[10px]" style={{ color: 'var(--ia-text-tertiary)' }}>
          <span>{agreeCount} {t('groups_all_agree', lang)}</span>
          <span>{totalWithAnswers - agreeCount} {t('groups_mixed', lang)}</span>
        </div>
      </div>

      {/* Per-Question Answers */}
      <div className="space-y-2">
        {rows.map(({ q, answers, allAgree }) => {
          if (answers.length === 0) return null;
          return (
            <div
              key={q.canonical.id}
              className="ia-card-sm p-4"
              style={allAgree === false ? { borderLeft: `3px solid ${SENTIMENT_COLORS.ambivalent}` } : undefined}
            >
              <div className="flex items-center gap-2 mb-2">
                <p className="text-xs font-medium flex-1" style={{ color: 'var(--ia-text)' }}>
                  {pickLang(q.canonical.canonical_text, q.canonical.canonical_text_alt, lang, projectLanguage)}
                </p>
                <span
                  className="ia-badge text-[10px] flex-shrink-0"
                  style={{
                    background: allAgree ? `${SENTIMENT_COLORS.positive}15` : `${SENTIMENT_COLORS.ambivalent}15`,
                    color: allAgree ? SENTIMENT_COLORS.positive : SENTIMENT_COLORS.ambivalent,
                  }}
                >
                  {allAgree ? t('groups_all_agree', lang) : t('groups_mixed', lang)}
                </span>
              </div>
              <div className="space-y-2">
                {answers.map((a, i) => (
                  <div key={i} className="flex gap-2">
                    <SentimentDot sentiment={a.sentiment} />
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] font-medium block" style={{ color: 'var(--ia-text-secondary)' }}>
                        {a.interview_name}
                      </span>
                      <p className="text-xs mt-0.5 line-clamp-3" style={{ color: 'var(--ia-text)' }}>
                        {a.text}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
