/**
 * Goal Assessment Prompts.
 *
 * System prompts for the conversation goal tracking feature. The LLM classifies
 * each predefined goal's coverage status based on embedding heat scores, the
 * live session summary, and recent transcript segments.
 * @module
 */

const SYSTEM_PROMPT_EN = `You are analyzing a brainstorming session's progress toward predefined discussion goals.

For each goal, you receive:
- The goal label and optional description
- An embedding-based "heat score" (0-1) indicating semantic proximity of recent discussion to this goal
- The current session summary
- Recent transcript segments

Classify each goal as one of:
- "not_started": Goal has not been touched at all
- "mentioned": Goal was briefly touched but not meaningfully explored
- "partially_covered": Goal received meaningful discussion but key aspects remain open
- "covered": Goal was thoroughly addressed

Also suggest 1-2 specific open topics that could help the group address uncovered goals.
Keep notes very brief (max 10 words per goal).

Respond ONLY with valid JSON in this exact format:
{
  "assessments": [{"goalId": "...", "status": "...", "notes": "..."}],
  "suggestedTopics": ["...", "..."]
}`;

const SYSTEM_PROMPT_DE = `Du analysierst den Fortschritt einer Brainstorming-Sitzung in Bezug auf vordefinierte Gesprächsziele.

Für jedes Ziel erhältst du:
- Das Ziel-Label und optionale Beschreibung
- Einen Embedding-basierten "Heat Score" (0-1), der die semantische Nähe der aktuellen Diskussion zum Ziel anzeigt
- Die aktuelle Sitzungszusammenfassung
- Die letzten Transkript-Segmente

Klassifiziere jedes Ziel als eines von:
- "not_started": Ziel wurde noch gar nicht angesprochen
- "mentioned": Ziel wurde kurz erwähnt, aber nicht vertieft
- "partially_covered": Ziel wurde substanziell diskutiert, aber wichtige Aspekte sind noch offen
- "covered": Ziel wurde gründlich behandelt

Schlage zusätzlich 1-2 konkrete offene Themen vor, die der Gruppe helfen könnten, noch unbehandelte Ziele anzugehen.
Halte Notizen sehr kurz (max 10 Worte pro Ziel).

Antworte NUR mit validem JSON in diesem Format:
{
  "assessments": [{"goalId": "...", "status": "...", "notes": "..."}],
  "suggestedTopics": ["...", "..."]
}`;

/**
 * Return the goal assessment system prompt for the given language.
 * @param language - BCP-47 language tag (e.g. `'en-US'`, `'de-CH'`).
 */
export function getGoalAssessmentSystemPrompt(language: string): string {
    return language.startsWith('de') ? SYSTEM_PROMPT_DE : SYSTEM_PROMPT_EN;
}
