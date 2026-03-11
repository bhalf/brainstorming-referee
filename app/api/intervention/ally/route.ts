import { NextRequest, NextResponse } from 'next/server';
import { callLLM, LLMError } from '@/lib/llm/client';
import { requireApiKey, loadRoutingConfig } from '@/lib/api/routeHelpers';
import { rateLimit } from '@/lib/api/rateLimit';
import { getAllySystemPrompt, buildAllyUserPrompt, getAllyFallbackResponse } from '@/lib/prompts/ally/prompts';

// --- Types ---

interface AllyRequest {
  language: string;
  scenario?: string;
  topic?: string;
  previousInterventions?: string[];
  transcriptExcerpt?: string[];
  totalTurns?: number;
  existingIdeas?: string[];
  // v2 fields
  intent?: string;
  triggeringState?: string;
  stateConfidence?: number;
  participationMetrics?: { participationRiskScore?: number };
  semanticDynamics?: { noveltyRate?: number; clusterConcentration?: number };
}

// --- System + User prompts are now managed centrally in lib/prompts/ally/prompts.ts ---

// --- User prompt templates removed — now in lib/prompts/ally/prompts.ts ---

// --- Handler ---

/**
 * POST /api/intervention/ally — Generate an ally (peer impulse) intervention via LLM.
 *
 * Only permitted in Scenario B. Constructs a prompt from topic context,
 * transcript excerpts, existing ideas, participation metrics, and semantic
 * dynamics, then calls the LLM to produce a natural-sounding peer impulse.
 * Falls back to a static response if the LLM call fails.
 *
 * Rate-limited to 30 requests per window.
 *
 * @param request.body.language - BCP-47 locale for prompt and response language.
 * @param request.body.scenario - Must be 'B'; other values are rejected with 400.
 * @param request.body.topic - Optional brainstorming topic for context.
 * @param request.body.previousInterventions - Optional array of prior intervention texts.
 * @param request.body.transcriptExcerpt - Optional recent transcript lines.
 * @param request.body.existingIdeas - Optional list of existing idea titles to avoid repetition.
 * @param request.body.intent - Optional intervention intent from the decision engine.
 * @param request.body.triggeringState - Optional conversation state that triggered the ally.
 * @param request.body.participationMetrics - Optional participation risk scores.
 * @param request.body.semanticDynamics - Optional semantic space metrics.
 * @returns {{ role, text, intent?, timestamp, logEntry, fallback? }}
 */
export async function POST(request: NextRequest) {
  const limited = rateLimit(request, { maxRequests: 30 });
  if (limited) return limited;

  try {
    const body = (await request.json()) as AllyRequest;
    const { language, scenario, topic, previousInterventions = [], transcriptExcerpt = [], totalTurns = transcriptExcerpt.length, triggeringState, participationMetrics, semanticDynamics, existingIdeas = [] } = body;

    // Server-side scenario guard: ally is only permitted in Scenario B
    if (!scenario || scenario !== 'B') {
      return NextResponse.json(
        { error: 'Ally interventions are only permitted in Scenario B' },
        { status: 400 }
      );
    }

    const apiKeyResult = requireApiKey();
    if ('error' in apiKeyResult) return apiKeyResult.error;
    const apiKey = apiKeyResult.key;

    const routingConfig = loadRoutingConfig();

    // Limit prior interventions to the 3 most recent to keep prompt size manageable
    const interventionContext = previousInterventions.length > 0
      ? previousInterventions.slice(-3).join('; ')
      : 'None yet';

    const excerptText = transcriptExcerpt.length > 0
      ? transcriptExcerpt.join('\n')
      : 'No recent transcript available';

    // Select language-appropriate prompts
    const isGerman = language.startsWith('de');

    // v2 prompts include conversation state context; v1 is a simpler format
    const topicText = topic || 'Not specified';

    // Build existing ideas context (capped at 15) so the ally avoids repeating
    // ideas the group has already generated
    let existingIdeasContext = '';
    if (existingIdeas.length > 0) {
      const ideasList = existingIdeas.slice(0, 15).map(i => `- ${i}`).join('\n');
      existingIdeasContext = isGerman
        ? `Bisherige Ideen der Gruppe:\n${ideasList}\n\nImpulse sollen NEUE Perspektiven eröffnen, die KEINER dieser Ideen entsprechen.`
        : `The group's existing ideas:\n${ideasList}\n\nYour impulse should open NEW perspectives that NONE of these ideas cover.`;
    }

    // Build user prompt using centralized prompt builder
    const userPrompt = buildAllyUserPrompt(language, {
      topic: topicText,
      previousInterventions: interventionContext,
      totalTurns: String(totalTurns),
      transcriptExcerpt: excerptText,
      triggeringState: triggeringState || '',
      existingIdeasContext,
      participationRiskScore: participationMetrics?.participationRiskScore?.toFixed(2) ?? 'N/A',
      noveltyRate: semanticDynamics?.noveltyRate?.toFixed(2) ?? 'N/A',
      clusterConcentration: semanticDynamics?.clusterConcentration?.toFixed(2) ?? 'N/A',
    }, !!triggeringState);

    try {
      const { text, logEntry } = await callLLM(
        'ally_intervention',
        routingConfig,
        [
          { role: 'system', content: getAllySystemPrompt(language) },
          { role: 'user', content: userPrompt },
        ],
        apiKey
      );

      return NextResponse.json({
        role: 'ally',
        text,
        intent: body.intent,
        timestamp: Date.now(),
        logEntry,
      });
    } catch (error) {
      // LLM call failed (after exhausting fallbacks) — return static fallback with HTTP 200
      // Include fallback:true flag so callers can distinguish LLM responses from static fallbacks.
      const logEntry = error instanceof LLMError ? error.logEntry : null;
      console.error('Ally LLM call failed:', error);

      return NextResponse.json({
        role: 'ally',
        text: getAllyFallbackResponse(language),
        timestamp: Date.now(),
        logEntry,
        fallback: true,
      });
    }
  } catch (error) {
    console.error('Ally endpoint error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
