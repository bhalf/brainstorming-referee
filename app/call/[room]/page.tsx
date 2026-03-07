'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useSession } from '@/lib/context/SessionContext';
import { decodeConfig, DEFAULT_CONFIG } from '@/lib/config';
import { Scenario, Intervention, TranscriptSegment } from '@/lib/types';
import { loadPersistedCache } from '@/lib/metrics/embeddingCache';
import { fetchWithRetry } from '@/lib/utils/fetchWithRetry';
import { segmentRowToApp, interventionRowToApp } from '@/lib/supabase/converters';
import { useSpeechSynthesis } from '@/lib/tts/useSpeechSynthesis';
import { useTranscriptionManager } from '@/lib/hooks/useTranscriptionManager';
import { useRealtimeSegments } from '@/lib/hooks/useRealtimeSegments';
import { useRealtimeInterventions } from '@/lib/hooks/useRealtimeInterventions';
import { useRealtimeMetrics } from '@/lib/hooks/useRealtimeMetrics';
import { useDecisionOwnership } from '@/lib/hooks/useDecisionOwnership';
import { useRealtimeEngineState } from '@/lib/hooks/useRealtimeEngineState';
import { useMetricsComputation } from '@/lib/hooks/useMetricsComputation';
import { useDecisionLoop } from '@/lib/hooks/useDecisionLoop';
import LiveKitRoom from '@/components/LiveKitRoom';
import OverlayPanel from '@/components/OverlayPanel';

export default function CallPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const {
    state, startSession, endSession, addError, addTranscriptSegment,
    addMetricSnapshot, addIntervention, updateIntervention, updateDecisionState,
    updateVoiceSettings, addModelRoutingLog, exportSessionLog,
  } = useSession();

  const [isPanelOpen, setIsPanelOpen] = useState(false);

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

  // --- TTS ---
  const {
    speak, isSpeaking, voices,
    isSupported: isTTSSupported,
    cancel: cancelSpeech,
  } = useSpeechSynthesis({
    defaultRate: state.voiceSettings.rate,
    defaultPitch: state.voiceSettings.pitch,
    defaultVolume: state.voiceSettings.volume,
    rateLimitSeconds: state.config.TTS_RATE_LIMIT_SECONDS,
    preferredLanguage: language,
  });

  const handleTestVoice = useCallback(() => {
    const testText = language.startsWith('de')
      ? 'Dies ist ein Test der Sprachausgabe. Die Stimme klingt jetzt klar und deutlich.'
      : 'This is a test of the voice output. The voice should sound clear and natural.';
    speak(testText);
  }, [speak, language]);

  const handleCancelVoice = useCallback(() => {
    cancelSpeech();
  }, [cancelSpeech]);

  // --- Local participant state (echo gate + mute tracking) ---
  const lastLocalSpeakingTimeRef = useRef<number | null>(null);
  const [isLocalMicMuted, setIsLocalMicMuted] = useState(false);

  const handleLocalSpeakingUpdate = useCallback(() => {
    lastLocalSpeakingTimeRef.current = Date.now();
  }, []);

  const handleLocalMicMuteChange = useCallback((muted: boolean) => {
    setIsLocalMicMuted(muted);
  }, []);

  // --- Segment Upload (Supabase) ---
  const transcriptSegmentsRef = useRef<TranscriptSegment[]>([]);
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    sessionIdRef.current = state.sessionId;
  }, [state.sessionId]);

  const uploadSegment = useCallback(async (segment: TranscriptSegment) => {
    const sid = sessionIdRef.current;
    if (!sid) return;
    await fetchWithRetry('/api/segments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sid, segment }),
      maxRetries: 3,
      silent: true,
    });
  }, []);

  // --- Transcription Manager (local mic only — remote segments arrive via Supabase Realtime) ---
  const transcription = useTranscriptionManager({
    language,
    isSessionActive: state.isActive && !isLocalMicMuted,
    displayName: isParticipant ? participantName : 'Researcher',
    lastLocalSpeakingTimeRef,
    addTranscriptSegment,
    addModelRoutingLog,
    addError,
    uploadSegment,
  });

  // Keep the shared transcriptSegmentsRef in sync with context (single source of truth)
  useEffect(() => {
    transcriptSegmentsRef.current = state.transcriptSegments;
  }, [state.transcriptSegments]);

  // --- Realtime Segments (Supabase) ---
  useRealtimeSegments({
    sessionId: state.sessionId,
    isActive: state.isActive,
    addTranscriptSegment,
    speakingTimeRef,
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

  // --- Realtime Metrics (all clients receive metric snapshots via Supabase Realtime) ---
  useRealtimeMetrics({
    sessionId: state.sessionId,
    isActive: state.isActive,
    addMetricSnapshot,
  });

  // --- Metrics Computation (only runs on the decision owner) ---
  const { currentMetrics, metricsHistory, currentMetricsRef, metricsHistoryRef, stateHistoryRef } = useMetricsComputation({
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
  });

  // --- Realtime Interventions (Supabase → all participants) ---
  useRealtimeInterventions({
    sessionId: state.sessionId,
    isActive: state.isActive,
    addIntervention,
    speak,
    voiceEnabled: state.voiceSettings.enabled,
    isTTSSupported,
  });

  // --- Initial data load: fetch historical segments + interventions for catch-up ---
  const loadInitialData = useCallback(async (sid: string) => {
    try {
      const [segRes, intRes] = await Promise.all([
        fetch(`/api/segments?sessionId=${sid}`),
        fetch(`/api/interventions?sessionId=${sid}`),
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
    } catch (e) {
      console.error('Failed to load initial data:', e);
    }
  }, [addTranscriptSegment, addIntervention]);

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
              config = data.config;
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
            // Use existing session's config if available
            sc = existing.scenario || sc;
            lang = existing.language || lang;
            if (existing.config && typeof existing.config === 'object' && Object.keys(existing.config).length > 0) {
              config = existing.config;
            }
          }
        } catch {
          // GET failed — will create new session below
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
                config,
                hostIdentity: 'Researcher',
              }),
            });
            if (res.ok) {
              const data = await res.json();
              sessionId = data.sessionId;
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

      // Whisper is default — disable only if server transcription is not available
      fetch('/api/model-routing')
        .then(r => r.json())
        .then(data => {
          if (!data.config?.transcription_server?.enabled) {
            transcription.setIsWhisperEnabled(false);
          }
        })
        .catch(() => {
          transcription.setIsWhisperEnabled(false);
        });
    };

    init();

    return () => {
      // End session in Supabase (best-effort on unmount)
      if (sessionIdRef.current) {
        fetchWithRetry('/api/session', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: sessionIdRef.current }),
          maxRetries: 1,
          silent: true,
        });
      }
      endSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomName]);

  // --- End Session ---
  const handleEndSession = useCallback(() => {
    if (sessionIdRef.current) {
      fetchWithRetry('/api/session', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sessionIdRef.current }),
        maxRetries: 2,
        silent: true,
      });
    }
    endSession();
    router.push('/');
  }, [endSession, router]);

  // Memoize sessionLog
  const sessionLog = useMemo(exportSessionLog, [exportSessionLog]);

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
      <header className="h-14 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="text-slate-400 hover:text-white transition-colors"
            title="Back to setup"
          >
            ←
          </button>
          <h1 className="text-white font-medium">
            Room: <span className="text-blue-400">{roomName}</span>
          </h1>
          {isParticipant && (
            <span className="text-xs bg-green-900/40 text-green-300 border border-green-700/50 px-2 py-0.5 rounded-full">
              {participantName}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4 text-sm">
          {/* Participant count */}
          <div className="text-slate-400">
            <span className="mr-1">👥</span>
            {participants.length + 1} participant{participants.length !== 0 ? 's' : ''}
          </div>

          {/* Connection status */}
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded ${isConnected ? 'bg-green-900/30 text-green-400' : 'bg-yellow-900/30 text-yellow-400'
            }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-400' : 'bg-yellow-400 animate-pulse'
              }`} />
            {isConnected ? 'Connected' : 'Connecting...'}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="h-[calc(100vh-3.5rem)] flex flex-col lg:flex-row">
        {/* Video Section */}
        <div className="flex-1 p-2 sm:p-4 min-w-0">
          <LiveKitRoom
            roomName={roomName}
            displayName={isParticipant ? participantName : 'Researcher'}
            onConnectionChange={setIsConnected}
            onParticipantsChange={setParticipants}
            onRemoteSpeakersChange={setRemoteSpeakers}
            onLocalSpeakingUpdate={handleLocalSpeakingUpdate}
            onLocalMicMuteChange={handleLocalMicMuteChange}
            onDisconnected={handleEndSession}
            speakingTimeRef={speakingTimeRef}
          />
        </div>

        {/* Backdrop for mobile/tablet */}
        {isPanelOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setIsPanelOpen(false)}
          />
        )}

        {/* Overlay Panel */}
        <div
          className={`fixed lg:relative top-0 right-0 h-full w-[min(100vw,400px)] lg:w-95 bg-slate-900 z-50 transition-transform duration-300 ease-in-out lg:translate-x-0 ${isPanelOpen ? 'translate-x-0' : 'translate-x-full'
            } p-2 sm:p-4 lg:pl-0`}
        >
          <button
            onClick={() => setIsPanelOpen(false)}
            className="absolute top-4 left-4 lg:hidden text-slate-400 hover:text-white z-10 min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Close panel"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

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
              isWhisperActive: transcription.isWhisperEnabled,
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
              onUpdateSettings: updateVoiceSettings,
              voices,
              isSpeaking,
              onTestVoice: handleTestVoice,
              onCancelVoice: handleCancelVoice,
            }}
            interventions={state.interventions}
            sessionLog={sessionLog}
            modelRoutingLog={state.modelRoutingLog}
          />
        </div>
      </div>
    </div>
  );
}
