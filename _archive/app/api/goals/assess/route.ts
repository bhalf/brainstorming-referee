import { NextRequest, NextResponse } from 'next/server';
import { callLLM, LLMError } from '@/lib/llm/client';
import { requireApiKey, loadRoutingConfig } from '@/lib/api/routeHelpers';
import { rateLimit } from '@/lib/api/rateLimit';
import { getGoalAssessmentSystemPrompt } from '@/lib/prompts/goals/prompts';
import type { GoalCoverageStatus } from '@/lib/types';

interface GoalAssessmentRequest {
    goals: Array<{ id: string; label: string; description?: string }>;
    heatScores: Record<string, number>;
    liveSummary: string | null;
    recentTranscript: Array<{ speaker: string; text: string }>;
    language: string;
}

interface LLMAssessmentResponse {
    assessments: Array<{ goalId: string; status: GoalCoverageStatus; notes?: string }>;
    suggestedTopics: string[];
}

export async function POST(request: NextRequest) {
    const limited = rateLimit(request, { maxRequests: 10 });
    if (limited) return limited;

    try {
        const body = (await request.json()) as GoalAssessmentRequest;
        const { goals = [], heatScores = {}, liveSummary, recentTranscript = [], language = 'en-US' } = body;

        if (goals.length === 0) {
            return NextResponse.json({ assessments: [], suggestedTopics: [], logEntry: null });
        }

        const apiKeyResult = requireApiKey();
        if ('error' in apiKeyResult) return apiKeyResult.error;
        const apiKey = apiKeyResult.key;

        const routingConfig = loadRoutingConfig();

        // Build user prompt
        const parts: string[] = [];

        // Goals with heat scores
        const goalLines = goals.map((g) => {
            const heat = heatScores[g.id] ?? 0;
            const desc = g.description ? ` — ${g.description}` : '';
            return `- [${g.id}] "${g.label}"${desc} (heat: ${heat.toFixed(2)})`;
        });
        parts.push(`Goals:\n${goalLines.join('\n')}`);

        if (liveSummary) {
            parts.push(`Session summary:\n${liveSummary}`);
        }

        if (recentTranscript.length > 0) {
            const transcript = recentTranscript
                .map((s) => `[${s.speaker}]: ${s.text}`)
                .join('\n');
            parts.push(`Recent transcript:\n${transcript}`);
        }

        const userPrompt = parts.join('\n\n');

        try {
            const { text, logEntry } = await callLLM(
                'goal_assessment',
                routingConfig,
                [
                    { role: 'system', content: getGoalAssessmentSystemPrompt(language) },
                    { role: 'user', content: userPrompt },
                ],
                apiKey,
            );

            // Parse JSON response
            const parsed = JSON.parse(text.trim()) as LLMAssessmentResponse;

            // Validate and sanitize
            const validStatuses: GoalCoverageStatus[] = ['not_started', 'mentioned', 'partially_covered', 'covered'];
            const assessments = (parsed.assessments ?? [])
                .filter((a) => goals.some((g) => g.id === a.goalId))
                .map((a) => ({
                    goalId: a.goalId,
                    status: validStatuses.includes(a.status) ? a.status : 'not_started' as GoalCoverageStatus,
                    notes: typeof a.notes === 'string' ? a.notes.slice(0, 100) : undefined,
                }));

            return NextResponse.json({
                assessments,
                suggestedTopics: Array.isArray(parsed.suggestedTopics) ? parsed.suggestedTopics.slice(0, 3) : [],
                logEntry,
            });
        } catch (error) {
            const logEntry = error instanceof LLMError ? error.logEntry : null;
            console.error('Goal assessment LLM call failed:', error);
            return NextResponse.json({ assessments: [], suggestedTopics: [], logEntry });
        }
    } catch (error) {
        console.error('Goal assessment endpoint error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
