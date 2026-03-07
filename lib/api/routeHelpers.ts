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
