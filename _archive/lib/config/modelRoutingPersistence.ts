/**
 * Model Routing File Persistence (Server-Only).
 *
 * Reads and writes the model routing config to `data/model-routing.json`.
 * This ensures routing overrides survive serverless cold starts.
 * Only import this module from API routes -- it uses Node.js `fs`.
 * @module
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { ModelRoutingConfig, mergeModelRouting } from './modelRouting';

/** Absolute path to the persisted config file. */
const CONFIG_FILE_PATH = join(process.cwd(), 'data', 'model-routing.json');

/**
 * Load the routing config from disk, merging with defaults to handle
 * newly added tasks that may not exist in older saved configs.
 * @returns The merged config, or null if the file doesn't exist or is unreadable.
 */
export function loadConfigFromFile(): ModelRoutingConfig | null {
    try {
        if (existsSync(CONFIG_FILE_PATH)) {
            const raw = readFileSync(CONFIG_FILE_PATH, 'utf-8');
            const parsed = JSON.parse(raw);
            // Merge with defaults to handle newly added tasks
            return mergeModelRouting(parsed);
        }
    } catch (error) {
        console.warn('[ModelRouting] Failed to load config from file:', error);
    }
    return null;
}

/**
 * Write the routing config to disk as pretty-printed JSON.
 * Creates the `data/` directory if it doesn't exist.
 * @param config - The complete routing config to persist.
 */
export function saveConfigToFile(config: ModelRoutingConfig): void {
    try {
        const dir = join(process.cwd(), 'data');
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
        }
        writeFileSync(CONFIG_FILE_PATH, JSON.stringify(config, null, 2), 'utf-8');
        console.log('[ModelRouting] Config persisted to', CONFIG_FILE_PATH);
    } catch (error) {
        console.warn('[ModelRouting] Failed to persist config to file:', error);
    }
}
