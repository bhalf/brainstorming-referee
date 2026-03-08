import { apiPost, apiGet, apiFireAndForget } from './apiClient';
import type { Intervention, DecisionEngineState } from '@/lib/types';
import type { ApiOptions } from './apiClient';

// --- Service Functions ---

/** Persist an intervention + optional engine state to the backend */
export function persistIntervention(
    sessionId: string,
    intervention: Intervention,
    engineState?: DecisionEngineState,
): void {
    apiFireAndForget('/api/interventions', {
        method: 'POST',
        body: JSON.stringify({ sessionId, intervention, engineState }),
    }, 3);
}

/** Fetch all interventions for a session (used for initial data load) */
export async function fetchInterventions(
    sessionId: string,
    options?: ApiOptions,
): Promise<{ interventions: unknown[] }> {
    return apiGet('/api/interventions', { sessionId }, options);
}

/** Generate a moderator intervention via LLM */
export async function generateModeratorIntervention(
    request: Record<string, unknown>,
    options?: ApiOptions,
): Promise<{ text: string }> {
    return apiPost('/api/intervention/moderator', request, options);
}

/** Generate an ally intervention via LLM */
export async function generateAllyIntervention(
    request: Record<string, unknown>,
    options?: ApiOptions,
): Promise<{ text: string }> {
    return apiPost('/api/intervention/ally', request, options);
}
