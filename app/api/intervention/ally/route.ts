import { NextRequest, NextResponse } from 'next/server';
import { callLLM, LLMError } from '@/lib/llm/client';
import { requireApiKey, loadRoutingConfig } from '@/lib/api/routeHelpers';

// --- Types ---

interface AllyRequest {
  language: string;
  scenario?: string;
  topic?: string;
  previousInterventions?: string[];
  transcriptExcerpt?: string[];
  totalTurns?: number;
  // v2 fields
  intent?: string;
  triggeringState?: string;
  stateConfidence?: number;
  participationMetrics?: { participationRiskScore?: number };
  semanticDynamics?: { noveltyRate?: number; clusterConcentration?: number };
}

// --- System Prompts ---

function getSystemPrompt(language: string): string {
  const isGerman = language.startsWith('de');

  if (isGerman) {
    return `Du bist ein kreativer Verbündeter in einer Brainstorming-Sitzung. Deine Aufgabe ist es, frische Energie und neue Perspektiven einzubringen, wenn die Gruppe feststeckt.

WICHTIGE REGELN:
1. Gib EINEN kurzen, kreativen Impuls oder unerwarteten Blickwinkel.
2. Maximal 1-2 Sätze. Dies ist zwingend.
3. Gib KEINE fertigen Lösungen oder Ideen vor, sondern rege lediglich zum Nachdenken an.
4. Sei spielerisch und energetisierend, nicht belehrend.
5. Verwende Sprache, die Neugier weckt und Perspektivwechsel erzwingt.
6. Antworten müssen für Sprachausgabe geeignet sein (keine Sonderzeichen, Emojis oder Formatierung).
7. Wiederhole KEINE Themen aus vorherigen Interventionen.

Dein Ziel ist es, Muster zu durchbrechen und neue kreative Wege zu eröffnen, ohne die Arbeit für die Gruppe zu erledigen.`;
  }

  return `You are a creative ally in a brainstorming session. Your role is to inject fresh energy and new perspectives when the group is stuck.

IMPORTANT RULES:
1. Provide ONE short, creative impulse or unexpected angle.
2. Keep it to 1-2 sentences maximum. This is mandatory.
3. Do NOT provide complete solutions or finished ideas, only provoke thought.
4. Be playful and energizing, not instructive or preachy.
5. Use language that sparks curiosity and forces perspective shifts.
6. Responses must be suitable for text-to-speech (no special characters, emojis, or formatting).
7. Do NOT repeat themes from previous interventions.

Your goal is to break patterns and open new creative pathways without doing the work for the group.`;
}

const USER_PROMPT_EN = `The brainstorming session is stuck despite earlier moderation attempts. The group needs a creative spark.
Session topic: {topic}

Previous interventions tried: {previousInterventions}

Full conversation transcript ({totalTurns} turns total):
{transcriptExcerpt}

Generate a brief, unexpected creative impulse to energize the discussion. Use the full transcript to avoid repeating themes already covered and to make the impulse feel specific to this group's conversation.`;

const USER_PROMPT_DE = `Die Brainstorming-Sitzung steckt trotz früherer Moderationsversuche fest. Die Gruppe braucht einen kreativen Funken.
Thema der Session: {topic}

Bisherige Interventionen: {previousInterventions}

Vollständiges Gesprächstranskript ({totalTurns} Beiträge insgesamt):
{transcriptExcerpt}

Formuliere einen kurzen, unerwarteten kreativen Impuls, um die Diskussion zu beleben. Nutze das vollständige Transkript, um bereits besprochene Themen nicht zu wiederholen und den Impuls spezifisch für dieses Gespräch zu gestalten.`;

// v2: Enhanced prompt with state context
const USER_PROMPT_V2_EN = `The brainstorming session is stuck despite earlier moderation.
Session topic: {topic}
The moderator tried to address: {triggeringState}
Previous interventions: {previousInterventions}

Key metrics:
- Participation risk: {participationRiskScore}
- Novelty rate: {noveltyRate}
- Cluster concentration: {clusterConcentration}

Full conversation transcript ({totalTurns} turns total):
{transcriptExcerpt}

Generate a brief, unexpected creative impulse. Make it specific to what this group has discussed. Avoid repeating themes from previous interventions.`;

const USER_PROMPT_V2_DE = `Die Brainstorming-Sitzung steckt trotz früherer Moderation fest.
Thema der Session: {topic}
Der Moderator versuchte Folgendes anzusprechen: {triggeringState}
Bisherige Interventionen: {previousInterventions}

Wichtige Kennzahlen:
- Partizipationsrisiko: {participationRiskScore}
- Neuheitsrate: {noveltyRate}
- Cluster-Konzentration: {clusterConcentration}

Vollständiges Gesprächstranskript ({totalTurns} Beiträge insgesamt):
{transcriptExcerpt}

Formuliere einen kurzen, unerwarteten kreativen Impuls. Mache ihn spezifisch für das, was diese Gruppe besprochen hat. Vermeide die Wiederholung von Themen aus früheren Interventionen.`;

// --- Handler ---

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AllyRequest;
    const { language, scenario, topic, previousInterventions = [], transcriptExcerpt = [], totalTurns = transcriptExcerpt.length, triggeringState, participationMetrics, semanticDynamics } = body;

    // Server-side scenario guard: ally is only permitted in Scenario B
    if (scenario && scenario !== 'B') {
      return NextResponse.json(
        { error: 'Ally interventions are only permitted in Scenario B' },
        { status: 400 }
      );
    }

    const apiKeyResult = requireApiKey();
    if ('error' in apiKeyResult) return apiKeyResult.error;
    const apiKey = apiKeyResult.key;

    const routingConfig = loadRoutingConfig();

    // Build prompt
    const interventionContext = previousInterventions.length > 0
      ? previousInterventions.slice(-3).join('; ')
      : 'None yet';

    const excerptText = transcriptExcerpt.length > 0
      ? transcriptExcerpt.join('\n')
      : 'No recent transcript available';

    // Select language-appropriate prompts
    const isGerman = language.startsWith('de');

    // Use v2 prompt if triggeringState is available, otherwise v1
    let userPrompt: string;
    const topicText = topic || 'Not specified';

    if (triggeringState) {
      userPrompt = (isGerman ? USER_PROMPT_V2_DE : USER_PROMPT_V2_EN)
        .replace('{topic}', topicText)
        .replace('{triggeringState}', triggeringState)
        .replace('{previousInterventions}', interventionContext)
        .replace('{totalTurns}', String(totalTurns))
        .replace('{transcriptExcerpt}', excerptText)
        .replace('{participationRiskScore}', String(participationMetrics?.participationRiskScore?.toFixed(2) ?? 'N/A'))
        .replace('{noveltyRate}', String(semanticDynamics?.noveltyRate?.toFixed(2) ?? 'N/A'))
        .replace('{clusterConcentration}', String(semanticDynamics?.clusterConcentration?.toFixed(2) ?? 'N/A'));
    } else {
      userPrompt = (isGerman ? USER_PROMPT_DE : USER_PROMPT_EN)
        .replace('{topic}', topicText)
        .replace('{previousInterventions}', interventionContext)
        .replace('{totalTurns}', String(totalTurns))
        .replace('{transcriptExcerpt}', excerptText);
    }

    try {
      const { text, logEntry } = await callLLM(
        'ally_intervention',
        routingConfig,
        [
          { role: 'system', content: getSystemPrompt(language) },
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
        text: getFallbackResponse(language),
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

// --- Fallback Responses ---
// Used only when the LLM call itself fails (e.g. network error, all models down).
// NOT used when API key is missing — that returns 503 instead.

function getFallbackResponse(language: string): string {
  const isGerman = language.startsWith('de');

  const fallbacks = {
    en: [
      "What if we approached this from the opposite direction entirely?",
      "Imagine explaining this to a five-year-old. What would change?",
      "What would make this solution completely fail? Now flip that.",
      "If this had to be fun, how would it look different?",
    ],
    de: [
      "Was wäre, wenn wir das Ganze komplett umdrehen würden?",
      "Stellt euch vor, ihr erklärt das einem Fünfjährigen. Was würde sich ändern?",
      "Was würde diese Lösung garantiert zum Scheitern bringen? Jetzt dreht das um.",
      "Wenn das Spass machen müsste, wie sähe es dann aus?",
    ],
  };

  const options = isGerman ? fallbacks.de : fallbacks.en;
  return options[Math.floor(Math.random() * options.length)];
}
