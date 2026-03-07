'use client';

import { useEffect, useState, useRef, MutableRefObject } from 'react';
import {
  LiveKitRoom as LKRoom,
  VideoConference,
  RoomAudioRenderer,
  useRemoteParticipants,
  useConnectionState,
  useLocalParticipant,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { ConnectionState } from 'livekit-client';

interface LiveKitRoomProps {
  roomName: string;
  displayName: string;
  onConnectionChange: (connected: boolean) => void;
  onParticipantsChange: (participants: { id: string; displayName: string }[]) => void;
  onRemoteSpeakersChange: (speakers: { id: string; displayName: string }[]) => void;
  onLocalSpeakingUpdate?: () => void;
  onLocalMicMuteChange?: (muted: boolean) => void;
  onDisconnected?: () => void;
  speakingTimeRef: MutableRefObject<Map<string, number>>;
}

// Inner component that runs inside LiveKit context
function LiveKitSession({
  displayName,
  onConnectionChange,
  onParticipantsChange,
  onRemoteSpeakersChange,
  onLocalSpeakingUpdate,
  onLocalMicMuteChange,
  onDisconnected,
  speakingTimeRef,
}: Omit<LiveKitRoomProps, 'roomName'>) {
  const connectionState = useConnectionState();
  const remoteParticipants = useRemoteParticipants();
  const { localParticipant } = useLocalParticipant();
  const lastSpeakingCheckRef = useRef<number>(Date.now());
  const lastMicMutedRef = useRef<boolean | null>(null);
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

  // Track participants
  useEffect(() => {
    const mapped = remoteParticipants.map(p => ({
      id: p.identity,
      displayName: p.name || p.identity,
    }));
    onParticipantsChange(mapped);
  }, [remoteParticipants, onParticipantsChange]);

  // Track speaking time + active speakers (500ms interval)
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
          const current = speakingTimeRef.current.get(name) || 0;
          speakingTimeRef.current.set(name, current + delta);
        }
      });

      // Track local participant speaking state (for echo gate AND actual speaking time)
      if (localParticipant.isSpeaking) {
        onLocalSpeakingUpdateRef.current?.();

        // Also add local participant to active speakers and speaking time
        activeSpeakers.push({ id: localParticipant.identity, displayName });
        const currentLocal = speakingTimeRef.current.get(displayName) || 0;
        speakingTimeRef.current.set(displayName, currentLocal + delta);
      }

      onRemoteSpeakersChange(activeSpeakers);

      // Track local mic mute state
      const isMicMuted = !localParticipant.isMicrophoneEnabled;
      if (lastMicMutedRef.current !== isMicMuted) {
        lastMicMutedRef.current = isMicMuted;
        onLocalMicMuteChangeRef.current?.(isMicMuted);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [remoteParticipants, localParticipant, speakingTimeRef, onRemoteSpeakersChange]);

  return null;
}

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
}: LiveKitRoomProps) {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const serverUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-900 rounded-lg">
        <div className="text-center p-8">
          <div className="text-red-400 text-xl mb-4">!</div>
          <h3 className="text-lg font-medium text-white mb-2">Connection Error</h3>
          <p className="text-slate-400 text-sm">{error}</p>
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
    <div className="w-full h-full rounded-lg overflow-hidden lk-theme-default" style={{ minHeight: '400px' }}>
      <LKRoom
        serverUrl={serverUrl}
        token={token}
        audio={true}
        video={true}
        connect={true}
        onError={(err) => setError(err.message)}
      >
        <VideoConference />
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
        />
      </LKRoom>
    </div>
  );
}
