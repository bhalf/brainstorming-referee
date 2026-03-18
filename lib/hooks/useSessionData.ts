'use client';

import {
  useRealtimeSegments,
  useRealtimeMetrics,
  useRealtimeInterventions,
  useRealtimeIdeas,
  useRealtimeSummary,
  useRealtimeEngineState,
  useRealtimeGoals,
  useRealtimeParticipants,
  useRealtimeSession,
} from '@/lib/realtime';

/**
 * Composition hook that wires all Supabase Realtime subscriptions for a session.
 * Returns the combined read-only data for use by the Session page and its children.
 *
 * Each sub-hook manages its own useState — no central context/reducer needed.
 */
export function useSessionData(sessionId: string | null, myIdentity: string | null = null) {
  const { segments, isSubscribed: segmentsConnected } = useRealtimeSegments(sessionId);
  const { latest: latestMetrics, history: metricsHistory, isSubscribed: metricsConnected } = useRealtimeMetrics(sessionId);
  const { interventions, latestIntervention, dismissLatest: dismissIntervention, isSubscribed: interventionsConnected } = useRealtimeInterventions(sessionId);
  const { ideas, connections } = useRealtimeIdeas(sessionId);
  const { summary, updatedAt: summaryUpdatedAt } = useRealtimeSummary(sessionId);
  const { engineState } = useRealtimeEngineState(sessionId);
  const { goals } = useRealtimeGoals(sessionId);
  const { participants, allParticipants, hostIdentity, myRole, isHost, isCoHost } = useRealtimeParticipants(sessionId, myIdentity);
  const { session: realtimeSession, isIdle, isEnded } = useRealtimeSession(sessionId);

  const isConnected = segmentsConnected || metricsConnected || interventionsConnected;

  return {
    // Transcript
    segments,

    // Metrics
    latestMetrics,
    metricsHistory,

    // Interventions
    interventions,
    latestIntervention,
    dismissIntervention,

    // Ideas
    ideas,
    connections,

    // Summary
    summary,
    summaryUpdatedAt,

    // Engine state
    engineState,

    // Goals
    goals,

    // Participants
    participants,
    allParticipants,
    hostIdentity,
    myRole,
    isHost,
    isCoHost,

    // Session state (realtime)
    realtimeSession,
    isIdle,
    isEnded,

    // Connection status
    isConnected,
  };
}
