'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useSession } from '@/lib/context/SessionContext';
import { DEFAULT_CONFIG } from '@/lib/config';
import { Scenario, Intervention, TranscriptSegment, ExperimentConfig, SpeakingTimeDelta } from '@/lib/types';
import { useTTSManager } from '@/lib/hooks/session/useTTSManager';
import { useTranscriptionManager } from '@/lib/hooks/useTranscriptionManager';
import { useSegmentUpload } from '@/lib/hooks/session/useSegmentUpload';
import { useLatestRef } from '@/lib/hooks/useLatestRef';
import { usePeerSync } from '@/lib/hooks/session/usePeerSync';
import { useSessionLifecycle } from '@/lib/hooks/session/useSessionLifecycle';
import { useSessionOrchestration } from '@/lib/hooks/session/useSessionOrchestration';
import { apiFireAndForget } from '@/lib/services/apiClient';
import { logSessionLifecycle } from '@/lib/services/eventService';
import type { InterimEntry } from '@/components/TranscriptFeed';
import LiveKitRoom from '@/components/LiveKitRoom';
import ReadinessCheck from '@/components/ReadinessCheck';
import type { SystemHealthProps } from '@/components/SystemHealthPanel';

// Dynamic imports — these heavy components are behind isMounted gates
const DesktopTabLayout = dynamic(() => import('@/components/DesktopTabLayout'));
const OverlayPanel = dynamic(() => import('@/components/OverlayPanel'));
const IdeaBoard = dynamic(() => import('@/components/IdeaBoard'));

/**
 * Main brainstorming session page.
 *
 * Orchestrates all session concerns: LiveKit video conferencing, real-time
 * transcription (OpenAI Realtime API), the decision engine (metrics,
 * interventions, idea extraction), and peer synchronization via LiveKit
 * DataChannel and Supabase Realtime.
 *
 * URL parameters:
 * - `[room]` — LiveKit room name (path segment).
 * - `role` — 'host' (default) or 'participant'.
 * - `name` — Participant display name.
 * - `scenario` — Experiment scenario ('baseline' | 'A' | 'B').
 * - `lang` — BCP-47 locale for transcription and prompts.
 * - `config` — Base64-encoded experiment config overrides.
 *
 * Renders a responsive layout: desktop uses a tabbed sidebar (`DesktopTabLayout`),
 * mobile uses a bottom tab bar switching between video, ideas, and panel views.
 */
export default function CallPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const {
    state, startSession, endSession, updateConfig, addError, addTranscriptSegment,
    addMetricSnapshot, addIntervention, updateIntervention, updateDecisionState,
    updateVoiceSettings, addIdea, updateIdea, removeIdea, addIdeaConnection,
    removeIdeaConnection, updateIdeaConnection, addModelRoutingLog, exportSessionLog,
  } = useSession();

  const [mobileView, setMobileView] = useState<'video' | 'ideas' | 'panel'>('video');

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
  const [, setRemoteSpeakers] = useState<{ id: string; displayName: string }[]>([]);
  const speakingTimeRef = useRef<SpeakingTimeDelta[]>([]);
  const participantCountRef = useRef<number>(1); // self

  // Keep participant count ref in sync with LiveKit state
  // and clean up speaking time data for departed participants
  const prevParticipantIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    participantCountRef.current = participants.length + 1; // +1 for self

    const currentIds = new Set(participants.map(p => p.displayName));
    const previousIds = prevParticipantIdsRef.current;

    // Detect departed participants and remove their speaking time deltas
    for (const id of previousIds) {
      if (!currentIds.has(id)) {
        speakingTimeRef.current = speakingTimeRef.current.filter(d => d.speaker !== id);
        console.log(`[Participant] ${id} left — removed from speaking time deltas`);
      }
    }

    prevParticipantIdsRef.current = currentIds;
  }, [participants]);

  // --- TTS (OpenAI Cloud TTS) ---
  const {
    speak,
    isSpeaking,
    isTTSSupported,
    handleTestVoice,
    handleCancelVoice,
  } = useTTSManager({
    voiceName: state.voiceSettings.voiceName,
    rate: state.voiceSettings.rate,
    volume: state.voiceSettings.volume,
    language,
    sessionId: state.sessionId,
    addError,
  });

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

  // Track mic mute to pause OpenAI transcription when muted
  const [isLocalMicMuted, setIsLocalMicMuted] = useState(false);
  const handleLocalMicMuteChange = useCallback((muted: boolean) => {
    setIsLocalMicMuted(muted);
  }, []);


  // --- WebRTC Sync (LiveKit DataChannel) ---
  const broadcastInterimRef = useRef<((text: string, lang?: string) => void) | null>(null);
  const broadcastFinalRef = useRef<((segment: TranscriptSegment) => void) | null>(null);
  const broadcastInterventionRef = useRef<((intervention: Intervention) => void) | null>(null);

  // Shared dedup set: prevents double-TTS when the same intervention arrives
  // via both LiveKit DataChannel (fast, ~50ms) and Supabase Realtime (slower, ~200ms).
  // The first delivery path wins; the second is silently ignored.
  const spokenInterventionIdsRef = useRef<Set<string>>(new Set());

  const {
    peerInterims,
    handleInterimTranscriptReceived,
    handleFinalSegmentReceived,
    handleInterventionReceived,
  } = usePeerSync({
    addTranscriptSegment,
    addIntervention,
    voiceEnabled: state.voiceSettings.enabled,
    displayMode: state.voiceSettings.displayMode ?? 'both',
    isTTSSupported,
    speak,
    spokenInterventionIdsRef,
  });

  // --- Segment Upload ---
  const transcriptSegmentsRef = useLatestRef(state.transcriptSegments);
  const sessionIdRef = useLatestRef(state.sessionId);
  const { uploadSegment } = useSegmentUpload({ sessionId: state.sessionId });

  // --- Transcription Manager (local mic only — remote segments arrive via Supabase Realtime) ---
  const transcription = useTranscriptionManager({
    language: state.language || language,
    isSessionActive: state.isActive,
    isMuted: isLocalMicMuted,
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

  // Build per-speaker interim entries for TranscriptFeed
  const interimEntries = useMemo((): InterimEntry[] => {
    const entries: InterimEntry[] = [];
    // Local user's interim
    const localDisplayName = isParticipant ? participantName : 'Researcher';
    if (transcription.interimTranscript) {
      entries.push({ speaker: localDisplayName, text: transcription.interimTranscript });
    }
    // Remote peer interims
    for (const entry of peerInterims.values()) {
      entries.push({ speaker: entry.speakerName, text: entry.text });
    }
    return entries;
  }, [transcription.interimTranscript, peerInterims, isParticipant, participantName]);

  // Keep the shared transcriptSegmentsRef in sync with context (single source of truth)

  // Stable broadcast callback — extracted to avoid re-renders in useDecisionLoop
  const handleBroadcastIntervention = useCallback((intervention: Intervention) => {
    broadcastInterventionRef.current?.(intervention);
  }, []);

  // --- Session Orchestration (realtime subscriptions, metrics, decision engine, ideas, summary) ---
  const {
    isDecisionOwner,
    currentMetrics,
    metricsHistory,
    currentMetricsRef,
    metricsHistoryRef,
    stateHistoryRef,
    lastComputedAt,
    computationError,
    realtimeSyncConnected,
    persistVoiceSettings,
    liveSummary,
  } = useSessionOrchestration({
    isActive: state.isActive,
    sessionId: state.sessionId,
    scenario,
    language,
    isParticipant,
    addTranscriptSegment,
    addIntervention,
    updateIntervention,
    addMetricSnapshot,
    addIdea,
    updateIdea,
    addIdeaConnection,
    removeIdeaConnection,
    updateIdeaConnection,
    addModelRoutingLog,
    addError,
    updateDecisionState,
    updateVoiceSettings,
    config: state.config,
    decisionState: state.decisionState,
    voiceSettings: state.voiceSettings,
    interventions: state.interventions,
    ideas: state.ideas,
    ideaConnections: state.ideaConnections,
    transcriptSegmentsRef,
    speakingTimeRef,
    participantCountRef,
    speak,
    isTTSSupported,
    broadcastIntervention: handleBroadcastIntervention,
    spokenInterventionIdsRef,
  });

  // --- Session Initialization & Cleanup ---
  useSessionLifecycle({
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
    setIsRealtimeEnabled: transcription.setIsRealtimeEnabled,
  });

  // Layout media query setup
  useEffect(() => {
    setIsMounted(true);
    const mql = window.matchMedia('(min-width: 1024px)');
    setIsDesktop(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  const [isEndingSession, setIsEndingSession] = useState(false);

  // --- End Session (user-initiated only) ---
  const handleEndSession = useCallback(async () => {
    if (isEndingSession) return;
    setIsEndingSession(true);

    const sid = sessionIdRef.current;
    if (sid) {
      const identity = isParticipant ? participantName : 'Researcher';
      logSessionLifecycle(sid, 'session_end', identity);
      // Await participant removal before navigating (with 2s safety timeout)
      try {
        await Promise.race([
          apiFireAndForget('/api/session/participants', {
            method: 'DELETE',
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
  }, [endSession, router, isParticipant, participantName, isEndingSession, sessionIdRef]);

  // --- LiveKit Disconnect handler (user clicked Leave or connection lost) ---
  const handleLiveKitDisconnect = useCallback(() => {
    console.warn('[LiveKit] Disconnected — cleaning up and navigating away');
    handleEndSession();
  }, [handleEndSession]);

  // --- System Health ---
  const healthProps = useMemo((): SystemHealthProps => ({
    transcription: {
      isConnected: transcription.realtimeConnected,
      isRecording: transcription.realtimeRecording,
      error: transcription.transcriptionError,
      isMuted: isLocalMicMuted,
      isRealtimeEnabled: transcription.isRealtimeEnabled,
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

  // --- Shared Props (Deduplication) ---
  const activeIdeas = useMemo(() => state.ideas.filter(i => !i.isDeleted), [state.ideas]);

  const liveKitProps = useMemo(() => ({
    roomName,
    displayName: isParticipant ? participantName : 'Researcher',
    onConnectionChange: setIsConnected,
    onParticipantsChange: setParticipants,
    onRemoteSpeakersChange: setRemoteSpeakers,
    onLocalSpeakingUpdate: handleLocalSpeakingUpdate,
    onLocalMicMuteChange: handleLocalMicMuteChange,
    onDisconnected: handleLiveKitDisconnect,
    speakingTimeRef,
    broadcastInterimRef,
    broadcastFinalRef,
    broadcastInterventionRef,
    onInterimTranscriptReceived: handleInterimTranscriptReceived,
    onFinalSegmentReceived: handleFinalSegmentReceived,
    onInterventionReceived: handleInterventionReceived,
  }), [
    roomName, isParticipant, participantName, handleLocalSpeakingUpdate,
    handleLocalMicMuteChange, handleLiveKitDisconnect, handleInterimTranscriptReceived,
    handleFinalSegmentReceived, handleInterventionReceived
  ]);

  const ideaBoardBaseProps = useMemo(() => ({
    ideas: activeIdeas,
    connections: state.ideaConnections,
    sessionId: state.sessionId,
    onAddIdea: addIdea,
    onUpdateIdea: updateIdea,
    onRemoveIdea: removeIdea,
    displayName: isParticipant ? participantName : 'Researcher',
    roomName,
  }), [activeIdeas, state.ideaConnections, state.sessionId, addIdea, updateIdea, removeIdea, isParticipant, participantName, roomName]);

  const handleUpdateSettings = useCallback((updates: Record<string, unknown>) => {
    updateVoiceSettings(updates);
    if (!isParticipant) {
      persistVoiceSettings({ ...state.voiceSettings, ...updates });
    }
  }, [state.voiceSettings, updateVoiceSettings, isParticipant, persistVoiceSettings]);

  const overlayPanelProps = useMemo(() => ({
    scenario: state.scenario,
    isSessionActive: state.isActive,
    onEndSession: handleEndSession,
    language,
    roomName,
    transcript: {
      segments: state.transcriptSegments,
      interimEntries,
      isTranscribing: transcription.isTranscribing,
      isTranscriptionSupported: transcription.isTranscriptionSupported,
      onToggleTranscription: transcription.toggleTranscription,
      onAddSimulatedSegment: transcription.handleAddSimulatedSegment,
      transcriptionError: transcription.transcriptionError,
      isWhisperActive: transcription.isRealtimeEnabled,
    },
    metrics: {
      currentMetrics: isDecisionOwner
        ? currentMetrics
        : state.metricSnapshots[state.metricSnapshots.length - 1] ?? null,
      metricsHistory: isDecisionOwner
        ? metricsHistory
        : state.metricSnapshots,
      config: state.config,
      decisionState: state.decisionState,
    },
    voice: {
      settings: state.voiceSettings,
      onUpdateSettings: handleUpdateSettings,
      isSpeaking,
      onTestVoice: handleTestVoice,
      onCancelVoice: handleCancelVoice,
    },
    interventions: state.interventions,
    sessionLog,
    modelRoutingLog: state.modelRoutingLog,
    onUpdateConfig: handleUpdateConfig,
    onResetConfig: handleResetConfig,
    health: healthProps,
    liveSummary,
    isParticipant,
  }), [
    state.scenario, state.isActive, handleEndSession, language, roomName,
    state.transcriptSegments, interimEntries, transcription.isTranscribing, transcription.isTranscriptionSupported,
    transcription.toggleTranscription, transcription.handleAddSimulatedSegment, transcription.transcriptionError,
    transcription.isRealtimeEnabled, isDecisionOwner, currentMetrics, state.metricSnapshots, metricsHistory,
    state.config, state.decisionState, state.voiceSettings, handleUpdateSettings,
    isSpeaking, handleTestVoice, handleCancelVoice, state.interventions, sessionLog, state.modelRoutingLog,
    handleUpdateConfig, handleResetConfig, healthProps, liveSummary, isParticipant
  ]);

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
      <div className="h-[calc(100vh-3rem)] sm:h-[calc(100vh-3.5rem)] flex flex-col overflow-hidden">

        {isMounted && isDesktop && (
          <div className="flex-1 min-h-0 overflow-hidden">
            <DesktopTabLayout
              liveKitSlot={<LiveKitRoom {...liveKitProps} />}
              ideaBoardSlot={
                <IdeaBoard
                  {...ideaBoardBaseProps}
                  isCollapsed={false}
                  onToggleCollapse={() => { }}
                />
              }
              sessionId={state.sessionId}
              scenario={overlayPanelProps.scenario}
              isSessionActive={overlayPanelProps.isSessionActive}
              onEndSession={overlayPanelProps.onEndSession}
              transcript={overlayPanelProps.transcript}
              metrics={overlayPanelProps.metrics}
              voice={overlayPanelProps.voice}
              interventions={overlayPanelProps.interventions}
              sessionLog={overlayPanelProps.sessionLog}
              modelRoutingLog={overlayPanelProps.modelRoutingLog}
              onUpdateConfig={overlayPanelProps.onUpdateConfig}
              onResetConfig={overlayPanelProps.onResetConfig}
              health={overlayPanelProps.health}
              roomName={roomName}
              liveSummary={liveSummary}
              isParticipant={isParticipant}
            />
          </div>
        )}

        {isMounted && !isDesktop && (
          <>
            {/* Mobile Content Area — switched by bottom tab bar */}
            <div className="flex-1 w-full min-w-0 min-h-0 overflow-hidden">
              {/* Video Tab */}
              <div className={`h-full p-1 ${mobileView === 'video' ? 'block' : 'hidden'}`}>
                <LiveKitRoom {...liveKitProps} />
              </div>

              {/* Ideas Tab */}
              <div className={`h-full p-1 ${mobileView === 'ideas' ? 'block' : 'hidden'}`}>
                <IdeaBoard
                  {...ideaBoardBaseProps}
                  isCollapsed={false}
                  onToggleCollapse={() => { }}
                />
              </div>

              {/* Panel Tab */}
              <div className={`h-full ${mobileView === 'panel' ? 'block' : 'hidden'}`}>
                <OverlayPanel {...overlayPanelProps} />
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

