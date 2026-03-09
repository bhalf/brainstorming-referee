import { fetchWithRetry } from '@/lib/utils/fetchWithRetry';

// --- Error Classes ---

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

export class NetworkError extends Error {
    constructor(message: string, public readonly context?: string) {
        super(message);
        this.name = 'NetworkError';
    }
}

// --- Options ---

export interface ApiOptions {
    signal?: AbortSignal;
    maxRetries?: number;
}

// --- Core Functions ---

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
        if (error instanceof ApiError) throw error;
        if (error instanceof NetworkError) throw error;
        if (error instanceof DOMException && error.name === 'AbortError') throw error;

        throw new NetworkError(
            error instanceof Error ? error.message : 'Unknown network error',
            url,
        );
    }
}

/** Fire-and-forget variant — logs errors but does not throw */
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
        // Intentionally swallowed — fire-and-forget
    }
}

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
