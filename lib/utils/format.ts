/**
 * Shared formatting utilities used across components.
 * Consolidates duplicated formatTime / estimation logic.
 */

/** Format a Unix ms timestamp as HH:MM:SS (24 h) */
export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/** Format 0-1 as percentage string, e.g. "65.0%" */
export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/** Format seconds with one decimal, e.g. "12.3s" */
export function formatSeconds(value: number): string {
  return `${value.toFixed(1)}s`;
}

/**
 * Estimate speaking duration from character count.
 * Average speaking rate ≈ 12.5 characters per second.
 */
export function estimateSpeakingSeconds(text: string): number {
  return text.trim().length / 12.5;
}
