import { useEffect, useRef, useCallback, useState } from 'react';
import { useLatestRef } from '@/lib/hooks/useLatestRef';
import { supabase } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Generic hook for subscribing to Supabase Realtime Postgres Changes.
 * Encapsulates the shared channel setup, reconnect logic, and cleanup
 * that was previously duplicated across multiple hooks.
 */

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY_MS = 1000;

export type RealtimeEventType = 'INSERT' | 'UPDATE' | 'DELETE';

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
    /**
     * Override the default Postgres filter.
     * Defaults to `session_id=eq.<sessionId>`.
     * Useful for tables where the PK is the session ID itself (e.g. `id=eq.<sessionId>`).
     */
    filter?: (sessionId: string) => string;
    /** Callback when a matching row is received. eventType is provided when listening for '*'. */
    onPayload: (row: TRow, eventType: RealtimeEventType) => void;
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
    filter,
    onPayload,
    onError,
}: UseSupabaseChannelParams<TRow>): UseSupabaseChannelReturn {
    // Stable ref for the callback to avoid re-subscribing on every render
    const onPayloadRef = useLatestRef(onPayload);
    const onErrorRef = useLatestRef(onError);
    const filterRef = useLatestRef(filter);

    const reconnectAttemptsRef = useRef(0);
    const channelRef = useRef<RealtimeChannel | null>(null);
    const isMountedRef = useRef(true);
    const [isSubscribed, setIsSubscribed] = useState(false);
    /** Guard against overlapping subscribe() calls (race condition prevention) */
    const isSubscribingRef = useRef(false);

    const subscribeRef = useRef<((sid: string) => void) | null>(null);

    const subscribe = useCallback((sid: string) => {
        // Prevent overlapping subscribe() calls — if a subscription is already
        // in-flight (e.g. from a rapid sessionId change or reconnect timer),
        // bail out to avoid creating duplicate channels.
        if (isSubscribingRef.current) return;
        isSubscribingRef.current = true;

        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
        }

        const filterString = filterRef.current
            ? filterRef.current(sid)
            : `session_id=eq.${sid}`;

        const channel: RealtimeChannel = supabase
            .channel(`${channelName}-${sid}-${Date.now()}`)
            .on(
                'postgres_changes',
                {
                    event,
                    schema: 'public',
                    table,
                    filter: filterString,
                },
                (payload) => {
                    const row = payload.new as TRow;
                    const eventType = (payload.eventType ?? event) as RealtimeEventType;
                    onPayloadRef.current(row, eventType);
                    reconnectAttemptsRef.current = 0;
                }
            )
            .subscribe((status, err) => {
                // Subscription attempt completed — clear the guard
                isSubscribingRef.current = false;

                if (status === 'SUBSCRIBED') {
                    reconnectAttemptsRef.current = 0;
                    setIsSubscribed(true);
                } else if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && isMountedRef.current) {
                    setIsSubscribed(false);
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
        isSubscribingRef.current = false;
        subscribe(sessionId);

        return () => {
            isMountedRef.current = false;
            setIsSubscribed(false);
            isSubscribingRef.current = false;
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, [sessionId, isActive, subscribe]);

    return { isSubscribed };
}
