// ============================================
// Model Routing File Persistence (Server-Only)
// ============================================
// Reads/writes model routing config to data/model-routing.json.
// Only import this module from API routes (server-side).
// ============================================
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { ModelRoutingConfig, mergeModelRouting } from './modelRouting';

const CONFIG_FILE_PATH = join(process.cwd(), 'data', 'model-routing.json');

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
