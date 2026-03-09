import { useEffect, useRef, useCallback, useState, MutableRefObject } from 'react';
import { useLatestRef } from '@/lib/hooks/useLatestRef';
import { apiPost, apiFireAndForget } from '@/lib/services/apiClient';
import { supabase } from '@/lib/supabase/client';
import type { TranscriptSegment, Idea, ModelRoutingLogEntry } from '@/lib/types';
import type { RealtimeChannel } from '@supabase/supabase-js';

// --- Config ---

const SUMMARY_INTERVAL_MS = 60_000; // Generate every 60 seconds
const MIN_NEW_SEGMENTS = 3;          // Minimum new segments before triggering

// --- Types ---

export interface LiveSummaryState {
    summary: string | null;
    isLoading: boolean;
    lastUpdatedAt: number | null;
}

interface UseLiveSummaryParams {
    isActive: boolean;
    isDecisionOwner: boolean;
    sessionId: string | null;
    transcriptSegmentsRef: MutableRefObject<TranscriptSegment[]>;
    ideas: Idea[];
    language: string;
    addModelRoutingLog: (entry: ModelRoutingLogEntry) => void;
    addError: (message: string, context?: string) => void;
}

// --- Hook ---

export function useLiveSummary({
    isActive,
    isDecisionOwner,
    sessionId,
    transcriptSegmentsRef,
    ideas,
    language,
    addModelRoutingLog,
    addError,
}: UseLiveSummaryParams): LiveSummaryState {
    const [summary, setSummary] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

    const lastSummarizedIndexRef = useRef(0);
    const previousSummaryRef = useRef<string | null>(null);
    const isLoadingRef = useRef(false);
    const ideasRef = useLatestRef(ideas);
    const channelRef = useRef<RealtimeChannel | null>(null);

    // --- Decision owner: periodically generate summary ---
    const generateSummary = useCallback(async () => {
        if (!sessionId || isLoadingRef.current) return;

        const segments = transcriptSegmentsRef.current;
        const newSegments = segments.slice(lastSummarizedIndexRef.current);

        if (newSegments.length < MIN_NEW_SEGMENTS && !previousSummaryRef.current) return;
        // If we already have a summary but no new segments, skip
        if (newSegments.length === 0) return;

        isLoadingRef.current = true;
        setIsLoading(true);

        try {
            const activeIdeas = ideasRef.current.filter(i => !i.isDeleted);
            const result = await apiPost('/api/summary/live', {
                previousSummary: previousSummaryRef.current,
                newSegments: newSegments.map(s => ({ speaker: s.speaker, text: s.text })),
                ideas: activeIdeas.map(i => ({ title: i.title, description: i.description })),
                language,
            }) as { summary?: string; logEntry?: ModelRoutingLogEntry };

            if (result.logEntry) {
                addModelRoutingLog(result.logEntry);
            }

            if (result.summary) {
                previousSummaryRef.current = result.summary;
                lastSummarizedIndexRef.current = segments.length;
                setSummary(result.summary);
                setLastUpdatedAt(Date.now());

                // Persist to session_events so other participants can receive it
                apiFireAndForget('/api/session/events', {
                    method: 'POST',
                    body: JSON.stringify({
                        sessionId,
                        eventType: 'live_summary',
                        payload: { summary: result.summary },
                        actor: 'system',
                        timestamp: Date.now(),
                    }),
                });
            }
        } catch (err) {
            console.error('[LiveSummary] Generation failed:', err);
            addError('Live summary generation failed', 'useLiveSummary');
        } finally {
            isLoadingRef.current = false;
            setIsLoading(false);
        }
    }, [sessionId, transcriptSegmentsRef, language, addModelRoutingLog, addError]);

    // Decision owner: interval-based generation
    useEffect(() => {
        if (!isActive || !isDecisionOwner || !sessionId) return;

        const interval = setInterval(generateSummary, SUMMARY_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [isActive, isDecisionOwner, sessionId, generateSummary]);

    // --- Non-owners: listen for summary via Supabase Realtime on session_events ---
    useEffect(() => {
        if (!sessionId || !isActive || isDecisionOwner) return;

        const channel = supabase
            .channel(`live-summary-${sessionId}-${Date.now()}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'session_events',
                filter: `session_id=eq.${sessionId}`,
            }, (payload) => {
                const row = payload.new as { event_type: string; payload: { summary: string } | null; timestamp: number };
                if (row.event_type === 'live_summary' && row.payload?.summary) {
                    setSummary(row.payload.summary);
                    setLastUpdatedAt(row.timestamp);
                }
            })
            .subscribe();

        channelRef.current = channel;

        // Also fetch the latest summary on mount
        (async () => {
            try {
                const { data } = await supabase
                    .from('session_events')
                    .select('payload, timestamp')
                    .eq('session_id', sessionId)
                    .eq('event_type', 'live_summary')
                    .order('timestamp', { ascending: false })
                    .limit(1);

                if (data && data.length > 0) {
                    const entry = data[0] as { payload: { summary: string } | null; timestamp: number };
                    if (entry.payload?.summary) {
                        setSummary(entry.payload.summary);
                        setLastUpdatedAt(entry.timestamp);
                    }
                }
            } catch (err) {
                console.error('[LiveSummary] Failed to fetch initial summary:', err);
            }
        })();

        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, [sessionId, isActive, isDecisionOwner]);

    return { summary, isLoading, lastUpdatedAt };
}
