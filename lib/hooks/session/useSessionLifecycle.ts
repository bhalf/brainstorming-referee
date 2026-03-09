'use client';

import { useEffect, useCallback, useRef, MutableRefObject } from 'react';
import { decodeConfig, DEFAULT_CONFIG } from '@/lib/config';
import { ExperimentConfig, Scenario, TranscriptSegment, Intervention, Idea, IdeaConnection } from '@/lib/types';
import { loadPersistedCache } from '@/lib/metrics/embeddingCache';
import { segmentRowToApp, interventionRowToApp, ideaRowToApp, connectionRowToApp } from '@/lib/supabase/converters';
import { buildExperimentMeta } from '@/lib/config/promptVersion';
import { loadModelRoutingFromStorage } from '@/lib/config/modelRouting';
import { apiGet, apiFireAndForget, apiPost } from '@/lib/services/apiClient';
import { createSession, getSession, joinSession } from '@/lib/services/sessionService';

// ---- Types ----

interface UseSessionLifecycleParams {
    roomName: string;
    scenario: Scenario;
    language: string;
    encodedConfig: string | null;
    isParticipant: boolean;
    participantName: string;
    sessionIdRef: MutableRefObject<string | null>;

    // Actions from SessionContext
    startSession: (roomName: string, scenario: Scenario, language: string, config: ExperimentConfig, sessionId?: string) => void;
    endSession: (sessionId?: string | null) => void;
    addTranscriptSegment: (segment: TranscriptSegment) => void;
    addIntervention: (intervention: Intervention) => void;
    addIdea: (idea: Idea) => void;
    addIdeaConnection: (connection: IdeaConnection) => void;
    updateVoiceSettings: (updates: Record<string, unknown>) => void;
    addError: (message: string, context?: string) => void;

    // Callbacks
    setParticipantName: (name: string) => void;
    setIsParticipantLoading: (loading: boolean) => void;
    setIsRealtimeEnabled: (enabled: boolean) => void;
}

// ---- Hook ----

export function useSessionLifecycle({
    roomName,
    scenario,
    language,
    encodedConfig,
    isParticipant,
    participantName,
    sessionIdRef,
    startSession,
    endSession,
    addTranscriptSegment,
    addIntervention,
    addIdea,
    addIdeaConnection,
    updateVoiceSettings,
    addError,
    setParticipantName,
    setIsParticipantLoading,
    setIsRealtimeEnabled,
}: UseSessionLifecycleParams) {

    // --- Load initial data (segments, interventions, ideas, connections) ---
    const loadInitialData = useCallback(async (sid: string) => {
        try {
            const [segRes, intRes, ideaRes, connRes] = await Promise.all([
                apiGet<{ segments: any[] }>(`/api/segments?sessionId=${sid}`),
                apiGet<{ interventions: any[] }>(`/api/interventions?sessionId=${sid}`),
                apiGet<{ ideas: any[] }>(`/api/ideas?sessionId=${sid}`),
                apiGet<{ connections: any[] }>(`/api/ideas/connections?sessionId=${sid}`),
            ]);

            if (Array.isArray(segRes?.segments)) {
                for (const row of segRes.segments) addTranscriptSegment(segmentRowToApp(row));
            }
            if (Array.isArray(intRes?.interventions)) {
                for (const row of intRes.interventions) addIntervention(interventionRowToApp(row));
            }
            if (Array.isArray(ideaRes?.ideas)) {
                for (const row of ideaRes.ideas) addIdea(ideaRowToApp(row));
            }
            if (Array.isArray(connRes?.connections)) {
                for (const row of connRes.connections) addIdeaConnection(connectionRowToApp(row));
            }
        } catch (e) {
            console.error('[SessionLifecycle] Failed to load initial data:', e);
        }
    }, [addTranscriptSegment, addIntervention, addIdea, addIdeaConnection]);

    // --- Main session initialization + cleanup effect ---
    useEffect(() => {
        const init = async () => {
            let sc = scenario;
            let lang = language;
            let config = DEFAULT_CONFIG;
            let sessionId: string | undefined;

            if (isParticipant) {
                try {
                    const data = await joinSession(roomName, participantName);
                    sessionId = data.sessionId;
                    sc = data.scenario || sc;
                    lang = data.language || lang;
                    if (data.config && typeof data.config === 'object' && Object.keys(data.config).length > 0) {
                        const { voiceSettings: joinedVoice, ...experimentConfig } = data.config as Record<string, unknown>;
                        if (Object.keys(experimentConfig).length > 0) {
                            config = experimentConfig as unknown as ExperimentConfig;
                        }
                        if (joinedVoice && typeof joinedVoice === 'object') {
                            updateVoiceSettings(joinedVoice as Record<string, unknown>);
                        }
                    }
                    if (data.resolvedName && data.resolvedName !== participantName) {
                        setParticipantName(data.resolvedName);
                    }
                } catch {
                    // Fallback to defaults
                }
                setIsParticipantLoading(false);
            } else {
                if (encodedConfig) {
                    const decoded = decodeConfig(encodedConfig);
                    if (decoded) {
                        config = decoded;
                    } else {
                        addError('Failed to decode config, using defaults', 'config');
                    }
                }

                // Check for existing active session first
                try {
                    const existing = await getSession(roomName);
                    sessionId = existing.sessionId;
                    console.log(`[SessionLifecycle] Resuming existing session ${sessionId}`);
                    sc = existing.scenario || sc;
                    lang = existing.language || lang;
                    if (existing.config && typeof existing.config === 'object' && Object.keys(existing.config).length > 0) {
                        config = existing.config;
                    }
                } catch {
                    console.log(`[SessionLifecycle] No active session for room "${roomName}" — creating new session`);
                }

                // Only create a new session if none exists
                if (!sessionId) {
                    try {
                        const data = await createSession({
                            roomName,
                            scenario: sc,
                            language: lang,
                            config: {
                                ...config,
                                _experimentMeta: buildExperimentMeta(
                                    loadModelRoutingFromStorage() ?? undefined
                                ),
                            } as unknown as ExperimentConfig,
                            hostIdentity: 'Researcher',
                        });
                        sessionId = data.sessionId;
                        console.log(`[SessionLifecycle] Created new session ${sessionId}`);
                    } catch (err: unknown) {
                        // Handle 409 Conflict — session already exists
                        if (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 409) {
                            const apiErr = err as { body?: { sessionId?: string } };
                            if (apiErr.body?.sessionId) {
                                sessionId = apiErr.body.sessionId;
                                console.log(`[SessionLifecycle] Reusing existing session ${sessionId} (409 conflict)`);
                            }
                        } else {
                            addError('Failed to create session in database', 'session');
                        }
                    }
                }
            }

            startSession(roomName, sc, lang, config, sessionId);
            loadPersistedCache();

            if (sessionId) {
                loadInitialData(sessionId);
            }

            // Register as participant
            if (sessionId) {
                const identity = isParticipant ? participantName : 'Researcher';
                apiFireAndForget('/api/session/participants', {
                    method: 'POST',
                    body: JSON.stringify({
                        sessionId,
                        identity,
                        displayName: identity,
                        role: isParticipant ? 'participant' : 'host',
                    }),
                });
            }

            // Pre-warm the transcription token endpoint — validates the API key is configured.
            // We no longer disable realtime on failure here; the hook handles retries itself.
            apiPost('/api/transcription/token', {}).catch(() => {
                console.warn('[SessionLifecycle] Transcription token pre-warm failed — will retry on first use');
            });
        };

        init();

        // --- beforeunload: reliable cleanup on tab close ---
        const handleBeforeUnload = () => {
            if (sessionIdRef.current) {
                const identity = isParticipant ? participantName : 'Researcher';
                navigator.sendBeacon(
                    '/api/session/participants',
                    new Blob(
                        [JSON.stringify({ sessionId: sessionIdRef.current, identity, action: 'leave' })],
                        { type: 'application/json' }
                    )
                );
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);

        // --- Heartbeat: 30s interval to prove we're alive ---
        const heartbeatInterval = setInterval(() => {
            if (sessionIdRef.current) {
                const identity = isParticipant ? participantName : 'Researcher';
                apiFireAndForget('/api/session/participants', {
                    method: 'PATCH',
                    body: JSON.stringify({ sessionId: sessionIdRef.current, identity }),
                });
            }
        }, 30_000);

        // --- visibilitychange: detect tab hidden / laptop lid close ---
        let departureTimer: ReturnType<typeof setTimeout> | null = null;
        const handleVisibilityChange = () => {
            if (document.hidden) {
                departureTimer = setTimeout(() => {
                    if (sessionIdRef.current) {
                        const identity = isParticipant ? participantName : 'Researcher';
                        navigator.sendBeacon(
                            '/api/session/participants',
                            new Blob(
                                [JSON.stringify({ sessionId: sessionIdRef.current, identity, action: 'leave' })],
                                { type: 'application/json' }
                            )
                        );
                    }
                }, 60_000);
            } else {
                if (departureTimer) {
                    clearTimeout(departureTimer);
                    departureTimer = null;
                }
                // Re-register as participant
                if (sessionIdRef.current) {
                    const identity = isParticipant ? participantName : 'Researcher';
                    apiFireAndForget('/api/session/participants', {
                        method: 'POST',
                        body: JSON.stringify({
                            sessionId: sessionIdRef.current,
                            identity,
                            displayName: identity,
                            role: isParticipant ? 'participant' : 'host',
                        }),
                    });
                }
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            clearInterval(heartbeatInterval);
            if (departureTimer) clearTimeout(departureTimer);

            // Leave participant (best-effort via sendBeacon)
            if (sessionIdRef.current) {
                const identity = isParticipant ? participantName : 'Researcher';
                navigator.sendBeacon(
                    '/api/session/participants',
                    new Blob(
                        [JSON.stringify({ sessionId: sessionIdRef.current, identity, action: 'leave' })],
                        { type: 'application/json' }
                    )
                );
            }
            endSession(sessionIdRef.current);
        };
        // This effect intentionally runs once on mount — roomName is the only lifecycle key.
        // All other values are accessed via stable refs to avoid re-initialization.
    }, [roomName]); // eslint-disable-line react-hooks/exhaustive-deps
}
