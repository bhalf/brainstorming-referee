// ============================================
// Embedding Cache & Cosine Similarity
// ============================================
// Client-side cache for segment embeddings.
// Persisted to localStorage across page refreshes.
// Only fetches embeddings for new segments.
// ============================================

// --- Constants ---

const STORAGE_KEY_PREFIX = 'uzh-brainstorming-embeddings';
const STORAGE_MODEL_KEY = 'uzh-brainstorming-embeddings-model';
const MAX_CACHE_ENTRIES = 500; // LRU limit (~6MB max in localStorage)

/** Track the embedding model used for cached vectors to detect dimension mismatches */
let cachedModelName: string | null = null;

// Max segments used in O(n²) pairwise operations.
// 50 segments → 1225 pairs, runs in <1ms on any modern device.
const MAX_PAIRWISE_SEGMENTS = 50;

// --- Cache ---

const embeddingCache = new Map<string, number[]>();

// O(1) LRU: store the last-access timestamp per entry.
// On eviction, we sort once by timestamp (O(n log n), but eviction is rare).
const accessTimestamp = new Map<string, number>();

// --- localStorage Persistence ---

function getStorageKey(sessionId?: string): string {
    return sessionId
        ? `${STORAGE_KEY_PREFIX}-${sessionId}`
        : STORAGE_KEY_PREFIX;
}

/**
 * Load persisted embeddings from localStorage into memory.
 * Call once on session start.
 */
export function loadPersistedCache(sessionId?: string): number {
    if (typeof window === 'undefined') return 0;

    try {
        // Check if the stored model matches the current model.
        // If the model changed (e.g. text-embedding-3-small → large),
        // cached vectors have different dimensions and would silently
        // corrupt cosine similarity (returning 0 for all cross-dimension pairs).
        const storedModel = localStorage.getItem(STORAGE_MODEL_KEY);
        if (storedModel && cachedModelName && storedModel !== cachedModelName) {
            console.warn(`[EmbeddingCache] Model changed (${storedModel} → ${cachedModelName}) — clearing stale cache`);
            clearEmbeddingCache(sessionId);
            return 0;
        }
        if (storedModel) {
            cachedModelName = storedModel;
        }

        const stored = localStorage.getItem(getStorageKey(sessionId));
        if (!stored) return 0;

        const entries: Record<string, number[]> = JSON.parse(stored);
        let count = 0;
        let expectedDim: number | null = null;
        const now = Date.now();

        for (const [id, embedding] of Object.entries(entries)) {
            if (Array.isArray(embedding) && embedding.length > 0) {
                // Validate all embeddings have the same dimension
                if (expectedDim === null) {
                    expectedDim = embedding.length;
                } else if (embedding.length !== expectedDim) {
                    console.warn(`[EmbeddingCache] Dimension mismatch in stored cache (${embedding.length} vs ${expectedDim}) — clearing`);
                    clearEmbeddingCache(sessionId);
                    return 0;
                }
                embeddingCache.set(id, embedding);
                accessTimestamp.set(id, now);
                count++;
            }
        }

        console.log(`[EmbeddingCache] Loaded ${count} embeddings from localStorage (dim=${expectedDim})`);
        return count;
    } catch (error) {
        console.warn('[EmbeddingCache] Failed to load persisted cache:', error);
        return 0;
    }
}

/**
 * Persist current cache to localStorage.
 * Called automatically after fetching new embeddings.
 */
export function persistCache(sessionId?: string): void {
    if (typeof window === 'undefined') return;

    try {
        const entries: Record<string, number[]> = {};
        for (const [id, embedding] of embeddingCache.entries()) {
            entries[id] = embedding;
        }
        localStorage.setItem(getStorageKey(sessionId), JSON.stringify(entries));
    } catch (error) {
        // localStorage might be full — evict older entries and retry
        if (error instanceof DOMException && error.name === 'QuotaExceededError') {
            evictOldEntries(Math.floor(embeddingCache.size / 4));
            try {
                const entries: Record<string, number[]> = {};
                for (const [id, embedding] of embeddingCache.entries()) {
                    entries[id] = embedding;
                }
                localStorage.setItem(getStorageKey(sessionId), JSON.stringify(entries));
            } catch {
                console.warn('[EmbeddingCache] Failed to persist cache even after eviction');
            }
        } else {
            console.warn('[EmbeddingCache] Failed to persist cache:', error);
        }
    }
}

/**
 * Evict the `count` least-recently-used entries.
 * Sort by accessTimestamp ascending (oldest first), then remove.
 * O(n log n) — called only when cache is full, so acceptable.
 */
function evictOldEntries(count: number): void {
    const sorted = [...accessTimestamp.entries()].sort((a, b) => a[1] - b[1]);
    const toRemove = sorted.slice(0, count).map(([id]) => id);
    for (const id of toRemove) {
        embeddingCache.delete(id);
        accessTimestamp.delete(id);
    }
}

/**
 * Enforce max cache size via LRU eviction.
 */
function enforceMaxSize(): void {
    if (embeddingCache.size > MAX_CACHE_ENTRIES) {
        const excess = embeddingCache.size - MAX_CACHE_ENTRIES;
        evictOldEntries(excess);
    }
}

// --- Cosine Similarity ---

export function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
}

// --- Batch Fetch & Cache ---

interface SegmentForEmbedding {
    id: string;
    text: string;
}

/**
 * Returns embeddings for all given segments, fetching only the ones
 * not already in cache. Automatically persists new embeddings.
 */
export async function getOrFetchEmbeddings(
    segments: SegmentForEmbedding[],
    sessionId?: string
): Promise<Map<string, number[]>> {
    const result = new Map<string, number[]>();
    const toFetch: SegmentForEmbedding[] = [];
    const now = Date.now();

    // Check cache first — O(1) lookup and O(1) access-time update
    for (const seg of segments) {
        const cached = embeddingCache.get(seg.id);
        if (cached) {
            result.set(seg.id, cached);
            accessTimestamp.set(seg.id, now); // O(1) LRU update
        } else {
            toFetch.push(seg);
        }
    }

    // Fetch missing embeddings
    if (toFetch.length > 0) {
        try {
            // Deduplicate by text: identical utterances (e.g. "Flugzeug" × 30) share
            // one embedding vector. This reduces API tokens from O(N) to O(unique texts)
            // and prevents hitting the 50-text batch limit on repetitive content.
            const uniqueTexts = [...new Set(toFetch.map((s) => s.text))];
            const textToEmbedding = new Map<string, number[]>();

            const response = await fetch('/api/embeddings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ texts: uniqueTexts }),
            });

            if (response.ok) {
                const data = await response.json();
                const embeddings: number[][] = data.embeddings;
                const fetchTime = Date.now();

                // Track the model used for these embeddings to detect future mismatches
                const modelUsed = data.logEntry?.model;
                if (modelUsed) {
                    if (cachedModelName && cachedModelName !== modelUsed) {
                        // Model changed mid-session — clear cache to avoid dimension mix
                        console.warn(`[EmbeddingCache] Model changed mid-session (${cachedModelName} → ${modelUsed}) — clearing cache`);
                        embeddingCache.clear();
                        accessTimestamp.clear();
                        result.clear();
                    }
                    cachedModelName = modelUsed;
                    try {
                        localStorage.setItem(STORAGE_MODEL_KEY, modelUsed);
                    } catch { /* ignore */ }
                }

                // Build text → embedding lookup
                for (let i = 0; i < uniqueTexts.length; i++) {
                    if (embeddings[i]) {
                        textToEmbedding.set(uniqueTexts[i], embeddings[i]);
                    }
                }

                // Map back to all segment IDs (including duplicates with same text)
                for (const seg of toFetch) {
                    const emb = textToEmbedding.get(seg.text);
                    if (emb) {
                        embeddingCache.set(seg.id, emb);
                        accessTimestamp.set(seg.id, fetchTime);
                        result.set(seg.id, emb);
                    }
                }

                // Enforce max size and persist
                enforceMaxSize();
                persistCache(sessionId);
            } else {
                console.warn('Embeddings API returned non-OK:', response.status);
            }
        } catch (error) {
            console.warn('Failed to fetch embeddings, falling back to Jaccard:', error);
        }
    }

    return result;
}

// --- Pairwise Similarity Metrics ---

/**
 * Computes average pairwise cosine similarity between consecutive segments.
 * Capped at MAX_PAIRWISE_SEGMENTS to keep cost O(30) per call.
 * High similarity = high repetition. Returns 0-1 where 1 = identical content.
 */
export function computeEmbeddingRepetition(
    embeddings: Map<string, number[]>,
    segmentIds: string[]
): number {
    // Use the most recent segments only
    const ids = segmentIds.slice(-MAX_PAIRWISE_SEGMENTS);
    if (ids.length < 2) return 0;

    let totalSimilarity = 0;
    let pairCount = 0;

    for (let i = 1; i < ids.length; i++) {
        const embA = embeddings.get(ids[i - 1]);
        const embB = embeddings.get(ids[i]);

        if (embA && embB) {
            totalSimilarity += cosineSimilarity(embA, embB);
            pairCount++;
        }
    }

    return pairCount > 0 ? totalSimilarity / pairCount : 0;
}

/**
 * Computes diversity as 1 - average pairwise cosine similarity.
 * Capped at MAX_PAIRWISE_SEGMENTS to keep cost O(30²/2) = O(435) per call.
 * Returns 0-1 where 1 = maximally diverse.
 */
export function computeEmbeddingDiversity(
    embeddings: Map<string, number[]>,
    segmentIds: string[]
): number {
    // Use the most recent segments only
    const ids = segmentIds.slice(-MAX_PAIRWISE_SEGMENTS);
    if (ids.length < 2) return 0;

    let totalSimilarity = 0;
    let pairCount = 0;

    for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
            const embA = embeddings.get(ids[i]);
            const embB = embeddings.get(ids[j]);

            if (embA && embB) {
                totalSimilarity += cosineSimilarity(embA, embB);
                pairCount++;
            }
        }
    }

    const avgSimilarity = pairCount > 0 ? totalSimilarity / pairCount : 0;
    return 1 - avgSimilarity;
}

// --- Cache Management ---

export function clearEmbeddingCache(sessionId?: string): void {
    embeddingCache.clear();
    accessTimestamp.clear();
    if (typeof window !== 'undefined') {
        try {
            localStorage.removeItem(getStorageKey(sessionId));
        } catch {
            // Ignore
        }
    }
}

export function getCacheSize(): number {
    return embeddingCache.size;
}

/**
 * Returns a cached embedding if available (no fetch).
 * Used by goal tracker to read segment embeddings already cached by metrics computation.
 */
export function getCachedEmbedding(id: string): number[] | undefined {
    const emb = embeddingCache.get(id);
    if (emb) {
        accessTimestamp.set(id, Date.now());
    }
    return emb;
}
