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
7. Du DARFST Teilnehmer beim Vornamen ansprechen, wenn du sie gezielt einladen möchtest (z.B. "Anna, was denkst du dazu?"). Tu dies bewusst und mit Absicht, nicht wahllos.
8. Beziehe dich auf etwas KONKRETES aus dem Gespräch — nenne ein Thema, eine Idee oder einen Moment der Diskussion. Generische Floskeln wie "Es wäre bereichernd, mehr Perspektiven zu hören" sind NICHT erlaubt.

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
7. You MAY address participants by first name when deliberately inviting them to contribute (e.g. "Anna, what are your thoughts on that?"). Do this purposefully, not randomly.
8. Reference something SPECIFIC from the conversation — mention a topic, idea, or moment from the discussion. Generic platitudes like "It would be great to hear more perspectives" are NOT allowed.

Your responses should help the group notice productivity patterns without telling them what to do.`;
}

// --- Intent-Specific Prompts ---

const INTENT_PROMPTS_EN: Record<string, string> = {
  PARTICIPATION_REBALANCING: `SITUATION: {dominantSpeakers} have dominated the conversation ({speakerDistribution}).
{quietInfo}
The group's topic: {topic}

Full conversation transcript ({totalTurns} turns total):
{transcriptExcerpt}

Generate a brief process reflection (1-2 sentences) that invites the quieter participants to contribute.
Reference something SPECIFIC from the conversation — a topic being discussed, a moment, or an idea.
You may address quiet participants by name to make the invitation feel personal and warm.
Do NOT use generic phrases like "it would be great to hear more voices".`,

  PERSPECTIVE_BROADENING: `SITUATION: The discussion has been circling around a narrow set of themes.
Cluster concentration: {clusterConcentration} (1.0 = all ideas in one cluster)
Novelty rate: {noveltyRate} (low = few new ideas)
The group's topic: {topic}

Full conversation transcript ({totalTurns} turns total):
{transcriptExcerpt}

Generate a brief process reflection (1-2 sentences) that encourages exploring different angles.
Reference the SPECIFIC themes that dominate and suggest looking beyond them.
Do NOT use generic phrases like "what other directions could we explore".`,

  REACTIVATION: `SITUATION: The conversation has become semantically static. No substantially new ideas for {stagnationDuration}s.
Novelty rate: {noveltyRate}
Semantic expansion: {expansionScore}
The group's topic: {topic}

Full conversation transcript ({totalTurns} turns total):
{transcriptExcerpt}

Generate a brief, energizing process reflection (1-2 sentences) to restart creative flow.
Reference what the group has already explored and point toward SPECIFIC unexplored dimensions related to their topic.
Do NOT use generic phrases like "let's think about what we haven't covered yet".`,

  NORM_REINFORCEMENT: `SITUATION: A brainstorming rule violation was detected.
Rule violated: {violationType}
Evidence from transcript: {violationEvidence}
Severity: {violationSeverity}

The four brainstorming rules (Osborn's Rules) are:
1. DEFER JUDGMENT — no criticizing, evaluating, or dismissing ideas during ideation
2. GO FOR QUANTITY — keep generating ideas, don't narrow or select yet
3. WILD IDEAS WELCOME — don't dismiss unconventional or unusual thinking
4. BUILD ON IDEAS — use "yes, and..." to extend ideas, not "yes, but..." to block them

Full conversation transcript ({totalTurns} turns total):
{transcriptExcerpt}

Generate a brief, friendly reminder (1-2 sentences) of the violated brainstorming rule.
Do NOT single out or blame anyone by name. Focus on the process and the rule.
Frame it positively — remind what TO do, not what NOT to do.`,
};

const INTENT_PROMPTS_DE: Record<string, string> = {
  PARTICIPATION_REBALANCING: `SITUATION: {dominantSpeakers} haben das Gespräch dominiert ({speakerDistribution}).
{quietInfo}
Thema der Gruppe: {topic}

Vollständiges Gesprächstranskript ({totalTurns} Beiträge insgesamt):
{transcriptExcerpt}

Formuliere eine kurze Prozessreflexion (1-2 Sätze), die die leiseren Teilnehmer einlädt, etwas beizutragen.
Beziehe dich auf etwas KONKRETES aus dem Gespräch — ein Thema, einen Moment oder eine Idee.
Du darfst stille Teilnehmer beim Namen ansprechen, um die Einladung persönlich und warm zu gestalten.
Verwende KEINE generischen Floskeln wie "es wäre bereichernd, mehr Perspektiven zu hören".`,

  PERSPECTIVE_BROADENING: `SITUATION: Die Diskussion kreist um eine enge Auswahl von Themen.
Cluster-Konzentration: {clusterConcentration} (1.0 = alle Ideen in einem Cluster)
Neuheitsrate: {noveltyRate} (niedrig = wenig neue Ideen)
Thema der Gruppe: {topic}

Vollständiges Gesprächstranskript ({totalTurns} Beiträge insgesamt):
{transcriptExcerpt}

Formuliere eine kurze Prozessreflexion (1-2 Sätze), die dazu ermutigt, andere Blickwinkel zu erkunden.
Benenne die KONKRETEN Themen, die dominieren, und schlage vor, darüber hinauszuschauen.
Verwende KEINE generischen Floskeln wie "welche anderen Richtungen könnten wir erkunden".`,

  REACTIVATION: `SITUATION: Das Gespräch ist semantisch statisch geworden. Seit {stagnationDuration}s keine wesentlich neuen Ideen.
Neuheitsrate: {noveltyRate}
Semantische Expansion: {expansionScore}
Thema der Gruppe: {topic}

Vollständiges Gesprächstranskript ({totalTurns} Beiträge insgesamt):
{transcriptExcerpt}

Formuliere eine kurze, energetisierende Prozessreflexion (1-2 Sätze), um den kreativen Fluss wieder anzuregen.
Verweise auf das, was die Gruppe bereits erkundet hat, und zeige KONKRETE unerforschte Dimensionen auf, die zum Thema passen.
Verwende KEINE generischen Floskeln wie "lasst uns überlegen, was wir noch nicht behandelt haben".`,

  NORM_REINFORCEMENT: `SITUATION: Ein Brainstorming-Regelverstoss wurde erkannt.
Verletzte Regel: {violationType}
Beleg aus dem Transkript: {violationEvidence}
Schweregrad: {violationSeverity}

Die vier Brainstorming-Regeln (Osborn's Regeln) sind:
1. BEWERTUNG ZURÜCKSTELLEN — keine Kritik, Bewertung oder Ablehnung von Ideen während der Ideenfindung
2. QUANTITÄT VOR QUALITÄT — weiter Ideen generieren, noch nicht eingrenzen oder auswählen
3. WILDE IDEEN WILLKOMMEN — unkonventionelles Denken nicht abtun
4. AUF IDEEN AUFBAUEN — "Ja, und..." statt "Ja, aber..."

Vollständiges Gesprächstranskript ({totalTurns} Beiträge insgesamt):
{transcriptExcerpt}

Formuliere eine kurze, freundliche Erinnerung (1-2 Sätze) an die verletzte Brainstorming-Regel.
Nenne NIEMANDEN beim Namen und weise NIEMANDEN direkt zurecht. Fokussiere auf den Prozess und die Regel.
Formuliere es positiv — erinnere daran, was man TUN soll, nicht was man NICHT tun soll.`,
};

// --- Combined Prompts (rule violation + metric issue) ---

const COMBINED_PROMPTS_EN: Record<string, string> = {
  PARTICIPATION_REBALANCING: 'Two issues need addressing in this brainstorming session:\n\n1. A brainstorming rule was violated:\n   Rule: {violationType}\n   Evidence: {violationEvidence}\n\n2. There is a participation imbalance:\n   {dominantSpeakers} have dominated ({speakerDistribution}).\n   {quietInfo}\n\nThe group\'s topic: {topic}\n\nFull conversation transcript ({totalTurns} turns):\n{transcriptExcerpt}\n\nGenerate ONE brief message (1-2 sentences) that naturally addresses both:\n- A gentle reminder of the brainstorming rule\n- An invitation for more balanced participation, referencing something specific from the discussion\nMake it flow naturally as one thought, not two separate points.',

  PERSPECTIVE_BROADENING: 'Two issues need addressing in this brainstorming session:\n\n1. A brainstorming rule was violated:\n   Rule: {violationType}\n   Evidence: {violationEvidence}\n\n2. Ideas are converging too narrowly:\n   Cluster concentration: {clusterConcentration}\n   Novelty rate: {noveltyRate}\n\nThe group\'s topic: {topic}\n\nFull conversation transcript ({totalTurns} turns):\n{transcriptExcerpt}\n\nGenerate ONE brief message (1-2 sentences) that naturally addresses both:\n- A gentle reminder of the brainstorming rule\n- Encouragement to explore fresh directions, referencing specific themes from the discussion\nMake it flow naturally as one thought.',

  REACTIVATION: 'Two issues need addressing in this brainstorming session:\n\n1. A brainstorming rule was violated:\n   Rule: {violationType}\n   Evidence: {violationEvidence}\n\n2. The discussion has stalled:\n   Stagnation duration: {stagnationDuration}s\n   Novelty rate: {noveltyRate}\n\nThe group\'s topic: {topic}\n\nFull conversation transcript ({totalTurns} turns):\n{transcriptExcerpt}\n\nGenerate ONE brief message (1-2 sentences) that naturally addresses both:\n- A gentle reminder of the brainstorming rule\n- An energizing nudge referencing specific ideas from the conversation\nMake it flow naturally as one thought.',
};

const COMBINED_PROMPTS_DE: Record<string, string> = {
  PARTICIPATION_REBALANCING: 'Zwei Punkte sollten in dieser Brainstorming-Session angesprochen werden:\n\n1. Eine Brainstorming-Regel wurde verletzt:\n   Regel: {violationType}\n   Beleg: {violationEvidence}\n\n2. Es gibt ein Ungleichgewicht in der Beteiligung:\n   {dominantSpeakers} haben dominiert ({speakerDistribution}).\n   {quietInfo}\n\nThema der Gruppe: {topic}\n\nGesprächstranskript ({totalTurns} Beiträge):\n{transcriptExcerpt}\n\nFormuliere EINE kurze Nachricht (1-2 Sätze), die beides natürlich anspricht:\n- Eine sanfte Erinnerung an die Brainstorming-Regel\n- Eine Einladung zu ausgewogenerer Beteiligung, mit Bezug auf etwas Konkretes aus der Diskussion\nLass es als ein natürlicher Gedanke fliessen, nicht als zwei separate Punkte.',

  PERSPECTIVE_BROADENING: 'Zwei Punkte sollten in dieser Brainstorming-Session angesprochen werden:\n\n1. Eine Brainstorming-Regel wurde verletzt:\n   Regel: {violationType}\n   Beleg: {violationEvidence}\n\n2. Die Ideen konvergieren zu stark:\n   Cluster-Konzentration: {clusterConcentration}\n   Neuheitsrate: {noveltyRate}\n\nThema der Gruppe: {topic}\n\nGesprächstranskript ({totalTurns} Beiträge):\n{transcriptExcerpt}\n\nFormuliere EINE kurze Nachricht (1-2 Sätze), die beides natürlich anspricht:\n- Eine sanfte Erinnerung an die Brainstorming-Regel\n- Ermutigung, frische Richtungen zu erkunden, mit Bezug auf konkrete Themen aus der Diskussion\nLass es als ein natürlicher Gedanke fliessen.',

  REACTIVATION: 'Zwei Punkte sollten in dieser Brainstorming-Session angesprochen werden:\n\n1. Eine Brainstorming-Regel wurde verletzt:\n   Regel: {violationType}\n   Beleg: {violationEvidence}\n\n2. Die Diskussion ist ins Stocken geraten:\n   Stagnationsdauer: {stagnationDuration}s\n   Neuheitsrate: {noveltyRate}\n\nThema der Gruppe: {topic}\n\nGesprächstranskript ({totalTurns} Beiträge):\n{transcriptExcerpt}\n\nFormuliere EINE kurze Nachricht (1-2 Sätze), die beides natürlich anspricht:\n- Eine sanfte Erinnerung an die Brainstorming-Regel\n- Einen energetisierenden Impuls mit Bezug auf konkrete Ideen aus dem Gespräch\nLass es als ein natürlicher Gedanke fliessen.',
};

// --- Handler ---

export async function POST(request: NextRequest) {
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

    // Build quiet participant info string
    const quietInfo = quietSpeakers
      ? `Quiet participants: ${quietSpeakers} `
      : participationMetrics?.silentParticipantRatio
        ? `${(participationMetrics.silentParticipantRatio * 100).toFixed(0)}% of participants have been quiet.`
        : '';

    const topicText = topic || 'Not specified';
    const dominantText = dominantSpeakers || 'Some participants';

    const userPrompt = promptTemplate
      .replace('{speakerDistribution}', speakerDistribution || 'Not available')
      .replace('{totalTurns}', String(totalTurns))
      .replace('{transcriptExcerpt}', excerptText)
      .replace('{topic}', topicText)
      .replace('{dominantSpeakers}', dominantText)
      .replace('{quietInfo}', quietInfo)
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
