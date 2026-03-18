'use client';

import React, { Component, useEffect, useState, useCallback } from 'react';
import {
  LiveKitRoom as LKRoom,
  TrackLoop,
  ParticipantTile,
  ControlBar,
  useTracks,
  RoomAudioRenderer,
  useRemoteParticipants,
  useConnectionState,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { ConnectionState, Track, ParticipantKind } from 'livekit-client';

// --- Error Boundary ---

interface ErrorBoundaryProps {
  children: React.ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class LiveKitErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[LiveKit ErrorBoundary]', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-white p-6" style={{ background: 'var(--bg-base)' }}>
          <div className="glass p-6 text-center max-w-sm">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-rose-500/10 mb-4">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-rose-400">
                <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <p className="text-rose-400 text-sm mb-4">Video-Verbindung fehlgeschlagen</p>
            <button onClick={this.handleRetry} className="btn-primary text-sm px-4 py-2">
              Erneut versuchen
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- Video Grid Content ---

function VideoGridContent({ onConnectionChange, onDisconnected, onTTSStateChange }: {
  onConnectionChange?: (connected: boolean) => void;
  onDisconnected?: () => void;
  onTTSStateChange?: (playing: boolean) => void;
}) {
  const connectionState = useConnectionState();
  const participants = useRemoteParticipants();
  const allTracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  // Detect agent audio tracks for TTS overlay sync
  const audioTracks = useTracks(
    [{ source: Track.Source.Microphone, withPlaceholder: false }],
    { onlySubscribed: true },
  );
  const agentAudioActive = audioTracks.some(
    (t) => t.participant.kind === ParticipantKind.AGENT && t.publication?.track,
  );

  useEffect(() => {
    onTTSStateChange?.(agentAudioActive);
  }, [agentAudioActive, onTTSStateChange]);

  // Hide backend agents from video grid (uses LiveKit's ParticipantKind, not name-based)
  const tracks = allTracks.filter(
    (t) => t.participant.kind !== ParticipantKind.AGENT,
  );
  const visibleParticipants = participants.filter(
    (p) => p.kind !== ParticipantKind.AGENT,
  );

  useEffect(() => {
    const connected = connectionState === ConnectionState.Connected;
    onConnectionChange?.(connected);
  }, [connectionState, onConnectionChange]);

  // Track if we've ever been connected — only redirect on disconnect AFTER a successful connection
  const hasConnected = React.useRef(false);

  useEffect(() => {
    if (connectionState === ConnectionState.Connected) {
      hasConnected.current = true;
    }
    if (connectionState === ConnectionState.Disconnected && hasConnected.current) {
      onDisconnected?.();
    }
  }, [connectionState, onDisconnected]);

  const totalParticipants = visibleParticipants.length + 1;
  const gridCols = totalParticipants <= 1 ? 1 : totalParticipants <= 4 ? 2 : totalParticipants <= 9 ? 3 : 4;

  return (
    <div className="h-full flex flex-col">
      <div
        className="flex-1 min-h-0"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
          gap: '4px',
        }}
      >
        <TrackLoop tracks={tracks}>
          <ParticipantTile />
        </TrackLoop>
      </div>
      <RoomAudioRenderer />
      <ControlBar variation="minimal" controls={{ leave: false }} />
    </div>
  );
}

// --- Main Component ---

interface VideoGridProps {
  token: string;
  serverUrl: string;
  onConnectionChange?: (connected: boolean) => void;
  onDisconnected?: () => void;
  onTTSStateChange?: (playing: boolean) => void;
}

export default function VideoGrid({ token, serverUrl, onConnectionChange, onDisconnected, onTTSStateChange }: VideoGridProps) {
  const [retryKey, setRetryKey] = useState(0);

  const handleReset = useCallback(() => {
    setRetryKey((k) => k + 1);
  }, []);

  if (!token) {
    return (
      <div className="h-full flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <LiveKitErrorBoundary key={retryKey} onReset={handleReset}>
      <LKRoom
        token={token}
        serverUrl={serverUrl}
        connect={true}
        audio={true}
        video={true}
        data-lk-theme="default"
        style={{ height: '100%' }}
      >
        <VideoGridContent
          onConnectionChange={onConnectionChange}
          onDisconnected={onDisconnected}
          onTTSStateChange={onTTSStateChange}
        />
      </LKRoom>
    </LiveKitErrorBoundary>
  );
}
