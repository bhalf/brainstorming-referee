/**
 * Model Routing Configuration.
 *
 * Central config for per-task LLM model assignment, generation parameters,
 * fallback chains, and runtime tuning. Each AI-powered feature (moderator,
 * ally, embeddings, transcription, idea extraction, rule check, live summary)
 * is mapped to a specific model with temperature, token limits, and timeout.
 * @module
 */

// --- Task Keys ---

/** Union of all task identifiers that can be routed to an LLM. */
export type ModelTaskKey =
    | 'moderator_intervention'
    | 'ally_intervention'
    | 'embeddings_similarity'
    | 'transcription_server'
    | 'idea_extraction'
    | 'connection_review'
    | 'rule_check'
    | 'live_summary'
    | 'goal_assessment';

/** Ordered list of all task keys, used for iteration in UI and validation. */
export const MODEL_TASK_KEYS: ModelTaskKey[] = [
    'moderator_intervention',
    'ally_intervention',
    'embeddings_similarity',
    'transcription_server',
    'idea_extraction',
    'connection_review',
    'rule_check',
    'live_summary',
    'goal_assessment',
];

/** Human-readable short labels shown in the settings UI. */
export const TASK_LABELS: Record<ModelTaskKey, string> = {
    moderator_intervention: 'Moderator',
    ally_intervention: 'Ally',
    embeddings_similarity: 'Embeddings',
    transcription_server: 'Transcription',
    idea_extraction: 'Idea Extraction',
    connection_review: 'Connection Review',
    rule_check: 'Rule Check',
    live_summary: 'Live Summary',
    goal_assessment: 'Goal Assessment',
};

/** Longer descriptions explaining what each task does, shown as tooltips. */
export const TASK_DESCRIPTIONS: Record<ModelTaskKey, string> = {
    moderator_intervention: 'Process-oriented reflections (low variance, fast)',
    ally_intervention: 'Creative impulses during escalation (higher variance)',
    embeddings_similarity: 'Semantic similarity for repetition/novelty detection',
    transcription_server: 'Server-side ASR (disabled by default, uses Web Speech API)',
    idea_extraction: 'Extract brainstorming ideas from transcript for the idea board',
    connection_review: 'Review and correct connections between brainstorming ideas',
    rule_check: 'Classify transcript segments for brainstorming rule violations',
    live_summary: 'Generate rolling summary of the brainstorming session',
    goal_assessment: 'Assess conversation goal coverage from transcript and metrics',
};

// --- Provider & Model Definitions ---

/** Supported LLM providers (currently OpenAI only). */
export type ModelProvider = 'openai';

/** A selectable model with its provider, API identifier, display label, and capability type. */
export interface ModelOption {
    provider: ModelProvider;
    model: string;
    label: string;
    type: 'chat' | 'embedding' | 'transcription';
}

/** Registry of all models available for routing. */
export const AVAILABLE_MODELS: ModelOption[] = [
    // Chat models — GPT-4o family
    { provider: 'openai', model: 'gpt-4o', label: 'GPT-4o', type: 'chat' },
    { provider: 'openai', model: 'gpt-4o-mini', label: 'GPT-4o Mini', type: 'chat' },
    // Embedding models (text-embedding-3 family is latest as of March 2026)
    { provider: 'openai', model: 'text-embedding-3-small', label: 'Embedding 3 Small', type: 'embedding' },
    { provider: 'openai', model: 'text-embedding-3-large', label: 'Embedding 3 Large', type: 'embedding' },
    // Transcription models
    { provider: 'openai', model: 'whisper-1', label: 'Whisper', type: 'transcription' },
];

/**
 * Return the subset of available models compatible with a given task.
 * Chat tasks get chat models, embedding tasks get embedding models, etc.
 * @param task - The task key to filter models for.
 * @returns Filtered array of compatible ModelOption entries.
 */
export function getModelsForTask(task: ModelTaskKey): ModelOption[] {
    switch (task) {
        case 'moderator_intervention':
        case 'ally_intervention':
        case 'idea_extraction':
        case 'connection_review':
        case 'rule_check':
        case 'live_summary':
        case 'goal_assessment':
            return AVAILABLE_MODELS.filter((m) => m.type === 'chat');
        case 'embeddings_similarity':
            return AVAILABLE_MODELS.filter((m) => m.type === 'embedding');
        case 'transcription_server':
            return AVAILABLE_MODELS.filter((m) => m.type === 'transcription');
    }
}

// --- Per-Task Config ---

/** A fallback model entry (provider + model ID) tried when the primary fails. */
export interface FallbackModel {
    provider: ModelProvider;
    model: string;
}

/** Full configuration for a single task: model selection, generation params, and fallback chain. */
export interface TaskModelConfig {
    provider: ModelProvider;
    model: string;
    temperature: number;
    maxTokens: number;
    timeoutMs: number;
    fallbacks: FallbackModel[];
    enabled: boolean;
}

/** Complete routing table mapping every task key to its model configuration. */
export type ModelRoutingConfig = Record<ModelTaskKey, TaskModelConfig>;

// --- Defaults ---

/** Production-ready default routing config. Used when no overrides are stored. */
export const DEFAULT_MODEL_ROUTING: ModelRoutingConfig = {
    moderator_intervention: {
        provider: 'openai',
        model: 'gpt-4o',
        temperature: 0.4,
        maxTokens: 250,
        timeoutMs: 8000,
        fallbacks: [
            { provider: 'openai', model: 'gpt-4o-mini' },
        ],
        enabled: true,
    },
    ally_intervention: {
        provider: 'openai',
        model: 'gpt-4o',
        temperature: 0.9,
        maxTokens: 200,
        timeoutMs: 10000,
        fallbacks: [
            { provider: 'openai', model: 'gpt-4o-mini' },
        ],
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
        model: 'gpt-4o',
        temperature: 0.3,
        maxTokens: 800,
        timeoutMs: 15000,
        fallbacks: [{ provider: 'openai', model: 'gpt-4o-mini' }],
        enabled: true,
    },
    connection_review: {
        provider: 'openai',
        model: 'gpt-4o-mini',
        temperature: 0.2,
        maxTokens: 600,
        timeoutMs: 12000,
        fallbacks: [],
        enabled: true,
    },
    rule_check: {
        provider: 'openai',
        model: 'gpt-4o',
        temperature: 0,
        maxTokens: 150,
        timeoutMs: 5000,
        fallbacks: [{ provider: 'openai', model: 'gpt-4o-mini' }],
        enabled: true,
    },
    live_summary: {
        provider: 'openai',
        model: 'gpt-4o-mini',
        temperature: 0.3,
        maxTokens: 600,
        timeoutMs: 15000,
        fallbacks: [],
        enabled: true,
    },
    goal_assessment: {
        provider: 'openai',
        model: 'gpt-4o-mini',
        temperature: 0.2,
        maxTokens: 400,
        timeoutMs: 10000,
        fallbacks: [],
        enabled: true,
    },
};

// --- Validation ---

/** Result of validating a ModelRoutingConfig against constraints. */
export interface ModelRoutingValidation {
    isValid: boolean;
    errors: string[];
}

/** Allowed ranges for numeric task config fields, enforced by {@link validateModelRouting}. */
export const TASK_CONFIG_CONSTRAINTS = {
    temperature: { min: 0, max: 2 },
    maxTokens: { min: 0, max: 4096 },
    timeoutMs: { min: 1000, max: 60000 },
} as const;

/**
 * Validate a full routing config against constraints (ranges, required fields).
 * @param config - The routing config to validate.
 * @returns Validation result with a list of human-readable error strings.
 */
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

/**
 * Merge a partial routing config with defaults. Missing tasks or fields
 * fall back to {@link DEFAULT_MODEL_ROUTING} values. Used when loading
 * from storage or file to handle newly added tasks.
 * @param partial - A sparse config with overrides for some tasks/fields.
 * @returns A complete ModelRoutingConfig.
 */
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

/**
 * Save the routing config to localStorage (client-side only).
 * Silently no-ops on the server or when storage is unavailable.
 * @param config - The complete routing config to persist.
 */
export function saveModelRoutingToStorage(config: ModelRoutingConfig): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(MODEL_ROUTING_STORAGE_KEY, JSON.stringify(config));
    } catch {
        console.warn('Failed to save model routing config to localStorage');
    }
}

/**
 * Load routing config from localStorage, merging with defaults for
 * forward-compatibility with newly added tasks.
 * @returns The merged config, or null if nothing is stored.
 */
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

/** Mutable in-memory config, set via {@link setModelRoutingConfig}. */
let runtimeConfig: ModelRoutingConfig | null = null;

/**
 * Get the active routing config. Returns the in-memory override if set,
 * otherwise falls back to {@link DEFAULT_MODEL_ROUTING}.
 * @returns The current ModelRoutingConfig.
 */
export function getModelRoutingConfig(): ModelRoutingConfig {
    if (runtimeConfig) return runtimeConfig;
    return DEFAULT_MODEL_ROUTING;
}

/**
 * Override the in-memory routing config. Typically called after loading
 * from file or receiving an update from the settings UI.
 * @param config - The new routing config to activate.
 */
export function setModelRoutingConfig(config: ModelRoutingConfig): void {
    runtimeConfig = config;
}

