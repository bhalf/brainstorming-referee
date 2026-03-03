'use client';

import { useEffect, useRef } from 'react';
import { TranscriptSegment } from '@/lib/types';

interface TranscriptFeedProps {
  segments: TranscriptSegment[];
  interimText?: string;
  showTimestamps?: boolean;
  maxHeight?: string;
  speakingParticipants?: Array<{ id: string; displayName: string }>;
}

export default function TranscriptFeed({
  segments,
  interimText = '',
  showTimestamps = true,
  maxHeight = '100%',
  speakingParticipants = [],
}: TranscriptFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new content
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [segments, interimText]);

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  // Group consecutive segments by speaker
  const groupedSegments = segments.reduce<Array<{
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
  }, []);

  if (segments.length === 0 && !interimText) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500 text-sm">
        <div className="text-center">
          <p className="mb-2">📝</p>
          <p>Live transcript will appear here</p>
          <p className="text-xs mt-1 text-slate-600">
            Click the microphone button to start
          </p>
        </div>
      </div>
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

      {/* Interim text (currently being spoken) */}
      {interimText && (
        <div className="bg-slate-700/20 rounded-lg p-3 border border-dashed border-slate-600">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-yellow-600/50 flex items-center justify-center">
              <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
            </div>
            <span className="text-sm font-medium text-slate-400">
              Speaking...
            </span>
          </div>
          <div className="text-sm text-slate-400 italic leading-relaxed pl-8">
            {interimText}
          </div>
        </div>
      )}

      {/* Scroll anchor */}
      <div ref={endRef} />

      {/* Remote participants speaking indicators */}
      {speakingParticipants.length > 0 && (
        <div className="flex flex-col gap-2 p-2">
            {speakingParticipants.map(participant => (
                <div key={participant.id} className="flex items-center gap-2 bg-slate-800/50 rounded-lg p-2 border border-slate-700">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-xs text-slate-400 font-medium">
                        {participant.displayName} is speaking...
                    </span>
                </div>
            ))}
        </div>
      )}
    </div>
  );
}

