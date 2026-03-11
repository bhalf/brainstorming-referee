/**
 * Live Summary Prompts.
 *
 * System prompts for the rolling live summary feature. The LLM generates
 * a concise 2-4 paragraph prose summary of the brainstorming session,
 * updating and extending a previous summary with new transcript content.
 * Centralised from `app/api/summary/live/route.ts`.
 * @module
 */

/** English system prompt for live summary generation. */
const SYSTEM_PROMPT_EN = `You are a summary assistant for an ongoing brainstorming session.
Create a concise, structured summary (2-4 paragraphs) of the conversation so far.
- Summarize the main topics and key ideas discussed
- Capture the directions and perspectives explored
- Keep the summary neutral and fact-based
- If a previous summary is provided, update and extend it with the new information
- Write flowing prose, no bullet lists
Respond ONLY with the summary, no introduction or explanation.`;

/** German system prompt for live summary generation. */
const SYSTEM_PROMPT_DE = `Du bist ein Zusammenfassungsassistent für eine laufende Brainstorming-Sitzung.
Erstelle eine knappe, strukturierte Zusammenfassung (2-4 Absätze) des bisherigen Gesprächsverlaufs.
- Fasse die Hauptthemen und Kernideen zusammen
- Gib wieder, welche Richtungen und Perspektiven diskutiert wurden
- Halte die Zusammenfassung neutral und faktenbasiert
- Wenn eine vorherige Zusammenfassung vorhanden ist, aktualisiere und erweitere sie mit den neuen Informationen
- Schreibe flüssig, keine Aufzählungslisten
Antworte NUR mit der Zusammenfassung, ohne Einleitung oder Erklärung.`;

/**
 * Return the live summary system prompt for the given language.
 * @param language - BCP-47 language tag (e.g. `'en-US'`, `'de-CH'`).
 * @returns The system prompt string in the appropriate language.
 */
export function getSummarySystemPrompt(language: string): string {
    return language.startsWith('de') ? SYSTEM_PROMPT_DE : SYSTEM_PROMPT_EN;
}
