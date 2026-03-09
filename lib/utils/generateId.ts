/**
 * Generates a unique ID with a human-readable prefix.
 * Uses `crypto.randomUUID()` for reliable, collision-resistant uniqueness.
 *
 * Replaces the inconsistent pattern:
 *   `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
 */
export function generateId(prefix: string): string {
    return `${prefix}-${crypto.randomUUID()}`;
}
