// ============================================
// Default Configuration & Encoding Utilities
// ============================================

import { ExperimentConfig, Scenario } from './types';

// --- Default Values ---

export const DEFAULT_CONFIG: ExperimentConfig = {
  // Window & Analysis
  WINDOW_SECONDS: 180,
  ANALYZE_EVERY_MS: 5000,

  // Trigger Timing
  PERSISTENCE_SECONDS: 120,
  COOLDOWN_SECONDS: 180,
  POST_CHECK_SECONDS: 90,

  // Thresholds (v1 — kept for backward compat)
  THRESHOLD_IMBALANCE: 0.65,
  THRESHOLD_REPETITION: 0.75,
  THRESHOLD_STAGNATION_SECONDS: 180,

  // Safety Limits
  TTS_RATE_LIMIT_SECONDS: 30,
  MAX_INTERVENTIONS_PER_10MIN: 3,

  // v2 thresholds
  THRESHOLD_SILENT_PARTICIPANT: 0.05,
  THRESHOLD_PARTICIPATION_RISK: 0.55,
  THRESHOLD_NOVELTY_RATE: 0.3,
  THRESHOLD_CLUSTER_CONCENTRATION: 0.7,
  CONFIRMATION_SECONDS: 30,
  RECOVERY_IMPROVEMENT_THRESHOLD: 0.15,
};

// --- Config Validation ---

export interface ConfigValidation {
  isValid: boolean;
  errors: string[];
}

export const CONFIG_CONSTRAINTS = {
  WINDOW_SECONDS: { min: 30, max: 600 },
  ANALYZE_EVERY_MS: { min: 1000, max: 30000 },
  PERSISTENCE_SECONDS: { min: 5, max: 300 },
  COOLDOWN_SECONDS: { min: 10, max: 600 },
  POST_CHECK_SECONDS: { min: 5, max: 300 },
  THRESHOLD_IMBALANCE: { min: 0.1, max: 1.0 },
  THRESHOLD_REPETITION: { min: 0.1, max: 1.0 },
  THRESHOLD_STAGNATION_SECONDS: { min: 15, max: 600 },
  TTS_RATE_LIMIT_SECONDS: { min: 10, max: 120 },
  MAX_INTERVENTIONS_PER_10MIN: { min: 1, max: 20 },
  // v2
  THRESHOLD_SILENT_PARTICIPANT: { min: 0.01, max: 0.3 },
  THRESHOLD_PARTICIPATION_RISK: { min: 0.1, max: 1.0 },
  THRESHOLD_NOVELTY_RATE: { min: 0.05, max: 0.8 },
  THRESHOLD_CLUSTER_CONCENTRATION: { min: 0.3, max: 1.0 },
  CONFIRMATION_SECONDS: { min: 5, max: 120 },
  RECOVERY_IMPROVEMENT_THRESHOLD: { min: 0.01, max: 0.5 },
} as const;

export function validateConfig(config: ExperimentConfig): ConfigValidation {
  const errors: string[] = [];

  for (const [key, constraints] of Object.entries(CONFIG_CONSTRAINTS)) {
    const value = config[key as keyof ExperimentConfig];
    const { min, max } = constraints;

    if (isNaN(value)) {
      errors.push(`${key} must be a valid number`);
    } else if (value < min || value > max) {
      errors.push(`${key} must be between ${min} and ${max}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// --- Config Encoding/Decoding (for URL/localStorage) ---

export function encodeConfig(config: ExperimentConfig): string {
  try {
    const json = JSON.stringify(config);
    return btoa(json);
  } catch {
    return '';
  }
}

export function decodeConfig(encoded: string): ExperimentConfig | null {
  try {
    const json = atob(encoded);
    const parsed = JSON.parse(json);
    // Merge with defaults so old encoded configs missing v2 fields still work
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return null;
  }
}

// --- LocalStorage ---

const CONFIG_STORAGE_KEY = 'uzh-brainstorming-config';
const ROOM_STORAGE_KEY = 'uzh-brainstorming-last-room';

export function saveConfigToStorage(config: ExperimentConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch {
    console.warn('Failed to save config to localStorage');
  }
}

export function loadConfigFromStorage(): ExperimentConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    // Merge with defaults so old configs missing v2 fields still work
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return null;
  }
}

export function saveRoomToStorage(roomName: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ROOM_STORAGE_KEY, roomName);
  } catch {
    console.warn('Failed to save room to localStorage');
  }
}

export function loadRoomFromStorage(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(ROOM_STORAGE_KEY);
  } catch {
    return null;
  }
}

// --- Room Name Generation ---

const ADJECTIVES = [
  'creative', 'innovative', 'dynamic', 'brilliant', 'agile',
  'bold', 'clever', 'bright', 'swift', 'keen'
];

const NOUNS = [
  'ideas', 'minds', 'thinkers', 'sparks', 'visions',
  'concepts', 'insights', 'breakthroughs', 'solutions', 'innovations'
];

export function generateRoomName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 1000);
  return `${adj}-${noun}-${num}`;
}

// --- Scenario Descriptions ---

export const SCENARIO_DESCRIPTIONS: Record<Scenario, string> = {
  baseline: 'Baseline: No AI interventions (control group)',
  A: 'Scenario A: Moderator interventions only (text + optional voice)',
  B: 'Scenario B: Moderator + Ally escalation (with creative impulses)',
};

// --- Language Options ---

export const LANGUAGE_OPTIONS = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'de-DE', label: 'German (Germany)' },
  { value: 'de-CH', label: 'German (Switzerland)' },
  { value: 'fr-FR', label: 'French (France)' },
] as const;

export type SupportedLanguage = typeof LANGUAGE_OPTIONS[number]['value'];


