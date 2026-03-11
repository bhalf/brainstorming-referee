'use client';

import React, { Component, useEffect, useState, useRef, MutableRefObject } from 'react';
import {
  LiveKitRoom as LKRoom,
  GridLayout,
  ParticipantTile,
  ControlBar,
  useTracks,
  RoomAudioRenderer,
  useRemoteParticipants,
  useConnectionState,
  useLocalParticipant,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { ConnectionState, Track } from 'livekit-client';
import { useLiveKitSync, SyncInterimPayload, SyncFinalSegmentPayload, SyncInterventionPayload } from '@/lib/hooks/useLiveKitSync';
import { useLiveKitErrorSuppression } from '@/lib/hooks/useLiveKitErrorSuppression';
import { TranscriptSegment, Intervention, SpeakingTimeDelta } from '@/lib/types';


/**
 * Error boundary that catches render-time exceptions from the LiveKit SDK
 * and displays a retry UI instead of crashing the entire page.
 */
interface LiveKitErrorBoundaryProps {
  children: React.ReactNode;
  onReset?: () => void;
}

interface LiveKitErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class LiveKitErrorBoundary extends Component<LiveKitErrorBoundaryProps, LiveKitErrorBoundaryState> {
  constructor(props: LiveKitErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): LiveKitErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[LiveKit ErrorBoundary] Caught render error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-slate-900 rounded-lg">
          <div className="text-center p-8">
            <div className="text-red-400 text-xl mb-4">!</div>
            <h3 className="text-lg font-medium text-white mb-2">Video Component Error</h3>
            <p className="text-slate-400 text-sm mb-4">
              {this.state.error?.message || 'An unexpected error occurred in the video component.'}
            </p>
            <button
              onClick={this.handleRetry}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/** Renders participant video tiles in an adaptive grid layout based on participant count. */
function CustomVideoLayout() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  // Adapt grid columns to participant count for optimal space usage
  const count = tracks.length;
  const gridCols =
    count <= 1 ? 'grid-cols-1' :
    count === 2 ? 'grid-cols-2' :
    count === 3 ? 'grid-cols-3' :
    'grid-cols-2';

  return (
    <div className="flex flex-col w-full h-full relative bg-slate-900 overflow-hidden">
      <div
        className={`flex-1 grid ${gridCols} gap-2 p-2 place-items-center`}
        style={{ height: 'calc(100% - var(--lk-control-bar-height, 60px))' }}
      >
        {tracks.map((trackRef, idx) => (
          <div
            key={`${trackRef.participant.identity}-${trackRef.source}-${idx}`}
            className="w-full h-full rounded-xl overflow-hidden relative shadow-lg bg-slate-950"
          >
            <ParticipantTile
              trackRef={trackRef}
              className="absolute inset-0 w-full h-full"
            />
          </div>
        ))}
      </div>
      <ControlBar variation="minimal" />
    </div>
  );
}

interface LiveKitRoomProps {
  roomName: string;
  displayName: string;
  onConnectionChange: (connected: boolean) => void;
  onParticipantsChange: (participants: { id: string; displayName: string }[]) => void;
  onRemoteSpeakersChange: (speakers: { id: string; displayName: string }[]) => void;
  onLocalSpeakingUpdate?: () => void;
  onLocalMicMuteChange?: (muted: boolean) => void;
  onDisconnected?: () => void;
  speakingTimeRef: MutableRefObject<SpeakingTimeDelta[]>;

  // Sync injection
  broadcastInterimRef?: MutableRefObject<((text: string, language?: string) => void) | null>;
  broadcastFinalRef?: MutableRefObject<((segment: TranscriptSegment) => void) | null>;
  broadcastInterventionRef?: MutableRefObject<((intervention: Intervention) => void) | null>;
  onInterimTranscriptReceived?: (payload: SyncInterimPayload) => void;
  onFinalSegmentReceived?: (payload: SyncFinalSegmentPayload) => void;
  onInterventionReceived?: (payload: SyncInterventionPayload) => void;
}

/**
 * Headless component running inside the LiveKit provider context.
 * Tracks connection state, participants, speaking time, mic mute state,
 * and synchronizes transcripts/interventions via P2P DataChannels.
 */
function LiveKitSession({
  displayName,
  onConnectionChange,
  onParticipantsChange,
  onRemoteSpeakersChange,
  onLocalSpeakingUpdate,
  onLocalMicMuteChange,
  onDisconnected,
  speakingTimeRef,
  broadcastInterimRef,
  broadcastFinalRef,
  broadcastInterventionRef,
  onInterimTranscriptReceived,
  onFinalSegmentReceived,
  onInterventionReceived,
}: Omit<LiveKitRoomProps, 'roomName'>) {
  // Suppress known benign LiveKit errors (cleaned up on unmount)
  useLiveKitErrorSuppression();

  const connectionState = useConnectionState();
  const remoteParticipants = useRemoteParticipants();
  const { localParticipant } = useLocalParticipant();
  const lastSpeakingCheckRef = useRef<number>(Date.now());
  const lastMicMutedRef = useRef<boolean | null>(null);
  const micMuteDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onLocalSpeakingUpdateRef = useRef(onLocalSpeakingUpdate);
  const onLocalMicMuteChangeRef = useRef(onLocalMicMuteChange);
  const wasConnectedRef = useRef(false);
  const onDisconnectedRef = useRef(onDisconnected);
  useEffect(() => { onLocalSpeakingUpdateRef.current = onLocalSpeakingUpdate; }, [onLocalSpeakingUpdate]);
  useEffect(() => { onLocalMicMuteChangeRef.current = onLocalMicMuteChange; }, [onLocalMicMuteChange]);
  useEffect(() => { onDisconnectedRef.current = onDisconnected; }, [onDisconnected]);

  // Track connection state
  useEffect(() => {
    onConnectionChange(connectionState === ConnectionState.Connected);

    // Track disconnect: only fire callback when transitioning FROM connected
    if (connectionState === ConnectionState.Connected) {
      wasConnectedRef.current = true;
    } else if (connectionState === ConnectionState.Disconnected && wasConnectedRef.current) {
      wasConnectedRef.current = false;
      onDisconnectedRef.current?.();
    }
  }, [connectionState, onConnectionChange]);

  // Synchronize P2P DataChannels
  const sync = useLiveKitSync({
    onInterimTranscriptReceived,
    onFinalSegmentReceived,
    onInterventionReceived,
  });

  useEffect(() => {
    if (broadcastInterimRef) broadcastInterimRef.current = sync.broadcastInterimTranscript;
    if (broadcastFinalRef) broadcastFinalRef.current = sync.broadcastFinalTranscript;
    if (broadcastInterventionRef) broadcastInterventionRef.current = sync.broadcastIntervention;
  }, [sync, broadcastInterimRef, broadcastFinalRef, broadcastInterventionRef]);

  // Track participants
  useEffect(() => {
    const mapped = remoteParticipants.map(p => ({
      id: p.identity,
      displayName: p.name || p.identity,
    }));
    onParticipantsChange(mapped);
  }, [remoteParticipants, onParticipantsChange]);

  // Poll speaking state every 500ms to accumulate speaking time and detect active speakers
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const delta = (now - lastSpeakingCheckRef.current) / 1000;
      lastSpeakingCheckRef.current = now;

      const activeSpeakers: { id: string; displayName: string }[] = [];

      remoteParticipants.forEach(p => {
        if (p.isSpeaking) {
          const name = p.name || p.identity;
          activeSpeakers.push({ id: p.identity, displayName: name });
          speakingTimeRef.current.push({ speaker: name, seconds: delta, timestamp: now });
        }
      });

      // Track local participant speaking state (for echo gate AND actual speaking time)
      if (localParticipant.isSpeaking) {
        onLocalSpeakingUpdateRef.current?.();

        // Also add local participant to active speakers and speaking time
        activeSpeakers.push({ id: localParticipant.identity, displayName });
        speakingTimeRef.current.push({ speaker: displayName, seconds: delta, timestamp: now });
      }

      // Prune entries older than 5 minutes to limit memory with 6 active speakers
      const pruneThreshold = now - 300_000;
      if (speakingTimeRef.current.length > 0 && speakingTimeRef.current[0].timestamp < pruneThreshold) {
        speakingTimeRef.current = speakingTimeRef.current.filter(d => d.timestamp >= pruneThreshold);
      }

      onRemoteSpeakersChange(activeSpeakers);

      // Debounce mic mute state changes (1s) to avoid transcription start/stop flicker
      const isMicMuted = !localParticipant.isMicrophoneEnabled;
      if (lastMicMutedRef.current !== isMicMuted) {
        lastMicMutedRef.current = isMicMuted;
        if (micMuteDebounceRef.current) clearTimeout(micMuteDebounceRef.current);
        micMuteDebounceRef.current = setTimeout(() => {
          onLocalMicMuteChangeRef.current?.(isMicMuted);
        }, 1000);
      }
    }, 500);

    return () => {
      clearInterval(interval);
      if (micMuteDebounceRef.current) clearTimeout(micMuteDebounceRef.current);
    };
  }, [remoteParticipants, localParticipant, speakingTimeRef, onRemoteSpeakersChange]);

  return null;
}

/**
 * LiveKit video conferencing wrapper that handles token acquisition,
 * error recovery, and connection lifecycle.
 * Renders the video grid, audio renderer, and headless session tracker.
 *
 * @param roomName - LiveKit room to join.
 * @param displayName - Local participant's display name.
 * @param onConnectionChange - Fires when connection state changes.
 * @param onParticipantsChange - Fires when remote participants join/leave.
 * @param onRemoteSpeakersChange - Fires every 500ms with currently speaking participants.
 * @param speakingTimeRef - Mutable ref accumulating per-speaker time deltas.
 */
export default function LiveKitRoomComponent({
  roomName,
  displayName,
  onConnectionChange,
  onParticipantsChange,
  onRemoteSpeakersChange,
  onLocalSpeakingUpdate,
  onLocalMicMuteChange,
  onDisconnected,
  speakingTimeRef,
  broadcastInterimRef,
  broadcastFinalRef,
  broadcastInterventionRef,
  onInterimTranscriptReceived,
  onFinalSegmentReceived,
  onInterventionReceived,
}: LiveKitRoomProps) {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const errorCountRef = useRef(0);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch token on mount
  useEffect(() => {
    const fetchToken = async () => {
      try {
        const res = await fetch('/api/livekit/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            room: roomName,
            identity: displayName,
            name: displayName,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Token request failed: ${res.status}`);
        }

        const { token: jwt } = await res.json();
        setToken(jwt);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to get token');
      }
    };

    fetchToken();
  }, [roomName, displayName]);

  // Cleanup error timers on unmount to prevent setState on unmounted component
  useEffect(() => {
    return () => {
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current);
        errorTimerRef.current = null;
      }
    };
  }, []);

  const serverUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

  if (error && errorCountRef.current >= 3) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-900 rounded-lg">
        <div className="text-center p-8">
          <div className="text-red-400 text-xl mb-4">!</div>
          <h3 className="text-lg font-medium text-white mb-2">Connection Error</h3>
          <p className="text-slate-400 text-sm mb-4">{error}</p>
          <button
            onClick={() => { setError(null); errorCountRef.current = 0; }}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-900 rounded-lg">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Connecting to room...</p>
          <p className="text-slate-500 text-sm mt-1">{roomName}</p>
        </div>
      </div>
    );
  }

  return (
    <LiveKitErrorBoundary onReset={() => { setError(null); errorCountRef.current = 0; }}>
      <div className="w-full h-full rounded-lg overflow-hidden lk-theme-default flex flex-col" style={{ minHeight: '300px' }}>
        <LKRoom
          serverUrl={serverUrl}
          token={token}
          audio={true}
          video={true}
          connect={true}
          onError={(err) => {
            const msg = err.message || '';
            console.warn('[LiveKit] Room error:', msg);
            // Show persistent error only after 3+ consecutive failures; otherwise auto-clear after 3s
            errorCountRef.current++;
            if (errorCountRef.current >= 3) {
              setError(msg);
            } else {
              setError(msg);
              if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
              errorTimerRef.current = setTimeout(() => {
                setError(null);
                // Reset count after stable period
                setTimeout(() => { errorCountRef.current = 0; }, 10000);
              }, 3000);
            }
          }}
        >
          <CustomVideoLayout />
          <RoomAudioRenderer />
          <LiveKitSession
            displayName={displayName}
            onConnectionChange={onConnectionChange}
            onParticipantsChange={onParticipantsChange}
            onRemoteSpeakersChange={onRemoteSpeakersChange}
            onLocalSpeakingUpdate={onLocalSpeakingUpdate}
            onLocalMicMuteChange={onLocalMicMuteChange}
            onDisconnected={onDisconnected}
            speakingTimeRef={speakingTimeRef}
            broadcastInterimRef={broadcastInterimRef}
            broadcastFinalRef={broadcastFinalRef}
            broadcastInterventionRef={broadcastInterventionRef}
            onInterimTranscriptReceived={onInterimTranscriptReceived}
            onFinalSegmentReceived={onFinalSegmentReceived}
            onInterventionReceived={onInterventionReceived}
          />
        </LKRoom>
      </div>
    </LiveKitErrorBoundary>
  );
}
