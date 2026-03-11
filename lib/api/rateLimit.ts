/**
 * Per-route in-memory rate limiter using a sliding window.
 *
 * Designed for research/staging deployments. For production at scale,
 * replace with Redis or a CDN-level rate limiter. Each IP + pathname
 * combination gets its own sliding window bucket.
 *
 * @example
 * ```ts
 * const limited = rateLimit(request, { maxRequests: 30, windowMs: 60_000 });
 * if (limited) return limited;
 * ```
 * @module
 */

import { NextResponse } from 'next/server';

/** Options for configuring the rate limiter per route. */
interface RateLimitOptions {
    /** Max requests in the window (default: 30) */
    maxRequests?: number;
    /** Window size in ms (default: 60_000 = 1 minute) */
    windowMs?: number;
}

/** Tracks request timestamps within a sliding window for a single bucket. */
interface WindowEntry {
    timestamps: number[];
}

/** Global map of rate limit buckets keyed by "ip:pathname". */
const windows = new Map<string, WindowEntry>();

// Periodic cleanup: evict stale entries every 5 minutes to prevent memory leaks
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of windows) {
        entry.timestamps = entry.timestamps.filter(t => now - t < 120_000);
        if (entry.timestamps.length === 0) windows.delete(key);
    }
}, 5 * 60_000);

/**
 * Extract the client IP from the request, using x-forwarded-for when behind a proxy.
 * @param request - The incoming HTTP request.
 * @returns The client IP string.
 */
function getClientIp(request: Request): string {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0].trim();
    return '127.0.0.1';
}

/**
 * Check whether the request should be rate-limited.
 * @param request - The incoming HTTP request.
 * @param options - Max requests and window size overrides.
 * @returns A 429 NextResponse if the limit is exceeded, or null if allowed.
 */
export function rateLimit(
    request: Request,
    options: RateLimitOptions = {},
): NextResponse | null {
    const { maxRequests = 30, windowMs = 60_000 } = options;
    const ip = getClientIp(request);
    // Each route gets its own bucket to prevent cross-route interference
    const pathname = new URL(request.url).pathname;
    const key = `${ip}:${pathname}`;
    const now = Date.now();

    let entry = windows.get(key);
    if (!entry) {
        entry = { timestamps: [] };
        windows.set(key, entry);
    }

    // Slide the window: discard timestamps older than windowMs
    entry.timestamps = entry.timestamps.filter(t => now - t < windowMs);

    if (entry.timestamps.length >= maxRequests) {
        return NextResponse.json(
            { error: 'Too many requests', code: 'RATE_LIMITED' },
            {
                status: 429,
                headers: {
                    'Retry-After': String(Math.ceil(windowMs / 1000)),
                    'X-RateLimit-Limit': String(maxRequests),
                    'X-RateLimit-Remaining': '0',
                },
            },
        );
    }

    entry.timestamps.push(now);
    return null;
}
