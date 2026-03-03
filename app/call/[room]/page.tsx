'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useSession } from '@/lib/context/SessionContext';
import { decodeConfig, DEFAULT_CONFIG } from '@/lib/config';
import { Scenario, TranscriptSegment, MetricSnapshot, Intervention, InterventionTrigger } from '@/lib/types';
import { useSpeechRecognition } from '@/lib/transcription/useSpeechRecognition';
import { useAudioRecorder, AudioChunk } from '@/lib/transcription/useAudioRecorder';
import { useTabAudioCapture, TabAudioChunk } from '@/lib/transcription/useTabAudioCapture';
import { computeMetricsAsync } from '@/lib/metrics/computeMetrics';
import { loadPersistedCache } from '@/lib/metrics/embeddingCache';
import { evaluateDecision, generateInterventionContext, resetInterventionCountIfNeeded } from '@/lib/decision/decisionEngine';
import { useSpeechSynthesis } from '@/lib/tts/useSpeechSynthesis';
import { useDebounce } from '@/lib/hooks/useDebounce';
import JitsiEmbed from '@/components/JitsiEmbed';
import OverlayPanel from '@/components/OverlayPanel';

export default function CallPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { state, startSession, endSession, addError, addTranscriptSegment, addMetricSnapshot, addIntervention, updateDecisionState, updateVoiceSettings, addModelRoutingLog, exportSessionLog } = useSession();

  const [isJitsiReady, setIsJitsiReady] = useState(false);
  const [participants, setParticipants] = useState<Array<{ id: string; displayName: string }>>([]);
  const [remoteSpeakers, setRemoteSpeakers] = useState<Array<{ id: string; displayName: string }>>([]);
  const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegment[]>([]);
  const [currentMetrics, setCurrentMetrics] = useState<MetricSnapshot | null>(null);
  const [metricsHistory, setMetricsHistory] = useState<MetricSnapshot[]>([]);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const metricsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const decisionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingInterventionRef = useRef(false);
  const isComputingMetricsRef = useRef(false);
  const interventionCountResetTimeRef = useRef(Date.now());
  // Use refs to avoid stale closures in the decision engine interval
  const transcriptSegmentsRef = useRef<TranscriptSegment[]>([]);
  const interventionsRef = useRef<Intervention[]>([]);
  const metricsHistoryRef = useRef<MetricSnapshot[]>([]);
  // Speaker diarization: track dominant speaker from Jitsi
  const dominantSpeakerRef = useRef<{ id: string; displayName: string } | null>(null);
  const participantsRef = useRef<Array<{ id: string; displayName: string }>>([]);
  const lastRemoteSpeakerTimeRef = useRef<number>(0);
  // Whisper transcription state
  const [isWhisperEnabled, setIsWhisperEnabled] = useState(false);
  // Audio-level-based speaking time tracking (seconds per participant)
  const speakingTimeRef = useRef<Map<string, number>>(new Map());
  const lastAudioLevelUpdateRef = useRef<Map<string, number>>(new Map());
  const SPEAKING_THRESHOLD = 0.05; // Audio level > 0.05 = speaking

  // Keep refs in sync with state
  useEffect(() => {
    transcriptSegmentsRef.current = transcriptSegments;
  }, [transcriptSegments]);

  useEffect(() => {
    interventionsRef.current = state.interventions;
  }, [state.interventions]);

  useEffect(() => {
    metricsHistoryRef.current = metricsHistory;
  }, [metricsHistory]);

  // POLL for active speakers (UI Indicator) - checks audio levels for "is speaking" status
  useEffect(() => {
     const interval = setInterval(() => {
        const now = Date.now();
        const active: Array<{ id: string, displayName: string }> = [];

        lastAudioLevelUpdateRef.current.forEach((lastTime, id) => {
           if (now - lastTime < 1000) {
              const p = participantsRef.current.find(p => p.id === id);
              if (p) active.push(p);
           }
        });

        setRemoteSpeakers(prev => {
           if (prev.length !== active.length) return active;
           const prevIds = new Set(prev.map(p => p.id));
           if (active.some(p => !prevIds.has(p.id))) return active;
           return prev;
        });
     }, 500);
     return () => clearInterval(interval);
  }, []);

  // Extract parameters
  const roomName = decodeURIComponent(params.room as string);
  const scenario = (searchParams.get('scenario') as Scenario) || 'A';
  const language = searchParams.get('lang') || 'en-US';
  const encodedConfig = searchParams.get('config');

  // Text-to-Speech with language awareness
  const {
    speak,
    isSpeaking,
    voices,
    isSupported: isTTSSupported,
    cancel: cancelSpeech,
  } = useSpeechSynthesis({
    defaultRate: state.voiceSettings.rate,
    defaultPitch: state.voiceSettings.pitch,
    defaultVolume: state.voiceSettings.volume,
    rateLimitSeconds: state.config.TTS_RATE_LIMIT_SECONDS,
    preferredLanguage: language,
  });

  // Voice test and cancel handlers
  const handleTestVoice = useCallback(() => {
    const testText = language.startsWith('de')
      ? 'Dies ist ein Test der Sprachausgabe. Die Stimme klingt jetzt klar und deutlich.'
      : 'This is a test of the voice output. The voice should sound clear and natural.';
    speak(testText);
  }, [speak, language]);

  const handleCancelVoice = useCallback(() => {
    cancelSpeech();
  }, [cancelSpeech]);

  // -----------------------------------------------------------------------
  // Stable refs for the decision engine.
  // Reading from refs inside the interval prevents the interval from being
  // torn down and recreated on every state change, fixing the interval
  // instability bug (V1).
  // -----------------------------------------------------------------------
  const decisionStateRef = useRef(state.decisionState);
  const configRef = useRef(state.config);
  const voiceSettingsRef = useRef(state.voiceSettings);
  const scenarioRef = useRef<Scenario>(scenario);
  const languageRef = useRef(language);
  const currentMetricsRef = useRef<MetricSnapshot | null>(null);
  const speakRef = useRef(speak);
  const isTTSSupportedRef = useRef(isTTSSupported);

  // Keep decision-engine refs in sync
  useEffect(() => { decisionStateRef.current = state.decisionState; }, [state.decisionState]);
  useEffect(() => { configRef.current = state.config; }, [state.config]);
  useEffect(() => { voiceSettingsRef.current = state.voiceSettings; }, [state.voiceSettings]);
  useEffect(() => { scenarioRef.current = scenario; }, [scenario]);
  useEffect(() => { languageRef.current = language; }, [language]);
  useEffect(() => { currentMetricsRef.current = currentMetrics; }, [currentMetrics]);
  useEffect(() => { speakRef.current = speak; }, [speak]);
  useEffect(() => { isTTSSupportedRef.current = isTTSSupported; }, [isTTSSupported]);

  // SYNC: Upload function with debouncing for performance
  const uploadSegmentImmediate = useCallback(async (segment: TranscriptSegment) => {
    try {
      if (!state.roomName) return;
      await fetch('/api/sync/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: state.roomName, segment })
      });
    } catch (e) {
      console.error("Upload error:", e);
    }
  }, [state.roomName]);

  // Debounced version for performance (500ms delay)
  const uploadSegment = useDebounce(uploadSegmentImmediate, 500);

  // SYNC: Poll for remote transcript segments (optimized to 2000ms)
  useEffect(() => {
    if (!state.isActive) return;

    const interval = setInterval(async () => {
      try {
        const maxTimestamp = transcriptSegmentsRef.current.reduce((max, seg) => Math.max(max, seg.timestamp), 0);

        const res = await fetch(`/api/sync/room?room=${state.roomName}&since=${maxTimestamp}`);
        if (res.ok) {
          const data = await res.json();
          if (data.segments && data.segments.length > 0) {
             const newSegments = data.segments as TranscriptSegment[];
             const uniqueNew = newSegments.filter(ns =>
               !transcriptSegmentsRef.current.some(existing => existing.id === ns.id)
             );

             if (uniqueNew.length > 0) {
               setTranscriptSegments(prev => {
                 const actualNew = uniqueNew.filter(ns => !prev.some(p => p.id === ns.id));
                 if (actualNew.length === 0) return prev;
                 return [...prev, ...actualNew].sort((a, b) => a.timestamp - b.timestamp);
               });

               uniqueNew.forEach(s => addTranscriptSegment(s));

               uniqueNew.forEach(seg => {
                 if (seg.speaker !== 'You') {
                   const estimatedSeconds = seg.text.length / 12.5;
                   const current = speakingTimeRef.current.get(seg.speaker) || 0;
                   speakingTimeRef.current.set(seg.speaker, current + estimatedSeconds);
                 }
               });
             }
          }
        }
      } catch (e) {
        console.error("Sync error:", e);
      }
    }, 2000); // Optimized: 2000ms instead of 1000ms

    return () => clearInterval(interval);
  }, [state.isActive, state.roomName, addTranscriptSegment]);

  // Speech recognition
  const {
    isSupported: isTranscriptionSupported,
    isListening: isTranscribing,
    interimTranscript,
    toggle: toggleTranscription,
    error: transcriptionError,
  } = useSpeechRecognition({
    language,
    continuous: true,
    interimResults: true,
    onResult: useCallback((result: { id: string; text: string; timestamp: number; isFinal: boolean }) => {
      const segment: TranscriptSegment = {
        id: result.id,
        speaker: 'You',
        text: result.text,
        timestamp: result.timestamp,
        isFinal: result.isFinal,
        language,
      };

      // Track local user speaking time via text-length proxy (V5 fix).
      // Converts characters to estimated seconds at 150 wpm (~12.5 chars/sec)
      // so local user's time is in the same unit (seconds) as audio-level data
      // for remote participants.
      if (result.isFinal && result.text.trim().length > 0) {
        const estimatedSeconds = result.text.trim().length / 12.5;
        const current = speakingTimeRef.current.get('You') || 0;
        speakingTimeRef.current.set('You', current + estimatedSeconds);
      }

      setTranscriptSegments((prev) => [...prev, segment]);
      addTranscriptSegment(segment);

      // Upload to server for sync
      if (result.isFinal) {
        uploadSegment(segment);
      }
    }, [language, addTranscriptSegment, uploadSegment]),
    onError: useCallback((error: string) => {
      addError(error, 'speech-recognition');
    }, [addError]),
  });

  // Whisper transcription: send audio chunks to server
  const handleAudioChunk = useCallback(async (chunk: AudioChunk) => {
    try {
      const formData = new FormData();
      formData.append('audio', chunk.blob, 'audio.webm');
      formData.append('language', language);

      const response = await fetch('/api/transcription', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        if (errData.logEntry) addModelRoutingLog(errData.logEntry);
        console.warn('Whisper transcription failed:', errData.error);
        return;
      }

      const data = await response.json();

      // Log the model routing entry
      if (data.logEntry) addModelRoutingLog(data.logEntry);

      // Create transcript segments from Whisper response
      if (data.text && data.text.trim().length > 0) {
        const whisperSegments: TranscriptSegment[] = (data.segments && data.segments.length > 0)
          ? data.segments.map((seg: { start: number; end: number; text: string }, idx: number) => ({
            id: `whisper-${chunk.timestamp}-${idx}`,
            speaker: 'You',
            text: seg.text.trim(),
            timestamp: chunk.timestamp + (seg.start * 1000),
            isFinal: true,
            language,
          }))
          : [{
            id: `whisper-${chunk.timestamp}-0`,
            speaker: 'You',
            text: data.text.trim(),
            timestamp: chunk.timestamp,
            isFinal: true,
            language,
          }];

        for (const segment of whisperSegments) {
          if (segment.text.length > 0) {
            setTranscriptSegments((prev) => [...prev, segment]);
            addTranscriptSegment(segment);
          }
        }
      }
    } catch (error) {
      console.error('Whisper chunk processing error:', error);
    }
  }, [language, addTranscriptSegment, addModelRoutingLog]);

  // Audio recorder for Whisper
  const {
    isRecording: isWhisperRecording,
    isSupported: isWhisperSupported,
    start: startWhisperRecording,
    stop: stopWhisperRecording,
    error: whisperError,
  } = useAudioRecorder({
    onAudioChunk: handleAudioChunk,
    chunkIntervalMs: 5000,
  });

  useEffect(() => {
    if (whisperError) console.error("Whisper recording error:", whisperError);
  }, [whisperError]);

  // Tab audio capture: transcribe remote participants via getDisplayMedia
  const handleTabAudioChunk = useCallback(async (chunk: TabAudioChunk) => {
    try {
      const formData = new FormData();
      formData.append('audio', chunk.blob, 'tab-audio.webm');
      formData.append('language', language);

      const response = await fetch('/api/transcription', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        if (errData.logEntry) addModelRoutingLog(errData.logEntry);
        console.warn('Tab audio transcription failed:', errData.error);
        return;
      }

      const data = await response.json();
      if (data.logEntry) addModelRoutingLog(data.logEntry);

      if (data.text && data.text.trim().length > 0) {
        // Attribute to the dominant speaker at time of recording
        const speaker = dominantSpeakerRef.current?.displayName || 'Remote Participant';

        const segments: TranscriptSegment[] = (data.segments && data.segments.length > 0)
          ? data.segments.map((seg: { start: number; end: number; text: string }, idx: number) => ({
            id: `tab-${chunk.timestamp}-${idx}`,
            speaker,
            text: seg.text.trim(),
            timestamp: chunk.timestamp + (seg.start * 1000),
            isFinal: true,
            language,
          }))
          : [{
            id: `tab-${chunk.timestamp}-0`,
            speaker,
            text: data.text.trim(),
            timestamp: chunk.timestamp,
            isFinal: true,
            language,
          }];

        for (const segment of segments) {
          if (segment.text.length > 0) {
            setTranscriptSegments((prev) => [...prev, segment]);
            addTranscriptSegment(segment);
          }
        }
      }
    } catch (error) {
      console.error('Tab audio chunk processing error:', error);
    }
  }, [language, addTranscriptSegment, addModelRoutingLog]);

  const {
    isCapturing: isTabAudioCapturing,
    isSupported: isTabAudioSupported,
    start: startTabAudioCapture,
    stop: stopTabAudioCapture,
    error: tabAudioError,
    setTTSSuppressed,
  } = useTabAudioCapture({
    onAudioChunk: handleTabAudioChunk,
    chunkIntervalMs: 5000,
  });

  useEffect(() => {
    if (tabAudioError) console.error("Tab audio capture error:", tabAudioError);
  }, [tabAudioError]);

  // Sync TTS suppression: suppress tab audio capture while TTS is speaking
  useEffect(() => {
    setTTSSuppressed(isSpeaking);
  }, [isSpeaking, setTTSSuppressed]);

  // Simulation fallback: manually add transcript segments
  const handleAddSimulatedSegment = useCallback((text: string) => {
    const segment: TranscriptSegment = {
      id: `sim-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      speaker: 'Simulated',
      text,
      timestamp: Date.now(),
      isFinal: true,
      language,
    };
    setTranscriptSegments((prev) => [...prev, segment]);
    addTranscriptSegment(segment);
  }, [language, addTranscriptSegment]);

  // Initialize session on mount
  useEffect(() => {
    let config = DEFAULT_CONFIG;

    if (encodedConfig) {
      const decoded = decodeConfig(encodedConfig);
      if (decoded) {
        config = decoded;
      } else {
        addError('Failed to decode config, using defaults', 'config');
      }
    }

    startSession(roomName, scenario, language, config);

    // Load persisted embedding cache (no sessionId — must match the generic key
    // used by persistCache() inside getOrFetchEmbeddings so data round-trips correctly)
    loadPersistedCache();

    // Check if Whisper is enabled via model routing
    fetch('/api/model-routing')
      .then(r => r.json())
      .then(data => {
        if (data.config?.transcription_server?.enabled) {
          setIsWhisperEnabled(true);
        }
      })
      .catch(() => { });

    // Cleanup on unmount
    return () => {
      endSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomName, scenario, language, encodedConfig]);

  // Auto-start/stop Whisper recording when session is active
  useEffect(() => {
    if (state.isActive && isWhisperEnabled && isWhisperSupported && !isWhisperRecording) {
      startWhisperRecording();
    }
    if (!state.isActive && isWhisperRecording) {
      stopWhisperRecording();
    }
  }, [state.isActive, isWhisperEnabled, isWhisperSupported, isWhisperRecording, startWhisperRecording, stopWhisperRecording]);

  // Metrics computation interval (async for embeddings).
  // Uses isComputingMetricsRef (not a closure-local bool) so the concurrent guard
  // survives if the effect is ever recreated. transcriptSegments.length is intentionally
  // NOT in the dep array — it was causing the interval to tear down and recreate on every
  // transcript addition, resetting the guard each time. Length is checked via ref instead.
  useEffect(() => {
    if (!state.isActive) return;

    metricsIntervalRef.current = setInterval(async () => {
      if (isComputingMetricsRef.current) return;
      const segments = transcriptSegmentsRef.current;
      if (segments.length === 0) return;
      isComputingMetricsRef.current = true;

      try {
        const metrics = await computeMetricsAsync(
          segments,
          state.config,
          Date.now(),
          speakingTimeRef.current
        );
        setCurrentMetrics(metrics);
        setMetricsHistory((prev) => [...prev.slice(-50), metrics]);
        addMetricSnapshot(metrics);
      } catch (error) {
        console.error('Metrics computation error:', error);
      } finally {
        isComputingMetricsRef.current = false;
      }
    }, state.config.ANALYZE_EVERY_MS);

    return () => {
      if (metricsIntervalRef.current) {
        clearInterval(metricsIntervalRef.current);
      }
    };
  }, [state.isActive, state.config, addMetricSnapshot]);

  // -----------------------------------------------------------------------
  // Decision Engine — stable interval via refs (V1 fix).
  //
  // All mutable values (decisionState, config, currentMetrics, etc.) are
  // read from refs inside the interval handler instead of being listed as
  // useEffect dependencies. This prevents the interval from being torn down
  // and recreated every 5 seconds (on metrics update) or more frequently
  // (on every stateUpdateOnly dispatch), restoring the intended 2-second
  // cadence.
  //
  // Refs are kept in sync by the lightweight single-purpose effects above.
  // The interval is only recreated when the session becomes active/inactive.
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!state.isActive) return;

    const runDecisionEngine = async () => {
      const metrics = currentMetricsRef.current;
      const currentScenario = scenarioRef.current;

      if (!metrics || currentScenario === 'baseline') return;
      if (isProcessingInterventionRef.current) return;

      const now = Date.now();
      const currentDecisionState = decisionStateRef.current;
      const config = configRef.current;
      const lang = languageRef.current;

      // Periodically reset the intervention count (every 10 minutes)
      const resetResult = resetInterventionCountIfNeeded(
        currentDecisionState,
        interventionCountResetTimeRef.current,
        now
      );
      if (resetResult.newResetTime !== interventionCountResetTimeRef.current) {
        interventionCountResetTimeRef.current = resetResult.newResetTime;
        updateDecisionState({ interventionCount: 0 });
        decisionStateRef.current = { ...currentDecisionState, interventionCount: 0 };
      }

      const decision = evaluateDecision(
        metrics,
        metricsHistoryRef.current,
        decisionStateRef.current,
        config,
        currentScenario,
        now
      );

      // Safe state updates (e.g. persistence timer) — apply immediately via ref too
      // so the next tick reads the updated value without waiting for a React render.
      if (decision.stateUpdateOnly) {
        updateDecisionState(decision.stateUpdateOnly);
        decisionStateRef.current = { ...decisionStateRef.current, ...decision.stateUpdateOnly };
      }

      // Trigger intervention if the engine says so
      if (decision.shouldIntervene && decision.interventionType && decision.trigger) {
        isProcessingInterventionRef.current = true;

        try {
          const context = generateInterventionContext(decision.trigger, metrics);

          // Get last 10 final transcript segments as excerpt
          const segments = transcriptSegmentsRef.current;
          const transcriptExcerpt = segments
            .filter(s => s.isFinal)
            .slice(-10)
            .map(s => `${s.speaker}: ${s.text}`);

          // Get previous interventions for ally context
          const prevInterventions = interventionsRef.current
            .slice(-3)
            .map(i => i.text);

          const endpoint = decision.interventionType === 'moderator'
            ? '/api/intervention/moderator'
            : '/api/intervention/ally';

          // 12-second timeout for API request
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 12000);

          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              trigger: decision.trigger,
              speakerDistribution: context.speakerDistribution,
              language: lang,
              participationImbalance: metrics.participationImbalance,
              repetitionRate: metrics.semanticRepetitionRate,
              stagnationDuration: metrics.stagnationDuration,
              transcriptExcerpt,
              scenario: currentScenario,
              currentState: decisionStateRef.current.currentState,
              previousInterventions: prevInterventions,
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            const data = await response.json();

            // API succeeded: commit the intended state machine transition.
            // Also update the ref immediately so the next tick reads fresh state.
            const newDecisionState = decision.nextState;
            updateDecisionState(newDecisionState);
            decisionStateRef.current = newDecisionState;

            // Create intervention record
            const intervention: Intervention = {
              id: `int-${Date.now()}`,
              timestamp: Date.now(),
              type: decision.interventionType,
              trigger: decision.trigger as InterventionTrigger,
              text: data.text,
              spoken: false,
              metricsAtTrigger: metrics,
            };

            // Speak if TTS is enabled
            if (voiceSettingsRef.current.enabled && isTTSSupportedRef.current) {
              intervention.spoken = speakRef.current(data.text);
            }

            addIntervention(intervention);

            if (data.logEntry) {
              addModelRoutingLog(data.logEntry);
            }
          } else {
            // 503 = API key missing or service unavailable — surface clearly
            if (response.status === 503) {
              addError('LLM unavailable — check OPENAI_API_KEY configuration', 'intervention');
            } else {
              addError(`Intervention API error: ${response.status}`, 'intervention');
            }
            // Do NOT update state. The engine will retry on next tick.
          }
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            addError('Intervention request timed out after 12s', 'intervention');
          } else {
            addError('Failed to generate intervention', 'intervention');
          }
        } finally {
          isProcessingInterventionRef.current = false;
        }
      }
    };

    // Stable 2-second interval — only recreated when isActive changes
    decisionIntervalRef.current = setInterval(runDecisionEngine, 2000);

    return () => {
      if (decisionIntervalRef.current) {
        clearInterval(decisionIntervalRef.current);
      }
    };
  }, [state.isActive, addIntervention, addModelRoutingLog, addError, updateDecisionState]);

  // Jitsi event handlers
  const handleVideoConferenceJoined = useCallback(() => {
    setIsJitsiReady(true);
  }, []);

  const handleVideoConferenceLeft = useCallback(() => {
    setIsJitsiReady(false);
  }, []);

  const handleParticipantJoined = useCallback((participant: { id: string; displayName: string }) => {
    setParticipants((prev) => [...prev, participant]);
    participantsRef.current = [...participantsRef.current, participant];
  }, []);

  const handleParticipantLeft = useCallback((participant: { id: string }) => {
    setParticipants((prev) => prev.filter((p) => p.id !== participant.id));
    participantsRef.current = participantsRef.current.filter((p) => p.id !== participant.id);
  }, []);

  // Speaker diarization: track who is currently speaking via Jitsi
  const handleDominantSpeakerChanged = useCallback((participantId: string) => {
    const participant = participantsRef.current.find((p) => p.id === participantId);
    const displayName = participant?.displayName || `Speaker-${participantId.slice(0, 4)}`;

    dominantSpeakerRef.current = { id: participantId, displayName };

    // Create a speaking activity segment for remote participants
    // Throttle: only create one every 5 seconds per speaker change
    const now = Date.now();
    if (now - lastRemoteSpeakerTimeRef.current > 5000) {
      lastRemoteSpeakerTimeRef.current = now;

      const activitySegment: TranscriptSegment = {
        id: `speaker-${now}-${Math.random().toString(36).substr(2, 6)}`,
        speaker: displayName,
        text: '[speaking]',
        timestamp: now,
        isFinal: true,
        language,
      };

      setTranscriptSegments((prev) => [...prev, activitySegment]);
      addTranscriptSegment(activitySegment);
    }
  }, [language, addTranscriptSegment]);

  // Audio level tracking for accurate speaking time distribution (remote participants only).
  // The local user is deliberately excluded: Jitsi fires audioLevelChanged for every
  // participant including the local researcher, but their speaking time is already tracked
  // via speech recognition under 'You'. Including them here would create a 'Speaker-XXXX'
  // entry (since the local ID is not in participantsRef) → they would appear as two
  // separate people in the Gini coefficient, splitting their time and suppressing imbalance
  // detection when the researcher dominates the conversation.
  const handleAudioLevelChanged = useCallback((participantId: string, audioLevel: number) => {
    const now = Date.now();
    const lastUpdate = lastAudioLevelUpdateRef.current.get(participantId);

    if (audioLevel > SPEAKING_THRESHOLD && lastUpdate) {
      const deltaSeconds = (now - lastUpdate) / 1000;
      // Cap at 2 seconds to avoid huge jumps from missed events
      if (deltaSeconds < 2) {
        const participant = participantsRef.current.find(p => p.id === participantId);
        // Skip if not a known remote participant (= local user, tracked via speech recognition)
        if (participant) {
          const current = speakingTimeRef.current.get(participant.displayName) || 0;
          speakingTimeRef.current.set(participant.displayName, current + deltaSeconds);
        }
      }
    }

    lastAudioLevelUpdateRef.current.set(participantId, now);
  }, []);

  // End session handler
  const handleEndSession = useCallback(() => {
    endSession();
    router.push('/');
  }, [endSession, router]);

  // Memoize sessionLog to avoid creating a new object reference on every render (P4 fix).
  // exportSessionLog is stable when state hasn't changed, so this prevents unnecessary
  // re-renders of OverlayPanel when unrelated local state changes.
  const sessionLog = useMemo(exportSessionLog, [exportSessionLog]);

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
        </div>

        <div className="flex items-center gap-4 text-sm">
          {/* Tab Audio Capture button */}
          {isJitsiReady && isTabAudioSupported && (
            <button
              onClick={() => isTabAudioCapturing ? stopTabAudioCapture() : startTabAudioCapture()}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${isTabAudioCapturing
                ? 'bg-purple-900/40 text-purple-300 hover:bg-purple-900/60'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              title={isTabAudioCapturing ? 'Stop tab audio transcription' : 'Share tab audio for full transcription of all participants'}
            >
              <span>{isTabAudioCapturing ? '🔴' : '🎙'}</span>
              {isTabAudioCapturing ? 'Capturing All' : 'Transcribe All'}
            </button>
          )}

          {/* Participant count */}
          <div className="text-slate-400">
            <span className="mr-1">👥</span>
            {participants.length + 1} participant{participants.length !== 0 ? 's' : ''}
          </div>

          {/* Connection status */}
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded ${isJitsiReady ? 'bg-green-900/30 text-green-400' : 'bg-yellow-900/30 text-yellow-400'
            }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isJitsiReady ? 'bg-green-400' : 'bg-yellow-400 animate-pulse'
              }`} />
            {isJitsiReady ? 'Connected' : 'Connecting...'}
          </div>
        </div>
      </header>

      {/* Main Content - Responsive Layout */}
      <div className="h-[calc(100vh-3.5rem)] flex flex-col lg:flex-row">
        {/* Video Section */}
        <div className="flex-1 p-2 sm:p-4 min-w-0">
          <JitsiEmbed
            roomName={roomName}
            displayName="Researcher"
            onVideoConferenceJoined={handleVideoConferenceJoined}
            onVideoConferenceLeft={handleVideoConferenceLeft}
            onParticipantJoined={handleParticipantJoined}
            onParticipantLeft={handleParticipantLeft}
            onDominantSpeakerChanged={handleDominantSpeakerChanged}
            onAudioLevelChanged={handleAudioLevelChanged}
          />
        </div>

        {/* Backdrop for mobile/tablet */}
        {isPanelOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setIsPanelOpen(false)}
          />
        )}

        {/* Overlay Panel - Collapsible on mobile/tablet */}
        <div
          className={`fixed lg:relative top-0 right-0 h-full w-[min(100vw,400px)] lg:w-95 bg-slate-900 z-50 transition-transform duration-300 ease-in-out lg:translate-x-0 ${
            isPanelOpen ? 'translate-x-0' : 'translate-x-full'
          } p-2 sm:p-4 lg:pl-0`}
        >
          {/* Close button for mobile/tablet */}
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
            transcriptSegments={transcriptSegments}
            interimTranscript={interimTranscript}
            isTranscribing={isTranscribing}
            isTranscriptionSupported={isTranscriptionSupported}
            onToggleTranscription={toggleTranscription}
            onAddSimulatedSegment={handleAddSimulatedSegment}
            transcriptionError={transcriptionError}
            currentMetrics={currentMetrics}
            metricsHistory={metricsHistory}
            config={state.config}
            decisionState={state.decisionState}
            interventions={state.interventions}
            voiceSettings={state.voiceSettings}
            onUpdateVoiceSettings={updateVoiceSettings}
            voices={voices}
            isSpeaking={isSpeaking}
            onTestVoice={handleTestVoice}
            onCancelVoice={handleCancelVoice}
            language={language}
            sessionLog={sessionLog}
            modelRoutingLog={state.modelRoutingLog}
            roomName={roomName}
            speakingParticipants={remoteSpeakers}
          />
        </div>
      </div>
    </div>
  );
}
