import { NextRequest, NextResponse } from 'next/server';
import { requireApiKey, loadRoutingConfig } from '@/lib/api/routeHelpers';

// POST – compute embeddings for a batch of texts
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { texts } = body as { texts: string[] };

        if (!texts || !Array.isArray(texts) || texts.length === 0) {
            return NextResponse.json(
                { error: 'texts must be a non-empty array of strings' },
                { status: 400 }
            );
        }

        // Limit batch size
        if (texts.length > 50) {
            return NextResponse.json(
                { error: 'Maximum 50 texts per request' },
                { status: 400 }
            );
        }

        const apiKeyResult = requireApiKey();
        if ('error' in apiKeyResult) return apiKeyResult.error;
        const apiKey = apiKeyResult.key;

        const routingConfig = loadRoutingConfig();

        if (!routingConfig.embeddings_similarity.enabled) {
            return NextResponse.json(
                { error: 'Embeddings task is disabled in model routing config' },
                { status: 503 }
            );
        }

        const taskConfig = routingConfig.embeddings_similarity;

        // Build the fallback chain: primary model + configured fallbacks
        const chain = [
            taskConfig.model,
            ...taskConfig.fallbacks.map(f => f.model),
        ];

        const startTime = Date.now();
        let lastError = '';

        for (let attempt = 0; attempt < chain.length; attempt++) {
            const model = chain[attempt];
            const isFallback = attempt > 0;

            try {
                const response = await fetch('https://api.openai.com/v1/embeddings', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${apiKey}`,
                    },
                    body: JSON.stringify({ model, input: texts }),
                    signal: AbortSignal.timeout(taskConfig.timeoutMs),
                });

                if (!response.ok) {
                    const errorBody = await response.json().catch(() => ({}));
                    throw new Error(errorBody?.error?.message || `HTTP ${response.status}`);
                }

                const data = await response.json();

                // Extract embeddings in order (OpenAI preserves input order)
                const results: number[][] = data.data.map(
                    (item: { embedding: number[] }) => item.embedding
                );

                const logEntry = {
                    id: `llm-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
                    timestamp: Date.now(),
                    task: 'embeddings_similarity' as const,
                    provider: taskConfig.provider,
                    model,
                    latencyMs: Date.now() - startTime,
                    inputTokens: data.usage?.prompt_tokens,
                    outputTokens: undefined,
                    success: true,
                    fallbackUsed: isFallback,
                    fallbackModel: isFallback ? model : undefined,
                };

                return NextResponse.json({
                    embeddings: results,
                    count: results.length,
                    logEntry,
                });
            } catch (error) {
                lastError = error instanceof Error ? error.message : String(error);
                console.warn(
                    `[Embeddings] ${model} failed: ${lastError}` +
                    (attempt < chain.length - 1 ? ` → trying fallback ${chain[attempt + 1]}` : ' → no more fallbacks')
                );
                // Continue to next model in chain
            }
        }

        // All models exhausted
        const logEntry = {
            id: `llm-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            timestamp: Date.now(),
            task: 'embeddings_similarity' as const,
            provider: taskConfig.provider,
            model: chain[chain.length - 1],
            latencyMs: Date.now() - startTime,
            success: false,
            error: lastError,
            fallbackUsed: chain.length > 1,
        };

        return NextResponse.json(
            { error: `Embeddings failed after ${chain.length} attempt(s): ${lastError}`, logEntry },
            { status: 502 }
        );
    } catch (error) {
        console.error('Embeddings endpoint error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
