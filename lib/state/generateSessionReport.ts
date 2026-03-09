/**
 * Session Report Generator
 *
 * Computes a comprehensive post-session analysis report from raw DB data.
 * Called server-side when a session ends, or on-demand via the report API.
 */

// --- Types ---

export interface ParticipantProfile {
    name: string;
    role: string;
    speakingTimePercent: number;
    turnCount: number;
    avgTurnLengthWords: number;
    ideasContributed: number;
    ruleViolations: number;
    activePhases: Array<{ fromMs: number; toMs: number }>;
}

export interface MetricsTimelineEntry {
    minuteOffset: number;
    participationRisk: number;
    noveltyRate: number;
    clusterConcentration: number;
    stagnationDuration: number;
    inferredState: string;
}

export interface InterventionImpactEntry {
    id: string;
    timestamp: number;
    minuteOffset: number;
    type: string;
    trigger: string;
    intent: string;
    text: string;
    metricsBefore: {
        participationRisk: number;
        noveltyRate: number;
        stagnationDuration: number;
    };
    metricsAfter: {
        participationRisk: number;
        noveltyRate: number;
        stagnationDuration: number;
    } | null;
    recoveryResult: string | null;
    improvement: 'positive' | 'neutral' | 'negative' | 'unknown';
}

export interface RuleViolationEntry {
    timestamp: number;
    minuteOffset: number;
    rule: string;
    severity: string;
    evidence: string;
    interventionId: string;
    interventionText: string;
}

export interface StateTimelineEntry {
    state: string;
    fromMs: number;
    toMs: number;
    durationMs: number;
}

export interface SessionReport {
    overview: {
        durationMs: number;
        totalSegments: number;
        totalInterventions: number;
        totalIdeas: number;
        dominantState: string;
        stateTransitionCount: number;
    };
    participants: ParticipantProfile[];
    metricsTimeline: MetricsTimelineEntry[];
    interventionImpact: InterventionImpactEntry[];
    ruleViolations: RuleViolationEntry[];
    stateTimeline: StateTimelineEntry[];
    llmSummary?: string;
    generatedAt: number;
}

// --- Raw DB row types (from Supabase select) ---

interface RawSegment {
    speaker: string;
    text: string;
    timestamp: number;
}

interface RawMetricSnapshot {
    timestamp: number;
    metrics: Record<string, unknown>;
    state_inference: Record<string, unknown> | null;
}

interface RawIntervention {
    id: string;
    type: string;
    trigger: string | null;
    intent: string | null;
    message: string;
    timestamp: number;
    recovery_result: string | null;
    rule_violated: string | null;
    rule_evidence: string | null;
    rule_severity: string | null;
}

interface RawIdea {
    author: string;
}

interface RawParticipant {
    identity: string;
    display_name: string;
    role: string;
}

// --- Helper functions ---

function getMinuteOffset(timestamp: number, sessionStart: number): number {
    return Math.round((timestamp - sessionStart) / 60000 * 10) / 10; // 1 decimal
}

function extractMetricValue(metrics: Record<string, unknown>, path: string): number {
    const parts = path.split('.');
    let current: unknown = metrics;
    for (const part of parts) {
        if (current && typeof current === 'object' && part in (current as Record<string, unknown>)) {
            current = (current as Record<string, unknown>)[part];
        } else {
            return 0;
        }
    }
    return typeof current === 'number' ? current : 0;
}

// --- Main generator ---

export function generateSessionReport(
    sessionStartedAt: number,
    sessionEndedAt: number | null,
    segments: RawSegment[],
    snapshots: RawMetricSnapshot[],
    interventions: RawIntervention[],
    ideas: RawIdea[],
    participants: RawParticipant[],
): SessionReport {
    const endTime = sessionEndedAt ?? Date.now();
    const durationMs = endTime - sessionStartedAt;

    // === 1. Participant Profiles ===
    const speakerTurns = new Map<string, { count: number; totalWords: number; timestamps: number[] }>();

    for (const seg of segments) {
        const existing = speakerTurns.get(seg.speaker) ?? { count: 0, totalWords: 0, timestamps: [] };
        existing.count++;
        existing.totalWords += seg.text.split(/\s+/).filter(Boolean).length;
        existing.timestamps.push(seg.timestamp);
        speakerTurns.set(seg.speaker, existing);
    }

    const totalWords = Array.from(speakerTurns.values()).reduce((s, v) => s + v.totalWords, 0);

    // Map ideas by author
    const ideaCountByAuthor = new Map<string, number>();
    for (const idea of ideas) {
        ideaCountByAuthor.set(idea.author, (ideaCountByAuthor.get(idea.author) ?? 0) + 1);
    }

    // Map rule violations by intervention
    const violationsByIntervention = new Map<string, RawIntervention>();
    for (const intv of interventions) {
        if (intv.rule_violated) {
            violationsByIntervention.set(intv.id, intv);
        }
    }

    // Build participant profiles
    const participantProfiles: ParticipantProfile[] = [];
    const allSpeakers = new Set<string>();
    for (const p of participants) allSpeakers.add(p.display_name);
    for (const s of speakerTurns.keys()) allSpeakers.add(s);

    for (const name of allSpeakers) {
        const turns = speakerTurns.get(name);
        const participant = participants.find(p => p.display_name === name || p.identity === name);

        // Compute active phases (group timestamps within 60s gaps)
        const activePhases: Array<{ fromMs: number; toMs: number }> = [];
        if (turns) {
            const sorted = [...turns.timestamps].sort((a, b) => a - b);
            let phaseStart = sorted[0];
            let phaseEnd = sorted[0];
            for (let i = 1; i < sorted.length; i++) {
                if (sorted[i] - phaseEnd > 60000) {
                    activePhases.push({ fromMs: phaseStart - sessionStartedAt, toMs: phaseEnd - sessionStartedAt });
                    phaseStart = sorted[i];
                }
                phaseEnd = sorted[i];
            }
            activePhases.push({ fromMs: phaseStart - sessionStartedAt, toMs: phaseEnd - sessionStartedAt });
        }

        // Count rule violations by this speaker (check evidence text)
        let ruleViolationCount = 0;
        for (const intv of violationsByIntervention.values()) {
            if (intv.rule_evidence?.includes(name)) {
                ruleViolationCount++;
            }
        }

        participantProfiles.push({
            name,
            role: participant?.role ?? 'participant',
            speakingTimePercent: totalWords > 0 ? Math.round((turns?.totalWords ?? 0) / totalWords * 100) : 0,
            turnCount: turns?.count ?? 0,
            avgTurnLengthWords: turns ? Math.round(turns.totalWords / turns.count) : 0,
            ideasContributed: ideaCountByAuthor.get(name) ?? 0,
            ruleViolations: ruleViolationCount,
            activePhases,
        });
    }

    // Sort by speaking time descending
    participantProfiles.sort((a, b) => b.speakingTimePercent - a.speakingTimePercent);

    // === 2. Metrics Timeline (1-minute buckets) ===
    const totalMinutes = Math.ceil(durationMs / 60000);
    const metricsTimeline: MetricsTimelineEntry[] = [];

    for (let minute = 0; minute < totalMinutes; minute++) {
        const bucketStart = sessionStartedAt + minute * 60000;
        const bucketEnd = bucketStart + 60000;

        // Find the closest snapshot to this bucket
        const bucketed = snapshots.filter(s => s.timestamp >= bucketStart && s.timestamp < bucketEnd);
        const snapshot = bucketed.length > 0 ? bucketed[bucketed.length - 1] : null;

        if (snapshot) {
            const m = snapshot.metrics;
            const si = snapshot.state_inference;

            metricsTimeline.push({
                minuteOffset: minute,
                participationRisk: extractMetricValue(m, 'participation.participationRiskScore'),
                noveltyRate: extractMetricValue(m, 'semanticDynamics.noveltyRate'),
                clusterConcentration: extractMetricValue(m, 'semanticDynamics.clusterConcentration'),
                stagnationDuration: extractMetricValue(m, 'stagnationDuration'),
                inferredState: (si as Record<string, unknown>)?.state as string ?? 'UNKNOWN',
            });
        }
    }

    // === 3. Intervention Impact (before/after comparison) ===
    const interventionImpact: InterventionImpactEntry[] = [];

    for (const intv of interventions) {
        const intvTime = intv.timestamp;

        // Find metrics ~60s before the intervention
        const before = snapshots
            .filter(s => s.timestamp >= intvTime - 90000 && s.timestamp < intvTime)
            .sort((a, b) => b.timestamp - a.timestamp)[0];

        // Find metrics ~60s after the intervention
        const after = snapshots
            .filter(s => s.timestamp > intvTime && s.timestamp <= intvTime + 90000)
            .sort((a, b) => a.timestamp - b.timestamp)[0];

        const metricsBefore = before ? {
            participationRisk: extractMetricValue(before.metrics, 'participation.participationRiskScore'),
            noveltyRate: extractMetricValue(before.metrics, 'semanticDynamics.noveltyRate'),
            stagnationDuration: extractMetricValue(before.metrics, 'stagnationDuration'),
        } : { participationRisk: 0, noveltyRate: 0, stagnationDuration: 0 };

        const metricsAfter = after ? {
            participationRisk: extractMetricValue(after.metrics, 'participation.participationRiskScore'),
            noveltyRate: extractMetricValue(after.metrics, 'semanticDynamics.noveltyRate'),
            stagnationDuration: extractMetricValue(after.metrics, 'stagnationDuration'),
        } : null;

        // Determine improvement
        let improvement: InterventionImpactEntry['improvement'] = 'unknown';
        if (metricsAfter) {
            const riskDelta = metricsBefore.participationRisk - metricsAfter.participationRisk;
            const noveltyDelta = metricsAfter.noveltyRate - metricsBefore.noveltyRate;
            const stagnationDelta = metricsBefore.stagnationDuration - metricsAfter.stagnationDuration;

            // Weighted positive if risk decreased, novelty increased, or stagnation decreased
            const score = riskDelta * 0.4 + noveltyDelta * 0.3 + (stagnationDelta > 0 ? 0.3 : -0.1);
            if (score > 0.05) improvement = 'positive';
            else if (score < -0.05) improvement = 'negative';
            else improvement = 'neutral';
        }

        interventionImpact.push({
            id: intv.id,
            timestamp: intv.timestamp,
            minuteOffset: getMinuteOffset(intv.timestamp, sessionStartedAt),
            type: intv.type,
            trigger: intv.trigger ?? 'manual',
            intent: intv.intent ?? 'unknown',
            text: intv.message,
            metricsBefore,
            metricsAfter,
            recoveryResult: intv.recovery_result,
            improvement,
        });
    }

    // === 4. Rule Violations ===
    const ruleViolationsList: RuleViolationEntry[] = interventions
        .filter(i => i.rule_violated)
        .map(i => ({
            timestamp: i.timestamp,
            minuteOffset: getMinuteOffset(i.timestamp, sessionStartedAt),
            rule: i.rule_violated!,
            severity: i.rule_severity ?? 'unknown',
            evidence: i.rule_evidence ?? '',
            interventionId: i.id,
            interventionText: i.message,
        }));

    // === 5. State Timeline ===
    const stateTimeline: StateTimelineEntry[] = [];
    const stateChanges = snapshots
        .filter(s => s.state_inference)
        .map(s => ({
            timestamp: s.timestamp,
            state: (s.state_inference as Record<string, unknown>)?.state as string ?? 'UNKNOWN',
        }))
        .sort((a, b) => a.timestamp - b.timestamp);

    if (stateChanges.length > 0) {
        let currentState = stateChanges[0].state;
        let stateStart = stateChanges[0].timestamp;

        for (let i = 1; i < stateChanges.length; i++) {
            if (stateChanges[i].state !== currentState) {
                stateTimeline.push({
                    state: currentState,
                    fromMs: stateStart - sessionStartedAt,
                    toMs: stateChanges[i].timestamp - sessionStartedAt,
                    durationMs: stateChanges[i].timestamp - stateStart,
                });
                currentState = stateChanges[i].state;
                stateStart = stateChanges[i].timestamp;
            }
        }
        // Final state
        stateTimeline.push({
            state: currentState,
            fromMs: stateStart - sessionStartedAt,
            toMs: endTime - sessionStartedAt,
            durationMs: endTime - stateStart,
        });
    }

    // === 6. Dominant State ===
    const stateDurations = new Map<string, number>();
    for (const entry of stateTimeline) {
        stateDurations.set(entry.state, (stateDurations.get(entry.state) ?? 0) + entry.durationMs);
    }
    let dominantState = 'UNKNOWN';
    let maxDuration = 0;
    for (const [state, dur] of stateDurations) {
        if (dur > maxDuration) {
            dominantState = state;
            maxDuration = dur;
        }
    }

    return {
        overview: {
            durationMs,
            totalSegments: segments.length,
            totalInterventions: interventions.length,
            totalIdeas: ideas.length,
            dominantState,
            stateTransitionCount: stateTimeline.length > 0 ? stateTimeline.length - 1 : 0,
        },
        participants: participantProfiles,
        metricsTimeline,
        interventionImpact,
        ruleViolations: ruleViolationsList,
        stateTimeline,
        generatedAt: Date.now(),
    };
}

// --- LLM Summary Generator ---

/**
 * Generates a human-readable narrative summary of the session using an LLM.
 * Called server-side after the statistical report is computed.
 */
export async function generateLLMSessionSummary(
    report: SessionReport,
    language: string,
    apiKey: string,
): Promise<string> {
    const durationMin = Math.round(report.overview.durationMs / 60000);
    const lang = language.startsWith('de') ? 'German' : 'English';

    // Build a compact context from the report data
    const participantSummary = report.participants
        .map(p => `${p.name} (${p.role}): ${p.speakingTimePercent}% speaking time, ${p.turnCount} turns, ${p.ideasContributed} ideas, ${p.ruleViolations} violations`)
        .join('\n');

    const interventionSummary = report.interventionImpact
        .map(i => `[Minute ${i.minuteOffset}] ${i.trigger}/${i.intent}: "${i.text.substring(0, 80)}..." → ${i.improvement}${i.recoveryResult ? ` (recovery: ${i.recoveryResult})` : ''}`)
        .join('\n');

    const violationSummary = report.ruleViolations
        .map(v => `[Minute ${v.minuteOffset}] Rule: ${v.rule} (${v.severity}) — Evidence: "${v.evidence.substring(0, 100)}"`);

    const stateFlow = report.stateTimeline
        .map(s => `${s.state} (${Math.round(s.durationMs / 1000)}s)`)
        .join(' → ');

    const prompt = `You are an expert facilitator and research analyst. Write a concise, professional post-session report summary in ${lang}.

Session Overview:
- Duration: ${durationMin} minutes
- Total transcript segments: ${report.overview.totalSegments}
- Total interventions by the AI moderator: ${report.overview.totalInterventions}
- Ideas generated: ${report.overview.totalIdeas}
- Dominant conversation state: ${report.overview.dominantState}

Participants:
${participantSummary}

Intervention Timeline & Impact:
${interventionSummary || 'No interventions were triggered.'}

Rule Violations:
${violationSummary.length > 0 ? violationSummary.join('\n') : 'No brainstorming rule violations detected.'}

Conversation State Flow:
${stateFlow || 'No state data available.'}

Write a structured summary (3-5 paragraphs) covering:
1. Session overview & dynamics (how the conversation evolved)
2. Participant contributions & roles (who was active, who was quiet, balance)
3. Intervention effectiveness (which interventions helped, which didn't)
4. Rule compliance (any violations, how they were resolved)
5. Key takeaways & recommendations for future sessions

Be specific, reference actual participant names and minute markers. Be analytical, not generic.`;

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: 'You are a session analysis expert. Write concise, data-driven summaries.' },
                    { role: 'user', content: prompt },
                ],
                max_completion_tokens: 1000,
            }),
            signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
            console.error('[LLM Summary] API error:', response.status);
            return `[Summary generation failed: HTTP ${response.status}]`;
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content?.trim() ?? '[Empty response from LLM]';
    } catch (error) {
        console.error('[LLM Summary] Error:', error);
        return '[Summary generation failed]';
    }
}
