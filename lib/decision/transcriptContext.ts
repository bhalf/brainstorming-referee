/**
 * Build a transcript context suitable for LLM intervention prompts.
 * Pure function — no React hook dependencies.
 */
import { TranscriptSegment, Intervention } from '@/lib/types';

export interface TranscriptContext {
    transcriptExcerpt: string[];
    totalTurns: number;
    previousInterventions: string[];
}

const MAX_EXCERPT_SEGMENTS = 50;

export function buildTranscriptContext(
    segments: TranscriptSegment[],
    interventions: Intervention[],
): TranscriptContext {
    const allFinalSegments = segments.filter(
        s => s.isFinal && !/^\[.*\]$/.test(s.text.trim())
    );
    return {
        transcriptExcerpt: allFinalSegments
            .slice(-MAX_EXCERPT_SEGMENTS)
            .map(s => `${s.speaker}: ${s.text}`),
        totalTurns: allFinalSegments.length,
        previousInterventions: interventions.slice(-3).map(i => i.text),
    };
}
