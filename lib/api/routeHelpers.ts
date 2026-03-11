/**
 * Shared API route helpers.
 *
 * Provides reusable utilities for Next.js API routes: API key validation,
 * model routing config loading (with cold-start recovery), and a
 * standardised error-handling wrapper.
 * @module
 */

import { NextResponse } from 'next/server';
import {
  getModelRoutingConfig,
  setModelRoutingConfig,
  DEFAULT_MODEL_ROUTING,
  ModelRoutingConfig,
} from '@/lib/config/modelRouting';
import { loadConfigFromFile } from '@/lib/config/modelRoutingPersistence';

/**
 * Validate that the OPENAI_API_KEY environment variable is set.
 * @returns An object with either `{ key }` on success or `{ error }` with a 503 response.
 */
export function requireApiKey(): { key: string } | { error: NextResponse } {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      error: NextResponse.json(
        { error: 'OPENAI_API_KEY not configured', code: 'NO_API_KEY' },
        { status: 503 }
      ),
    };
  }
  return { key: apiKey };
}

/**
 * Load the model routing config, restoring from disk on cold start.
 * On a fresh serverless invocation the in-memory config is still the default,
 * so this checks for a persisted file override and applies it.
 * @returns The active ModelRoutingConfig.
 */
export function loadRoutingConfig(): ModelRoutingConfig {
  let config = getModelRoutingConfig();
  // Identity check: if still pointing at the DEFAULT object, try loading from file
  if (config === DEFAULT_MODEL_ROUTING) {
    const fileConfig = loadConfigFromFile();
    if (fileConfig) {
      setModelRoutingConfig(fileConfig);
      config = fileConfig;
    }
  }
  return config;
}

/**
 * Wrap a Next.js route handler with standardised error handling.
 * Catches thrown errors and returns a consistent JSON error response
 * with the appropriate HTTP status code.
 *
 * @example
 * ```ts
 * export const POST = withErrorHandler(async (request) => { ... });
 * ```
 *
 * @param handler - The async route handler function.
 * @returns A wrapped handler that catches and formats errors.
 */
export function withErrorHandler(
  handler: (request: Request) => Promise<NextResponse>,
): (request: Request) => Promise<NextResponse> {
  return async (request: Request) => {
    try {
      return await handler(request);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error';
      const status = (error as { status?: number }).status ?? 500;
      console.error(`[API Error] ${request.url}:`, message);
      return NextResponse.json(
        { error: message, code: 'INTERNAL_ERROR' },
        { status },
      );
    }
  };
}
