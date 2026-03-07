// ============================================
// Whisper Hallucination Filter
// ============================================
// Whisper is known to produce hallucinated text
// when receiving silence or very low audio.
// Common hallucinations include subtitle credits,
// thank-you messages, and repetitive filler.
// ============================================

/** Known hallucination patterns (case-insensitive substrings) */
const HALLUCINATION_PATTERNS = [
  // German subtitle/credits hallucinations
  'untertitel',
  'amara.org',
  'vielen dank für\'s zuschauen',
  'vielen dank für die aufmerksamkeit',
  'im auftrag des zdf',
  'für funk',
  'swisstext',
  'swiss text',
  'copyright',
  '© ',

  // English subtitle/credits hallucinations
  'thanks for watching',
  'thank you for watching',
  'please subscribe',
  'like and subscribe',
  'subtitles by',
  'captions by',
  'transcribed by',
  'translated by',
  'provided by',

  // Common filler hallucinations
  'www.',
  'http',
  '.com',
  '.org',
  '.de',
  '.ch',
];

/** Patterns that indicate repetitive hallucination (same short phrase repeated) */
const MIN_UNIQUE_RATIO = 0.5;

/**
 * Check if a transcription result is likely a Whisper hallucination.
 * Returns true if the text should be discarded.
 */
export function isWhisperHallucination(text: string): boolean {
  const trimmed = text.trim();

  // Empty or very short
  if (trimmed.length < 2) return true;

  // Check against known patterns
  const lower = trimmed.toLowerCase();
  for (const pattern of HALLUCINATION_PATTERNS) {
    if (lower.includes(pattern)) return true;
  }

  // Check for repetitive text (same words repeated many times)
  // e.g., "Vielen Dank. Vielen Dank. Vielen Dank."
  const words = trimmed.split(/\s+/);
  if (words.length >= 6) {
    const uniqueWords = new Set(words.map(w => w.toLowerCase().replace(/[.,!?;:]/g, '')));
    const uniqueRatio = uniqueWords.size / words.length;
    if (uniqueRatio < MIN_UNIQUE_RATIO) return true;
  }

  // Check for text that is only punctuation/ellipsis
  if (/^[.\s…,!?;:\-–—]+$/.test(trimmed)) return true;

  return false;
}
