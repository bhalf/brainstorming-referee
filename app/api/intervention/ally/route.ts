import { NextRequest, NextResponse } from 'next/server';
import { callLLM, LLMError } from '@/lib/llm/client';
import { getModelRoutingConfig, setModelRoutingConfig, DEFAULT_MODEL_ROUTING } from '@/lib/config/modelRouting';
import { loadConfigFromFile } from '@/lib/config/modelRoutingPersistence';

// --- Types ---

interface AllyRequest {
  language: string;
  scenario?: string;
  topic?: string;
  previousInterventions?: string[];
  transcriptExcerpt?: string[];
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

const USER_PROMPT = `The brainstorming session is stuck despite earlier moderation attempts. The group needs a creative spark.

Previous interventions tried: {previousInterventions}

Recent transcript from the session:
{transcriptExcerpt}

Generate a brief, unexpected creative impulse to energize the discussion. Make it thought-provoking but not prescriptive.`;

// --- Handler ---

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AllyRequest;
    const { language, scenario, previousInterventions = [], transcriptExcerpt = [] } = body;

    // Server-side scenario guard: ally is only permitted in Scenario B
    if (scenario && scenario !== 'B') {
      return NextResponse.json(
        { error: 'Ally interventions are only permitted in Scenario B' },
        { status: 400 }
      );
    }

    // Require API key — return 503 so the client can detect misconfiguration
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY not configured', code: 'NO_API_KEY' },
        { status: 503 }
      );
    }

    // Load persisted model routing config on cold start (avoids serverless reset to defaults)
    let routingConfig = getModelRoutingConfig();
    if (routingConfig === DEFAULT_MODEL_ROUTING) {
      const fileConfig = loadConfigFromFile();
      if (fileConfig) {
        setModelRoutingConfig(fileConfig);
        routingConfig = fileConfig;
      }
    }

    // Build prompt
    const interventionContext = previousInterventions.length > 0
      ? previousInterventions.slice(-3).join('; ')
      : 'None yet';

    const excerptText = transcriptExcerpt.length > 0
      ? transcriptExcerpt.join('\n')
      : 'No recent transcript available';

    const userPrompt = USER_PROMPT
      .replace('{previousInterventions}', interventionContext)
      .replace('{transcriptExcerpt}', excerptText);

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
