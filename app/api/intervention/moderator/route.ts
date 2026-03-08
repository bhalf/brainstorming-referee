import { NextRequest, NextResponse } from 'next/server';
import { callLLM, LLMError } from '@/lib/llm/client';
import { requireApiKey, loadRoutingConfig } from '@/lib/api/routeHelpers';

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

// --- Intent-Specific Prompts ---

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

  NORM_REINFORCEMENT: `A brainstorming rule violation was detected in the session.
Rule violated: {violationType}
Evidence from transcript: {violationEvidence}
Severity: {violationSeverity}

The four brainstorming rules (Osborn's Rules) are:
1. DEFER JUDGMENT — no criticizing, evaluating, or dismissing ideas during ideation
2. GO FOR QUANTITY — keep generating ideas, don't narrow or select yet
3. WILD IDEAS WELCOME — don't dismiss unconventional or unusual thinking
4. BUILD ON IDEAS — use "yes, and..." to extend ideas, not "yes, but..." to block them

Speaker distribution: {speakerDistribution}
Recent transcript ({totalTurns} turns):
{transcriptExcerpt}

Generate a brief, friendly reminder of the violated brainstorming rule.
Do NOT single out or blame anyone by name. Focus on the process and the rule.
Frame it positively — remind what TO do, not what NOT to do.
Keep it to 1-2 sentences maximum.`,
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

  NORM_REINFORCEMENT: `Ein Brainstorming-Regelverstoss wurde in der Session erkannt.
Verletzte Regel: {violationType}
Beleg aus dem Transkript: {violationEvidence}
Schweregrad: {violationSeverity}

Die vier Brainstorming-Regeln (Osborn's Regeln) sind:
1. BEWERTUNG ZURÜCKSTELLEN — keine Kritik, Bewertung oder Ablehnung von Ideen während der Ideenfindung
2. QUANTITÄT VOR QUALITÄT — weiter Ideen generieren, noch nicht eingrenzen oder auswählen
3. WILDE IDEEN WILLKOMMEN — unkonventionelles Denken nicht abtun
4. AUF IDEEN AUFBAUEN — "Ja, und..." statt "Ja, aber..."

Verteilung der Sprecher: {speakerDistribution}
Gesprächstranskript ({totalTurns} Beiträge):
{transcriptExcerpt}

Formuliere eine kurze, freundliche Erinnerung an die verletzte Brainstorming-Regel.
Nenne NIEMANDEN beim Namen und weise NIEMANDEN direkt zurecht. Fokussiere auf den Prozess und die Regel.
Formuliere es positiv — erinnere daran, was man TUN soll, nicht was man NICHT tun soll.
Maximal 1-2 Sätze.`,
};

// --- Combined Prompts (rule violation + metric issue) ---

const COMBINED_PROMPTS_EN: Record<string, string> = {
  PARTICIPATION_REBALANCING: `Two issues need addressing in this brainstorming session:

1. A brainstorming rule was violated:
   Rule: {violationType}
   Evidence: {violationEvidence}

2. There is a participation imbalance:
   Participation risk score: {participationRiskScore}
   Silent participant ratio: {silentParticipantRatio}
   Speaker distribution: {speakerDistribution}

Recent transcript ({totalTurns} turns):
{transcriptExcerpt}

Generate ONE brief message (1-2 sentences) that naturally addresses both:
- A gentle reminder of the brainstorming rule
- An invitation for more balanced participation
Make it flow naturally as one thought, not two separate points.
Do NOT single out anyone by name.`,

  PERSPECTIVE_BROADENING: `Two issues need addressing in this brainstorming session:

1. A brainstorming rule was violated:
   Rule: {violationType}
   Evidence: {violationEvidence}

2. Ideas are converging too narrowly:
   Cluster concentration: {clusterConcentration}
   Novelty rate: {noveltyRate}

Recent transcript ({totalTurns} turns):
{transcriptExcerpt}

Generate ONE brief message (1-2 sentences) that naturally addresses both:
- A gentle reminder of the brainstorming rule
- Encouragement to explore fresh directions
Make it flow naturally as one thought. Do NOT single out anyone.`,

  REACTIVATION: `Two issues need addressing in this brainstorming session:

1. A brainstorming rule was violated:
   Rule: {violationType}
   Evidence: {violationEvidence}

2. The discussion has stalled:
   Stagnation duration: {stagnationDuration}s
   Novelty rate: {noveltyRate}

Recent transcript ({totalTurns} turns):
{transcriptExcerpt}

Generate ONE brief message (1-2 sentences) that naturally addresses both:
- A gentle reminder of the brainstorming rule
- An energizing nudge to restart creative flow
Make it flow naturally as one thought. Do NOT single out anyone.`,
};

const COMBINED_PROMPTS_DE: Record<string, string> = {
  PARTICIPATION_REBALANCING: `Zwei Punkte sollten in dieser Brainstorming-Session angesprochen werden:

1. Eine Brainstorming-Regel wurde verletzt:
   Regel: {violationType}
   Beleg: {violationEvidence}

2. Es gibt ein Ungleichgewicht in der Beteiligung:
   Partizipations-Risiko-Score: {participationRiskScore}
   Anteil stiller Teilnehmer: {silentParticipantRatio}
   Verteilung: {speakerDistribution}

Gesprächstranskript ({totalTurns} Beiträge):
{transcriptExcerpt}

Formuliere EINE kurze Nachricht (1-2 Sätze), die beides natürlich anspricht:
- Eine sanfte Erinnerung an die Brainstorming-Regel
- Eine Einladung zu ausgewogenerer Beteiligung
Lass es als ein natürlicher Gedanke fliessen, nicht als zwei separate Punkte.
Nenne NIEMANDEN beim Namen.`,

  PERSPECTIVE_BROADENING: `Zwei Punkte sollten in dieser Brainstorming-Session angesprochen werden:

1. Eine Brainstorming-Regel wurde verletzt:
   Regel: {violationType}
   Beleg: {violationEvidence}

2. Die Ideen konvergieren zu stark:
   Cluster-Konzentration: {clusterConcentration}
   Neuheitsrate: {noveltyRate}

Gesprächstranskript ({totalTurns} Beiträge):
{transcriptExcerpt}

Formuliere EINE kurze Nachricht (1-2 Sätze), die beides natürlich anspricht:
- Eine sanfte Erinnerung an die Brainstorming-Regel
- Ermutigung, frische Richtungen zu erkunden
Lass es als ein natürlicher Gedanke fliessen. Nenne NIEMANDEN beim Namen.`,

  REACTIVATION: `Zwei Punkte sollten in dieser Brainstorming-Session angesprochen werden:

1. Eine Brainstorming-Regel wurde verletzt:
   Regel: {violationType}
   Beleg: {violationEvidence}

2. Die Diskussion ist ins Stocken geraten:
   Stagnationsdauer: {stagnationDuration}s
   Neuheitsrate: {noveltyRate}

Gesprächstranskript ({totalTurns} Beiträge):
{transcriptExcerpt}

Formuliere EINE kurze Nachricht (1-2 Sätze), die beides natürlich anspricht:
- Eine sanfte Erinnerung an die Brainstorming-Regel
- Einen energetisierenden Impuls, um den kreativen Fluss wieder anzuregen
Lass es als ein natürlicher Gedanke fliessen. Nenne NIEMANDEN beim Namen.`,
};

// --- Handler ---

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ModeratorRequest;
    const { trigger, speakerDistribution, language, transcriptExcerpt = [], totalTurns = transcriptExcerpt.length, scenario, intent, participationMetrics, semanticDynamics, stagnationDuration, violationType, violationEvidence, violationSeverity, combined, ruleViolation } = body;

    // Server-side scenario guard: moderator is never appropriate in baseline
    if (scenario === 'baseline') {
      return NextResponse.json(
        { error: 'Moderator interventions not permitted in baseline scenario' },
        { status: 400 }
      );
    }

    // Validate: need intent
    const isGerman = language.startsWith('de');
    const intentPrompts = isGerman ? INTENT_PROMPTS_DE : INTENT_PROMPTS_EN;
    const combinedPrompts = isGerman ? COMBINED_PROMPTS_DE : COMBINED_PROMPTS_EN;

    if (!intent || !intentPrompts[intent]) {
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

    // Select prompt template: combined (rule+metric) or single intent
    let promptTemplate: string;
    if (combined && ruleViolation && combinedPrompts[intent]) {
      promptTemplate = combinedPrompts[intent];
    } else {
      promptTemplate = intentPrompts[intent];
    }

    const userPrompt = promptTemplate
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
      .replace('{expansionScore}', String(semanticDynamics?.semanticExpansionScore?.toFixed(2) ?? 'N/A'))
      .replace('{violationType}', effectiveViolationType)
      .replace('{violationEvidence}', effectiveViolationEvidence)
      .replace('{violationSeverity}', effectiveViolationSeverity);

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
        combined: combined ?? false,
        timestamp: Date.now(),
        logEntry,
      });
    } catch (error) {
      const logEntry = error instanceof LLMError ? error.logEntry : null;
      console.error('Moderator LLM call failed:', error);

      return NextResponse.json({
        role: 'moderator',
        text: getFallbackResponse(language, intent),
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

// --- Fallback Responses ---

function getFallbackResponse(language: string, intent: string): string {
  const isGerman = language.startsWith('de');

  const fallbacks: Record<string, { en: string; de: string }> = {
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
    NORM_REINFORCEMENT: {
      en: "Quick reminder — in brainstorming, all ideas are welcome! Let's save evaluation for later and keep building on each other's thoughts.",
      de: 'Kurze Erinnerung: Beim Brainstorming sind alle Ideen willkommen! Bewertungen heben wir uns für später auf — lasst uns weiter aufeinander aufbauen.',
    },
  };

  const fallback = fallbacks[intent] || fallbacks.PARTICIPATION_REBALANCING;
  return isGerman ? fallback.de : fallback.en;
}
