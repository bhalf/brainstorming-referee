import { NextRequest, NextResponse } from 'next/server';
import { callLLM, LLMError } from '@/lib/llm/client';
import { requireApiKey, loadRoutingConfig } from '@/lib/api/routeHelpers';
import { rateLimit } from '@/lib/api/rateLimit';
import {
  getModeratorSystemPrompt,
  getModeratorPromptTemplate,
  buildModeratorUserPrompt,
  getModeratorFallbackResponse,
} from '@/lib/prompts/moderator/prompts';

// --- Types ---

interface ModeratorRequest {
  trigger: 'imbalance' | 'repetition' | 'stagnation' | 'rule_violation' | 'goal_refocus';
  speakerDistribution: string;
  language: string;
  participationImbalance?: number;
  repetitionRate?: number;
  stagnationDuration?: number;
  transcriptExcerpt?: string[];
  totalTurns?: number;
  scenario?: string;
  intent?: string;
  triggeringState?: string;
  stateConfidence?: number;
  topic?: string;
  dominantSpeakers?: string;
  quietSpeakers?: string;
  participationMetrics?: {
    participationRiskScore?: number;
    silentParticipantRatio?: number;
    dominanceStreakScore?: number;
  };
  semanticDynamics?: {
    noveltyRate?: number;
    clusterConcentration?: number;
    explorationElaborationRatio?: number;
    semanticExpansionScore?: number;
  };
  // Rule violation fields
  violationType?: string;
  violationEvidence?: string;
  violationSeverity?: string;
  // Combined intervention (rule + metric)
  combined?: boolean;
  ruleViolation?: {
    rule: string;
    evidence: string;
    severity: string;
  };
  // Existing ideas for context
  existingIdeas?: string[];
  // Conversation goals context
  goalContext?: {
    coveredGoals: string[];
    uncoveredGoals: string[];
    suggestedTopics: string[];
  };
}

// --- Prompts are now managed centrally in lib/prompts/moderator/prompts.ts ---

// --- Handler ---

/**
 * POST /api/intervention/moderator — Generate a moderator intervention via LLM.
 *
 * Constructs a context-aware prompt from participation metrics, semantic
 * dynamics, transcript excerpts, and rule-violation details, then calls the
 * LLM to produce a natural-language moderator message. Falls back to a
 * static response if the LLM call fails.
 *
 * Blocked for 'baseline' scenario (no interventions allowed).
 * Rate-limited to 30 requests per window.
 *
 * @param request.body.trigger - What triggered the intervention ('imbalance' | 'repetition' | 'stagnation' | 'rule_violation').
 * @param request.body.intent - Intervention intent (e.g. 'PARTICIPATION_REBALANCING', 'PERSPECTIVE_BROADENING').
 * @param request.body.speakerDistribution - Human-readable speaker turn distribution.
 * @param request.body.language - BCP-47 locale for prompt and response language.
 * @param request.body.scenario - Experiment scenario; 'baseline' is rejected.
 * @param request.body.transcriptExcerpt - Optional recent transcript lines for context.
 * @param request.body.participationMetrics - Optional participation risk scores.
 * @param request.body.semanticDynamics - Optional semantic space metrics.
 * @param request.body.ruleViolation - Optional rule violation details for combined interventions.
 * @param request.body.existingIdeas - Optional list of existing idea titles for context.
 * @returns {{ role, text, trigger, intent, timestamp, logEntry, fallback? }}
 */
export async function POST(request: NextRequest) {
  const limited = rateLimit(request, { maxRequests: 30 });
  if (limited) return limited;

  try {
    const body = (await request.json()) as ModeratorRequest;
    const { trigger, speakerDistribution, language, transcriptExcerpt = [], totalTurns = transcriptExcerpt.length, scenario, intent, participationMetrics, semanticDynamics, stagnationDuration, violationType, violationEvidence, violationSeverity, combined, ruleViolation, topic, dominantSpeakers, quietSpeakers, goalContext } = body;

    // Server-side scenario guard: moderator is never appropriate in baseline
    if (scenario === 'baseline') {
      return NextResponse.json(
        { error: 'Moderator interventions not permitted in baseline scenario' },
        { status: 400 }
      );
    }

    // Select the appropriate prompt template based on intent, whether this is a
    // combined rule+metric intervention, and whether a rule violation is present
    const promptTemplate = getModeratorPromptTemplate(
      language,
      intent || '',
      combined ?? false,
      !!ruleViolation,
    );

    if (!intent || !promptTemplate) {
      return NextResponse.json(
        { error: 'Invalid intent type' },
        { status: 400 }
      );
    }

    const apiKeyResult = requireApiKey();
    if ('error' in apiKeyResult) return apiKeyResult.error;
    const apiKey = apiKeyResult.key;

    const routingConfig = loadRoutingConfig();

    const excerptText = transcriptExcerpt.length > 0
      ? transcriptExcerpt.join('\n')
      : 'No recent transcript available';

    // Resolve rule violation fields (from combined body or separate fields)
    const effectiveViolationType = ruleViolation?.rule ?? violationType ?? 'Unknown';
    const effectiveViolationEvidence = ruleViolation?.evidence ?? violationEvidence ?? 'Not available';
    const effectiveViolationSeverity = ruleViolation?.severity ?? violationSeverity ?? 'medium';

    // Prompt template was already resolved via getModeratorPromptTemplate above

    // Build quiet participant info: prefer explicit names from the client,
    // fall back to the silent-participant ratio from computed metrics
    const quietInfo = quietSpeakers
      ? `Quiet participants: ${quietSpeakers} `
      : participationMetrics?.silentParticipantRatio
        ? `${(participationMetrics.silentParticipantRatio * 100).toFixed(0)}% of participants have been quiet.`
        : '';

    // Build goal context block for enrichment (used by GOAL_REFOCUS and other intents)
    let goalContextBlock = '';
    if (goalContext && goalContext.uncoveredGoals.length > 0) {
      const isGerman = language.startsWith('de');
      const covered = goalContext.coveredGoals.length > 0
        ? `${isGerman ? 'Bereits behandelt' : 'Covered'}: ${goalContext.coveredGoals.join(', ')}`
        : '';
      const uncovered = `${isGerman ? 'Noch offen' : 'Still open'}: ${goalContext.uncoveredGoals.join(', ')}`;
      const suggested = goalContext.suggestedTopics.length > 0
        ? `${isGerman ? 'Vorgeschlagene Themen' : 'Suggested topics'}: ${goalContext.suggestedTopics.join(', ')}`
        : '';
      goalContextBlock = [
        isGerman ? 'GESPRÄCHSZIELE (einige noch offen):' : 'CONVERSATION GOALS (some still open):',
        covered, uncovered, suggested,
      ].filter(Boolean).join('\n');
    }

    // Interpolate all metric values into the selected prompt template
    const userPrompt = buildModeratorUserPrompt(promptTemplate, {
      speakerDistribution: speakerDistribution || 'Not available',
      totalTurns: String(totalTurns),
      transcriptExcerpt: excerptText,
      topic: topic || 'Not specified',
      dominantSpeakers: dominantSpeakers || 'Some participants',
      quietInfo,
      participationRiskScore: participationMetrics?.participationRiskScore?.toFixed(2) ?? 'N/A',
      silentParticipantRatio: participationMetrics?.silentParticipantRatio?.toFixed(2) ?? 'N/A',
      dominanceStreakScore: participationMetrics?.dominanceStreakScore?.toFixed(2) ?? 'N/A',
      clusterConcentration: semanticDynamics?.clusterConcentration?.toFixed(2) ?? 'N/A',
      noveltyRate: semanticDynamics?.noveltyRate?.toFixed(2) ?? 'N/A',
      explorationRatio: semanticDynamics?.explorationElaborationRatio?.toFixed(2) ?? 'N/A',
      stagnationDuration: stagnationDuration?.toFixed(0) ?? 'N/A',
      expansionScore: semanticDynamics?.semanticExpansionScore?.toFixed(2) ?? 'N/A',
      violationType: effectiveViolationType,
      violationEvidence: effectiveViolationEvidence,
      violationSeverity: effectiveViolationSeverity,
      goalContextBlock: goalContextBlock || '',
    });

    try {
      const { text, logEntry } = await callLLM(
        'moderator_intervention',
        routingConfig,
        [
          { role: 'system', content: getModeratorSystemPrompt(language) },
          { role: 'user', content: userPrompt },
        ],
        apiKey
      );

      return NextResponse.json({
        role: 'moderator',
        text,
        trigger,
        intent,
        combined: combined ?? false,
        timestamp: Date.now(),
        logEntry,
      });
    } catch (error) {
      // LLM call failed — return a static intent-aware fallback with HTTP 200
      // so the client can still deliver a useful intervention
      const logEntry = error instanceof LLMError ? error.logEntry : null;
      console.error('Moderator LLM call failed:', error);

      return NextResponse.json({
        role: 'moderator',
        text: getModeratorFallbackResponse(language, intent),
        trigger,
        intent,
        combined: combined ?? false,
        timestamp: Date.now(),
        logEntry,
        fallback: true,
      });
    }
  } catch (error) {
    console.error('Moderator endpoint error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
