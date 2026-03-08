import { ConversationStateName, EnginePhase } from '@/lib/types';

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
 * Display configuration for engine phases.
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
