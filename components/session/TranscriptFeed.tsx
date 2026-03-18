'use client';

import { useEffect, useRef } from 'react';
import type { TranscriptSegment } from '@/types';

interface TranscriptFeedProps {
  segments: TranscriptSegment[];
}

export default function TranscriptFeed({ segments }: TranscriptFeedProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [segments.length]);

  if (segments.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-[var(--text-tertiary)]">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-3 opacity-50">
          <path d="M4 6h16M4 12h16M4 18h12" />
        </svg>
        <p className="text-sm">Warte auf Transkription...</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-3 scrollbar-thin">
      {segments.map((seg) => (
        <div key={seg.id} className="animate-fade-in">
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="text-sm font-medium bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
              {seg.speaker_name}
            </span>
            <span className="text-[10px] text-[var(--text-tertiary)] font-mono">
              {new Date(seg.created_at).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed pl-0">{seg.text}</p>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}
