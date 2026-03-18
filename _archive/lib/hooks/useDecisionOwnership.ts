import { useState, useEffect, useRef, useCallback } from 'react';
import { useLatestRef } from '@/lib/hooks/useLatestRef';
import { apiPost, apiDelete, ApiError } from '@/lib/services/apiClient';

/** Parameters for the decision ownership negotiation hook. */
interface UseDecisionOwnershipParams {
  sessionId: string | null;
  isActive: boolean;
  isParticipant: boolean;
}

/** Heartbeat interval for claiming/renewing decision ownership. */
const HEARTBEAT_INTERVAL_MS = 10_000;
/** Maximum backoff delay on 429 rate limiting. */
const MAX_BACKOFF_MS = 60_000;

/**
 * Negotiates which browser tab runs the decision engine for a given session.
 * Uses a server-side lock with periodic heartbeats. Only host clients (non-participants)
 * attempt to claim ownership. Implements exponential backoff with jitter on 429 responses,
 * and releases ownership on tab close (via sendBeacon) or unmount (via DELETE).
 *
 * @param params - Session ID, active flag, and whether the current user is a participant.
 * @returns Whether this client is the current decision owner.
 */
export function useDecisionOwnership({
  sessionId,
  isActive,
  isParticipant,
}: UseDecisionOwnershipParams) {
  const [isDecisionOwner, setIsDecisionOwner] = useState(false);
  const clientIdRef = useRef<string>(crypto.randomUUID());
  const sessionIdRef = useLatestRef(sessionId);
  const backoffRef = useRef(0); // Consecutive 429 count for exponential backoff

  /** Attempts to claim or renew decision ownership via the server lock API. */
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

  /** Releases ownership using sendBeacon (works during beforeunload). */
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

      // Schedule next heartbeat with exponential backoff on rate limiting
      let nextInterval = HEARTBEAT_INTERVAL_MS;
      if (rateLimited) {
        nextInterval = Math.min(HEARTBEAT_INTERVAL_MS * Math.pow(2, backoffRef.current), MAX_BACKOFF_MS);
        console.warn(`[DecisionOwner] Rate limited — backing off ${nextInterval / 1000}s`);
      }
      // Add +/-15% jitter to prevent thundering herd when multiple tabs recover simultaneously
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
