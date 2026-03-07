import { NextRequest, NextResponse } from 'next/server';
import { callLLM, LLMError } from '@/lib/llm/client';
import { requireApiKey, loadRoutingConfig } from '@/lib/api/routeHelpers';

// --- Types ---

interface ModeratorRequest {
  trigger: 'imbalance' | 'repetition' | 'stagnation';
  speakerDistribution: string;
  language: string;
  participationImbalance?: number;
  repetitionRate?: number;
  stagnationDuration?: number;
  transcriptExcerpt?: string[];
  totalTurns?: number;
  scenario?: string;
  currentState?: string;
  // v2 fields
  intent?: string;
  triggeringState?: string;
  stateConfidence?: number;
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
}

// --- System Prompts ---

function getSystemPrompt(language: string): string {
  const isGerman = language.startsWith('de');

  if (isGerman) {
    return `Du bist ein erfahrener Brainstorming-Moderator. Deine Aufgabe ist es, die Gruppendiskussion durch kurze, prozessbezogene Beobachtungen sanft zu lenken.

WICHTIGE REGELN:
1. Mache NUR Prozessreflexionen – trage NIEMALS eigene Ideen oder inhaltliche Lösungen zum Brainstorming bei.
2. Halte Antworten auf maximal 1-2 kurze Sätze. Dies ist zwingend.
3. Sei neutral, ermutigend und konstruktiv, niemals belehrend oder wertend.
4. Formuliere Beobachtungen als Fragen oder sanfte Prozess-Vorschläge.
5. Fokussiere auf Gruppendynamik, nicht auf Inhalte.
6. Antworten müssen für Sprachausgabe geeignet sein (keine Sonderzeichen, Emojis oder Formatierung).
7. Adressiere NIEMALS einzelne Personen direkt, sondern sprich immer zur gesamten Gruppe ("wir", "die Gruppe").

Deine Antworten sollen der Gruppe helfen, Muster zu erkennen, ohne ihnen zu sagen, was sie inhaltlich tun sollen.`;
  }

  return `You are a skilled brainstorming facilitator. Your role is to gently guide group discussions by making brief process-oriented observations.

IMPORTANT RULES:
1. ONLY make process reflections - NEVER contribute actual ideas or solutions to the brainstorming.
2. Keep responses to 1-2 short sentences maximum. This is mandatory.
3. Be neutral, encouraging and constructive, never preachy or critical.
4. Phrase observations as questions or gentle process suggestions.
5. Focus on group dynamics, not content.
6. Responses must be suitable for text-to-speech (no special characters, emojis, or formatting).
7. NEVER address individuals directly by name or single them out. ALWAYS address the group collectively ("we", "the group").

Your responses should help the group notice productivity patterns without telling them what to do.`;
}

const TRIGGER_PROMPTS_EN: Record<string, string> = {
  imbalance: `The conversation shows participation imbalance. Some voices are dominating while others are quiet.
Speaker distribution: {speakerDistribution}

Full conversation transcript ({totalTurns} turns total):
{transcriptExcerpt}

Generate a brief, gentle process reflection to encourage more balanced participation. Do NOT single out individuals by name.`,

  repetition: `The discussion is circling around similar themes with high semantic repetition.

Full conversation transcript ({totalTurns} turns total):
{transcriptExcerpt}

Generate a brief process reflection to gently encourage exploring new directions or building on existing ideas in fresh ways. Use the full transcript to identify which specific themes have been repeated most.`,

  stagnation: `The conversation has stagnated - there's been a pause in new contributions for a while.

Full conversation transcript ({totalTurns} turns total):
{transcriptExcerpt}

Generate a brief, energizing process reflection to help restart the creative flow. Use the transcript context to make the prompt feel specific to what this group has already explored.`,
};

const TRIGGER_PROMPTS_DE: Record<string, string> = {
  imbalance: `Das Gespräch zeigt ein Ungleichgewicht in der Beteiligung. Einige Stimmen dominieren, während andere still bleiben.
Verteilung der Sprecher: {speakerDistribution}

Vollständiges Gesprächstranskript ({totalTurns} Beiträge insgesamt):
{transcriptExcerpt}

Formuliere eine kurze, sanfte Prozessreflexion, um eine ausgewogenere Beteiligung zu fördern. Nenne KEINE einzelnen Personen beim Namen.`,

  repetition: `Die Diskussion dreht sich um ähnliche Themen mit hoher semantischer Wiederholung.

Vollständiges Gesprächstranskript ({totalTurns} Beiträge insgesamt):
{transcriptExcerpt}

Formuliere eine kurze Prozessreflexion, die sanft dazu ermutigt, neue Richtungen zu erkunden oder bestehende Ideen auf frische Weise weiterzuentwickeln. Nutze das vollständige Transkript, um zu erkennen, welche Themen am meisten wiederholt wurden.`,

  stagnation: `Das Gespräch ist ins Stocken geraten — es gab eine Weile keine neuen Beiträge.

Vollständiges Gesprächstranskript ({totalTurns} Beiträge insgesamt):
{transcriptExcerpt}

Formuliere eine kurze, energetisierende Prozessreflexion, um den kreativen Fluss wieder anzuregen. Nutze den Transkript-Kontext, damit der Impuls spezifisch zu dem passt, was die Gruppe bereits erkundet hat.`,
};

// --- v2 Intent-Specific Prompts ---

const INTENT_PROMPTS_EN: Record<string, string> = {
  PARTICIPATION_REBALANCING: `The conversation shows a participation imbalance.
Participation risk score: {participationRiskScore}
Silent participant ratio: {silentParticipantRatio}
Speaker distribution: {speakerDistribution}
Dominance streak score: {dominanceStreakScore}

Full conversation transcript ({totalTurns} turns total):
{transcriptExcerpt}

Generate a brief, gentle process reflection to encourage more balanced participation.
Focus on inviting quieter voices without singling anyone out.`,

  PERSPECTIVE_BROADENING: `The discussion is converging around a narrow set of ideas.
Cluster concentration: {clusterConcentration}
Novelty rate: {noveltyRate}
Exploration/elaboration ratio: {explorationRatio}

Full conversation transcript ({totalTurns} turns total):
{transcriptExcerpt}

Generate a brief process reflection to encourage exploring different angles or
connecting ideas in unexpected ways. Use the transcript to identify which themes
dominate and suggest looking beyond them.`,

  REACTIVATION: `The conversation has become semantically static with little new content.
Stagnation duration: {stagnationDuration}s
Novelty rate: {noveltyRate}
Semantic expansion: {expansionScore}

Full conversation transcript ({totalTurns} turns total):
{transcriptExcerpt}

Generate a brief, energizing process reflection to restart creative flow.
Reference what the group has explored so far and invite thinking about
unexplored dimensions.`,
};

const INTENT_PROMPTS_DE: Record<string, string> = {
  PARTICIPATION_REBALANCING: `Das Gespräch zeigt ein Ungleichgewicht in der Beteiligung.
Partizipations-Risiko-Score: {participationRiskScore}
Anteil stiller Teilnehmer: {silentParticipantRatio}
Verteilung der Sprecher: {speakerDistribution}
Dominanz-Streak-Score: {dominanceStreakScore}

Vollständiges Gesprächstranskript ({totalTurns} Beiträge insgesamt):
{transcriptExcerpt}

Formuliere eine kurze, sanfte Prozessreflexion, um eine ausgewogenere Beteiligung zu fördern.
Lade leisere Stimmen ein, ohne jemanden einzeln hervorzuheben.`,

  PERSPECTIVE_BROADENING: `Die Diskussion konvergiert um eine enge Auswahl von Ideen.
Cluster-Konzentration: {clusterConcentration}
Neuheitsrate: {noveltyRate}
Explorations-/Elaborations-Verhältnis: {explorationRatio}

Vollständiges Gesprächstranskript ({totalTurns} Beiträge insgesamt):
{transcriptExcerpt}

Formuliere eine kurze Prozessreflexion, die dazu ermutigt, verschiedene Blickwinkel zu erkunden oder Ideen auf unerwartete Weise zu verbinden. Nutze das Transkript, um zu erkennen, welche Themen dominieren, und schlage vor, darüber hinauszuschauen.`,

  REACTIVATION: `Das Gespräch ist semantisch statisch geworden mit wenig neuem Inhalt.
Stagnationsdauer: {stagnationDuration}s
Neuheitsrate: {noveltyRate}
Semantische Expansion: {expansionScore}

Vollständiges Gesprächstranskript ({totalTurns} Beiträge insgesamt):
{transcriptExcerpt}

Formuliere eine kurze, energetisierende Prozessreflexion, um den kreativen Fluss wieder anzuregen.
Verweise auf das, was die Gruppe bisher erkundet hat, und lade dazu ein, über unerforschte Dimensionen nachzudenken.`,
};

// --- Handler ---

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ModeratorRequest;
    const { trigger, speakerDistribution, language, transcriptExcerpt = [], totalTurns = transcriptExcerpt.length, scenario, intent, participationMetrics, semanticDynamics, stagnationDuration } = body;

    // Server-side scenario guard: moderator is never appropriate in baseline
    if (scenario === 'baseline') {
      return NextResponse.json(
        { error: 'Moderator interventions not permitted in baseline scenario' },
        { status: 400 }
      );
    }

    // Select language-appropriate prompts
    const isGerman = language.startsWith('de');
    const triggerPrompts = isGerman ? TRIGGER_PROMPTS_DE : TRIGGER_PROMPTS_EN;
    const intentPrompts = isGerman ? INTENT_PROMPTS_DE : INTENT_PROMPTS_EN;

    // Validate: need either intent (v2) or trigger (v1)
    if (!intent && (!trigger || !triggerPrompts[trigger])) {
      return NextResponse.json(
        { error: 'Invalid trigger or intent type' },
        { status: 400 }
      );
    }

    const apiKeyResult = requireApiKey();
    if ('error' in apiKeyResult) return apiKeyResult.error;
    const apiKey = apiKeyResult.key;

    const routingConfig = loadRoutingConfig();

    // Build prompt — prefer v2 intent-based prompts, fall back to v1 trigger prompts
    const excerptText = transcriptExcerpt.length > 0
      ? transcriptExcerpt.join('\n')
      : 'No recent transcript available';

    let userPrompt: string;

    if (intent && intentPrompts[intent]) {
      userPrompt = intentPrompts[intent]
        .replace('{speakerDistribution}', speakerDistribution || 'Not available')
        .replace('{totalTurns}', String(totalTurns))
        .replace('{transcriptExcerpt}', excerptText)
        .replace('{participationRiskScore}', String(participationMetrics?.participationRiskScore?.toFixed(2) ?? 'N/A'))
        .replace('{silentParticipantRatio}', String(participationMetrics?.silentParticipantRatio?.toFixed(2) ?? 'N/A'))
        .replace('{dominanceStreakScore}', String(participationMetrics?.dominanceStreakScore?.toFixed(2) ?? 'N/A'))
        .replace('{clusterConcentration}', String(semanticDynamics?.clusterConcentration?.toFixed(2) ?? 'N/A'))
        .replace('{noveltyRate}', String(semanticDynamics?.noveltyRate?.toFixed(2) ?? 'N/A'))
        .replace('{explorationRatio}', String(semanticDynamics?.explorationElaborationRatio?.toFixed(2) ?? 'N/A'))
        .replace('{stagnationDuration}', String(stagnationDuration?.toFixed(0) ?? 'N/A'))
        .replace('{expansionScore}', String(semanticDynamics?.semanticExpansionScore?.toFixed(2) ?? 'N/A'));
    } else {
      userPrompt = triggerPrompts[trigger]
        .replace('{speakerDistribution}', speakerDistribution || 'Not available')
        .replace('{totalTurns}', String(totalTurns))
        .replace('{transcriptExcerpt}', excerptText);
    }

    try {
      const { text, logEntry } = await callLLM(
        'moderator_intervention',
        routingConfig,
        [
          { role: 'system', content: getSystemPrompt(language) },
          { role: 'user', content: userPrompt },
        ],
        apiKey
      );

      return NextResponse.json({
        role: 'moderator',
        text,
        trigger,
        intent,
        timestamp: Date.now(),
        logEntry,
      });
    } catch (error) {
      // LLM call failed (after exhausting fallbacks) — return static fallback with HTTP 200
      // so the client can still commit the state transition. Include fallback:true flag for logging.
      const logEntry = error instanceof LLMError ? error.logEntry : null;
      console.error('Moderator LLM call failed:', error);

      return NextResponse.json({
        role: 'moderator',
        text: getFallbackResponse(trigger, language, intent),
        trigger,
        intent,
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

// --- Fallback Responses ---
// Used only when the LLM call itself fails (e.g. network error, all models down).
// NOT used when API key is missing — that returns 503 instead.

function getFallbackResponse(trigger: string, language: string, intent?: string): string {
  const isGerman = language.startsWith('de');

  const fallbacks: Record<string, { en: string; de: string }> = {
    imbalance: {
      en: "I notice some voices we haven't heard from in a while. Would anyone like to add a different perspective?",
      de: 'Mir fällt auf, dass wir von einigen noch nichts gehört haben. Möchte jemand eine andere Perspektive einbringen?',
    },
    repetition: {
      en: "We've explored some great themes. What if we looked at this from a completely different angle?",
      de: 'Wir haben einige tolle Themen erkundet. Wie wäre es, das Ganze aus einem völlig anderen Blickwinkel zu betrachten?',
    },
    stagnation: {
      en: "Let's take a moment to reflect. What aspects haven't we considered yet?",
      de: 'Lasst uns kurz innehalten. Welche Aspekte haben wir noch nicht berücksichtigt?',
    },
    PARTICIPATION_REBALANCING: {
      en: "It feels like we could benefit from hearing more perspectives. Who else has thoughts to share?",
      de: 'Es wäre bereichernd, noch mehr Perspektiven zu hören. Wer möchte noch etwas beitragen?',
    },
    PERSPECTIVE_BROADENING: {
      en: "We've built strong ideas around a few themes. What completely different direction could we explore?",
      de: 'Wir haben starke Ideen zu einigen Themen entwickelt. Welche völlig andere Richtung könnten wir erkunden?',
    },
    REACTIVATION: {
      en: "Let's pause and think about what territory we haven't explored yet. What dimensions are still open?",
      de: 'Lasst uns kurz überlegen, welche Bereiche wir noch nicht erkundet haben. Welche Dimensionen sind noch offen?',
    },
  };

  const key = intent && fallbacks[intent] ? intent : trigger;
  const fallback = fallbacks[key] || fallbacks.imbalance;
  return isGerman ? fallback.de : fallback.en;
}
