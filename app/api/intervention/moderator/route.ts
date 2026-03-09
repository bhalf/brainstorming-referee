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
  trigger: 'imbalance' | 'repetition' | 'stagnation' | 'rule_violation';
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
}

// --- Prompts are now managed centrally in lib/prompts/moderator/prompts.ts ---

// --- Handler ---

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, { maxRequests: 30 });
  if (limited) return limited;

  try {
    const body = (await request.json()) as ModeratorRequest;
    const { trigger, speakerDistribution, language, transcriptExcerpt = [], totalTurns = transcriptExcerpt.length, scenario, intent, participationMetrics, semanticDynamics, stagnationDuration, violationType, violationEvidence, violationSeverity, combined, ruleViolation, topic, dominantSpeakers, quietSpeakers } = body;

    // Server-side scenario guard: moderator is never appropriate in baseline
    if (scenario === 'baseline') {
      return NextResponse.json(
        { error: 'Moderator interventions not permitted in baseline scenario' },
        { status: 400 }
      );
    }

    // Validate: need intent
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

    // Build quiet participant info string
    const quietInfo = quietSpeakers
      ? `Quiet participants: ${quietSpeakers} `
      : participationMetrics?.silentParticipantRatio
        ? `${(participationMetrics.silentParticipantRatio * 100).toFixed(0)}% of participants have been quiet.`
        : '';

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
