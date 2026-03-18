'use client';

import { useState, useMemo } from 'react';
import type { SessionExport, ConversationState } from '@/types';
import { formatTimestamp, getSpeakerColor, STATE_LABELS, INTENT_LABELS } from './utils';

interface Props {
  data: SessionExport;
}

interface TimelineEvent {
  type: 'segment' | 'state_change' | 'intervention';
  timestamp: string;
  segment?: SessionExport['segments'][0];
  intervention?: SessionExport['interventions'][0];
  stateChange?: { state: ConversationState; confidence: number; criteria?: Record<string, number> };
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-amber-400/30 text-[var(--text-primary)] rounded px-0.5">{part}</mark>
        ) : (
          part
        )
      )}
    </>
  );
}

export default function TranscriptTab({ data }: Props) {
  const { session, segments, metrics, interventions, participants } = data;
  const sessionStart = session.started_at || session.created_at;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpeaker, setSelectedSpeaker] = useState<string | null>(null);

  // Build speaker list with colors
  const speakers = useMemo(() => {
    const unique = new Map<string, { name: string; identity: string; color: string }>();
    let idx = 0;
    for (const p of participants) {
      if (!unique.has(p.livekit_identity)) {
        unique.set(p.livekit_identity, {
          name: p.display_name,
          identity: p.livekit_identity,
          color: getSpeakerColor(idx++),
        });
      }
    }
    return Array.from(unique.values());
  }, [participants]);

  const speakerColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    speakers.forEach((s) => { map[s.identity] = s.color; });
    return map;
  }, [speakers]);

  // Build timeline with state changes interleaved
  const timeline = useMemo<TimelineEvent[]>(() => {
    const events: TimelineEvent[] = [];

    // Add final segments
    const finalSegments = segments.filter((s) => s.is_final);
    for (const seg of finalSegments) {
      events.push({ type: 'segment', timestamp: seg.created_at, segment: seg });
    }

    // Add interventions
    for (const iv of interventions) {
      events.push({ type: 'intervention', timestamp: iv.created_at, intervention: iv });
    }

    // Add state changes (deduplicated) with criteria_snapshot (#14)
    let lastState: ConversationState | null = null;
    for (const m of metrics) {
      const state = m.inferred_state?.state;
      if (state && state !== lastState) {
        events.push({
          type: 'state_change',
          timestamp: m.computed_at,
          stateChange: {
            state,
            confidence: m.inferred_state!.confidence,
            criteria: m.inferred_state!.criteria_snapshot,
          },
        });
        lastState = state;
      }
    }

    events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return events;
  }, [segments, metrics, interventions]);

  // Filter
  const filtered = useMemo(() => {
    return timeline.filter((ev) => {
      if (selectedSpeaker && ev.type === 'segment' && ev.segment?.speaker_identity !== selectedSpeaker) {
        return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (ev.type === 'segment') {
          return ev.segment!.text.toLowerCase().includes(q) ||
            ev.segment!.speaker_name.toLowerCase().includes(q);
        }
        if (ev.type === 'intervention') {
          return ev.intervention!.text.toLowerCase().includes(q);
        }
        return true; // Always show state changes
      }
      return true;
    });
  }, [timeline, selectedSpeaker, searchQuery]);

  // State color mapping for badges
  const stateColors: Record<string, string> = {
    HEALTHY_EXPLORATION: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    HEALTHY_ELABORATION: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
    DOMINANCE_RISK: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    CONVERGENCE_RISK: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    STALLED_DISCUSSION: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Suche im Transkript..."
          className="input-glass text-sm flex-1 min-w-[200px]"
        />
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setSelectedSpeaker(null)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
              !selectedSpeaker
                ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-400'
                : 'border-[var(--border-glass)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
            }`}
          >
            Alle
          </button>
          {speakers.map((s) => (
            <button
              key={s.identity}
              onClick={() => setSelectedSpeaker(s.identity === selectedSpeaker ? null : s.identity)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
                selectedSpeaker === s.identity
                  ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-400'
                  : 'border-[var(--border-glass)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
              }`}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
              {s.name}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="glass p-5 space-y-0.5 max-h-[600px] overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-sm text-[var(--text-tertiary)] text-center py-8">Keine Einträge gefunden.</p>
        ) : (
          filtered.map((ev, i) => {
            if (ev.type === 'segment') {
              const seg = ev.segment!;
              const color = speakerColorMap[seg.speaker_identity] || '#818cf8';
              return (
                <div key={`seg-${seg.id}`} className="flex gap-3 py-1.5 hover:bg-white/[0.02] rounded-lg px-2 -mx-2 transition-colors">
                  <span className="text-[10px] font-mono text-[var(--text-tertiary)] w-12 shrink-0 pt-0.5 text-right">
                    {formatTimestamp(seg.created_at, sessionStart)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium mr-2" style={{ color }}>
                      {searchQuery ? <HighlightedText text={seg.speaker_name} query={searchQuery} /> : seg.speaker_name}
                    </span>
                    <span className="text-sm text-[var(--text-primary)]">
                      {searchQuery ? <HighlightedText text={seg.text} query={searchQuery} /> : seg.text}
                    </span>
                  </div>
                </div>
              );
            }

            if (ev.type === 'state_change') {
              const sc = ev.stateChange!;
              const badgeColor = stateColors[sc.state] || 'bg-white/5 text-white/40 border-white/10';
              return (
                <div key={`state-${i}`} className="flex items-center gap-3 py-2 px-2 -mx-2">
                  <span className="text-[10px] font-mono text-[var(--text-tertiary)] w-12 shrink-0 text-right">
                    {formatTimestamp(ev.timestamp, sessionStart)}
                  </span>
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1 border-t border-dashed border-white/[0.08]" />
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${badgeColor}`} title={
                      sc.criteria ? Object.entries(sc.criteria).map(([k, v]) => `${k}: ${Math.round(v * 100)}%`).join(', ') : undefined
                    }>
                      {STATE_LABELS[sc.state]} ({Math.round(sc.confidence * 100)}%)
                    </span>
                    <div className="flex-1 border-t border-dashed border-white/[0.08]" />
                  </div>
                </div>
              );
            }

            if (ev.type === 'intervention') {
              const iv = ev.intervention!;
              return (
                <div key={`iv-${iv.id}`} className="flex gap-3 py-2 px-2 -mx-2 bg-indigo-500/[0.03] rounded-lg border border-indigo-500/10">
                  <span className="text-[10px] font-mono text-[var(--text-tertiary)] w-12 shrink-0 pt-0.5 text-right">
                    {formatTimestamp(iv.created_at, sessionStart)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-indigo-400 mr-2">
                      KI-Moderator
                    </span>
                    <span className="text-[10px] text-[var(--text-tertiary)] mr-2">
                      [{INTENT_LABELS[iv.intent] || iv.intent}]
                    </span>
                    <span className="text-sm text-[var(--text-primary)]">
                      {searchQuery ? <HighlightedText text={iv.text} query={searchQuery} /> : iv.text}
                    </span>
                  </div>
                </div>
              );
            }

            return null;
          })
        )}
      </div>

      <p className="text-xs text-[var(--text-tertiary)]">
        {segments.filter((s) => s.is_final).length} Segmente, {interventions.length} Interventionen
      </p>
    </div>
  );
}
