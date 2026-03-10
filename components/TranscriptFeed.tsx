'use client';

import React, { useEffect, useRef, useMemo } from 'react';
import { TranscriptSegment } from '@/lib/types';
import { formatTime } from '@/lib/utils/format';
import EmptyState from './shared/EmptyState';

export interface InterimEntry {
  speaker: string;
  text: string;
}

interface TranscriptFeedProps {
  segments: TranscriptSegment[];
  /** Per-speaker interim transcripts — one entry per actively speaking participant */
  interimEntries?: InterimEntry[];
  showTimestamps?: boolean;
  maxHeight?: string;
}

function TranscriptFeedInner({
  segments,
  interimEntries = [],
  showTimestamps = true,
  maxHeight = '100%',
}: TranscriptFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced auto-scroll to bottom on new content (500ms debounce)
  useEffect(() => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 500);
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [segments, interimEntries]);

  // Memoized grouping of consecutive segments by speaker
  const groupedSegments = useMemo(() =>
    segments.reduce<Array<{
      speaker: string;
      segments: TranscriptSegment[];
      startTime: number;
    }>>((groups, segment) => {
      const lastGroup = groups[groups.length - 1];

      if (lastGroup && lastGroup.speaker === segment.speaker) {
        lastGroup.segments.push(segment);
      } else {
        groups.push({
          speaker: segment.speaker,
          segments: [segment],
          startTime: segment.timestamp,
        });
      }

      return groups;
    }, []),
  [segments]);

  if (segments.length === 0 && interimEntries.length === 0) {
    return (
      <EmptyState
        icon="📝"
        title="Live transcript will appear here"
        subtitle="Click the microphone button to start"
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-full overflow-y-auto pr-2 space-y-3"
      style={{ maxHeight }}
    >
      {groupedSegments.map((group, groupIndex) => (
        <div
          key={`group-${groupIndex}`}
          className="bg-slate-700/30 rounded-lg p-3"
        >
          {/* Speaker header */}
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs font-medium text-white">
              {group.speaker.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-medium text-slate-300">
              {group.speaker}
            </span>
            {showTimestamps && (
              <span className="text-xs text-slate-500 ml-auto">
                {formatTime(group.startTime)}
              </span>
            )}
          </div>

          {/* Transcript text */}
          <div className="text-sm text-slate-200 leading-relaxed pl-8">
            {group.segments.map((segment, segIndex) => (
              <span
                key={segment.id}
                className={segment.isFinal ? '' : 'text-slate-400 italic'}
              >
                {segment.text}
                {segIndex < group.segments.length - 1 ? ' ' : ''}
              </span>
            ))}
          </div>
        </div>
      ))}

      {/* Per-speaker interim entries (yellow boxes) */}
      {interimEntries.map((entry) => (
        <div
          key={`interim-${entry.speaker}`}
          className="bg-yellow-900/20 rounded-lg p-3 border border-dashed border-yellow-600/40"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-yellow-600/50 flex items-center justify-center">
              <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
            </div>
            <span className="text-sm font-medium text-yellow-300/80">
              {entry.speaker}
            </span>
            <span className="text-xs text-yellow-500/60">speaking…</span>
          </div>
          {entry.text ? (
            <div className="text-sm text-yellow-200/70 italic leading-relaxed pl-8">
              {entry.text}
            </div>
          ) : (
            <div className="text-sm text-yellow-200/40 italic leading-relaxed pl-8">
              …
            </div>
          )}
        </div>
      ))}

      {/* Scroll anchor — AFTER all content so auto-scroll catches everything */}
      <div ref={endRef} />
    </div>
  );
}

const TranscriptFeed = React.memo(TranscriptFeedInner);
export default TranscriptFeed;
