/**
 * Ally intervention prompts — system prompts, user prompts, and fallback responses.
 * Extracted from app/api/intervention/ally/route.ts for central management.
 */

import { selectLanguage, fillTemplate, type TemplateVars } from '../templateEngine';

// --- System Prompts ---

const SYSTEM_PROMPT_EN = `You are a creative ally in a brainstorming session. Your role is to inject fresh energy and new perspectives when the group is stuck.

IMPORTANT RULES:
1. Provide ONE short, creative impulse or unexpected angle.
2. Keep it to 1-2 sentences maximum. This is mandatory.
3. You MAY suggest concrete "what if" scenarios, but do NOT provide complete solutions. Your impulse should spark further thinking.
4. Be playful and energizing, not instructive or preachy.
5. Use language that sparks curiosity and forces perspective shifts.
6. Responses must be suitable for text-to-speech (no special characters, emojis, or formatting).
7. Do NOT repeat themes from previous interventions.

Your goal is to break patterns and open new creative pathways without doing the work for the group.`;

const SYSTEM_PROMPT_DE = `Du bist ein kreativer Verbündeter in einer Brainstorming-Sitzung. Deine Aufgabe ist es, frische Energie und neue Perspektiven einzubringen, wenn die Gruppe feststeckt.

WICHTIGE REGELN:
1. Gib EINEN kurzen, kreativen Impuls oder unerwarteten Blickwinkel.
2. Maximal 1-2 Sätze. Dies ist zwingend.
3. Du darfst konkrete "Was wäre wenn"-Szenarien vorschlagen, aber liefere keine fertigen Lösungen. Dein Impuls soll zum Weiterdenken anregen.
4. Sei spielerisch und energetisierend, nicht belehrend.
5. Verwende Sprache, die Neugier weckt und Perspektivwechsel erzwingt.
6. Antworten müssen für Sprachausgabe geeignet sein (keine Sonderzeichen, Emojis oder Formatierung).
7. Wiederhole KEINE Themen aus vorherigen Interventionen.

Dein Ziel ist es, Muster zu durchbrechen und neue kreative Wege zu eröffnen, ohne die Arbeit für die Gruppe zu erledigen.`;

export function getAllySystemPrompt(language: string): string {
    return selectLanguage(language, SYSTEM_PROMPT_EN, SYSTEM_PROMPT_DE);
}

// --- User Prompts ---

const USER_PROMPT_V1_EN = `The brainstorming session is stuck despite earlier moderation attempts. The group needs a creative spark.
Session topic: {topic}

Previous interventions tried: {previousInterventions}

Full conversation transcript ({totalTurns} turns total):
{transcriptExcerpt}

Generate a brief, unexpected creative impulse to energize the discussion. Use the full transcript to avoid repeating themes already covered and to make the impulse feel specific to this group's conversation.`;

const USER_PROMPT_V1_DE = `Die Brainstorming-Sitzung steckt trotz früherer Moderationsversuche fest. Die Gruppe braucht einen kreativen Funken.
Thema der Session: {topic}

Bisherige Interventionen: {previousInterventions}

Vollständiges Gesprächstranskript ({totalTurns} Beiträge insgesamt):
{transcriptExcerpt}

Formuliere einen kurzen, unerwarteten kreativen Impuls, um die Diskussion zu beleben. Nutze das vollständige Transkript, um bereits besprochene Themen nicht zu wiederholen und den Impuls spezifisch für dieses Gespräch zu gestalten.`;

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

{existingIdeasContext}

Generate a brief, unexpected creative impulse. Make it specific to what this group has discussed. Avoid repeating themes from previous interventions. If existing ideas are listed, ensure your impulse opens a NEW direction that NONE of those ideas cover.`;

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

{existingIdeasContext}

Formuliere einen kurzen, unerwarteten kreativen Impuls. Mache ihn spezifisch für das, was diese Gruppe besprochen hat. Vermeide die Wiederholung von Themen aus früheren Interventionen. Falls bestehende Ideen aufgelistet sind, stelle sicher, dass dein Impuls eine NEUE Richtung eröffnet, die KEINE dieser Ideen abdeckt.`;

/**
 * Build a fully-filled ally user prompt.
 */
export function buildAllyUserPrompt(
    language: string,
    vars: TemplateVars,
    useV2: boolean,
): string {
    const template = useV2
        ? selectLanguage(language, USER_PROMPT_V2_EN, USER_PROMPT_V2_DE)
        : selectLanguage(language, USER_PROMPT_V1_EN, USER_PROMPT_V1_DE);
    return fillTemplate(template, vars);
}

// --- Fallback Responses ---

const FALLBACKS_EN = [
    "What if we approached this from the opposite direction entirely?",
    "Imagine explaining this to a five-year-old. What would change?",
    "What would make this solution completely fail? Now flip that.",
    "If this had to be fun, how would it look different?",
];

const FALLBACKS_DE = [
    "Was wäre, wenn wir das Ganze komplett umdrehen würden?",
    "Stellt euch vor, ihr erklärt das einem Fünfjährigen. Was würde sich ändern?",
    "Was würde diese Lösung garantiert zum Scheitern bringen? Jetzt dreht das um.",
    "Wenn das Spass machen müsste, wie sähe es dann aus?",
];

export function getAllyFallbackResponse(language: string): string {
    const options = selectLanguage(language, FALLBACKS_EN, FALLBACKS_DE);
    return options[Math.floor(Math.random() * options.length)];
}
