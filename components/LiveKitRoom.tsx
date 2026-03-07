'use client';

import { useEffect, useState, useCallback, useRef, MutableRefObject } from 'react';
import {
  LiveKitRoom as LKRoom,
  VideoConference,
  RoomAudioRenderer,
  useRemoteParticipants,
  useConnectionState,
  useLocalParticipant,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { Track, RemoteParticipant, ConnectionState } from 'livekit-client';
import { TranscriptSegment, ModelRoutingLogEntry } from '@/lib/types';
import { useLiveKitTranscription } from '@/lib/hooks/useLiveKitTranscription';

interface LiveKitRoomProps {
  roomName: string;
  displayName: string;
  onConnectionChange: (connected: boolean) => void;
  onParticipantsChange: (participants: { id: string; displayName: string }[]) => void;
  onRemoteSpeakersChange: (speakers: { id: string; displayName: string }[]) => void;
  speakingTimeRef: MutableRefObject<Map<string, number>>;
  transcriptionConfig: {
    language: string;
    isActive: boolean;
    onSegment: (segment: TranscriptSegment) => void;
    uploadSegment: (segment: TranscriptSegment) => void;
    addModelRoutingLog: (entry: ModelRoutingLogEntry) => void;
  };
}

// Inner component that runs inside LiveKit context
function LiveKitSession({
  onConnectionChange,
  onParticipantsChange,
  onRemoteSpeakersChange,
  speakingTimeRef,
  transcriptionConfig,
}: Omit<LiveKitRoomProps, 'roomName' | 'displayName'>) {
  const connectionState = useConnectionState();
  const remoteParticipants = useRemoteParticipants();
  const { localParticipant } = useLocalParticipant();
  const lastSpeakingCheckRef = useRef<number>(Date.now());

  // Track connection state
  useEffect(() => {
    onConnectionChange(connectionState === ConnectionState.Connected);
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

      onRemoteSpeakersChange(activeSpeakers);
    }, 500);

    return () => clearInterval(interval);
  }, [remoteParticipants, speakingTimeRef, onRemoteSpeakersChange]);

  // Per-participant transcription
  useLiveKitTranscription({
    remoteParticipants,
    language: transcriptionConfig.language,
    isActive: transcriptionConfig.isActive,
    onSegment: transcriptionConfig.onSegment,
    uploadSegment: transcriptionConfig.uploadSegment,
    addModelRoutingLog: transcriptionConfig.addModelRoutingLog,
  });

  return null;
}

export default function LiveKitRoomComponent({
  roomName,
  displayName,
  onConnectionChange,
  onParticipantsChange,
  onRemoteSpeakersChange,
  speakingTimeRef,
  transcriptionConfig,
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
          onConnectionChange={onConnectionChange}
          onParticipantsChange={onParticipantsChange}
          onRemoteSpeakersChange={onRemoteSpeakersChange}
          speakingTimeRef={speakingTimeRef}
          transcriptionConfig={transcriptionConfig}
        />
      </LKRoom>
    </div>
  );
}
