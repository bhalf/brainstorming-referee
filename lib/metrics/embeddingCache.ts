// ============================================
// Embedding Cache & Cosine Similarity
// ============================================
// Client-side cache for segment embeddings.
// Persisted to localStorage across page refreshes.
// Only fetches embeddings for new segments.
// ============================================

// --- Constants ---

const STORAGE_KEY_PREFIX = 'uzh-brainstorming-embeddings';
const MAX_CACHE_ENTRIES = 500; // LRU limit (~6MB max in localStorage)

// Max segments used in O(n²) pairwise operations.
// 30 segments → 435 pairs, runs in <1ms on any modern device.
const MAX_PAIRWISE_SEGMENTS = 30;

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
        const stored = localStorage.getItem(getStorageKey(sessionId));
        if (!stored) return 0;

        const entries: Record<string, number[]> = JSON.parse(stored);
        let count = 0;
        const now = Date.now();

        for (const [id, embedding] of Object.entries(entries)) {
            if (Array.isArray(embedding) && embedding.length > 0) {
                embeddingCache.set(id, embedding);
                accessTimestamp.set(id, now);
                count++;
            }
        }

        console.log(`[EmbeddingCache] Loaded ${count} embeddings from localStorage`);
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
            const response = await fetch('/api/embeddings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ texts: toFetch.map((s) => s.text) }),
            });

            if (response.ok) {
                const data = await response.json();
                const embeddings: number[][] = data.embeddings;
                const fetchTime = Date.now();

                // Store in cache and result
                for (let i = 0; i < toFetch.length; i++) {
                    if (embeddings[i]) {
                        embeddingCache.set(toFetch[i].id, embeddings[i]);
                        accessTimestamp.set(toFetch[i].id, fetchTime);
                        result.set(toFetch[i].id, embeddings[i]);
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

// --- Novelty Detection (for semantic stagnation) ---

/**
 * Checks if the latest segment introduces novel content compared to
 * the average of recent segments. Returns the novelty score (0-1).
 * 0 = identical to recent content, 1 = completely novel.
 */
export function computeNoveltyScore(
    embeddings: Map<string, number[]>,
    segmentIds: string[]
): number {
    if (segmentIds.length < 2) return 1; // First segment is always novel

    const latestId = segmentIds[segmentIds.length - 1];
    const latestEmb = embeddings.get(latestId);
    if (!latestEmb) return 1; // Can't compute, assume novel

    // Compare with all previous segments (not just consecutive)
    const previousIds = segmentIds.slice(0, -1);
    let totalSimilarity = 0;
    let count = 0;

    for (const prevId of previousIds) {
        const prevEmb = embeddings.get(prevId);
        if (prevEmb) {
            totalSimilarity += cosineSimilarity(latestEmb, prevEmb);
            count++;
        }
    }

    if (count === 0) return 1;

    const avgSimilarity = totalSimilarity / count;
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
