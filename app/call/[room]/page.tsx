'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useSession } from '@/lib/context/SessionContext';
import { decodeConfig, DEFAULT_CONFIG } from '@/lib/config';
import { Scenario, Intervention, TranscriptSegment, ExperimentConfig } from '@/lib/types';
import { loadPersistedCache } from '@/lib/metrics/embeddingCache';
import { segmentRowToApp, interventionRowToApp, ideaRowToApp, connectionRowToApp } from '@/lib/supabase/converters';
import { useCloudTTS } from '@/lib/tts/useCloudTTS';
import { useTranscriptionManager } from '@/lib/hooks/useTranscriptionManager';
import { useSegmentUpload } from '@/lib/hooks/session/useSegmentUpload';
import { useRealtimeSegments } from '@/lib/hooks/useRealtimeSegments';
import { useRealtimeInterventions } from '@/lib/hooks/useRealtimeInterventions';
import { useRealtimeMetrics } from '@/lib/hooks/useRealtimeMetrics';
import { useDecisionOwnership } from '@/lib/hooks/useDecisionOwnership';
import { useRealtimeEngineState } from '@/lib/hooks/useRealtimeEngineState';
import { useMetricsComputation } from '@/lib/hooks/useMetricsComputation';
import { useDecisionLoop } from '@/lib/hooks/useDecisionLoop';
import { useRealtimeVoiceSettings } from '@/lib/hooks/useRealtimeVoiceSettings';
import { useRealtimeIdeas } from '@/lib/hooks/useRealtimeIdeas';
import { useRealtimeConnections } from '@/lib/hooks/useRealtimeConnections';
import { useIdeaExtraction } from '@/lib/hooks/useIdeaExtraction';
import { SyncInterimPayload, SyncFinalSegmentPayload, SyncInterventionPayload } from '@/lib/hooks/useLiveKitSync';
import LiveKitRoom from '@/components/LiveKitRoom';
import OverlayPanel from '@/components/OverlayPanel';
import ResizableLayout from '@/components/ResizableLayout';
import IdeaBoard from '@/components/IdeaBoard';
import ReadinessCheck from '@/components/ReadinessCheck';
import type { SystemHealthProps } from '@/components/SystemHealthPanel';
import { buildExperimentMeta } from '@/lib/config/promptVersion';
import { loadModelRoutingFromStorage } from '@/lib/config/modelRouting';

export default function CallPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const {
    state, startSession, endSession, updateConfig, addError, addTranscriptSegment,
    addMetricSnapshot, addIntervention, updateIntervention, updateDecisionState,
    updateVoiceSettings, addIdea, updateIdea, removeIdea, addIdeaConnection, addModelRoutingLog, exportSessionLog,
  } = useSession();

  const [mobileView, setMobileView] = useState<'video' | 'ideas' | 'panel'>('video');
  const [isIdeaBoardCollapsed, setIsIdeaBoardCollapsed] = useState(false);

  // Layout mounting state
  const [isMounted, setIsMounted] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);

  // Extract URL parameters
  const roomName = decodeURIComponent(params.room as string);
  const role = (searchParams.get('role') || 'host') as 'host' | 'participant';
  const isParticipant = role === 'participant';
  const [participantName, setParticipantName] = useState(searchParams.get('name') || 'Participant');
  const scenario = (searchParams.get('scenario') as Scenario) || 'A';
  const language = searchParams.get('lang') || 'en-US';
  const encodedConfig = searchParams.get('config');

  // Loading gate for participants
  const [isParticipantLoading, setIsParticipantLoading] = useState(isParticipant);

  // Readiness check gate — shown before session starts
  const [isReadyChecked, setIsReadyChecked] = useState(false);

  // --- LiveKit State ---
  const [isConnected, setIsConnected] = useState(false);
  const [participants, setParticipants] = useState<{ id: string; displayName: string }[]>([]);
  const [remoteSpeakers, setRemoteSpeakers] = useState<{ id: string; displayName: string }[]>([]);
  const speakingTimeRef = useRef<Map<string, number>>(new Map());
  const participantCountRef = useRef<number>(1); // self

  // Keep participant count ref in sync with LiveKit state
  useEffect(() => {
    participantCountRef.current = participants.length + 1; // +1 for self
  }, [participants]);

  // --- TTS (OpenAI Cloud TTS) ---
  const cloudTTS = useCloudTTS({
    voice: (state.voiceSettings.voiceName as import('@/lib/tts/useCloudTTS').CloudTTSVoice) || 'nova',
    speed: state.voiceSettings.rate,
    volume: state.voiceSettings.volume,
    onError: (err) => {
      console.warn('Cloud TTS error:', err);
      addError(err, 'tts');
    },
  });

  const speak = useCallback((text: string): boolean => {
    return cloudTTS.speak(text);
  }, [cloudTTS]);

  const isSpeaking = cloudTTS.isSpeaking;
  const isTTSSupported = cloudTTS.isSupported;

  const cancelSpeech = useCallback(() => {
    cloudTTS.cancel();
  }, [cloudTTS]);

  const handleTestVoice = useCallback(() => {
    const testText = language.startsWith('de')
      ? 'Dies ist ein Test der Sprachausgabe. Die Stimme klingt jetzt klar und deutlich.'
      : 'This is a test of the voice output. The voice should sound clear and natural.';
    speak(testText);
  }, [speak, language]);

  const handleCancelVoice = useCallback(() => {
    cancelSpeech();
  }, [cancelSpeech]);

  const handleUpdateConfig = useCallback((key: keyof ExperimentConfig, value: number | boolean | [number, number, number, number]) => {
    updateConfig({ [key]: value } as Partial<ExperimentConfig>);
  }, [updateConfig]);

  const handleResetConfig = useCallback(() => {
    updateConfig(DEFAULT_CONFIG);
  }, [updateConfig]);

  // --- Local participant state (echo gate + mute tracking) ---
  const lastLocalSpeakingTimeRef = useRef<number | null>(null);
  const handleLocalSpeakingUpdate = useCallback(() => {
    lastLocalSpeakingTimeRef.current = Date.now();
  }, []);


  // --- WebRTC Sync (LiveKit DataChannel) ---
  const broadcastInterimRef = useRef<((text: string, lang?: string) => void) | null>(null);
  const broadcastFinalRef = useRef<((segment: TranscriptSegment) => void) | null>(null);
  const broadcastInterventionRef = useRef<((intervention: Intervention) => void) | null>(null);

  const [peerInterims, setPeerInterims] = useState<Map<string, string>>(new Map());

  const handleInterimTranscriptReceived = useCallback((payload: SyncInterimPayload) => {
    setPeerInterims(prev => {
      const next = new Map(prev);
      if (!payload.text) {
        next.delete(payload.speakerName);
      } else {
        next.set(payload.speakerName, payload.text);
      }
      return next;
    });
  }, []);

  const handleFinalSegmentReceived = useCallback((payload: SyncFinalSegmentPayload) => {
    addTranscriptSegment(payload.segment);
    // Clear their text from the fast interim overlay
    setPeerInterims(prev => {
      if (!prev.has(payload.segment.speaker)) return prev;
      const next = new Map(prev);
      next.delete(payload.segment.speaker);
      return next;
    });
  }, [addTranscriptSegment]);

  const handleInterventionReceived = useCallback((payload: SyncInterventionPayload) => {
    addIntervention(payload.intervention);
    if (state.voiceSettings.enabled && isTTSSupported && speak) {
      speak(payload.intervention.text);
    }
  }, [addIntervention, state.voiceSettings.enabled, isTTSSupported, speak]);

  // --- Segment Upload ---
  const transcriptSegmentsRef = useRef<TranscriptSegment[]>([]);
  const sessionIdRef = useRef<string | null>(null);
  const { uploadSegment } = useSegmentUpload({ sessionId: state.sessionId });

  // Keep sessionIdRef in sync for other callbacks
  useEffect(() => {
    sessionIdRef.current = state.sessionId;
  }, [state.sessionId]);

  // --- Transcription Manager (local mic only — remote segments arrive via Supabase Realtime) ---
  const transcription = useTranscriptionManager({
    language,
    isSessionActive: state.isActive,
    displayName: isParticipant ? participantName : 'Researcher',
    lastLocalSpeakingTimeRef,
    addTranscriptSegment,
    addError,
    uploadSegment,
    broadcastInterimTranscript: useCallback((text: string, lang?: string) => {
      broadcastInterimRef.current?.(text, lang);
    }, []),
    broadcastFinalTranscript: useCallback((segment: TranscriptSegment) => {
      broadcastFinalRef.current?.(segment);
    }, []),
  });

  const combinedInterim = useMemo(() => {
    return [
      transcription.interimTranscript,
      ...Array.from(peerInterims.values())
    ].filter(Boolean).join(' | ');
  }, [transcription.interimTranscript, peerInterims]);

  // Keep the shared transcriptSegmentsRef in sync with context (single source of truth)
  useEffect(() => {
    transcriptSegmentsRef.current = state.transcriptSegments;
  }, [state.transcriptSegments]);

  // --- Realtime Segments (Supabase) ---
  const { isSubscribed: realtimeSyncConnected } = useRealtimeSegments({
    sessionId: state.sessionId,
    isActive: state.isActive,
    addTranscriptSegment,
    speakingTimeRef,
    onError: addError,
  });

  // Keep interventions ref in sync for decision engine
  const interventionsRef = useRef<Intervention[]>([]);
  useEffect(() => {
    interventionsRef.current = state.interventions;
  }, [state.interventions]);

  // --- Decision Ownership (Supabase-based lock: one decision engine per session) ---
  const { isDecisionOwner } = useDecisionOwnership({
    sessionId: state.sessionId,
    isActive: state.isActive,
    isParticipant,
  });

  // --- Realtime Engine State (non-owners see phase transitions via Supabase Realtime) ---
  useRealtimeEngineState({
    sessionId: state.sessionId,
    isActive: state.isActive,
    isDecisionOwner,
    updateDecisionState,
  });

  // --- Realtime Voice Settings (host → participants via Supabase Realtime) ---
  const { persistVoiceSettings } = useRealtimeVoiceSettings({
    sessionId: state.sessionId,
    isActive: state.isActive,
    isHost: !isParticipant,
    updateVoiceSettings,
  });

  // --- Realtime Metrics (all clients receive metric snapshots via Supabase Realtime) ---
  useRealtimeMetrics({
    sessionId: state.sessionId,
    isActive: state.isActive,
    addMetricSnapshot,
  });

  // --- Metrics Computation (only runs on the decision owner) ---
  const { currentMetrics, metricsHistory, currentMetricsRef, metricsHistoryRef, stateHistoryRef, lastComputedAt, computationError } = useMetricsComputation({
    isActive: state.isActive,
    isDecisionOwner,
    sessionId: state.sessionId,
    config: state.config,
    transcriptSegmentsRef,
    speakingTimeRef,
    participantCountRef,
  });

  // --- Decision Engine (only runs on the decision owner) ---
  useDecisionLoop({
    isActive: state.isActive,
    isDecisionOwner,
    sessionId: state.sessionId,
    transcriptSegmentsRef,
    interventionsRef,
    metricsHistoryRef,
    currentMetricsRef,
    stateHistoryRef,
    decisionState: state.decisionState,
    config: state.config,
    voiceSettings: state.voiceSettings,
    scenario,
    language,
    speak,
    isTTSSupported,
    addIntervention,
    updateIntervention,
    addModelRoutingLog,
    addError,
    updateDecisionState,
    broadcastIntervention: useCallback((intervention: Intervention) => {
      broadcastInterventionRef.current?.(intervention);
    }, []),
  });

  // --- Realtime Interventions (Supabase → all participants) ---
  useRealtimeInterventions({
    sessionId: state.sessionId,
    isActive: state.isActive,
    isDecisionOwner,
    addIntervention,
    speak,
    voiceEnabled: state.voiceSettings.enabled,
    isTTSSupported,
  });

  // --- Realtime Ideas (Supabase → all participants) ---
  useRealtimeIdeas({
    sessionId: state.sessionId,
    isActive: state.isActive,
    addIdea,
    updateIdea,
  });

  // --- Realtime Idea Connections (Supabase → all participants) ---
  useRealtimeConnections({
    sessionId: state.sessionId,
    isActive: state.isActive,
    addConnection: addIdeaConnection,
  });

  // --- Idea Extraction (only runs on the decision owner) ---
  useIdeaExtraction({
    isActive: state.isActive,
    isDecisionOwner,
    sessionId: state.sessionId,
    transcriptSegmentsRef,
    ideas: state.ideas,
    language,
    addIdea,
    addIdeaConnection,
    addModelRoutingLog,
    addError,
  });

  // --- Initial data load: fetch historical segments + interventions + ideas for catch-up ---
  const loadInitialData = useCallback(async (sid: string) => {
    try {
      const [segRes, intRes, ideaRes, connRes] = await Promise.all([
        fetch(`/api/segments?sessionId=${sid}`),
        fetch(`/api/interventions?sessionId=${sid}`),
        fetch(`/api/ideas?sessionId=${sid}`),
        fetch(`/api/ideas/connections?sessionId=${sid}`),
      ]);

      if (segRes.ok) {
        const { segments } = await segRes.json();
        if (Array.isArray(segments)) {
          for (const row of segments) {
            addTranscriptSegment(segmentRowToApp(row));
          }
        }
      }

      if (intRes.ok) {
        const { interventions } = await intRes.json();
        if (Array.isArray(interventions)) {
          for (const row of interventions) {
            addIntervention(interventionRowToApp(row));
          }
        }
      }

      if (ideaRes.ok) {
        const { ideas } = await ideaRes.json();
        if (Array.isArray(ideas)) {
          for (const row of ideas) {
            addIdea(ideaRowToApp(row));
          }
        }
      }

      if (connRes.ok) {
        const { connections } = await connRes.json();
        if (Array.isArray(connections)) {
          for (const row of connections) {
            addIdeaConnection(connectionRowToApp(row));
          }
        }
      }
    } catch (e) {
      console.error('Failed to load initial data:', e);
    }
  }, [addTranscriptSegment, addIntervention, addIdea, addIdeaConnection]);

  // --- Session Initialization ---
  useEffect(() => {
    const init = async () => {
      let sc = scenario;
      let lang = language;
      let config = DEFAULT_CONFIG;
      let sessionId: string | undefined;

      if (isParticipant) {
        try {
          const res = await fetch('/api/session/join', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomName, participantName }),
          });
          if (res.ok) {
            const data = await res.json();
            sessionId = data.sessionId;
            sc = data.scenario || sc;
            lang = data.language || lang;
            if (data.config && typeof data.config === 'object' && Object.keys(data.config).length > 0) {
              // Extract voice settings from session config if present
              const { voiceSettings: joinedVoice, ...experimentConfig } = data.config;
              if (Object.keys(experimentConfig).length > 0) {
                config = experimentConfig;
              }
              if (joinedVoice && typeof joinedVoice === 'object') {
                updateVoiceSettings(joinedVoice);
              }
            }
            // Use server-resolved name (deduplicated if needed)
            if (data.resolvedName && data.resolvedName !== participantName) {
              setParticipantName(data.resolvedName);
            }
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

        // Check for existing active session first (prevents duplicate sessions on refresh)
        try {
          const getRes = await fetch(`/api/session?room=${encodeURIComponent(roomName)}`);
          if (getRes.ok) {
            const existing = await getRes.json();
            sessionId = existing.sessionId;
            console.log(`[Session] Resuming existing session ${sessionId} (started: ${existing.startedAt})`);
            // Use existing session's config if available
            sc = existing.scenario || sc;
            lang = existing.language || lang;
            if (existing.config && typeof existing.config === 'object' && Object.keys(existing.config).length > 0) {
              config = existing.config;
            }
          } else {
            console.log(`[Session] No active session found for room "${roomName}" (HTTP ${getRes.status}), will create new`);
          }
        } catch {
          // GET failed — will create new session below
          console.warn('[Session] GET /api/session failed, will create new session');
        }

        // Only create a new session if none exists
        if (!sessionId) {
          try {
            const res = await fetch('/api/session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                roomName,
                scenario: sc,
                language: lang,
                config: {
                  ...config,
                  _experimentMeta: buildExperimentMeta(
                    loadModelRoutingFromStorage() ?? undefined
                  ),
                },
                hostIdentity: 'Researcher',
              }),
            });
            if (res.ok) {
              const data = await res.json();
              sessionId = data.sessionId;
              console.log(`[Session] Created new session ${sessionId}`);
            } else if (res.status === 409) {
              // Session already exists (e.g. React strict mode double-mount) — reuse it
              const data = await res.json().catch(() => ({}));
              if (data.sessionId) {
                sessionId = data.sessionId;
                console.log(`[Session] Reusing existing session ${sessionId} (409 conflict)`);
              } else {
                console.warn('[Session] 409 conflict but no sessionId in response');
              }
            } else {
              const errData = await res.json().catch(() => ({}));
              console.warn(`[Session] POST /api/session failed (HTTP ${res.status}):`, errData);
            }
          } catch {
            addError('Failed to create session in database', 'session');
          }
        }
      }

      startSession(roomName, sc, lang, config, sessionId);
      loadPersistedCache();

      // Load historical data for catch-up (segments + interventions)
      if (sessionId) {
        loadInitialData(sessionId);
      }

      // Register as participant in the session
      if (sessionId) {
        const identity = isParticipant ? participantName : 'Researcher';
        fetch('/api/session/participants', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            identity,
            displayName: identity,
            role: isParticipant ? 'participant' : 'host',
          }),
        }).catch(err => console.warn('[Session] Failed to register participant:', err));
      }

      // OpenAI Realtime is default — fallback to Web Speech API if token fetch fails
      fetch('/api/transcription/token', { method: 'POST' })
        .then(res => {
          if (!res.ok) transcription.setIsRealtimeEnabled(false);
        })
        .catch(() => {
          transcription.setIsRealtimeEnabled(false);
        });
    };

    init();

    // --- beforeunload: reliable cleanup on tab close ---
    const handleBeforeUnload = () => {
      if (sessionIdRef.current) {
        const identity = isParticipant ? participantName : 'Researcher';
        // sendBeacon only sends POST — use action: 'leave' to trigger leave logic
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
        fetch('/api/session/participants', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: sessionIdRef.current, identity }),
        }).catch(() => { }); // best-effort
      }
    }, 30_000);

    // --- visibilitychange: detect tab hidden / laptop lid close ---
    // If the tab is hidden for 60s, assume the user has left
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
        // Tab became visible again — cancel departure
        if (departureTimer) {
          clearTimeout(departureTimer);
          departureTimer = null;
        }
        // Re-register as participant (in case we were marked as left by stale cleanup)
        if (sessionIdRef.current) {
          const identity = isParticipant ? participantName : 'Researcher';
          fetch('/api/session/participants', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: sessionIdRef.current,
              identity,
              displayName: identity,
              role: isParticipant ? 'participant' : 'host',
            }),
          }).catch(() => { });
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(heartbeatInterval);
      if (departureTimer) clearTimeout(departureTimer);

      // Leave participant (best-effort via sendBeacon — reliable during unmount)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomName]);

  // Layout media query setup
  useEffect(() => {
    setIsMounted(true);
    const mql = window.matchMedia('(min-width: 1024px)');
    setIsDesktop(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // --- End Session (user-initiated only) ---
  const handleEndSession = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (sid) {
      const identity = isParticipant ? participantName : 'Researcher';
      // Await participant removal before navigating (with 2s safety timeout)
      try {
        await Promise.race([
          fetch('/api/session/participants', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: sid, identity }),
          }),
          new Promise(resolve => setTimeout(resolve, 2000)),
        ]);
      } catch {
        // Best effort — navigate anyway
      }
    }
    endSession(sid);
    router.push('/');
  }, [endSession, router, isParticipant, participantName]);

  // --- LiveKit Disconnect handler (tolerant — does NOT end session) ---
  const handleLiveKitDisconnect = useCallback(() => {
    console.warn('[LiveKit] Disconnected — session stays active, LiveKit will auto-reconnect');
  }, []);

  // --- System Health ---
  const healthProps = useMemo((): SystemHealthProps => ({
    transcription: {
      isConnected: transcription.realtimeConnected,
      isRecording: transcription.realtimeRecording,
      error: transcription.transcriptionError,
    },
    liveKit: { isConnected },
    realtimeSync: { isConnected: realtimeSyncConnected },
    metrics: {
      lastComputedAt,
      error: computationError,
      isDecisionOwner,
    },
    engine: {
      phase: state.decisionState.phase || 'MONITORING',
      isDecisionOwner,
    },
    tts: { isSupported: isTTSSupported },
    errors: state.errors,
  }), [
    transcription.realtimeConnected, transcription.realtimeRecording, transcription.transcriptionError,
    isConnected, realtimeSyncConnected, lastComputedAt, computationError,
    isDecisionOwner, state.decisionState.phase, isTTSSupported, state.errors,
  ]);

  // Memoize sessionLog
  const sessionLog = useMemo(exportSessionLog, [exportSessionLog]);

  // --- Readiness Check Gate ---
  if (!isReadyChecked) {
    return (
      <ReadinessCheck
        roomName={roomName}
        displayName={isParticipant ? participantName : 'Researcher'}
        language={language}
        onReady={() => setIsReadyChecked(true)}
        onBack={() => router.push('/')}
      />
    );
  }

  // --- Loading State ---
  if (isParticipantLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 text-sm">Joining session<span className="text-blue-400"> {roomName}</span>...</p>
        </div>
      </div>
    );
  }

  // --- Render ---
  return (
    <div className="h-screen w-screen bg-slate-900 overflow-hidden">
      {/* Top Bar */}
      <header className="h-12 sm:h-14 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between px-3 sm:px-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="text-slate-400 hover:text-white transition-colors"
            title="Back to setup"
          >
            ←
          </button>
          <h1 className="text-white font-medium text-sm sm:text-base truncate max-w-[140px] sm:max-w-none">
            Room: <span className="text-blue-400">{roomName}</span>
          </h1>
          {isParticipant ? (
            <span className="text-xs bg-green-900/40 text-green-300 border border-green-700/50 px-2 py-0.5 rounded-full">
              {participantName}
            </span>
          ) : (
            <span className="text-xs bg-blue-900/40 text-blue-300 border border-blue-700/50 px-2 py-0.5 rounded-full">
              Researcher
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-4 text-sm">
          {/* Participant count */}
          <div className="text-slate-400">
            <span className="mr-1">👥</span>
            <span className="hidden sm:inline">{participants.length + 1} participant{participants.length !== 0 ? 's' : ''}</span>
            <span className="sm:hidden">{participants.length + 1}</span>
          </div>

          {/* Connection status */}
          <div className={`hidden sm:flex items-center gap-1.5 px-2 py-1 rounded ${isConnected ? 'bg-green-900/30 text-green-400' : 'bg-yellow-900/30 text-yellow-400'
            }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-400' : 'bg-yellow-400 animate-pulse'
              }`} />
            {isConnected ? 'Connected' : 'Connecting...'}
          </div>
          {/* Mobile-only connection dot */}
          <span className={`sm:hidden w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-yellow-400 animate-pulse'}`} />
        </div>
      </header>

      {/* Main Content */}
      <div className="h-[calc(100vh-3rem)] sm:h-[calc(100vh-3.5rem)] flex flex-col lg:flex-row">

        {isMounted && isDesktop && (
          <ResizableLayout
            topLeft={
              <LiveKitRoom
                roomName={roomName}
                displayName={isParticipant ? participantName : 'Researcher'}
                onConnectionChange={setIsConnected}
                onParticipantsChange={setParticipants}
                onRemoteSpeakersChange={setRemoteSpeakers}
                onLocalSpeakingUpdate={handleLocalSpeakingUpdate}
                onDisconnected={handleLiveKitDisconnect}
                speakingTimeRef={speakingTimeRef}
                broadcastInterimRef={broadcastInterimRef}
                broadcastFinalRef={broadcastFinalRef}
                broadcastInterventionRef={broadcastInterventionRef}
                onInterimTranscriptReceived={handleInterimTranscriptReceived}
                onFinalSegmentReceived={handleFinalSegmentReceived}
                onInterventionReceived={handleInterventionReceived}
              />
            }
            bottomLeft={
              <IdeaBoard
                ideas={state.ideas.filter(i => !i.isDeleted)}
                connections={state.ideaConnections}
                sessionId={state.sessionId}
                onAddIdea={addIdea}
                onUpdateIdea={updateIdea}
                onRemoveIdea={removeIdea}
                displayName={isParticipant ? participantName : 'Researcher'}
                isCollapsed={isIdeaBoardCollapsed}
                onToggleCollapse={() => setIsIdeaBoardCollapsed(prev => !prev)}
              />
            }
            right={
              <OverlayPanel
                scenario={state.scenario}
                isSessionActive={state.isActive}
                onEndSession={handleEndSession}
                language={language}
                roomName={roomName}
                transcript={{
                  segments: state.transcriptSegments,
                  interimTranscript: combinedInterim,
                  isTranscribing: transcription.isTranscribing,
                  isTranscriptionSupported: transcription.isTranscriptionSupported,
                  onToggleTranscription: transcription.toggleTranscription,
                  onAddSimulatedSegment: transcription.handleAddSimulatedSegment,
                  transcriptionError: transcription.transcriptionError,
                  speakingParticipants: remoteSpeakers,
                  isWhisperActive: transcription.isRealtimeEnabled,
                }}
                metrics={{
                  currentMetrics: isDecisionOwner
                    ? currentMetrics
                    : state.metricSnapshots[state.metricSnapshots.length - 1] ?? null,
                  metricsHistory: isDecisionOwner
                    ? metricsHistory
                    : state.metricSnapshots,
                  config: state.config,
                  decisionState: state.decisionState,
                }}
                voice={{
                  settings: state.voiceSettings,
                  onUpdateSettings: (updates) => {
                    updateVoiceSettings(updates);
                    if (!isParticipant) {
                      persistVoiceSettings({ ...state.voiceSettings, ...updates });
                    }
                  },
                  isSpeaking,
                  onTestVoice: handleTestVoice,
                  onCancelVoice: handleCancelVoice,
                }}
                interventions={state.interventions}
                sessionLog={sessionLog}
                modelRoutingLog={state.modelRoutingLog}
                onUpdateConfig={handleUpdateConfig}
                onResetConfig={handleResetConfig}
                health={healthProps}
              />
            }
          />
        )}

        {isMounted && !isDesktop && (
          <>
            {/* Mobile Content Area — switched by bottom tab bar */}
            <div className="flex-1 w-full min-w-0 min-h-0 overflow-hidden">
              {/* Video Tab */}
              <div className={`h-full p-1 ${mobileView === 'video' ? 'block' : 'hidden'}`}>
                <LiveKitRoom
                  roomName={roomName}
                  displayName={isParticipant ? participantName : 'Researcher'}
                  onConnectionChange={setIsConnected}
                  onParticipantsChange={setParticipants}
                  onRemoteSpeakersChange={setRemoteSpeakers}
                  onLocalSpeakingUpdate={handleLocalSpeakingUpdate}
                  onDisconnected={handleLiveKitDisconnect}
                  speakingTimeRef={speakingTimeRef}
                  broadcastInterimRef={broadcastInterimRef}
                  broadcastFinalRef={broadcastFinalRef}
                  broadcastInterventionRef={broadcastInterventionRef}
                  onInterimTranscriptReceived={handleInterimTranscriptReceived}
                  onFinalSegmentReceived={handleFinalSegmentReceived}
                  onInterventionReceived={handleInterventionReceived}
                />
              </div>

              {/* Ideas Tab */}
              <div className={`h-full p-1 ${mobileView === 'ideas' ? 'block' : 'hidden'}`}>
                <IdeaBoard
                  ideas={state.ideas.filter(i => !i.isDeleted)}
                  connections={state.ideaConnections}
                  sessionId={state.sessionId}
                  onAddIdea={addIdea}
                  onUpdateIdea={updateIdea}
                  onRemoveIdea={removeIdea}
                  displayName={isParticipant ? participantName : 'Researcher'}
                  isCollapsed={false}
                  onToggleCollapse={() => { }}
                />
              </div>

              {/* Panel Tab */}
              <div className={`h-full ${mobileView === 'panel' ? 'block' : 'hidden'}`}>
                <OverlayPanel
                  scenario={state.scenario}
                  isSessionActive={state.isActive}
                  onEndSession={handleEndSession}
                  language={language}
                  roomName={roomName}
                  transcript={{
                    segments: state.transcriptSegments,
                    interimTranscript: transcription.interimTranscript,
                    isTranscribing: transcription.isTranscribing,
                    isTranscriptionSupported: transcription.isTranscriptionSupported,
                    onToggleTranscription: transcription.toggleTranscription,
                    onAddSimulatedSegment: transcription.handleAddSimulatedSegment,
                    transcriptionError: transcription.transcriptionError,
                    speakingParticipants: remoteSpeakers,
                    isWhisperActive: transcription.isRealtimeEnabled,
                  }}
                  metrics={{
                    currentMetrics: isDecisionOwner
                      ? currentMetrics
                      : state.metricSnapshots[state.metricSnapshots.length - 1] ?? null,
                    metricsHistory: isDecisionOwner
                      ? metricsHistory
                      : state.metricSnapshots,
                    config: state.config,
                    decisionState: state.decisionState,
                  }}
                  voice={{
                    settings: state.voiceSettings,
                    onUpdateSettings: (updates) => {
                      updateVoiceSettings(updates);
                      if (!isParticipant) {
                        persistVoiceSettings({ ...state.voiceSettings, ...updates });
                      }
                    },
                    isSpeaking,
                    onTestVoice: handleTestVoice,
                    onCancelVoice: handleCancelVoice,
                  }}
                  interventions={state.interventions}
                  sessionLog={sessionLog}
                  modelRoutingLog={state.modelRoutingLog}
                  onUpdateConfig={handleUpdateConfig}
                  onResetConfig={handleResetConfig}
                  health={healthProps}
                />
              </div>
            </div>

            {/* Mobile Bottom Tab Bar */}
            <nav className="bottom-tab-bar shrink-0 bg-slate-800/95 backdrop-blur-sm border-t border-slate-700 flex items-stretch lg:hidden">
              {[
                { id: 'video' as const, icon: '📹', label: 'Video' },
                { id: 'ideas' as const, icon: '💡', label: 'Ideas' },
                { id: 'panel' as const, icon: '📊', label: 'Panel' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setMobileView(tab.id)}
                  className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[52px] transition-colors ${mobileView === tab.id
                    ? 'text-blue-400 bg-blue-900/20'
                    : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                  <span className="text-lg">{tab.icon}</span>
                  <span className="text-[10px] font-medium">{tab.label}</span>
                </button>
              ))}
            </nav>
          </>
        )}
      </div>
    </div>
  );
}
