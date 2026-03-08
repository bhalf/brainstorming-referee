// ============================================
// Prompt & Engine Version Tracking
// ============================================
// Bump these constants when prompts, engine logic,
// or model defaults change. Sessions store these
// at creation time for later reproducibility.
// ============================================

/** Version of the system/trigger/intent prompts used by the moderator & ally API routes */
export const PROMPT_VERSION = 'v2.1';

/** Version of the decision engine (state inference + policy + recovery) */
export const ENGINE_VERSION = 'v2';

/** Build a metadata object to store alongside session config */
export function buildExperimentMeta(modelRoutingSnapshot?: Record<string, unknown>) {
  return {
    promptVersion: PROMPT_VERSION,
    engineVersion: ENGINE_VERSION,
    modelRouting: modelRoutingSnapshot ?? null,
    createdWith: 'uzh-brainstorming-webapp',
  };
}
