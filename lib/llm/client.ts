// ============================================
// Unified LLM Client
// ============================================
// Handles model routing, timeouts, fallback chains,
// and structured logging for every AI call.
// ============================================

import type { ModelRoutingLogEntry } from '@/lib/types';
import type { ModelTaskKey, ModelRoutingConfig, TaskModelConfig } from '@/lib/config/modelRouting';

// --- Types ---

export interface LLMMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface LLMResult {
    text: string;
    logEntry: ModelRoutingLogEntry;
}

export interface EmbeddingResult {
    embedding: number[];
    logEntry: ModelRoutingLogEntry;
}

// --- Chat Completions ---

export interface LLMOptions {
    responseFormat?: { type: 'json_object' };
}

export async function callLLM(
    task: ModelTaskKey,
    config: ModelRoutingConfig,
    messages: LLMMessage[],
    apiKey: string,
    options?: LLMOptions
): Promise<LLMResult> {
    const taskConfig = config[task];

    if (!taskConfig.enabled) {
        throw new Error(`Task "${task}" is disabled in model routing config`);
    }

    // Build the chain: primary model + fallbacks
    const chain: Array<{ provider: string; model: string }> = [
        { provider: taskConfig.provider, model: taskConfig.model },
        ...taskConfig.fallbacks,
    ];

    let lastError: string = '';

    for (let i = 0; i < chain.length; i++) {
        const { provider, model } = chain[i];
        const isFallback = i > 0;
        const startTime = Date.now();

        try {
            const result = await callOpenAIChatWithTimeout(
                model,
                messages,
                taskConfig,
                apiKey,
                options?.responseFormat
            );

            const logEntry = createLogEntry(task, provider, model, startTime, {
                success: true,
                inputTokens: result.usage?.prompt_tokens,
                outputTokens: result.usage?.completion_tokens,
                fallbackUsed: isFallback,
                fallbackModel: isFallback ? model : undefined,
            });

            return {
                text: result.text,
                logEntry,
            };
        } catch (error) {
            lastError = error instanceof Error ? error.message : String(error);

            const logEntry = createLogEntry(task, provider, model, startTime, {
                success: false,
                error: lastError,
                fallbackUsed: isFallback,
                fallbackModel: isFallback ? model : undefined,
            });

            // Log failed attempt
            console.warn(
                `[LLM Client] ${task} failed with ${model}: ${lastError}` +
                (i < chain.length - 1 ? ` → trying fallback ${chain[i + 1].model}` : ' → no more fallbacks')
            );

            // If this was the last model in the chain, throw with the log entry
            if (i === chain.length - 1) {
                const err = new LLMError(lastError, logEntry);
                throw err;
            }
        }
    }

    // Should never reach here, but TypeScript needs it
    throw new Error(`All models failed for task "${task}"`);
}

// --- Embeddings ---

export async function callEmbeddings(
    task: ModelTaskKey,
    config: ModelRoutingConfig,
    input: string | string[],
    apiKey: string
): Promise<EmbeddingResult> {
    const taskConfig = config[task];

    if (!taskConfig.enabled) {
        throw new Error(`Task "${task}" is disabled in model routing config`);
    }

    const chain = [
        { provider: taskConfig.provider, model: taskConfig.model },
        ...taskConfig.fallbacks,
    ];

    let lastError = '';

    for (let i = 0; i < chain.length; i++) {
        const { provider, model } = chain[i];
        const isFallback = i > 0;
        const startTime = Date.now();

        try {
            const result = await callOpenAIEmbeddingsWithTimeout(
                model,
                input,
                taskConfig,
                apiKey
            );

            const logEntry = createLogEntry(task, provider, model, startTime, {
                success: true,
                inputTokens: result.usage?.prompt_tokens,
                fallbackUsed: isFallback,
                fallbackModel: isFallback ? model : undefined,
            });

            return {
                embedding: result.embedding,
                logEntry,
            };
        } catch (error) {
            lastError = error instanceof Error ? error.message : String(error);

            if (i === chain.length - 1) {
                const logEntry = createLogEntry(task, provider, model, startTime, {
                    success: false,
                    error: lastError,
                    fallbackUsed: isFallback,
                    fallbackModel: isFallback ? model : undefined,
                });
                throw new LLMError(lastError, logEntry);
            }
        }
    }

    throw new Error(`All models failed for task "${task}"`);
}

// --- Internal: OpenAI Chat Call with Timeout ---

interface OpenAIChatResult {
    text: string;
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

async function callOpenAIChatWithTimeout(
    model: string,
    messages: LLMMessage[],
    config: TaskModelConfig,
    apiKey: string,
    responseFormat?: { type: 'json_object' }
): Promise<OpenAIChatResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
        // GPT-5+ and o-series models use max_completion_tokens and don't support custom temperature
        const usesNewAPI = /^(gpt-5|o[1-9]|o\d)/.test(model);
        const tokenParam = usesNewAPI
            ? { max_completion_tokens: config.maxTokens }
            : { max_tokens: config.maxTokens };

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model,
                messages,
                ...tokenParam,
                // GPT-5/o-series only support default temperature (1), so omit for those models
                ...(usesNewAPI ? {} : { temperature: config.temperature }),
                ...(responseFormat && { response_format: responseFormat }),
            }),
            signal: controller.signal,
        });

        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({}));
            const errorMsg = errorBody?.error?.message || `HTTP ${response.status}`;
            throw new Error(`OpenAI API error: ${errorMsg}`);
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content?.trim();

        if (!text) {
            throw new Error('Empty response from OpenAI');
        }

        return {
            text,
            usage: data.usage,
        };
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error(`Timeout after ${config.timeoutMs}ms`);
        }
        throw error;
    } finally {
        clearTimeout(timer);
    }
}

// --- Internal: OpenAI Embeddings Call with Timeout ---

interface OpenAIEmbeddingResult {
    embedding: number[];
    usage?: { prompt_tokens: number };
}

async function callOpenAIEmbeddingsWithTimeout(
    model: string,
    input: string | string[],
    config: TaskModelConfig,
    apiKey: string
): Promise<OpenAIEmbeddingResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
        const response = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({ model, input }),
            signal: controller.signal,
        });

        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({}));
            const errorMsg = errorBody?.error?.message || `HTTP ${response.status}`;
            throw new Error(`OpenAI Embeddings error: ${errorMsg}`);
        }

        const data = await response.json();
        const embedding = data.data?.[0]?.embedding;

        if (!embedding) {
            throw new Error('Empty embedding response');
        }

        return {
            embedding,
            usage: data.usage,
        };
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error(`Timeout after ${config.timeoutMs}ms`);
        }
        throw error;
    } finally {
        clearTimeout(timer);
    }
}

// --- Log Entry Factory ---

function createLogEntry(
    task: ModelTaskKey,
    provider: string,
    model: string,
    startTime: number,
    result: {
        success: boolean;
        inputTokens?: number;
        outputTokens?: number;
        error?: string;
        fallbackUsed: boolean;
        fallbackModel?: string;
    }
): ModelRoutingLogEntry {
    return {
        id: `llm-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        timestamp: Date.now(),
        task,
        provider,
        model,
        latencyMs: Date.now() - startTime,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        success: result.success,
        error: result.error,
        fallbackUsed: result.fallbackUsed,
        fallbackModel: result.fallbackModel,
    };
}

// --- Custom Error (carries logEntry) ---

export class LLMError extends Error {
    logEntry: ModelRoutingLogEntry;

    constructor(message: string, logEntry: ModelRoutingLogEntry) {
        super(message);
        this.name = 'LLMError';
        this.logEntry = logEntry;
    }
}
