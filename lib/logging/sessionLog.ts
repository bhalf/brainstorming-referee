// ============================================
// Enhanced Session Logging
// ============================================

import {
  SessionState,
  SessionLog,
  SessionSummary,
  Intervention,
  ConversationStateName,
  ConversationStateInference,
  InterventionIntent,
} from '../types';

const PROMPT_VERSION = '2.0.0';

// --- Build Enhanced Session Log ---

export function buildEnhancedSessionLog(
  state: SessionState,
  stateHistory: ConversationStateInference[],
): SessionLog {
  const sessionDurationMs = state.startTime
    ? (state.isActive ? Date.now() : Date.now()) - state.startTime
    : 0;

  const summary = computeSessionSummary(
    state.interventions,
    stateHistory,
    sessionDurationMs,
  );

  return {
    metadata: {
      roomName: state.roomName,
      scenario: state.scenario,
      startTime: state.startTime || Date.now(),
      endTime: state.isActive ? null : Date.now(),
      language: state.language,
    },
    activeConfig: state.config,
    transcriptSegments: state.transcriptSegments,
    metricSnapshots: state.metricSnapshots,
    interventions: state.interventions,
    voiceSettings: state.voiceSettings,
    modelRoutingLog: state.modelRoutingLog,
    errors: state.errors,
    sessionSummary: summary,
    promptVersion: PROMPT_VERSION,
  };
}

// --- Compute Session Summary ---

export function computeSessionSummary(
  interventions: Intervention[],
  stateHistory: ConversationStateInference[],
  sessionDurationMs: number,
): SessionSummary {
  // Interventions by intent
  const totalInterventionsByIntent: Record<string, number> = {};
  for (const intervention of interventions) {
    const intent = intervention.intent ?? intervention.trigger ?? 'unknown';
    totalInterventionsByIntent[intent] = (totalInterventionsByIntent[intent] || 0) + 1;
  }

  // Average state durations
  const stateDurations: Record<string, number[]> = {};
  let prevState: ConversationStateName | null = null;
  let stateStart = 0;
  let stateTransitions = 0;

  for (const entry of stateHistory) {
    if (prevState !== entry.state) {
      if (prevState !== null) {
        const duration = entry.enteredAt - stateStart;
        if (!stateDurations[prevState]) stateDurations[prevState] = [];
        stateDurations[prevState].push(duration);
        stateTransitions++;
      }
      prevState = entry.state;
      stateStart = entry.enteredAt;
    }
  }
  // Close final state
  if (prevState !== null && stateHistory.length > 0) {
    const lastEntry = stateHistory[stateHistory.length - 1];
    const duration = lastEntry.enteredAt + lastEntry.durationMs - stateStart;
    if (!stateDurations[prevState]) stateDurations[prevState] = [];
    stateDurations[prevState].push(duration);
  }

  const avgStateDurations: Record<string, number> = {};
  for (const [state, durations] of Object.entries(stateDurations)) {
    avgStateDurations[state] = durations.reduce((a, b) => a + b, 0) / durations.length;
  }

  // Recovery by intent
  const avgRecoveryByIntent: Record<string, { attempted: number; recovered: number; partial: number }> = {};
  for (const intervention of interventions) {
    const intent = intervention.intent ?? intervention.trigger ?? 'unknown';
    if (!avgRecoveryByIntent[intent]) {
      avgRecoveryByIntent[intent] = { attempted: 0, recovered: 0, partial: 0 };
    }
    avgRecoveryByIntent[intent].attempted++;
    if (intervention.recoveryResult === 'recovered') {
      avgRecoveryByIntent[intent].recovered++;
    } else if (intervention.recoveryResult === 'partial') {
      avgRecoveryByIntent[intent].partial++;
    }
  }

  // Dominant state: most total time
  let dominantState: ConversationStateName = 'HEALTHY_EXPLORATION';
  let maxTotalDuration = 0;
  for (const [state, durations] of Object.entries(stateDurations)) {
    const total = durations.reduce((a, b) => a + b, 0);
    if (total > maxTotalDuration) {
      maxTotalDuration = total;
      dominantState = state as ConversationStateName;
    }
  }

  return {
    totalInterventionsByIntent,
    avgStateDurations,
    avgRecoveryByIntent,
    totalSessionDurationMs: sessionDurationMs,
    dominantState,
    stateTransitions,
  };
}
