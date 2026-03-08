import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Generic hook for subscribing to Supabase Realtime Postgres Changes.
 * Encapsulates the shared channel setup, reconnect logic, and cleanup
 * that was previously duplicated across 6 separate hooks.
 */

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY_MS = 1000;

interface UseSupabaseChannelParams<TRow> {
    /** Unique channel name prefix (e.g. 'metrics', 'segments') */
    channelName: string;
    /** Database table to listen on */
    table: string;
    /** Session ID to filter events */
    sessionId: string | null;
    /** Whether the subscription should be active */
    isActive: boolean;
    /** Postgres event type(s) to listen for */
    event?: 'INSERT' | 'UPDATE' | '*';
    /** Callback when a matching row is received */
    onPayload: (row: TRow) => void;
    /** Optional error callback */
    onError?: (message: string, context?: string) => void;
}

interface UseSupabaseChannelReturn {
    isSubscribed: boolean;
}

export function useSupabaseChannel<TRow>({
    channelName,
    table,
    sessionId,
    isActive,
    event = 'INSERT',
    onPayload,
    onError,
}: UseSupabaseChannelParams<TRow>): UseSupabaseChannelReturn {
    // Stable ref for the callback to avoid re-subscribing on every render
    const onPayloadRef = useRef(onPayload);
    useEffect(() => { onPayloadRef.current = onPayload; }, [onPayload]);

    const onErrorRef = useRef(onError);
    useEffect(() => { onErrorRef.current = onError; }, [onError]);

    const reconnectAttemptsRef = useRef(0);
    const channelRef = useRef<RealtimeChannel | null>(null);
    const isMountedRef = useRef(true);
    const isSubscribedRef = useRef(false);

    const subscribeRef = useRef<((sid: string) => void) | null>(null);

    const subscribe = useCallback((sid: string) => {
        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
        }

        const channel: RealtimeChannel = supabase
            .channel(`${channelName}-${sid}-${Date.now()}`)
            .on(
                'postgres_changes',
                {
                    event,
                    schema: 'public',
                    table,
                    filter: `session_id=eq.${sid}`,
                },
                (payload) => {
                    const row = payload.new as TRow;
                    onPayloadRef.current(row);
                    reconnectAttemptsRef.current = 0;
                }
            )
            .subscribe((status, err) => {
                if (status === 'SUBSCRIBED') {
                    reconnectAttemptsRef.current = 0;
                    isSubscribedRef.current = true;
                } else if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && isMountedRef.current) {
                    isSubscribedRef.current = false;
                    const errorMsg = `Realtime ${channelName} error (${status})`;
                    console.error(errorMsg, err);
                    onErrorRef.current?.(errorMsg, channelName);

                    if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
                        const delay = RECONNECT_BASE_DELAY_MS * Math.pow(2, reconnectAttemptsRef.current);
                        reconnectAttemptsRef.current++;
                        setTimeout(() => {
                            if (isMountedRef.current && subscribeRef.current) subscribeRef.current(sid);
                        }, delay);
                    }
                }
            });

        channelRef.current = channel;
    }, [channelName, table, event]);

    useEffect(() => {
        subscribeRef.current = subscribe;
    }, [subscribe]);

    useEffect(() => {
        if (!sessionId || !isActive) return;

        isMountedRef.current = true;
        reconnectAttemptsRef.current = 0;
        subscribe(sessionId);

        return () => {
            isMountedRef.current = false;
            isSubscribedRef.current = false;
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, [sessionId, isActive, subscribe]);

    return { isSubscribed: isSubscribedRef.current };
}
