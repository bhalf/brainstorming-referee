import { useEffect, useRef, useCallback, useState, MutableRefObject } from 'react';
import { useLatestRef } from '@/lib/hooks/useLatestRef';
import { apiPost, apiFireAndForget } from '@/lib/services/apiClient';
import { supabase } from '@/lib/supabase/client';
import {
    getOrFetchEmbeddings,
    getCachedEmbedding,
    cosineSimilarity,
} from '@/lib/metrics/embeddingCache';
import type {
    ConversationGoal,
    GoalAssessment,
    GoalTrackingState,
    GoalCoverageStatus,
    TranscriptSegment,
    ModelRoutingLogEntry,
} from '@/lib/types';
import type { LiveSummaryState } from '@/lib/hooks/useLiveSummary';
import type { RealtimeChannel } from '@supabase/supabase-js';

// --- Config ---

/** How often the decision owner runs the LLM assessment. */
const ASSESSMENT_INTERVAL_MS = 90_000;
/** How often to compute embedding heat scores. */
const HEAT_INTERVAL_MS = 5_000;
/** Rolling window for heat score computation (segments from last 60s). */
const HEAT_WINDOW_MS = 60_000;
/** Minimum transcript segments needed before first assessment. */
const MIN_SEGMENTS_FOR_ASSESSMENT = 5;

// --- Goal Context (for intervention enrichment) ---

export interface GoalContext {
    coveredGoals: string[];
    uncoveredGoals: string[];
    suggestedTopics: string[];
}

// --- Params ---

interface UseGoalTrackerParams {
    isActive: boolean;
    isDecisionOwner: boolean;
    sessionId: string | null;
    goals: ConversationGoal[];
    transcriptSegmentsRef: MutableRefObject<TranscriptSegment[]>;
    liveSummary: LiveSummaryState;
    language: string;
    addModelRoutingLog: (entry: ModelRoutingLogEntry) => void;
    addError: (message: string, context?: string) => void;
}

interface UseGoalTrackerReturn {
    goalTracking: GoalTrackingState | null;
    getGoalContext: () => GoalContext | null;
}

// --- Helpers ---

function createInitialAssessments(goals: ConversationGoal[]): GoalAssessment[] {
    return goals.map((g) => ({
        goalId: g.id,
        status: 'not_started' as GoalCoverageStatus,
        heatScore: 0,
        relevantSegmentCount: 0,
    }));
}

function computeOverallProgress(assessments: GoalAssessment[]): number {
    if (assessments.length === 0) return 0;
    const covered = assessments.filter(
        (a) => a.status === 'partially_covered' || a.status === 'covered'
    ).length;
    return covered / assessments.length;
}

// --- Hook ---

/**
 * Tracks predefined conversation goals against the live transcript.
 * Decision owner computes embedding heat scores (5s) and runs LLM assessments (90s).
 * Non-owners receive assessment updates via Supabase Realtime on session_events.
 */
export function useGoalTracker({
    isActive,
    isDecisionOwner,
    sessionId,
    goals,
    transcriptSegmentsRef,
    liveSummary,
    language,
    addModelRoutingLog,
    addError,
}: UseGoalTrackerParams): UseGoalTrackerReturn {
    const [state, setState] = useState<GoalTrackingState | null>(null);

    const goalEmbeddingsRef = useRef<Map<string, number[]>>(new Map());
    const isAssessingRef = useRef(false);
    const channelRef = useRef<RealtimeChannel | null>(null);
    const liveSummaryRef = useLatestRef(liveSummary);
    const goalsRef = useLatestRef(goals);

    // Initialize state when goals change
    useEffect(() => {
        if (goals.length === 0) {
            setState(null);
            return;
        }
        setState((prev) => {
            // Preserve existing assessments if goals haven't changed
            if (prev && prev.goals.length === goals.length &&
                prev.goals.every((g, i) => g.id === goals[i].id)) {
                return prev;
            }
            return {
                goals,
                assessments: createInitialAssessments(goals),
                lastAssessedAt: null,
                isAssessing: false,
                overallProgress: 0,
                suggestedTopics: [],
            };
        });
    }, [goals]);

    // --- Embed goals once ---
    useEffect(() => {
        if (!isDecisionOwner || goals.length === 0) return;

        const embedGoals = async () => {
            const toEmbed = goals.map((g) => ({
                id: `goal-${g.id}`,
                text: g.description ? `${g.label}: ${g.description}` : g.label,
            }));
            try {
                const embeddings = await getOrFetchEmbeddings(toEmbed, sessionId ?? undefined);
                goalEmbeddingsRef.current = embeddings;
            } catch (err) {
                console.error('[GoalTracker] Failed to embed goals:', err);
            }
        };

        embedGoals();
    }, [isDecisionOwner, goals, sessionId]);

    // --- Embedding heat computation (every 5s, decision owner) ---
    useEffect(() => {
        if (!isActive || !isDecisionOwner || goals.length === 0) return;

        const computeHeat = () => {
            const goalEmbs = goalEmbeddingsRef.current;
            if (goalEmbs.size === 0) return;

            const segments = transcriptSegmentsRef.current;
            const now = Date.now();
            const windowStart = now - HEAT_WINDOW_MS;

            // Get recent segments within the window
            const recentSegments = segments.filter((s) => s.timestamp >= windowStart && s.isFinal);

            const updatedAssessments: GoalAssessment[] = goalsRef.current.map((goal) => {
                const goalEmb = goalEmbs.get(`goal-${goal.id}`);
                if (!goalEmb) {
                    return {
                        goalId: goal.id,
                        status: 'not_started' as GoalCoverageStatus,
                        heatScore: 0,
                        relevantSegmentCount: 0,
                    };
                }

                let maxSim = 0;
                let relevantCount = 0;

                for (const seg of recentSegments) {
                    const segEmb = getCachedEmbedding(seg.id);
                    if (segEmb) {
                        const sim = cosineSimilarity(goalEmb, segEmb);
                        if (sim > maxSim) maxSim = sim;
                        if (sim > 0.35) relevantCount++;
                    }
                }

                // Preserve LLM status if available, otherwise derive from heat
                const prevAssessment = state?.assessments.find((a) => a.goalId === goal.id);
                const llmStatus = prevAssessment?.notes ? prevAssessment.status : undefined;

                return {
                    goalId: goal.id,
                    status: llmStatus ?? deriveStatusFromHeat(maxSim),
                    heatScore: maxSim,
                    relevantSegmentCount: relevantCount,
                    notes: prevAssessment?.notes,
                };
            });

            setState((prev) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    assessments: updatedAssessments,
                    overallProgress: computeOverallProgress(updatedAssessments),
                };
            });
        };

        const interval = setInterval(computeHeat, HEAT_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [isActive, isDecisionOwner, goals.length, transcriptSegmentsRef, state?.assessments]);

    // --- LLM assessment (every 90s, decision owner) ---
    const runAssessment = useCallback(async () => {
        if (!sessionId || isAssessingRef.current || goals.length === 0) return;

        const segments = transcriptSegmentsRef.current;
        if (segments.length < MIN_SEGMENTS_FOR_ASSESSMENT) return;

        isAssessingRef.current = true;
        setState((prev) => prev ? { ...prev, isAssessing: true } : prev);

        try {
            const recentSegments = segments.slice(-15).map((s) => ({
                speaker: s.speaker,
                text: s.text,
            }));

            const heatScores: Record<string, number> = {};
            for (const goal of goals) {
                const assessment = state?.assessments.find((a) => a.goalId === goal.id);
                heatScores[goal.id] = assessment?.heatScore ?? 0;
            }

            const result = await apiPost<{
                assessments?: Array<{ goalId: string; status: GoalCoverageStatus; notes?: string }>;
                suggestedTopics?: string[];
                logEntry?: ModelRoutingLogEntry;
            }>('/api/goals/assess', {
                goals: goals.map((g) => ({
                    id: g.id,
                    label: g.label,
                    description: g.description,
                })),
                heatScores,
                liveSummary: liveSummaryRef.current.summary,
                recentTranscript: recentSegments,
                language,
            });

            if (result.logEntry) {
                addModelRoutingLog(result.logEntry);
            }

            if (result.assessments) {
                setState((prev) => {
                    if (!prev) return prev;

                    const merged = prev.assessments.map((existing) => {
                        const llm = result.assessments!.find((a) => a.goalId === existing.goalId);
                        if (llm) {
                            return {
                                ...existing,
                                status: llm.status,
                                notes: llm.notes,
                            };
                        }
                        return existing;
                    });

                    const newState: GoalTrackingState = {
                        ...prev,
                        assessments: merged,
                        lastAssessedAt: Date.now(),
                        isAssessing: false,
                        overallProgress: computeOverallProgress(merged),
                        suggestedTopics: result.suggestedTopics ?? prev.suggestedTopics,
                    };

                    // Persist to session_events for non-owners
                    apiFireAndForget('/api/session/events', {
                        method: 'POST',
                        body: JSON.stringify({
                            sessionId,
                            eventType: 'goal_assessment',
                            payload: {
                                assessments: merged,
                                suggestedTopics: newState.suggestedTopics,
                                overallProgress: newState.overallProgress,
                            },
                            actor: 'system',
                            timestamp: Date.now(),
                        }),
                    });

                    return newState;
                });
            }
        } catch (err) {
            console.error('[GoalTracker] Assessment failed:', err);
            addError('Goal assessment failed', 'useGoalTracker');
        } finally {
            isAssessingRef.current = false;
            setState((prev) => prev ? { ...prev, isAssessing: false } : prev);
        }
    }, [sessionId, goals, transcriptSegmentsRef, language, addModelRoutingLog, addError, state?.assessments, liveSummaryRef]);

    // Decision owner: interval-based LLM assessment
    useEffect(() => {
        if (!isActive || !isDecisionOwner || !sessionId || goals.length === 0) return;

        const interval = setInterval(runAssessment, ASSESSMENT_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [isActive, isDecisionOwner, sessionId, goals.length, runAssessment]);

    // --- Non-owners: subscribe to goal_assessment events ---
    useEffect(() => {
        if (!sessionId || !isActive || isDecisionOwner || goals.length === 0) return;

        const channel = supabase
            .channel(`goal-tracking-${sessionId}-${Date.now()}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'session_events',
                filter: `session_id=eq.${sessionId}`,
            }, (payload) => {
                const row = payload.new as {
                    event_type: string;
                    payload: {
                        assessments: GoalAssessment[];
                        suggestedTopics: string[];
                        overallProgress: number;
                    } | null;
                };
                if (row.event_type === 'goal_assessment' && row.payload?.assessments) {
                    setState((prev) => {
                        if (!prev) return prev;
                        return {
                            ...prev,
                            assessments: row.payload!.assessments,
                            suggestedTopics: row.payload!.suggestedTopics ?? prev.suggestedTopics,
                            overallProgress: row.payload!.overallProgress ?? prev.overallProgress,
                            lastAssessedAt: Date.now(),
                        };
                    });
                }
            })
            .subscribe();

        channelRef.current = channel;

        // Fetch latest assessment on mount (for late joiners)
        (async () => {
            try {
                const { data } = await supabase
                    .from('session_events')
                    .select('payload')
                    .eq('session_id', sessionId)
                    .eq('event_type', 'goal_assessment')
                    .order('timestamp', { ascending: false })
                    .limit(1);

                if (data && data.length > 0) {
                    const entry = data[0] as {
                        payload: {
                            assessments: GoalAssessment[];
                            suggestedTopics: string[];
                            overallProgress: number;
                        } | null;
                    };
                    if (entry.payload?.assessments) {
                        setState((prev) => {
                            if (!prev) return prev;
                            return {
                                ...prev,
                                assessments: entry.payload!.assessments,
                                suggestedTopics: entry.payload!.suggestedTopics ?? [],
                                overallProgress: entry.payload!.overallProgress ?? 0,
                                lastAssessedAt: Date.now(),
                            };
                        });
                    }
                }
            } catch (err) {
                console.error('[GoalTracker] Failed to fetch initial assessment:', err);
            }
        })();

        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, [sessionId, isActive, isDecisionOwner, goals.length]);

    // --- Goal context for intervention enrichment ---
    const getGoalContext = useCallback((): GoalContext | null => {
        if (!state || state.goals.length === 0) return null;

        const covered: string[] = [];
        const uncovered: string[] = [];

        for (const assessment of state.assessments) {
            const goal = state.goals.find((g) => g.id === assessment.goalId);
            if (!goal) continue;

            if (assessment.status === 'covered' || assessment.status === 'partially_covered') {
                covered.push(goal.label);
            } else {
                uncovered.push(goal.label);
            }
        }

        if (uncovered.length === 0) return null;

        return {
            coveredGoals: covered,
            uncoveredGoals: uncovered,
            suggestedTopics: state.suggestedTopics,
        };
    }, [state]);

    return { goalTracking: state, getGoalContext };
}

// --- Utility ---

function deriveStatusFromHeat(heat: number): GoalCoverageStatus {
    if (heat >= 0.55) return 'partially_covered';
    if (heat >= 0.35) return 'mentioned';
    return 'not_started';
}
