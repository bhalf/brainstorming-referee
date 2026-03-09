import { useState, useEffect, useRef, useCallback } from 'react';
import { useLatestRef } from '@/lib/hooks/useLatestRef';
import { apiPost, apiDelete } from '@/lib/services/apiClient';

interface UseDecisionOwnershipParams {
  sessionId: string | null;
  isActive: boolean;
  isParticipant: boolean;
}

const HEARTBEAT_INTERVAL_MS = 5000;

export function useDecisionOwnership({
  sessionId,
  isActive,
  isParticipant,
}: UseDecisionOwnershipParams) {
  const [isDecisionOwner, setIsDecisionOwner] = useState(false);
  const clientIdRef = useRef<string>(crypto.randomUUID());
  // useLatestRef keeps sessionId in sync without manual useEffect
  const sessionIdRef = useLatestRef(sessionId);

  const claimOrHeartbeat = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (!sid) return false;

    try {
      const data = await apiPost<{ isOwner: boolean }>('/api/decision-owner', {
        sessionId: sid,
        clientId: clientIdRef.current,
      });
      return data.isOwner === true;
    } catch {
      // Network error — assume not owner
    }
    return false;
  }, [sessionIdRef]);

  const releaseOwnership = useCallback(() => {
    const sid = sessionIdRef.current;
    if (!sid) return;

    // Best-effort release via sendBeacon for tab close
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

    let intervalId: ReturnType<typeof setInterval>;
    let isMounted = true;

    const run = async () => {
      const claimed = await claimOrHeartbeat();
      if (isMounted) {
        setIsDecisionOwner(claimed);
      }
    };

    // Initial claim attempt
    run();

    // Heartbeat / re-claim interval
    intervalId = setInterval(run, HEARTBEAT_INTERVAL_MS);

    // Release on tab close
    window.addEventListener('beforeunload', releaseOwnership);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
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
