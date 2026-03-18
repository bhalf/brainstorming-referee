/**
 * Central timeout and retry constants for LLM and API calls.
 *
 * Keeping these in one place makes it easy to tune across the app
 * and ensures consistent abort behaviour.
 */
export const TIMEOUTS = {
  /** Timeout for generic LLM generation calls (ms) */
  LLM_GENERATION_MS: 30_000,
  /** Timeout for intervention API calls — moderator & ally (ms) */
  INTERVENTION_MS: 20_000,
  /** Max age before an in-flight idea-extraction request is considered stale (ms) */
  IDEA_EXTRACTION_STALE_MS: 30_000,
  /** Timeout for rule-violation check API calls (ms) */
  RULE_CHECK_MS: 30_000,
} as const;
