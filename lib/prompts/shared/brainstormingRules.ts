/**
 * Shared brainstorming rules (Osborn's Rules) used by both
 * the rule-check system prompt and the norm-reinforcement intervention prompt.
 * Single source of truth — avoids duplication across API routes.
 */

export const BRAINSTORMING_RULES_EN = `The four brainstorming rules (Osborn's Rules):
1. DEFER JUDGMENT: No criticizing, evaluating, or dismissing ideas during ideation. No "killer phrases."
2. QUANTITY OVER QUALITY: Don't prematurely narrow or select ideas — keep generating.
3. WILD IDEAS WELCOME: Don't dismiss unconventional or unusual thinking.
4. BUILD ON IDEAS: Use "yes, and..." to extend ideas, not "yes, but..." to block them.`;

export const BRAINSTORMING_RULES_DE = `Die vier Brainstorming-Regeln (Osborn's Regeln):
1. BEWERTUNG ZURÜCKSTELLEN — keine Kritik, Bewertung oder Ablehnung von Ideen während der Ideenfindung
2. QUANTITÄT VOR QUALITÄT — weiter Ideen generieren, noch nicht eingrenzen oder auswählen
3. WILDE IDEEN WILLKOMMEN — unkonventionelles Denken nicht abtun
4. AUF IDEEN AUFBAUEN — "Ja, und..." statt "Ja, aber..."`;

/**
 * Shared base rules for all TTS-compatible responses.
 * Used by moderator and ally system prompts.
 */
export const TTS_CONSTRAINTS_EN = `Responses must be suitable for text-to-speech (no special characters, emojis, or formatting).`;
export const TTS_CONSTRAINTS_DE = `Antworten müssen für Sprachausgabe geeignet sein (keine Sonderzeichen, Emojis oder Formatierung).`;
