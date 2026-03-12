import type { TranscriptSegment } from '@/lib/types';
import { apiPost } from '@/lib/services/apiClient';
import { TIMEOUTS } from '@/lib/config/timeouts';

// --- Constants ---

/** Minimum interval between rule checks (ms) — throttled to avoid API rate limits */
export const RULE_CHECK_INTERVAL_MS = 5_000;

// NOTE: Rule violations have NO cooldown — they fire immediately when detected.

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

  // Need at least 1 segment to check for violations
  if (newSegments.length < 1) return null;

  // Send only the last 15 segments (keep payload small)
  const recentSegments = newSegments.slice(-15).map(s => ({
    speaker: s.speaker,
    text: s.text,
  }));

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUTS.RULE_CHECK_MS);

    const data = await apiPost<{ violated: boolean; rule?: string; severity?: string; evidence?: string }>(
      '/api/rule-check',
      { segments: recentSegments, language },
      { signal: controller.signal, maxRetries: 0 },
    );

    clearTimeout(timeoutId);

    if (data.violated) {
      const severity = data.severity as RuleViolationResult['severity'];

      // Only act on medium/high severity — low/borderline violations are not worth
      // interrupting the brainstorming for (high false-positive rate).
      if (!severity || severity === 'low') {
        console.log(`[RuleCheck] Low-severity violation ignored: ${data.evidence ?? 'no evidence'}`);
        return null;
      }

      return {
        violated: true,
        rule: data.rule ?? undefined,
        severity,
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
