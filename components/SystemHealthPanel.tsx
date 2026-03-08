'use client';

import { useState, useEffect } from 'react';
import { formatTime } from '@/lib/utils/format';
import Panel from './shared/Panel';
import SectionHeader from './shared/SectionHeader';

// --- Types ---

export interface SystemHealthProps {
  transcription: {
    isConnected: boolean;
    isRecording: boolean;
    error: string | null;
    isMuted?: boolean;
    isRealtimeEnabled?: boolean;
  };
  liveKit: {
    isConnected: boolean;
  };
  realtimeSync: {
    isConnected: boolean;
  };
  metrics: {
    lastComputedAt: number | null;
    error: string | null;
    isDecisionOwner: boolean;
  };
  engine: {
    phase: string;
    isDecisionOwner: boolean;
  };
  tts: {
    isSupported: boolean;
  };
  errors: Array<{ timestamp: number; message: string; context?: string }>;
}

type HealthLevel = 'healthy' | 'degraded' | 'error' | 'inactive';

interface SubsystemStatus {
  label: string;
  status: HealthLevel;
  detail: string;
}

// --- Helpers ---

function getStatusDotColor(status: HealthLevel): string {
  switch (status) {
    case 'healthy': return 'bg-green-400';
    case 'degraded': return 'bg-yellow-400';
    case 'error': return 'bg-red-400';
    case 'inactive': return 'bg-slate-500';
  }
}

function getStatusTextColor(status: HealthLevel): string {
  switch (status) {
    case 'healthy': return 'text-green-400';
    case 'degraded': return 'text-yellow-400';
    case 'error': return 'text-red-400';
    case 'inactive': return 'text-slate-500';
  }
}

function getSubsystems(props: SystemHealthProps, now: number): SubsystemStatus[] {
  const subsystems: SubsystemStatus[] = [];

  // Transcription
  if (props.transcription.error) {
    subsystems.push({ label: 'Transcription', status: 'error', detail: props.transcription.error });
  } else if (props.transcription.isConnected && props.transcription.isRecording) {
    subsystems.push({ label: 'Transcription', status: 'healthy', detail: 'Connected & recording' });
  } else if (props.transcription.isConnected) {
    subsystems.push({ label: 'Transcription', status: 'degraded', detail: 'Connected, not recording' });
  } else if (props.transcription.isMuted) {
    subsystems.push({ label: 'Transcription', status: 'healthy', detail: 'Paused (mic muted)' });
  } else if (props.transcription.isRealtimeEnabled === false) {
    subsystems.push({ label: 'Transcription', status: 'inactive', detail: 'Disabled' });
  } else {
    subsystems.push({ label: 'Transcription', status: 'degraded', detail: 'Connecting…' });
  }

  // LiveKit
  subsystems.push({
    label: 'LiveKit',
    status: props.liveKit.isConnected ? 'healthy' : 'degraded',
    detail: props.liveKit.isConnected ? 'Connected' : 'Connecting...',
  });

  // Realtime Sync
  subsystems.push({
    label: 'Realtime Sync',
    status: props.realtimeSync.isConnected ? 'healthy' : 'degraded',
    detail: props.realtimeSync.isConnected ? 'Subscribed' : 'Connecting...',
  });

  // Metrics Engine
  if (props.metrics.error) {
    subsystems.push({ label: 'Metrics Engine', status: 'error', detail: props.metrics.error });
  } else if (!props.metrics.isDecisionOwner) {
    subsystems.push({ label: 'Metrics Engine', status: 'healthy', detail: 'Receiving via Realtime' });
  } else if (props.metrics.lastComputedAt) {
    const ageSeconds = Math.round((now - props.metrics.lastComputedAt) / 1000);
    if (ageSeconds > 15) {
      subsystems.push({ label: 'Metrics Engine', status: 'degraded', detail: `Stale (${ageSeconds}s ago)` });
    } else {
      subsystems.push({ label: 'Metrics Engine', status: 'healthy', detail: `Active (${ageSeconds}s ago)` });
    }
  } else {
    subsystems.push({ label: 'Metrics Engine', status: 'inactive', detail: 'Waiting for data' });
  }

  // Decision Engine
  subsystems.push({
    label: 'Decision Engine',
    status: props.engine.isDecisionOwner ? 'healthy' : 'inactive',
    detail: props.engine.isDecisionOwner
      ? `Phase: ${props.engine.phase}`
      : 'Not owner',
  });

  // TTS
  subsystems.push({
    label: 'Voice (TTS)',
    status: props.tts.isSupported ? 'healthy' : 'degraded',
    detail: props.tts.isSupported ? 'Ready' : 'Not supported',
  });

  return subsystems;
}

/** Compute overall health from all subsystem statuses */
export function computeOverallHealth(props: SystemHealthProps): HealthLevel {
  const subsystems = getSubsystems(props, Date.now());
  if (subsystems.some(s => s.status === 'error')) return 'error';
  if (subsystems.some(s => s.status === 'degraded')) return 'degraded';
  return 'healthy';
}

// --- Component ---

export default function SystemHealthPanel({ health }: { health: SystemHealthProps }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const subsystems = getSubsystems(health, now);
  const overallHealth = computeOverallHealth(health);
  const recentErrors = health.errors.slice(-10).reverse();

  return (
    <div className="h-full overflow-y-auto space-y-4 text-sm">
      {/* Overall Status */}
      <Panel>
        <div className="flex items-center justify-between">
          <SectionHeader>System Health</SectionHeader>
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${getStatusDotColor(overallHealth)} ${overallHealth === 'error' ? 'animate-pulse' : ''}`} />
            <span className={`text-xs font-medium ${getStatusTextColor(overallHealth)}`}>
              {overallHealth === 'healthy' ? 'All Systems OK' :
                overallHealth === 'degraded' ? 'Degraded' : 'Issues Detected'}
            </span>
          </div>
        </div>
      </Panel>

      {/* Subsystem Status */}
      <Panel>
        <SectionHeader>Subsystems</SectionHeader>
        <div className="space-y-2.5 mt-2">
          {subsystems.map((sub) => (
            <div key={sub.label} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full shrink-0 ${getStatusDotColor(sub.status)} ${sub.status === 'error' ? 'animate-pulse' : ''}`} />
                <span className="text-slate-300 text-xs">{sub.label}</span>
              </div>
              <span className={`text-xs ${getStatusTextColor(sub.status)} text-right max-w-[180px] truncate`} title={sub.detail}>
                {sub.detail}
              </span>
            </div>
          ))}
        </div>
      </Panel>

      {/* Recent Errors */}
      <Panel>
        <SectionHeader>Recent Errors ({recentErrors.length})</SectionHeader>
        {recentErrors.length === 0 ? (
          <p className="text-slate-500 text-center py-2 text-xs">No errors</p>
        ) : (
          <div className="space-y-2 mt-2 max-h-64 overflow-y-auto">
            {recentErrors.map((err, i) => (
              <div key={`${err.timestamp}-${i}`} className="text-xs border-b border-slate-700/50 pb-2 last:border-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-slate-500">{formatTime(err.timestamp)}</span>
                  {err.context && (
                    <span className="text-slate-600 bg-slate-700/50 px-1.5 py-0.5 rounded text-[10px]">
                      {err.context}
                    </span>
                  )}
                </div>
                <p className="text-red-400/80">{err.message}</p>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
