import { NextRequest, NextResponse } from 'next/server';
import { callLLM, LLMError } from '@/lib/llm/client';
import { requireApiKey, loadRoutingConfig } from '@/lib/api/routeHelpers';
import { rateLimit } from '@/lib/api/rateLimit';

interface LiveSummaryRequest {
    previousSummary: string | null;
    newSegments: { speaker: string; text: string }[];
    ideas: { title: string; description: string | null }[];
    language: string;
}

function getSystemPrompt(language: string): string {
    const isGerman = language.startsWith('de');
    return isGerman
        ? `Du bist ein Zusammenfassungsassistent für eine laufende Brainstorming-Sitzung.
Erstelle eine knappe, strukturierte Zusammenfassung (2-4 Absätze) des bisherigen Gesprächsverlaufs.
- Fasse die Hauptthemen und Kernideen zusammen
- Gib wieder, welche Richtungen und Perspektiven diskutiert wurden
- Halte die Zusammenfassung neutral und faktenbasiert
- Wenn eine vorherige Zusammenfassung vorhanden ist, aktualisiere und erweitere sie mit den neuen Informationen
- Schreibe flüssig, keine Aufzählungslisten
Antworte NUR mit der Zusammenfassung, ohne Einleitung oder Erklärung.`
        : `You are a summary assistant for an ongoing brainstorming session.
Create a concise, structured summary (2-4 paragraphs) of the conversation so far.
- Summarize the main topics and key ideas discussed
- Capture the directions and perspectives explored
- Keep the summary neutral and fact-based
- If a previous summary is provided, update and extend it with the new information
- Write flowing prose, no bullet lists
Respond ONLY with the summary, no introduction or explanation.`;
}

export async function POST(request: NextRequest) {
    const limited = rateLimit(request, { maxRequests: 10 });
    if (limited) return limited;

    try {
        const body = (await request.json()) as LiveSummaryRequest;
        const { previousSummary, newSegments = [], ideas = [], language = 'en-US' } = body;

        if (newSegments.length === 0 && !previousSummary) {
            return NextResponse.json({ summary: null, logEntry: null });
        }

        const apiKeyResult = requireApiKey();
        if ('error' in apiKeyResult) return apiKeyResult.error;
        const apiKey = apiKeyResult.key;

        const routingConfig = loadRoutingConfig();

        // Build the user prompt
        const parts: string[] = [];

        if (previousSummary) {
            parts.push(`Previous summary:\n${previousSummary}`);
        }

        if (newSegments.length > 0) {
            const transcript = newSegments
                .map(s => `[${s.speaker}]: ${s.text}`)
                .join('\n');
            parts.push(`New transcript segments:\n${transcript}`);
        }

        if (ideas.length > 0) {
            const ideaList = ideas
                .map(i => `- "${i.title}"${i.description ? `: ${i.description}` : ''}`)
                .join('\n');
            parts.push(`Current ideas on the board:\n${ideaList}`);
        }

        const userPrompt = parts.join('\n\n');

        try {
            const { text, logEntry } = await callLLM(
                'live_summary',
                routingConfig,
                [
                    { role: 'system', content: getSystemPrompt(language) },
                    { role: 'user', content: userPrompt },
                ],
                apiKey,
            );

            return NextResponse.json({ summary: text.trim(), logEntry });
        } catch (error) {
            const logEntry = error instanceof LLMError ? error.logEntry : null;
            console.error('Live summary LLM call failed:', error);
            return NextResponse.json({ summary: previousSummary, logEntry });
        }
    } catch (error) {
        console.error('Live summary endpoint error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
