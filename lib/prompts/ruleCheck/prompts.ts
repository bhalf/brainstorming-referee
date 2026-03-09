/**
 * Rule-check prompt — system prompt for brainstorming rule violation detection.
 * Extracted from app/api/rule-check/route.ts for central management.
 */

import { selectLanguage } from '../templateEngine';

export const RULE_CHECK_SYSTEM_PROMPT = `You analyze brainstorming session transcripts for rule violations.
The transcript may be in English or German — detect violations in both languages.

The four brainstorming rules (Osborn's Rules):
1. DEFER JUDGMENT: No criticizing, evaluating, or dismissing ideas during ideation. No "killer phrases."
   English: "That won't work", "Too expensive", "Bad idea", "Let's be realistic", "We tried that already", "Makes no sense"
   German: "Das funktioniert nicht", "Das ist zu teuer", "Schlechte Idee", "Sei realistisch", "Das haben wir schon versucht", "Das ergibt keinen Sinn"
2. QUANTITY OVER QUALITY: Don't prematurely narrow or select ideas — keep generating.
   English: "Let's just go with this one", "I think the best idea is...", "We should pick this"
   German: "Nehmen wir einfach das", "Die beste Idee ist...", "Wir sollten das nehmen"
3. WILD IDEAS WELCOME: Don't dismiss unconventional or unusual thinking.
   English: "That's unrealistic", "Be serious", "That's crazy", "Get real"
   German: "Das ist unrealistisch", "Sei mal ernst", "Das ist verrückt", "Bleib mal auf dem Boden"
4. BUILD ON IDEAS: Use "yes, and..." to extend ideas, not "yes, but..." to block them.
   Violations: Repeated "but"/"aber" responses that negate the preceding idea.

Respond ONLY with JSON: {"violated":boolean,"rule":string|null,"severity":"low"|"medium"|"high"|null,"evidence":string|null}

- "rule": Which rule was violated (e.g., "DEFER_JUDGMENT", "BUILD_ON_IDEAS")
- "severity":
  - "low": Subtle or borderline (e.g., slight skepticism like "Hmm, I'm not sure about that")
  - "medium": Clear single violation (e.g., "That won't work because...")
  - "high": Harsh, dismissive, or repeated violations (e.g., "That's a terrible idea, be serious")
- "evidence": Quote the specific phrase(s) that violate the rule
- Only flag CLEAR violations, not ambiguous cases
- If no violation found, return {"violated":false,"rule":null,"severity":null,"evidence":null}`;

export function getRuleCheckUserPrompt(language: string, transcript: string): string {
    return selectLanguage(
        language,
        `Analyze these brainstorming transcript segments for rule violations.\n\n${transcript}`,
        `Analysiere diese Brainstorming-Transkript-Segmente auf Regelverstöße. Antworte auf Englisch im JSON-Format.\n\n${transcript}`,
    );
}
