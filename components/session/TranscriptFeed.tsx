'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { TranscriptSegment } from '@/types';

interface TranscriptFeedProps {
  segments: TranscriptSegment[];
}

export default function TranscriptFeed({ segments }: TranscriptFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unseenCount, setUnseenCount] = useState(0);
  const prevLengthRef = useRef(segments.length);

  // Track scroll position
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    setIsAtBottom(atBottom);
    if (atBottom) setUnseenCount(0);
  }, []);

  // Auto-scroll only when user is at bottom
  useEffect(() => {
    const newCount = segments.length - prevLengthRef.current;
    prevLengthRef.current = segments.length;

    if (newCount <= 0) return;

    if (isAtBottom) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else {
      setUnseenCount((prev) => prev + newCount);
    }
  }, [segments.length, isAtBottom]);

  const scrollToBottom = useCallback(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
    setUnseenCount(0);
  }, []);

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
    <div className="h-full relative">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto p-4 space-y-3 scrollbar-thin"
      >
        {segments.map((seg, i) => {
          // Show topic badge when topic changes from previous segment
          const prevTopic = i > 0 ? segments[i - 1].topic_subdimension : undefined;
          const showTopicBadge = seg.topic_subdimension && seg.topic_subdimension !== prevTopic;

          return (
            <div key={seg.id}>
              {showTopicBadge && (
                <div className="flex items-center gap-2 mb-2 mt-1">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent" />
                  <span className="text-[9px] font-semibold text-indigo-400/70 uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/8 border border-indigo-500/15">
                    {seg.topic_subdimension}
                  </span>
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent" />
                </div>
              )}
              <div className="animate-fade-in">
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
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* "New messages" button when scrolled up */}
      {unseenCount > 0 && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-500/90 text-white text-xs font-medium shadow-lg shadow-indigo-500/25 hover:bg-indigo-500 transition-all animate-fade-in backdrop-blur-sm"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M19 12l-7 7-7-7" />
          </svg>
          {unseenCount} neue {unseenCount === 1 ? 'Nachricht' : 'Nachrichten'}
        </button>
      )}
    </div>
  );
}
