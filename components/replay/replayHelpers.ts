/**
 * Shared types and helper functions for the SessionReplay feature.
 * Extracted from SessionReplayView.tsx for modularity.
 */
import type { TranscriptSegment, Intervention, ConversationStateName } from '@/lib/types';
import { formatPercent } from '@/lib/utils/format';

// --- Types ---

export type TimelineEventType = 'segment' | 'intervention' | 'state_change';

export interface TimelineEvent {
    type: TimelineEventType;
    timestamp: number;
    segment?: TranscriptSegment;
    intervention?: Intervention;
    stateChange?: { state: ConversationStateName; confidence: number };
}

export type FilterSet = Set<TimelineEventType>;

// --- Helpers ---

export function formatDuration(ms: number): string {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}m ${s.toString().padStart(2, '0')}s`;
}

export function formatRelativeTime(timestamp: number, startTime: number): string {
    const elapsed = Math.max(0, timestamp - startTime);
    const totalSec = Math.floor(elapsed / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

export const STATE_COLORS: Record<ConversationStateName, string> = {
    HEALTHY_EXPLORATION: 'text-green-400',
    HEALTHY_ELABORATION: 'text-emerald-400',
    DOMINANCE_RISK: 'text-red-400',
    CONVERGENCE_RISK: 'text-yellow-400',
    STALLED_DISCUSSION: 'text-orange-400',
};

export const STATE_BG_COLORS: Record<ConversationStateName, string> = {
    HEALTHY_EXPLORATION: 'bg-green-500/20 border-green-500/40',
    HEALTHY_ELABORATION: 'bg-emerald-500/20 border-emerald-500/40',
    DOMINANCE_RISK: 'bg-red-500/20 border-red-500/40',
    CONVERGENCE_RISK: 'bg-yellow-500/20 border-yellow-500/40',
    STALLED_DISCUSSION: 'bg-orange-500/20 border-orange-500/40',
};

export const RECOVERY_BADGE: Record<string, { text: string; color: string }> = {
    recovered: { text: 'Recovered', color: 'bg-green-500/30 text-green-300' },
    partial: { text: 'Partial', color: 'bg-yellow-500/30 text-yellow-300' },
    not_recovered: { text: 'Not recovered', color: 'bg-red-500/30 text-red-300' },
    pending: { text: 'Pending', color: 'bg-slate-500/30 text-slate-300' },
};

// --- Speaker Colors ---

export const SPEAKER_COLORS = [
    'text-blue-300', 'text-purple-300', 'text-cyan-300', 'text-pink-300',
    'text-amber-300', 'text-lime-300', 'text-rose-300', 'text-teal-300',
];

export function getSpeakerColor(speaker: string, speakerList: string[]): string {
    const idx = speakerList.indexOf(speaker);
    return SPEAKER_COLORS[idx % SPEAKER_COLORS.length];
}

// Re-export formatPercent for convenience
export { formatPercent };
