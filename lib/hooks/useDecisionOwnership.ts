import { useState, useEffect, useRef, useCallback } from 'react';
import { useLatestRef } from '@/lib/hooks/useLatestRef';
import { apiPost, apiDelete, ApiError } from '@/lib/services/apiClient';

interface UseDecisionOwnershipParams {
  sessionId: string | null;
  isActive: boolean;
  isParticipant: boolean;
}

const HEARTBEAT_INTERVAL_MS = 10_000; // 10s heartbeat (was 5s — too aggressive for Vercel)
const MAX_BACKOFF_MS = 60_000;        // Max 60s backoff on 429

export function useDecisionOwnership({
  sessionId,
  isActive,
  isParticipant,
}: UseDecisionOwnershipParams) {
  const [isDecisionOwner, setIsDecisionOwner] = useState(false);
  const clientIdRef = useRef<string>(crypto.randomUUID());
  const sessionIdRef = useLatestRef(sessionId);
  const backoffRef = useRef(0); // Consecutive 429 count for exponential backoff

  const claimOrHeartbeat = useCallback(async (): Promise<{ isOwner: boolean; rateLimited: boolean }> => {
    const sid = sessionIdRef.current;
    if (!sid) return { isOwner: false, rateLimited: false };

    try {
      const data = await apiPost<{ isOwner: boolean }>('/api/decision-owner', {
        sessionId: sid,
        clientId: clientIdRef.current,
      }, { maxRetries: 0 }); // No retries — backoff handles it
      backoffRef.current = 0; // Reset backoff on success
      return { isOwner: data.isOwner === true, rateLimited: false };
    } catch (err: unknown) {
      // Detect 429 rate limiting
      if (err instanceof ApiError && err.status === 429) {
        backoffRef.current = Math.min(backoffRef.current + 1, 6);
        return { isOwner: false, rateLimited: true };
      }
      // Other network error — assume not owner, don't backoff
    }
    return { isOwner: false, rateLimited: false };
  }, [sessionIdRef]);

  const releaseOwnership = useCallback(() => {
    const sid = sessionIdRef.current;
    if (!sid) return;

    const body = JSON.stringify({ sessionId: sid, clientId: clientIdRef.current });
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/decision-owner', new Blob([body], { type: 'application/json' }));
    }
  }, [sessionIdRef]);

  useEffect(() => {
    // Participants never try to claim
    if (!isActive || isParticipant || !sessionId) {
      setIsDecisionOwner(false);
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout>;
    let isMounted = true;

    const run = async () => {
      const { isOwner, rateLimited } = await claimOrHeartbeat();
      if (!isMounted) return;

      setIsDecisionOwner(isOwner);

      // Schedule next heartbeat with optional backoff
      let nextInterval = HEARTBEAT_INTERVAL_MS;
      if (rateLimited) {
        // Exponential backoff: 10s, 20s, 40s, 60s (capped)
        nextInterval = Math.min(HEARTBEAT_INTERVAL_MS * Math.pow(2, backoffRef.current), MAX_BACKOFF_MS);
        console.warn(`[DecisionOwner] Rate limited — backing off ${nextInterval / 1000}s`);
      }
      // Add jitter (±15%) to prevent thundering herd
      const jitter = nextInterval * (0.85 + Math.random() * 0.3);
      timeoutId = setTimeout(run, jitter);
    };

    // Initial claim attempt
    run();

    // Release on tab close
    window.addEventListener('beforeunload', releaseOwnership);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      window.removeEventListener('beforeunload', releaseOwnership);

      // Release ownership on unmount (session end, navigation)
      const sid = sessionIdRef.current;
      if (sid) {
        apiDelete('/api/decision-owner', {
          sessionId: sid,
          clientId: clientIdRef.current,
        }).catch(() => { });
      }
    };
  }, [isActive, isParticipant, sessionId, claimOrHeartbeat, releaseOwnership, sessionIdRef]);

  return { isDecisionOwner };
}
