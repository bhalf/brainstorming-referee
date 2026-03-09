import { NextRequest, NextResponse } from 'next/server';
import { callLLM, LLMError } from '@/lib/llm/client';
import { requireApiKey, loadRoutingConfig } from '@/lib/api/routeHelpers';
import { rateLimit } from '@/lib/api/rateLimit';
import { RULE_CHECK_SYSTEM_PROMPT, getRuleCheckUserPrompt } from '@/lib/prompts/ruleCheck/prompts';

interface RuleCheckRequest {
  segments: { speaker: string; text: string }[];
  language: string;
}

// --- System prompt now managed centrally in lib/prompts/ruleCheck/prompts.ts ---

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, { maxRequests: 30 });
  if (limited) return limited;

  const keyResult = requireApiKey();
  if ('error' in keyResult) return keyResult.error;

  try {
    const body: RuleCheckRequest = await request.json();
    const { segments, language } = body;

    if (!segments || segments.length === 0) {
      return NextResponse.json({ violated: false });
    }

    const routingConfig = loadRoutingConfig();

    // Format transcript for analysis
    const transcript = segments
      .map(s => `${s.speaker}: ${s.text}`)
      .join('\n');

    const userPrompt = getRuleCheckUserPrompt(language, transcript);

    const { text, logEntry } = await callLLM(
      'rule_check',
      routingConfig,
      [
        { role: 'system', content: RULE_CHECK_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      keyResult.key,
      { responseFormat: { type: 'json_object' } }
    );

    // Parse JSON response — wrapped in try/catch for robustness
    let result;
    try {
      result = JSON.parse(text);
    } catch {
      console.warn('[rule-check] Failed to parse LLM JSON:', text);
      return NextResponse.json({ violated: false, error: 'Invalid JSON from LLM' });
    }

    return NextResponse.json({
      violated: result.violated ?? false,
      rule: result.rule ?? null,
      severity: result.severity ?? null,
      evidence: result.evidence ?? null,
      logEntry,
    });
  } catch (error) {
    if (error instanceof LLMError) {
      console.error('[rule-check] LLM error:', error.message);
      return NextResponse.json({ violated: false, error: 'LLM call failed' });
    }
    console.error('[rule-check] Error:', error);
    return NextResponse.json({ violated: false, error: 'Internal error' });
  }
}
