import { NextRequest, NextResponse } from 'next/server';
import { callLLM, LLMError } from '@/lib/llm/client';
import { getModelRoutingConfig, setModelRoutingConfig, DEFAULT_MODEL_ROUTING } from '@/lib/config/modelRouting';
import { loadConfigFromFile } from '@/lib/config/modelRoutingPersistence';

// --- Types ---

interface ModeratorRequest {
  trigger: 'imbalance' | 'repetition' | 'stagnation';
  speakerDistribution: string;
  language: string;
  participationImbalance?: number;
  repetitionRate?: number;
  stagnationDuration?: number;
  transcriptExcerpt?: string[];
  scenario?: string;
  currentState?: string;
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

const TRIGGER_PROMPTS: Record<string, string> = {
  imbalance: `The conversation shows participation imbalance. Some voices are dominating while others are quiet.
Speaker distribution: {speakerDistribution}

Recent transcript:
{transcriptExcerpt}

Generate a brief, gentle process reflection to encourage more balanced participation. Do NOT single out individuals by name.`,

  repetition: `The discussion seems to be circling around similar themes with high semantic repetition.

Recent transcript:
{transcriptExcerpt}

Generate a brief process reflection to gently encourage exploring new directions or building on existing ideas in fresh ways.`,

  stagnation: `The conversation has stagnated - there's been a pause in new contributions for a while.

Recent transcript:
{transcriptExcerpt}

Generate a brief, energizing process reflection to help restart the creative flow without suggesting specific ideas.`,
};

// --- Handler ---

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ModeratorRequest;
    const { trigger, speakerDistribution, language, transcriptExcerpt = [], scenario } = body;

    // Server-side scenario guard: moderator is never appropriate in baseline
    if (scenario === 'baseline') {
      return NextResponse.json(
        { error: 'Moderator interventions not permitted in baseline scenario' },
        { status: 400 }
      );
    }

    // Validate trigger
    if (!trigger || !TRIGGER_PROMPTS[trigger]) {
      return NextResponse.json(
        { error: 'Invalid trigger type' },
        { status: 400 }
      );
    }

    // Require API key — return 503 so the client can detect misconfiguration
    // Do NOT silently substitute fallback text here; the caller must know the LLM was unavailable
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
    const excerptText = transcriptExcerpt.length > 0
      ? transcriptExcerpt.join('\n')
      : 'No recent transcript available';

    const userPrompt = TRIGGER_PROMPTS[trigger]
      .replace('{speakerDistribution}', speakerDistribution || 'Not available')
      .replace('{transcriptExcerpt}', excerptText);

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
        text: getFallbackResponse(trigger, language),
        trigger,
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

function getFallbackResponse(trigger: string, language: string): string {
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
  };

  const fallback = fallbacks[trigger] || fallbacks.imbalance;
  return isGerman ? fallback.de : fallback.en;
}
