import { DecisionState, ConversationStateName, EnginePhase } from '@/lib/types';

/**
 * Shared display configuration for decision engine states (v1 — backward compat).
 * Used by AnalysisPanel and DebugPanel.
 */
export const DECISION_STATE_CONFIG: Record<DecisionState, {
  label: string;
  description: string;
  panelColor: string;
  dotColor: string;
  badgeColor: string;
}> = {
  OBSERVATION: {
    label: 'Observation',
    description: 'Monitoring conversation',
    panelColor: 'bg-slate-600/60 text-slate-300 border-slate-600',
    dotColor: 'bg-slate-400',
    badgeColor: 'bg-green-600',
  },
  STABILIZATION: {
    label: 'Stabilization',
    description: 'Threshold breached — waiting for persistence',
    panelColor: 'bg-yellow-900/50 text-yellow-300 border-yellow-700',
    dotColor: 'bg-yellow-400 animate-pulse',
    badgeColor: 'bg-yellow-600',
  },
  ESCALATION: {
    label: 'Escalation',
    description: 'Intervention triggered',
    panelColor: 'bg-red-900/50 text-red-300 border-red-700',
    dotColor: 'bg-red-400 animate-pulse',
    badgeColor: 'bg-red-600',
  },
};

/**
 * Display configuration for inferred conversation states (v2).
 */
export const CONVERSATION_STATE_CONFIG: Record<ConversationStateName, {
  label: string;
  description: string;
  color: string;
  severity: 'healthy' | 'warning' | 'critical';
}> = {
  HEALTHY_EXPLORATION: {
    label: 'Healthy Exploration',
    description: 'Multiple voices, new ideas flowing',
    color: 'bg-green-600',
    severity: 'healthy',
  },
  HEALTHY_ELABORATION: {
    label: 'Healthy Elaboration',
    description: 'Productive deepening of ideas',
    color: 'bg-emerald-600',
    severity: 'healthy',
  },
  DOMINANCE_RISK: {
    label: 'Dominance Risk',
    description: 'Participation becoming imbalanced',
    color: 'bg-orange-600',
    severity: 'warning',
  },
  CONVERGENCE_RISK: {
    label: 'Convergence Risk',
    description: 'Ideas narrowing, low novelty',
    color: 'bg-yellow-600',
    severity: 'warning',
  },
  STALLED_DISCUSSION: {
    label: 'Stalled Discussion',
    description: 'No new content, semantically static',
    color: 'bg-red-600',
    severity: 'critical',
  },
};

/**
 * Display configuration for engine phases (v2).
 */
export const ENGINE_PHASE_CONFIG: Record<EnginePhase, {
  label: string;
  description: string;
  badgeColor: string;
}> = {
  MONITORING: {
    label: 'Monitoring',
    description: 'Observing conversation',
    badgeColor: 'bg-green-600',
  },
  CONFIRMING: {
    label: 'Confirming',
    description: 'Verifying persistent state',
    badgeColor: 'bg-blue-600',
  },
  POST_CHECK: {
    label: 'Post-Check',
    description: 'Evaluating intervention effect',
    badgeColor: 'bg-yellow-600',
  },
  COOLDOWN: {
    label: 'Cooldown',
    description: 'Waiting after escalation',
    badgeColor: 'bg-red-600',
  },
};
