'use client';

import { useState, useEffect } from 'react';

interface SummaryPanelProps {
  summary: string | null;
  updatedAt: string | null;
}

function useRelativeTime(dateStr: string | null) {
  const [label, setLabel] = useState('');

  useEffect(() => {
    if (!dateStr) { setLabel(''); return; }

    const tick = () => {
      const diff = Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000));
      if (diff < 10) setLabel('Gerade eben');
      else if (diff < 60) setLabel(`vor ${diff}s`);
      else if (diff < 3600) setLabel(`vor ${Math.floor(diff / 60)} Min`);
      else setLabel(`vor ${Math.floor(diff / 3600)} Std`);
    };

    tick();
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, [dateStr]);

  return label;
}

export default function SummaryPanel({ summary, updatedAt }: SummaryPanelProps) {
  const relativeTime = useRelativeTime(updatedAt);
  const isFresh = updatedAt ? (Date.now() - new Date(updatedAt).getTime()) < 30_000 : false;

  if (!summary) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-[var(--text-tertiary)]">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-3 opacity-50">
          <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-sm">Warte auf Zusammenfassung...</p>
        <p className="text-[10px] mt-1.5 text-[var(--text-tertiary)]">Erscheint nach den ersten Minuten</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-3 scrollbar-thin">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
            Live-Zusammenfassung
          </h3>
          {isFresh && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
          )}
        </div>
        {relativeTime && (
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
            isFresh
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'text-[var(--text-tertiary)] bg-white/[0.04]'
          }`}>
            {relativeTime}
          </span>
        )}
      </div>
      <div className={`glass-sm p-4 transition-all duration-500 ${isFresh ? 'ring-1 ring-emerald-500/20' : ''}`}>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">{summary}</p>
      </div>
    </div>
  );
}
