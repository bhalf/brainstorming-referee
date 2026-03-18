'use client';

interface SummaryPanelProps {
  summary: string | null;
  updatedAt: string | null;
}

export default function SummaryPanel({ summary, updatedAt }: SummaryPanelProps) {
  if (!summary) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-[var(--text-tertiary)]">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-3 opacity-50">
          <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-sm">Warte auf Zusammenfassung...</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-3 scrollbar-thin">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
          Live-Zusammenfassung
        </h3>
        {updatedAt && (
          <span className="text-[10px] text-[var(--text-tertiary)] font-mono">
            {new Date(updatedAt).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
      <div className="glass-sm p-4">
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">{summary}</p>
      </div>
    </div>
  );
}
