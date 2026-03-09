import { NextResponse } from 'next/server';
import {
  getModelRoutingConfig,
  setModelRoutingConfig,
  DEFAULT_MODEL_ROUTING,
  ModelRoutingConfig,
} from '@/lib/config/modelRouting';
import { loadConfigFromFile } from '@/lib/config/modelRoutingPersistence';

/**
 * Check that the OPENAI_API_KEY environment variable is set.
 * Returns an error response if missing, or the key string if present.
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
 * Avoids serverless reset to defaults.
 */
export function loadRoutingConfig(): ModelRoutingConfig {
  let config = getModelRoutingConfig();
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
 * Wraps a Next.js route handler with standardised error handling.
 * Catches thrown errors and returns a consistent JSON error response.
 *
 * Usage:
 *   export const POST = withErrorHandler(async (request) => { ... });
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
