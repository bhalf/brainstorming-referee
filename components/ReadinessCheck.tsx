'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface ReadinessCheckProps {
  roomName: string;
  displayName: string;
  language: string;
  onReady: () => void;
  onBack: () => void;
}

type CheckStatus = 'pending' | 'checking' | 'ok' | 'error';

export default function ReadinessCheck({
  roomName,
  displayName,
  language,
  onReady,
  onBack,
}: ReadinessCheckProps) {
  const [micStatus, setMicStatus] = useState<CheckStatus>('pending');
  const [micError, setMicError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [hasSpeechDetected, setHasSpeechDetected] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);

  // Cleanup audio resources
  const cleanup = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (audioContextRef.current?.state !== 'closed') {
      audioContextRef.current?.close();
    }
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    audioContextRef.current = null;
    analyserRef.current = null;
  }, []);

  // Request microphone permission and start level monitoring
  const checkMicrophone = useCallback(async () => {
    setMicStatus('checking');
    setMicError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);
      analyserRef.current = analyser;

      setMicStatus('ok');

      // Start level monitoring
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((sum, v) => sum + v, 0) / dataArray.length;
        const normalized = Math.min(1, avg / 128);
        setAudioLevel(normalized);
        if (normalized > 0.05) setHasSpeechDetected(true);
        rafRef.current = requestAnimationFrame(updateLevel);
      };
      rafRef.current = requestAnimationFrame(updateLevel);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('NotAllowed') || message.includes('Permission denied')) {
        setMicError('Microphone permission denied. Please allow access in your browser settings.');
      } else if (message.includes('NotFound')) {
        setMicError('No microphone found. Please connect a microphone.');
      } else {
        setMicError(`Microphone error: ${message}`);
      }
      setMicStatus('error');
    }
  }, []);

  // Auto-check microphone on mount
  useEffect(() => {
    checkMicrophone();
    return cleanup;
  }, [checkMicrophone, cleanup]);

  const isDE = language.startsWith('de');
  const allReady = micStatus === 'ok';

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 max-w-md w-full space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-xl font-semibold text-white mb-1">
            {isDE ? 'Bereit machen' : 'Pre-Session Check'}
          </h2>
          <p className="text-sm text-slate-400">
            {isDE
              ? `Raum: ${roomName}`
              : `Room: ${roomName}`}
          </p>
        </div>

        {/* Info */}
        <div className="bg-slate-700/50 rounded-lg p-3 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">{isDE ? 'Name' : 'Name'}:</span>
            <span className="text-white">{displayName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">{isDE ? 'Sprache' : 'Language'}:</span>
            <span className="text-white">{language}</span>
          </div>
        </div>

        {/* Microphone Check */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StatusDot status={micStatus} />
              <span className="text-sm text-slate-300">
                {isDE ? 'Mikrofon' : 'Microphone'}
              </span>
            </div>
            <span className="text-xs text-slate-500">
              {micStatus === 'pending' && (isDE ? 'Warten...' : 'Waiting...')}
              {micStatus === 'checking' && (isDE ? 'Prüfe...' : 'Checking...')}
              {micStatus === 'ok' && (isDE ? 'Freigegeben' : 'Granted')}
              {micStatus === 'error' && (isDE ? 'Fehler' : 'Error')}
            </span>
          </div>

          {micError && (
            <div className="bg-red-900/30 border border-red-800/50 rounded-lg p-3 text-sm text-red-300">
              {micError}
              <button
                onClick={checkMicrophone}
                className="block mt-2 text-xs text-red-400 hover:text-red-300 underline"
              >
                {isDE ? 'Erneut versuchen' : 'Retry'}
              </button>
            </div>
          )}

          {/* Audio Level Meter */}
          {micStatus === 'ok' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 w-12 shrink-0">
                  {isDE ? 'Pegel' : 'Level'}:
                </span>
                <div className="flex-1 h-3 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-75 ${
                      audioLevel > 0.3 ? 'bg-green-400' :
                      audioLevel > 0.05 ? 'bg-green-500/70' :
                      'bg-slate-600'
                    }`}
                    style={{ width: `${Math.max(2, audioLevel * 100)}%` }}
                  />
                </div>
              </div>
              <p className={`text-xs ${hasSpeechDetected ? 'text-green-400' : 'text-slate-500'}`}>
                {hasSpeechDetected
                  ? (isDE ? 'Audio erkannt — Mikrofon funktioniert' : 'Audio detected — microphone is working')
                  : (isDE ? 'Sprich kurz, um das Mikrofon zu testen...' : 'Speak briefly to test your microphone...')}
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onBack}
            className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm font-medium transition-colors"
          >
            {isDE ? 'Zurück' : 'Back'}
          </button>
          <button
            onClick={() => {
              cleanup();
              onReady();
            }}
            disabled={!allReady}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              allReady
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
            }`}
          >
            {isDE ? 'Session beitreten' : 'Join Session'}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: CheckStatus }) {
  const colors: Record<CheckStatus, string> = {
    pending: 'bg-slate-500',
    checking: 'bg-yellow-400 animate-pulse',
    ok: 'bg-green-400',
    error: 'bg-red-400',
  };
  return <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${colors[status]}`} />;
}
