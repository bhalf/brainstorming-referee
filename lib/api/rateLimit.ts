import { NextResponse } from 'next/server';

/**
 * Simple in-memory rate limiter using a sliding window per IP.
 * Designed for research/staging — for production, use Redis or similar.
 *
 * Usage in a route:
 *   const limited = rateLimit(request, { maxRequests: 30, windowMs: 60_000 });
 *   if (limited) return limited;
 */

interface RateLimitOptions {
    /** Max requests in the window (default: 30) */
    maxRequests?: number;
    /** Window size in ms (default: 60_000 = 1 minute) */
    windowMs?: number;
}

interface WindowEntry {
    timestamps: number[];
}

const windows = new Map<string, WindowEntry>();

// Clean up old entries every 5 minutes to prevent memory leaks
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of windows) {
        entry.timestamps = entry.timestamps.filter(t => now - t < 120_000);
        if (entry.timestamps.length === 0) windows.delete(key);
    }
}, 5 * 60_000);

function getClientIp(request: Request): string {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0].trim();
    // Fallback for local dev
    return '127.0.0.1';
}

export function rateLimit(
    request: Request,
    options: RateLimitOptions = {},
): NextResponse | null {
    const { maxRequests = 30, windowMs = 60_000 } = options;
    const ip = getClientIp(request);
    // Include pathname in key so each route has its own rate limit bucket
    const pathname = new URL(request.url).pathname;
    const key = `${ip}:${pathname}`;
    const now = Date.now();

    let entry = windows.get(key);
    if (!entry) {
        entry = { timestamps: [] };
        windows.set(key, entry);
    }

    // Remove timestamps outside the window
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
    return null; // Not limited
}
