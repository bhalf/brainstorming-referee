// ============================================
// Whisper Hallucination Filter
// ============================================
// Whisper is known to produce hallucinated text
// when receiving silence or very low audio.
// Common hallucinations include subtitle credits,
// thank-you messages, YouTube outros, and
// repetitive filler loops.
//
// This filter uses multiple strategies:
// 1. Known pattern matching (substrings)
// 2. Sentence-level repetition detection
// 3. Filler-word density check
// 4. Word-level repetition ratio
// ============================================

/** Known hallucination patterns (case-insensitive substrings) */
const HALLUCINATION_PATTERNS = [
  // German subtitle/credits hallucinations
  'untertitel',
  'amara.org',
  'vielen dank für\'s zuschauen',
  'vielen dank fürs zuschauen',
  'vielen dank für die aufmerksamkeit',
  'im auftrag des zdf',
  'für funk',
  'swisstext',
  'swiss text',
  'copyright',
  '© ',
  'srf',
  'bis zum nächsten mal',
  'bis zum nächsten video',

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

  // YouTube outro hallucinations
  'see you in the next',
  'in the next video',
  'next video',
  'next episode',
  'don\'t forget to subscribe',
  'hit the bell',
  'leave a comment',
  'leave a like',
  'smash that like',

  // URL patterns
  'www.',
  'http',
  '.com/',
  '.org/',
  '.de/',
  '.ch/',

  // Chinese/other language hallucinations (common on silence)
  '字幕',
  '請不吝',
  '谢谢观看',
];

/** Common filler words that Whisper hallucinates in loops */
const FILLER_WORDS = new Set([
  // English
  'hello', 'hi', 'hey', 'bye', 'goodbye', 'okay', 'ok',
  'thank', 'thanks', 'you', 'very', 'much', 'so',
  'yes', 'no', 'yeah', 'well', 'um', 'uh', 'ah',
  'the', 'a', 'an', 'is', 'are', 'and', 'or', 'but',
  'it', 'this', 'that', 'my', 'your', 'i', 'we',
  // German
  'hallo', 'tschüss', 'danke', 'bitte', 'ja', 'nein',
  'gut', 'schön', 'also', 'genau', 'ähm', 'äh',
  'der', 'die', 'das', 'und', 'ist', 'ein', 'eine',
]);

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

  // Check for text that is only punctuation/ellipsis
  if (/^[.\s…,!?;:\-–—]+$/.test(trimmed)) return true;

  const words = lower.replace(/[.,!?;:'"()\-–—]/g, '').split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return true;

  // --- Word-level repetition check ---
  // e.g., "Hello hello hello hello" → unique ratio very low
  if (words.length >= 4) {
    const uniqueWords = new Set(words);
    const uniqueRatio = uniqueWords.size / words.length;
    if (uniqueRatio < 0.4) return true;
  }

  // --- Sentence-level repetition check ---
  // e.g., "Thank you. Thank you. Thank you." → same sentence repeated
  const sentences = trimmed
    .split(/[.!?]+/)
    .map(s => s.trim().toLowerCase().replace(/[,;:\-–—'"()]/g, ''))
    .filter(s => s.length > 1);

  if (sentences.length >= 3) {
    const sentenceCounts = new Map<string, number>();
    for (const s of sentences) {
      sentenceCounts.set(s, (sentenceCounts.get(s) || 0) + 1);
    }
    const maxRepeat = Math.max(...sentenceCounts.values());
    // If any sentence appears in more than half the total sentences → hallucination
    if (maxRepeat >= sentences.length * 0.5) return true;
  }

  // --- Filler word density check ---
  // If >80% of words are common filler words, it's likely hallucination
  if (words.length >= 6) {
    const fillerCount = words.filter(w => FILLER_WORDS.has(w)).length;
    const fillerRatio = fillerCount / words.length;
    if (fillerRatio > 0.8) return true;
  }

  // --- Short repetitive fragments check ---
  // Detect "Hello, hello, hello, hello" patterns (same word 4+ times)
  if (words.length >= 4) {
    const wordCounts = new Map<string, number>();
    for (const w of words) {
      wordCounts.set(w, (wordCounts.get(w) || 0) + 1);
    }
    for (const [, count] of wordCounts) {
      if (count >= 4 && count / words.length > 0.3) return true;
    }
  }

  return false;
}
