/**
 * Intervention persistence and generation service.
 *
 * Provides fire-and-forget persistence of interventions to Supabase,
 * fetching stored interventions for session hydration, and LLM-based
 * generation of moderator and ally intervention texts.
 * @module
 */

import { apiPost, apiGet, apiFireAndForget } from './apiClient';
import type { Intervention, DecisionEngineState } from '@/lib/types';
import type { ApiOptions } from './apiClient';

// --- Service Functions ---

/**
 * Persist an intervention and optional engine state snapshot to the backend.
 * @param sessionId - The active session's UUID.
 * @param intervention - The intervention object to store.
 * @param engineState - Optional decision engine state snapshot at time of intervention.
 * @param ruleViolation - Optional rule violation metadata (rule name, evidence, severity).
 */
export function persistIntervention(
    sessionId: string,
    intervention: Intervention,
    engineState?: DecisionEngineState,
    ruleViolation?: { rule?: string; evidence?: string; severity?: string } | null,
): void {
    apiFireAndForget('/api/interventions', {
        method: 'POST',
        body: JSON.stringify({ sessionId, intervention, engineState, ruleViolation }),
    }, 3);
}

/**
 * Fetch all interventions for a session (used during initial data load).
 * @param sessionId - The session to fetch interventions for.
 * @param options - Optional abort signal and retry config.
 * @returns An object containing an array of raw intervention rows.
 */
export async function fetchInterventions(
    sessionId: string,
    options?: ApiOptions,
): Promise<{ interventions: unknown[] }> {
    return apiGet('/api/interventions', { sessionId }, options);
}

/**
 * Generate a moderator intervention via the server-side LLM endpoint.
 * @param request - The prompt payload including transcript context and metrics.
 * @param options - Optional abort signal and retry config.
 * @returns The generated intervention text.
 */
export async function generateModeratorIntervention(
    request: Record<string, unknown>,
    options?: ApiOptions,
): Promise<{ text: string }> {
    return apiPost('/api/intervention/moderator', request, options);
}

/**
 * Generate an ally intervention via the server-side LLM endpoint.
 * @param request - The prompt payload including transcript context and metrics.
 * @param options - Optional abort signal and retry config.
 * @returns The generated ally impulse text.
 */
export async function generateAllyIntervention(
    request: Record<string, unknown>,
    options?: ApiOptions,
): Promise<{ text: string }> {
    return apiPost('/api/intervention/ally', request, options);
}
