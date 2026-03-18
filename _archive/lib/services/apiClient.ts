/**
 * Centralised API client with retry logic.
 *
 * Wraps `fetchWithRetry` to provide typed JSON request helpers (GET, POST,
 * PUT, PATCH, DELETE) and a fire-and-forget variant for best-effort calls.
 * All methods set JSON content-type headers and convert errors into
 * {@link ApiError} or {@link NetworkError} instances.
 * @module
 */

import { fetchWithRetry } from '@/lib/utils/fetchWithRetry';

// --- Error Classes ---

/** Represents an HTTP-level error returned by an API route. */
export class ApiError extends Error {
    constructor(
        message: string,
        public readonly status: number,
        public readonly code?: string,
        public readonly context?: string,
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

/** Represents a network-level failure (DNS, timeout, no response). */
export class NetworkError extends Error {
    constructor(message: string, public readonly context?: string) {
        super(message);
        this.name = 'NetworkError';
    }
}

// --- Options ---

/** Shared options accepted by all typed request helpers. */
export interface ApiOptions {
    signal?: AbortSignal;
    maxRetries?: number;
}

// --- Core Functions ---

/**
 * Internal request handler: sends a JSON request with retries and maps
 * failures to ApiError / NetworkError. Not exported -- use the typed
 * wrappers below.
 * @param url - The API endpoint URL.
 * @param init - Standard RequestInit (method, body, headers, etc.).
 * @param options - Abort signal and retry count.
 * @returns Parsed JSON response body typed as T.
 */
async function apiRequest<T>(
    url: string,
    init: RequestInit,
    options: ApiOptions = {},
): Promise<T> {
    const { signal, maxRetries = 3 } = options;

    try {
        const response = await fetchWithRetry(url, {
            ...init,
            headers: {
                'Content-Type': 'application/json',
                ...init.headers,
            },
            signal,
            maxRetries,
            silent: false,
        });

        if (!response) {
            throw new NetworkError('Request failed after retries', url);
        }

        const data = await response.json();

        if (!response.ok) {
            throw new ApiError(
                data?.error || `Request failed: ${response.status}`,
                response.status,
                data?.code,
                url,
            );
        }

        return data as T;
    } catch (error) {
        // Re-throw known error types without wrapping
        if (error instanceof ApiError) throw error;
        if (error instanceof NetworkError) throw error;
        if (error instanceof DOMException && error.name === 'AbortError') throw error;

        throw new NetworkError(
            error instanceof Error ? error.message : 'Unknown network error',
            url,
        );
    }
}

/**
 * Fire-and-forget variant -- logs errors internally but never throws.
 * Used for best-effort persistence (segments, events, errors).
 * @param url - The API endpoint URL.
 * @param init - Standard RequestInit (method, body, headers, etc.).
 * @param maxRetries - Number of retries before silently giving up.
 */
export async function apiFireAndForget(
    url: string,
    init: RequestInit,
    maxRetries = 2,
): Promise<void> {
    try {
        await fetchWithRetry(url, {
            ...init,
            headers: { 'Content-Type': 'application/json', ...init.headers },
            maxRetries,
            silent: true,
        });
    } catch {
        // Intentionally swallowed -- fire-and-forget
    }
}

/**
 * Send a GET request and return the parsed JSON body.
 * @param url - The API endpoint URL.
 * @param params - Optional query string parameters.
 * @param options - Optional abort signal and retry config.
 * @returns Parsed JSON response typed as T.
 */
export async function apiGet<T>(
    url: string,
    params?: Record<string, string>,
    options?: ApiOptions,
): Promise<T> {
    const queryString = params
        ? '?' + new URLSearchParams(params).toString()
        : '';
    return apiRequest<T>(`${url}${queryString}`, { method: 'GET' }, options);
}

/**
 * Send a POST request with a JSON body.
 * @param url - The API endpoint URL.
 * @param body - Request payload (will be JSON-stringified).
 * @param options - Optional abort signal and retry config.
 * @returns Parsed JSON response typed as T.
 */
export async function apiPost<T>(
    url: string,
    body: unknown,
    options?: ApiOptions,
): Promise<T> {
    return apiRequest<T>(
        url,
        { method: 'POST', body: JSON.stringify(body) },
        options,
    );
}

/**
 * Send a PUT request with a JSON body.
 * @param url - The API endpoint URL.
 * @param body - Request payload (will be JSON-stringified).
 * @param options - Optional abort signal and retry config.
 * @returns Parsed JSON response typed as T.
 */
export async function apiPut<T>(
    url: string,
    body: unknown,
    options?: ApiOptions,
): Promise<T> {
    return apiRequest<T>(
        url,
        { method: 'PUT', body: JSON.stringify(body) },
        options,
    );
}

/**
 * Send a PATCH request with a JSON body.
 * @param url - The API endpoint URL.
 * @param body - Request payload (will be JSON-stringified).
 * @param options - Optional abort signal and retry config.
 * @returns Parsed JSON response typed as T.
 */
export async function apiPatch<T>(
    url: string,
    body: unknown,
    options?: ApiOptions,
): Promise<T> {
    return apiRequest<T>(
        url,
        { method: 'PATCH', body: JSON.stringify(body) },
        options,
    );
}

/**
 * Send a DELETE request with an optional JSON body.
 * @param url - The API endpoint URL.
 * @param body - Optional request payload (will be JSON-stringified).
 * @param options - Optional abort signal and retry config.
 * @returns Parsed JSON response typed as T (defaults to void).
 */
export async function apiDelete<T = void>(
    url: string,
    body?: unknown,
    options?: ApiOptions,
): Promise<T> {
    return apiRequest<T>(
        url,
        { method: 'DELETE', body: body !== undefined ? JSON.stringify(body) : undefined },
        options,
    );
}
