import { describe, it, expect } from 'vitest';
import { computeMetricsAsync } from '@/lib/metrics/computeMetrics';
import { TranscriptSegment, ExperimentConfig } from '@/lib/types';
import { DEFAULT_CONFIG } from '@/lib/config';

// --- Helpers ---

const now = Date.now();

function seg(speaker: string, text: string, index: number): TranscriptSegment {
    return {
        id: `seg-${index}`,
        speaker,
        text,
        timestamp: now - (100 - index) * 1000, // spread over last 100s
        isFinal: true,
    };
}

function activityMarker(index: number): TranscriptSegment {
    return {
        id: `marker-${index}`,
        speaker: 'System',
        text: '[speaking]',
        timestamp: now - (100 - index) * 1000,
        isFinal: true,
    };
}

const config: ExperimentConfig = { ...DEFAULT_CONFIG, WINDOW_SECONDS: 300 };

// --- Tests ---

describe('computeMetricsAsync — orchestration', () => {
    it('returns a valid snapshot with default zero-like values for empty segments', async () => {
        const result = await computeMetricsAsync([], config, now);
        expect(result).toBeDefined();
        expect(result.id).toMatch(/^metric-/);
        expect(result.timestamp).toBe(now);
        expect(result.participationImbalance).toBe(0);
        expect(result.speakingTimeDistribution).toEqual({});
        expect(result.semanticRepetitionRate).toBe(0);
        expect(result.diversityDevelopment).toBeGreaterThanOrEqual(0);
        expect(result.stagnationDuration).toBeGreaterThanOrEqual(0);
    });

    it('returns correct distribution for a single speaker', async () => {
        const segments = [
            seg('Alice', 'Hello world this is a test', 0),
            seg('Alice', 'Another sentence here', 1),
        ];
        const result = await computeMetricsAsync(segments, config, now);
        expect(result.speakingTimeDistribution['Alice']).toBeDefined();
        // Single speaker with text-proxy: Hoover index sees 100% on one speaker
        expect(result.participationImbalance).toBeGreaterThanOrEqual(0);
    });

    it('detects imbalance with unequal speakers', async () => {
        const segments: TranscriptSegment[] = [];
        // Alice speaks 8 turns, Bob 2
        for (let i = 0; i < 8; i++) {
            segments.push(seg('Alice', `Idea number ${i} about the topic here`, i));
        }
        for (let i = 0; i < 2; i++) {
            segments.push(seg('Bob', 'Ok sure', 8 + i));
        }
        const result = await computeMetricsAsync(segments, config, now);
        expect(result.participationImbalance).toBeGreaterThan(0.2);
        expect(result.speakingTimeDistribution['Alice']).toBeGreaterThan(0.5);
    });

    it('filters out activity markers ([speaking], [joined])', async () => {
        const segments = [
            seg('Alice', 'Hello world this is some content', 0),
            activityMarker(1),
            activityMarker(2),
            seg('Bob', 'Some other relevant content here', 3),
        ];
        const result = await computeMetricsAsync(segments, config, now);
        // Should only see Alice and Bob, not System
        expect(result.speakingTimeDistribution['System']).toBeUndefined();
        expect(result.speakingTimeDistribution['Alice']).toBeDefined();
        expect(result.speakingTimeDistribution['Bob']).toBeDefined();
    });

    it('uses audio speaking times when provided', async () => {
        const segments = [
            seg('Alice', 'Short', 0),
            seg('Bob', 'This is a much longer sentence with many words', 1),
        ];
        // Audio says Alice spoke 10s, Bob 2s (opposite of text length)
        const audioTimes = new Map([['Alice', 10], ['Bob', 2]]);
        const result = await computeMetricsAsync(segments, config, now, audioTimes);
        // Audio override should give Alice the larger share
        expect(result.speakingTimeDistribution['Alice']).toBeGreaterThan(
            result.speakingTimeDistribution['Bob'],
        );
    });

    it('accounts for knownParticipantCount in imbalance', async () => {
        // Single speaker but we know 3 people are present
        const segments = [seg('Alice', 'Only I am talking here unfortunately', 0)];
        const resultWithout = await computeMetricsAsync(segments, config, now);
        const resultWith = await computeMetricsAsync(
            segments, config, now, undefined, undefined, 3,
        );
        // With 3 known participants, imbalance should be higher (2 are silent)
        expect(resultWith.participationImbalance).toBeGreaterThan(
            resultWithout.participationImbalance,
        );
    });

    it('includes participation sub-metrics', async () => {
        const segments: TranscriptSegment[] = [];
        for (let i = 0; i < 5; i++) {
            segments.push(seg('Alice', `Contribution number ${i}`, i));
            segments.push(seg('Bob', `Response number ${i}`, i + 5));
        }
        const result = await computeMetricsAsync(segments, config, now);
        expect(result.participation).toBeDefined();
        expect(result.participation!.volumeShare).toBeDefined();
        expect(result.participation!.turnShare).toBeDefined();
        expect(result.participation!.participationRiskScore).toBeDefined();
    });
});
