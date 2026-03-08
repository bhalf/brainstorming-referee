import { useState, useEffect, useRef, useCallback } from 'react';

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
  const sessionIdRef = useRef(sessionId);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  const claimOrHeartbeat = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (!sid) return false;

    try {
      const res = await fetch('/api/decision-owner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid, clientId: clientIdRef.current }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.isOwner === true;
      }
    } catch {
      // Network error — assume not owner
    }
    return false;
  }, []);

  const releaseOwnership = useCallback(() => {
    const sid = sessionIdRef.current;
    if (!sid) return;

    // Best-effort release via sendBeacon for tab close
    const body = JSON.stringify({ sessionId: sid, clientId: clientIdRef.current });
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/decision-owner', new Blob([body], { type: 'application/json' }));
    }
  }, []);

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
      console.log('[DecisionOwnership] claim result:', claimed, 'sessionId:', sessionId);
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
        fetch('/api/decision-owner', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: sid, clientId: clientIdRef.current }),
        }).catch(() => {});
      }
    };
  }, [isActive, isParticipant, sessionId, claimOrHeartbeat, releaseOwnership]);

  return { isDecisionOwner };
}
