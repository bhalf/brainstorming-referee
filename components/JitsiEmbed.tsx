'use client';

import { useEffect, useRef, useState } from 'react';

interface JitsiEmbedProps {
  roomName: string;
  displayName?: string;
  onParticipantJoined?: (participant: { id: string; displayName: string }) => void;
  onParticipantLeft?: (participant: { id: string }) => void;
  onVideoConferenceJoined?: () => void;
  onVideoConferenceLeft?: () => void;
  onDominantSpeakerChanged?: (participantId: string) => void;
  onAudioLevelChanged?: (participantId: string, audioLevel: number) => void;
}

// Jitsi Meet External API types
interface JitsiMeetExternalAPI {
  executeCommand: (command: string, ...args: unknown[]) => void;
  addEventListener: (event: string, listener: (...args: unknown[]) => void) => void;
  removeEventListener: (event: string, listener: (...args: unknown[]) => void) => void;
  dispose: () => void;
  getParticipantsInfo: () => Array<{ participantId: string; displayName: string }>;
}

declare global {
  interface Window {
    JitsiMeetExternalAPI?: new (domain: string, options: JitsiOptions) => JitsiMeetExternalAPI;
  }
}

interface JitsiOptions {
  roomName: string;
  width: string;
  height: string;
  parentNode: HTMLElement;
  userInfo?: {
    displayName?: string;
  };
  configOverwrite?: Record<string, unknown>;
  interfaceConfigOverwrite?: Record<string, unknown>;
}

export default function JitsiEmbed({
  roomName,
  displayName = 'Participant',
  onParticipantJoined,
  onParticipantLeft,
  onVideoConferenceJoined,
  onVideoConferenceLeft,
  onDominantSpeakerChanged,
  onAudioLevelChanged,
}: JitsiEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<JitsiMeetExternalAPI | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [useIframe, setUseIframe] = useState(false);

  useEffect(() => {
    let mounted = true;
    let timeoutId: NodeJS.Timeout;

    // Load Jitsi External API script
    const loadJitsiScript = (): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (window.JitsiMeetExternalAPI) {
          resolve();
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://jitsi.riot.im/external_api.js';
        script.async = true;
        script.onload = () => {
          // Wait a bit for the API to fully initialize
          setTimeout(() => resolve(), 500);
        };
        script.onerror = () => reject(new Error('Failed to load Jitsi Meet API'));
        document.body.appendChild(script);
      });
    };

    const initializeJitsi = async () => {
      try {
        await loadJitsiScript();

        if (!mounted) return;

        if (!containerRef.current || !window.JitsiMeetExternalAPI) {
          // Fallback to iframe
          console.warn('JitsiMeetExternalAPI not available, falling back to iframe');
          setUseIframe(true);
          setIsLoading(false);
          return;
        }

        // Clean up existing instance
        if (apiRef.current) {
          apiRef.current.dispose();
        }

        const api = new window.JitsiMeetExternalAPI('jitsi.riot.im', {
          roomName: `uzh-brainstorming-${roomName}`,
          width: '100%',
          height: '100%',
          parentNode: containerRef.current,
          userInfo: {
            displayName,
          },
          configOverwrite: {
            startWithAudioMuted: false,
            startWithVideoMuted: false,
            prejoinPageEnabled: false,
            disableDeepLinking: true,
            enableClosePage: false,
            enableWelcomePage: false,
            disableInviteFunctions: true,
            hideConferenceSubject: false,
            hideConferenceTimer: false,
          },
          interfaceConfigOverwrite: {
            TOOLBAR_BUTTONS: [
              'microphone',
              'camera',
              'desktop',
              'chat',
              'raisehand',
              'participants-pane',
              'tileview',
              'settings',
              'hangup',
            ],
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            SHOW_BRAND_WATERMARK: false,
            BRAND_WATERMARK_LINK: '',
            SHOW_CHROME_EXTENSION_BANNER: false,
            MOBILE_APP_PROMO: false,
            HIDE_INVITE_MORE_HEADER: true,
            DISABLE_JOIN_LEAVE_NOTIFICATIONS: false,
            FILM_STRIP_MAX_HEIGHT: 120,
          },
        });

        apiRef.current = api;

        // Set a timeout - if not connected in 10 seconds, show the iframe anyway
        timeoutId = setTimeout(() => {
          if (mounted && isLoading) {
            console.warn('Jitsi connection timeout, assuming connected');
            setIsLoading(false);
            onVideoConferenceJoined?.();
          }
        }, 10000);

        // Event listeners
        api.addEventListener('videoConferenceJoined', () => {
          if (mounted) {
            clearTimeout(timeoutId);
            setIsLoading(false);
            onVideoConferenceJoined?.();
          }
        });

        api.addEventListener('videoConferenceLeft', () => {
          if (mounted) {
            onVideoConferenceLeft?.();
          }
        });

        api.addEventListener('participantJoined', (data: unknown) => {
          if (mounted) {
            const participant = data as { id: string; displayName: string };
            onParticipantJoined?.(participant);
          }
        });

        api.addEventListener('participantLeft', (data: unknown) => {
          if (mounted) {
            const participant = data as { id: string };
            onParticipantLeft?.(participant);
          }
        });

        // Also listen for ready event
        api.addEventListener('browserSupport', () => {
          console.log('Jitsi browser support check passed');
        });

        // Dominant speaker changed (for speaker diarization)
        api.addEventListener('dominantSpeakerChanged', (data: unknown) => {
          if (mounted) {
            const { id } = data as { id: string };
            onDominantSpeakerChanged?.(id);
          }
        });

        // Audio level changed (for accurate speaking time tracking)
        api.addEventListener('audioLevelChanged', (data: unknown) => {
          if (mounted) {
            const { participantId, audioLevel } = data as { participantId: string; audioLevel: number };
            onAudioLevelChanged?.(participantId, audioLevel);
          }
        });

      } catch (err) {
        console.error('Jitsi initialization error:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to initialize Jitsi');
          // Fallback to iframe on error
          setUseIframe(true);
          setIsLoading(false);
        }
      }
    };

    initializeJitsi();

    // Cleanup
    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      if (apiRef.current) {
        apiRef.current.dispose();
        apiRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomName, displayName]);

  // Iframe fallback
  if (useIframe) {
    const jitsiUrl = `https://jitsi.riot.im/uzh-brainstorming-${roomName}#userInfo.displayName="${encodeURIComponent(displayName)}"&config.prejoinPageEnabled=false`;
    return (
      <div className="w-full h-full rounded-lg overflow-hidden">
        <iframe
          src={jitsiUrl}
          className="w-full h-full border-0"
          allow="camera; microphone; fullscreen; display-capture; autoplay"
          style={{ minHeight: '400px' }}
          // In iframe mode we have no External API events, so treat the iframe
          // loading as the join signal so isJitsiReady becomes true and the
          // session can start. Speaker diarization events are unavailable in this mode.
          onLoad={() => onVideoConferenceJoined?.()}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-900 rounded-lg">
        <div className="text-center p-8">
          <div className="text-red-400 text-xl mb-4">⚠️</div>
          <h3 className="text-lg font-medium text-white mb-2">Connection Error</h3>
          <p className="text-slate-400 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900 rounded-lg z-10">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-400">Connecting to room...</p>
            <p className="text-slate-500 text-sm mt-1">{roomName}</p>
          </div>
        </div>
      )}
      <div
        ref={containerRef}
        className="w-full h-full rounded-lg overflow-hidden"
        style={{ minHeight: '400px' }}
      />
    </div>
  );
}





