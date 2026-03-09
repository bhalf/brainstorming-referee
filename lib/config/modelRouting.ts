// ============================================
// Model Routing Configuration
// ============================================
// Central config for per-task model assignment,
// parameters, fallback chains, and runtime tuning.
// ============================================

// --- Task Keys ---

export type ModelTaskKey =
    | 'moderator_intervention'
    | 'ally_intervention'
    | 'embeddings_similarity'
    | 'transcription_server'
    | 'idea_extraction'
    | 'rule_check'
    | 'live_summary';

export const MODEL_TASK_KEYS: ModelTaskKey[] = [
    'moderator_intervention',
    'ally_intervention',
    'embeddings_similarity',
    'transcription_server',
    'idea_extraction',
    'rule_check',
    'live_summary',
];

export const TASK_LABELS: Record<ModelTaskKey, string> = {
    moderator_intervention: 'Moderator',
    ally_intervention: 'Ally',
    embeddings_similarity: 'Embeddings',
    transcription_server: 'Transcription',
    idea_extraction: 'Idea Extraction',
    rule_check: 'Rule Check',
    live_summary: 'Live Summary',
};

export const TASK_DESCRIPTIONS: Record<ModelTaskKey, string> = {
    moderator_intervention: 'Process-oriented reflections (low variance, fast)',
    ally_intervention: 'Creative impulses during escalation (higher variance)',
    embeddings_similarity: 'Semantic similarity for repetition/novelty detection',
    transcription_server: 'Server-side ASR (disabled by default, uses Web Speech API)',
    idea_extraction: 'Extract brainstorming ideas from transcript for the idea board',
    rule_check: 'Classify transcript segments for brainstorming rule violations',
    live_summary: 'Generate rolling summary of the brainstorming session',
};

// --- Provider & Model Definitions ---

export type ModelProvider = 'openai';

export interface ModelOption {
    provider: ModelProvider;
    model: string;
    label: string;
    type: 'chat' | 'embedding' | 'transcription';
}

export const AVAILABLE_MODELS: ModelOption[] = [
    // Chat models — GPT-5 family (latest as of March 2026)
    { provider: 'openai', model: 'gpt-5', label: 'GPT-5', type: 'chat' },
    { provider: 'openai', model: 'gpt-5-mini', label: 'GPT-5 Mini', type: 'chat' },
    // Chat models — GPT-4o family (legacy, available via API until retirement)
    { provider: 'openai', model: 'gpt-4o', label: 'GPT-4o (legacy)', type: 'chat' },
    { provider: 'openai', model: 'gpt-4o-mini', label: 'GPT-4o Mini (legacy)', type: 'chat' },
    // Embedding models (text-embedding-3 family is latest as of March 2026)
    { provider: 'openai', model: 'text-embedding-3-small', label: 'Embedding 3 Small', type: 'embedding' },
    { provider: 'openai', model: 'text-embedding-3-large', label: 'Embedding 3 Large', type: 'embedding' },
    // Transcription models
    { provider: 'openai', model: 'whisper-1', label: 'Whisper', type: 'transcription' },
];

export function getModelsForTask(task: ModelTaskKey): ModelOption[] {
    switch (task) {
        case 'moderator_intervention':
        case 'ally_intervention':
        case 'idea_extraction':
        case 'rule_check':
        case 'live_summary':
            return AVAILABLE_MODELS.filter((m) => m.type === 'chat');
        case 'embeddings_similarity':
            return AVAILABLE_MODELS.filter((m) => m.type === 'embedding');
        case 'transcription_server':
            return AVAILABLE_MODELS.filter((m) => m.type === 'transcription');
    }
}

// --- Per-Task Config ---

export interface FallbackModel {
    provider: ModelProvider;
    model: string;
}

export interface TaskModelConfig {
    provider: ModelProvider;
    model: string;
    temperature: number;
    maxTokens: number;
    timeoutMs: number;
    fallbacks: FallbackModel[];
    enabled: boolean;
}

export type ModelRoutingConfig = Record<ModelTaskKey, TaskModelConfig>;

// --- Defaults ---

export const DEFAULT_MODEL_ROUTING: ModelRoutingConfig = {
    moderator_intervention: {
        provider: 'openai',
        model: 'gpt-5',
        temperature: 0.4,
        maxTokens: 250,
        timeoutMs: 8000,
        fallbacks: [{ provider: 'openai', model: 'gpt-5-mini' }],
        enabled: true,
    },
    ally_intervention: {
        provider: 'openai',
        model: 'gpt-5',
        temperature: 0.9,
        maxTokens: 200,
        timeoutMs: 10000,
        fallbacks: [{ provider: 'openai', model: 'gpt-5-mini' }],
        enabled: true,
    },
    embeddings_similarity: {
        provider: 'openai',
        model: 'text-embedding-3-small',
        temperature: 0,
        maxTokens: 0, // Not applicable for embeddings
        timeoutMs: 5000,
        fallbacks: [{ provider: 'openai', model: 'text-embedding-3-large' }],
        enabled: true, // Uses cosine similarity for repetition/diversity
    },
    transcription_server: {
        provider: 'openai',
        model: 'whisper-1',
        temperature: 0,
        maxTokens: 0,
        timeoutMs: 15000,
        fallbacks: [],
        enabled: true,
    },
    idea_extraction: {
        provider: 'openai',
        model: 'gpt-5-mini',
        temperature: 0.3,
        maxTokens: 800,
        timeoutMs: 15000,
        fallbacks: [{ provider: 'openai', model: 'gpt-4o-mini' }],
        enabled: true,
    },
    rule_check: {
        provider: 'openai',
        model: 'gpt-5-mini',
        temperature: 0,
        maxTokens: 150,
        timeoutMs: 5000,
        fallbacks: [{ provider: 'openai', model: 'gpt-4o-mini' }],
        enabled: true,
    },
    live_summary: {
        provider: 'openai',
        model: 'gpt-5-mini',
        temperature: 0.3,
        maxTokens: 600,
        timeoutMs: 15000,
        fallbacks: [{ provider: 'openai', model: 'gpt-4o-mini' }],
        enabled: true,
    },
};

// --- Validation ---

export interface ModelRoutingValidation {
    isValid: boolean;
    errors: string[];
}

export const TASK_CONFIG_CONSTRAINTS = {
    temperature: { min: 0, max: 2 },
    maxTokens: { min: 0, max: 4096 },
    timeoutMs: { min: 1000, max: 60000 },
} as const;

export function validateModelRouting(config: ModelRoutingConfig): ModelRoutingValidation {
    const errors: string[] = [];

    for (const task of MODEL_TASK_KEYS) {
        const tc = config[task];
        if (!tc) {
            errors.push(`Missing config for task: ${task}`);
            continue;
        }

        if (!tc.model) {
            errors.push(`${task}: model is required`);
        }

        if (tc.temperature < TASK_CONFIG_CONSTRAINTS.temperature.min ||
            tc.temperature > TASK_CONFIG_CONSTRAINTS.temperature.max) {
            errors.push(`${task}: temperature must be ${TASK_CONFIG_CONSTRAINTS.temperature.min}–${TASK_CONFIG_CONSTRAINTS.temperature.max}`);
        }

        if (tc.maxTokens < TASK_CONFIG_CONSTRAINTS.maxTokens.min ||
            tc.maxTokens > TASK_CONFIG_CONSTRAINTS.maxTokens.max) {
            errors.push(`${task}: maxTokens must be ${TASK_CONFIG_CONSTRAINTS.maxTokens.min}–${TASK_CONFIG_CONSTRAINTS.maxTokens.max}`);
        }

        if (tc.timeoutMs < TASK_CONFIG_CONSTRAINTS.timeoutMs.min ||
            tc.timeoutMs > TASK_CONFIG_CONSTRAINTS.timeoutMs.max) {
            errors.push(`${task}: timeout must be ${TASK_CONFIG_CONSTRAINTS.timeoutMs.min}–${TASK_CONFIG_CONSTRAINTS.timeoutMs.max}ms`);
        }
    }

    return { isValid: errors.length === 0, errors };
}

// --- Merge with defaults (for partial updates) ---

export function mergeModelRouting(
    partial: Partial<Record<ModelTaskKey, Partial<TaskModelConfig>>>
): ModelRoutingConfig {
    const result = { ...DEFAULT_MODEL_ROUTING };

    for (const task of MODEL_TASK_KEYS) {
        if (partial[task]) {
            result[task] = { ...DEFAULT_MODEL_ROUTING[task], ...partial[task] };
        }
    }

    return result;
}

// --- LocalStorage Persistence ---

const MODEL_ROUTING_STORAGE_KEY = 'uzh-brainstorming-model-routing';

export function saveModelRoutingToStorage(config: ModelRoutingConfig): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(MODEL_ROUTING_STORAGE_KEY, JSON.stringify(config));
    } catch {
        console.warn('Failed to save model routing config to localStorage');
    }
}

export function loadModelRoutingFromStorage(): ModelRoutingConfig | null {
    if (typeof window === 'undefined') return null;
    try {
        const stored = localStorage.getItem(MODEL_ROUTING_STORAGE_KEY);
        if (!stored) return null;
        const parsed = JSON.parse(stored);
        // Merge with defaults to handle newly added tasks
        return mergeModelRouting(parsed);
    } catch {
        return null;
    }
}

// --- Runtime accessor (used by API routes) ---
// In-memory runtime config; file persistence handled by modelRoutingPersistence.ts

let runtimeConfig: ModelRoutingConfig | null = null;

export function getModelRoutingConfig(): ModelRoutingConfig {
    if (runtimeConfig) return runtimeConfig;
    return DEFAULT_MODEL_ROUTING;
}

export function setModelRoutingConfig(config: ModelRoutingConfig): void {
    runtimeConfig = config;
}

