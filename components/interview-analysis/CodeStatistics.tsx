'use client';

import { useState, useEffect, useMemo } from 'react';
import type { IACode, CodeFrequency } from '@/types/interview-analysis';
import { useIALang, t } from '@/lib/interview-analysis/i18n';

interface CodeStatisticsProps {
  projectId: string;
  codes: IACode[];
}

interface StatsData {
  frequencies: CodeFrequency[];
  co_occurrences: Array<{ code_a_id: string; code_b_id: string; count: number }>;
}

type SortKey = 'name' | 'count' | 'interview_count' | 'question_count';

export default function CodeStatistics({ projectId, codes }: CodeStatisticsProps) {
  const lang = useIALang();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('count');
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/interview-analysis/projects/${projectId}/code-stats`);
        if (res.ok) setStats(await res.json());
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, [projectId]);

  const sortedFrequencies = useMemo(() => {
    if (!stats) return [];
    const sorted = [...stats.frequencies];
    sorted.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') cmp = a.code.name.localeCompare(b.code.name);
      else if (sortKey === 'count') cmp = a.count - b.count;
      else if (sortKey === 'interview_count') cmp = a.interview_count - b.interview_count;
      else if (sortKey === 'question_count') cmp = a.question_count - b.question_count;
      return sortAsc ? cmp : -cmp;
    });
    return sorted;
  }, [stats, sortKey, sortAsc]);

  // Co-occurrence: build a matrix of codes that have assignments
  const coOccurrenceData = useMemo(() => {
    if (!stats) return { codes: [] as IACode[], matrix: new Map<string, number>() };
    const activeCodes = codes.filter(c => stats.frequencies.some(f => f.code.id === c.id && f.count > 0));
    const matrix = new Map<string, number>();
    for (const co of stats.co_occurrences) {
      matrix.set(`${co.code_a_id}|${co.code_b_id}`, co.count);
      matrix.set(`${co.code_b_id}|${co.code_a_id}`, co.count);
    }
    return { codes: activeCodes, matrix };
  }, [stats, codes]);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  }

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return '';
    return sortAsc ? ' ↑' : ' ↓';
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '20vh' }}>
        <div className="ia-skeleton" style={{ width: 40, height: 40, borderRadius: '50%' }} />
      </div>
    );
  }

  if (!stats || stats.frequencies.every(f => f.count === 0)) {
    return (
      <div className="ia-card p-8 text-center">
        <p className="text-sm" style={{ color: 'var(--ia-text-tertiary)' }}>
          {t('coding_no_assignments', lang)}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Frequency table */}
      <div className="ia-card p-5">
        <div className="ia-section-header">
          <h3 className="ia-section-title">
            {t('coding_frequency', lang)}
          </h3>
        </div>
        <div className="ia-scroll-x">
          <table className="ia-table">
            <thead>
              <tr>
                <th
                  className="ia-table-sortable"
                  onClick={() => handleSort('name')}
                >
                  Code{sortIndicator('name')}
                </th>
                <th
                  className="ia-table-sortable"
                  style={{ textAlign: 'right' }}
                  onClick={() => handleSort('count')}
                >
                  {t('coding_assignments', lang)}{sortIndicator('count')}
                </th>
                <th
                  className="ia-table-sortable"
                  style={{ textAlign: 'right' }}
                  onClick={() => handleSort('interview_count')}
                >
                  {t('interviews', lang)}{sortIndicator('interview_count')}
                </th>
                <th
                  className="ia-table-sortable"
                  style={{ textAlign: 'right' }}
                  onClick={() => handleSort('question_count')}
                >
                  {t('questions', lang)}{sortIndicator('question_count')}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedFrequencies.map(f => (
                <tr key={f.code.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: f.code.color }} />
                      <span>{f.code.name}</span>
                    </div>
                  </td>
                  <td className="ia-table-num">{f.count}</td>
                  <td className="ia-table-num" style={{ color: 'var(--ia-text-secondary)' }}>{f.interview_count}</td>
                  <td className="ia-table-num" style={{ color: 'var(--ia-text-secondary)' }}>{f.question_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Co-occurrence matrix */}
      {coOccurrenceData.codes.length >= 2 && (
        <div className="ia-card p-5">
          <div className="ia-section-header">
            <h3 className="ia-section-title">
              {t('coding_co_occurrence', lang)}
            </h3>
          </div>
          <div className="ia-scroll-x">
            <table className="text-[11px]" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th className="py-1 px-2" />
                  {coOccurrenceData.codes.map(c => (
                    <th
                      key={c.id}
                      className="py-1 px-2 text-center"
                      style={{ color: c.color, maxWidth: 80 }}
                    >
                      <div className="truncate" style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)', maxHeight: 80 }}>
                        {c.name}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {coOccurrenceData.codes.map(row => (
                  <tr key={row.id}>
                    <td className="py-1 px-2 truncate" style={{ color: row.color, maxWidth: 100 }}>
                      {row.name}
                    </td>
                    {coOccurrenceData.codes.map(col => {
                      if (row.id === col.id) {
                        return (
                          <td key={col.id} className="py-1 px-2 text-center" style={{ backgroundColor: 'var(--ia-surface-2)' }}>
                            —
                          </td>
                        );
                      }
                      const count = coOccurrenceData.matrix.get(`${row.id}|${col.id}`) ?? 0;
                      const maxCount = Math.max(...Array.from(coOccurrenceData.matrix.values()), 1);
                      const intensity = count / maxCount;
                      return (
                        <td
                          key={col.id}
                          className="py-1 px-2 text-center ia-data"
                          style={{
                            backgroundColor: count > 0 ? `rgba(99, 102, 241, ${0.1 + intensity * 0.4})` : undefined,
                            color: count > 0 ? 'var(--ia-text)' : 'var(--ia-text-tertiary)',
                          }}
                        >
                          {count || '·'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
