/**
 * Centralised tick / interval configuration for all periodic analysis tasks.
 *
 * Previously each hook hard-coded its own interval, which meant
 * they could all fire in the same event-loop turn (thundering herd).
 * This module:
 *   1. Keeps every interval constant in one place.
 *   2. Provides stagger offsets so tasks don't overlap.
 *
 * @module tickConfig
 */

// ---- Interval durations (ms) ----

/** Decision engine evaluation cycle (default: 1 s). */
export const DECISION_TICK_MS = 1_000;

/**
 * Idea extraction cycle (default: 4 s).
 * Slightly offset from metrics to avoid concurrent LLM bursts.
 */
export const EXTRACTION_TICK_MS = 4_000;

/**
 * Decision-ownership heartbeat (default: 5 s).
 * Not an analysis task -- only a keep-alive ping to the server.
 */
export const OWNERSHIP_HEARTBEAT_MS = 5_000;

// ---- Stagger offsets ----
// These delays are added to the initial setTimeout before the
// first setInterval fires. They spread the load across the first
// few seconds so metrics, decision, and extraction don't all
// start at t = 0.

/** Metrics computation starts first (small head-start of 500ms). */
export const STAGGER_METRICS_MS = 500;

/** Decision engine waits 1.5s for the first metrics result before starting. */
export const STAGGER_DECISION_MS = 1_500;

/** Idea extraction starts last (2.5s) to let metrics settle. */
export const STAGGER_EXTRACTION_MS = 2_500;
