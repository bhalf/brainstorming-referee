/**
 * Fetch wrapper with exponential backoff retry for transient failures.
 * Used for all Supabase persistence operations to prevent silent data loss.
 */

interface FetchWithRetryOptions extends RequestInit {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay in ms before first retry (default: 500) */
  initialDelayMs?: number;
  /** Maximum delay in ms between retries (default: 5000) */
  maxDelayMs?: number;
  /** If true, don't throw on final failure — just log (default: false) */
  silent?: boolean;
}

export async function fetchWithRetry(
  url: string,
  options: FetchWithRetryOptions = {},
): Promise<Response | null> {
  const {
    maxRetries = 3,
    initialDelayMs = 500,
    maxDelayMs = 5000,
    silent = false,
    ...fetchOptions
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, fetchOptions);

      // Don't retry client errors (4xx) — only server/network errors
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        return response;
      }

      // Server error (5xx) — retry
      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      // Network error — retry
      lastError = error instanceof Error ? error : new Error(String(error));
    }

    // Don't delay after the last attempt
    if (attempt < maxRetries) {
      const delay = Math.min(initialDelayMs * Math.pow(2, attempt), maxDelayMs);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  if (silent) {
    console.error(`fetchWithRetry failed after ${maxRetries + 1} attempts:`, url, lastError);
    return null;
  }

  throw lastError ?? new Error('fetchWithRetry failed');
}
