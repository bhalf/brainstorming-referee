import { NextRequest, NextResponse } from 'next/server';
import { callLLM, LLMError } from '@/lib/llm/client';
import { requireApiKey, loadRoutingConfig } from '@/lib/api/routeHelpers';
import { rateLimit } from '@/lib/api/rateLimit';
import { getSummarySystemPrompt } from '@/lib/prompts/summary/prompts';

interface LiveSummaryRequest {
    previousSummary: string | null;
    newSegments: { speaker: string; text: string }[];
    ideas: { title: string; description: string | null }[];
    language: string;
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
                    { role: 'system', content: getSummarySystemPrompt(language) },
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
