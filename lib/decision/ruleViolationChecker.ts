import type { TranscriptSegment } from '@/lib/types';

// --- Constants ---

/** Minimum interval between rule checks (ms) */
export const RULE_CHECK_INTERVAL_MS = 3_000;

/** Minimum cooldown between violation interventions (ms) */
export const RULE_VIOLATION_COOLDOWN_MS = 15_000;

// --- Types ---

export interface RuleViolationResult {
  violated: boolean;
  rule?: string;
  severity?: 'low' | 'medium' | 'high';
  evidence?: string;
}

// --- Main Function ---

/**
 * Check recent transcript segments for brainstorming rule violations.
 * Calls /api/rule-check which uses gpt-4o-mini for classification.
 *
 * Returns null if there are no new segments to check or on error.
 */
export async function checkRuleViolations(
  segments: TranscriptSegment[],
  language: string,
  lastCheckTime: number,
): Promise<RuleViolationResult | null> {
  // Only check segments that arrived since last check
  const newSegments = segments.filter(
    s => s.isFinal && s.timestamp > lastCheckTime && !/^\[.*\]$/.test(s.text.trim())
  );

  // Need at least 2 segments to have meaningful context
  if (newSegments.length < 2) return null;

  // Send only the last 15 segments (keep payload small)
  const recentSegments = newSegments.slice(-15).map(s => ({
    speaker: s.speaker,
    text: s.text,
  }));

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch('/api/rule-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ segments: recentSegments, language }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const data = await response.json();

    if (data.violated) {
      return {
        violated: true,
        rule: data.rule ?? undefined,
        severity: data.severity ?? undefined,
        evidence: data.evidence ?? undefined,
      };
    }

    return null;
  } catch (error) {
    // Silently fail — rule checking is non-critical
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.log('[RuleCheck] Timeout — skipping this cycle');
    } else {
      console.warn('[RuleCheck] Error:', error);
    }
    return null;
  }
}
