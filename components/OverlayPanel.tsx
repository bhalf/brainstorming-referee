'use client';

import { ReactNode, useState } from 'react';
import { Scenario, TranscriptSegment, MetricSnapshot, ExperimentConfig, DecisionEngineState, Intervention, VoiceSettings, SessionLog, ModelRoutingLogEntry } from '@/lib/types';
import { SCENARIO_DESCRIPTIONS } from '@/lib/config';
import DashboardTab from './DashboardTab';
import SettingsTab from './SettingsTab';
import TranscriptTab from './TranscriptTab';
import { SystemHealthProps, computeOverallHealth } from './SystemHealthPanel';
import type { InterimEntry } from './TranscriptFeed';
import type { LiveSummaryState } from '@/lib/hooks/useLiveSummary';

/** Props for controlling transcription state and display. */
export interface TranscriptControlProps {
  segments: TranscriptSegment[];
  interimEntries?: InterimEntry[];
  isTranscribing: boolean;
  isTranscriptionSupported: boolean;
  onToggleTranscription: () => void;
  onAddSimulatedSegment?: (text: string) => void;
  transcriptionError?: string | null;
  isWhisperActive?: boolean;
}

/** Props for displaying real-time metrics, history, and engine state. */
export interface MetricsDisplayProps {
  currentMetrics: MetricSnapshot | null;
  metricsHistory: MetricSnapshot[];
  config: ExperimentConfig;
  decisionState: DecisionEngineState;
}

/** Props for TTS voice configuration and playback control. */
export interface VoiceControlProps {
  settings: VoiceSettings;
  onUpdateSettings: (updates: Partial<VoiceSettings>) => void;
  isSpeaking: boolean;
  onTestVoice: () => void;
  onCancelVoice: () => void;
}

interface OverlayPanelProps {
  scenario: Scenario;
  isSessionActive: boolean;
  onEndSession: () => void;
  language: string;
  roomName: string;
  transcript: TranscriptControlProps;
  metrics: MetricsDisplayProps;
  voice: VoiceControlProps;
  interventions: Intervention[];
  sessionLog: SessionLog;
  modelRoutingLog: ModelRoutingLogEntry[];
  onUpdateConfig?: (key: keyof ExperimentConfig, value: number | boolean | [number, number, number, number]) => void;
  onResetConfig?: () => void;
  health?: SystemHealthProps;
  liveSummary: LiveSummaryState;
  children?: ReactNode;
}

type TabId = 'dashboard' | 'transcript' | 'settings';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'transcript', label: 'Transcript', icon: '📝' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

/**
 * Side panel containing the AI Moderator controls, organized into tabbed sections:
 * Dashboard (metrics + interventions), Transcript, and Settings.
 * Displays session status, scenario description, and system health indicator.
 *
 * @param scenario - Active experiment scenario (baseline, A, or B).
 * @param isSessionActive - Whether the brainstorming session is currently running.
 * @param transcript - Transcription state and controls.
 * @param metrics - Real-time metric snapshots and decision engine state.
 * @param voice - TTS voice settings and playback controls.
 * @param interventions - List of all interventions in the session.
 * @param health - System health status for all subsystems.
 * @param liveSummary - AI-generated live session summary.
 */
export default function OverlayPanel({
  scenario,
  isSessionActive,
  onEndSession,
  language,
  roomName,
  transcript,
  metrics,
  voice,
  interventions,
  sessionLog,
  modelRoutingLog,
  onUpdateConfig,
  onResetConfig,
  health,
  liveSummary,
  children,
}: OverlayPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');

  // Derive overall health status for the compact indicator in the header
  const overallHealth = health ? computeOverallHealth(health) : null;

  return (
    <div className="h-full flex flex-col bg-slate-800/90 backdrop-blur-sm rounded-xl border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="p-3 sm:p-4 border-b border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-white">AI Moderator</h2>
          <div className="flex items-center gap-2">
            {overallHealth && (
              <button
                onClick={() => setActiveTab('settings')}
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${overallHealth === 'healthy' ? 'bg-green-900/30 text-green-400 hover:bg-green-900/50' :
                  overallHealth === 'degraded' ? 'bg-yellow-900/30 text-yellow-400 hover:bg-yellow-900/50' :
                    'bg-red-900/30 text-red-400 hover:bg-red-900/50'
                  }`}
                title="System Health"
              >
                <span className={`w-2 h-2 rounded-full ${overallHealth === 'healthy' ? 'bg-green-400' :
                  overallHealth === 'degraded' ? 'bg-yellow-400 animate-pulse' :
                    'bg-red-400 animate-pulse'
                  }`} />
                {overallHealth === 'error' ? 'Issues' : overallHealth === 'degraded' ? 'Warning' : 'OK'}
              </button>
            )}
            <div className={`flex items-center gap-2 px-2 py-1 rounded text-xs ${isSessionActive
              ? 'bg-green-900/50 text-green-400'
              : 'bg-slate-700 text-slate-400'
              }`}>
              <span className={`w-2 h-2 rounded-full ${isSessionActive ? 'bg-green-400 animate-pulse' : 'bg-slate-500'}`} />
              {isSessionActive ? 'Active' : 'Inactive'}
            </div>
          </div>
        </div>

        <div className="text-xs text-slate-400 bg-slate-700/50 rounded px-2 py-1.5">
          <span className="font-medium text-slate-300">
            {scenario === 'baseline' ? 'Baseline' : `Scenario ${scenario}`}:
          </span>{' '}
          {SCENARIO_DESCRIPTIONS[scenario].split(':')[1]?.trim() || SCENARIO_DESCRIPTIONS[scenario]}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700 overflow-x-auto scrollbar-hide">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 px-2.5 sm:px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center sm:justify-start gap-1.5 ${activeTab === tab.id
              ? 'bg-slate-700/50 text-white border-b-2 border-blue-500'
              : 'text-slate-400 hover:text-white hover:bg-slate-700/30'
              }`}
          >
            <span>{tab.icon}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'dashboard' && (
          <DashboardTab
            currentMetrics={metrics.currentMetrics}
            config={metrics.config}
            decisionState={metrics.decisionState}
            interventions={interventions}
            liveSummary={liveSummary}
          />
        )}

        {activeTab === 'transcript' && (
          <TranscriptTab transcript={transcript} />
        )}

        {activeTab === 'settings' && (
          <SettingsTab
            voice={voice}
            config={metrics.config}
            onUpdateConfig={onUpdateConfig}
            onResetConfig={onResetConfig}
            health={health}
            modelRoutingLog={modelRoutingLog}
            sessionLog={sessionLog}
            roomName={roomName}
            onEndSession={onEndSession}
            currentMetrics={metrics.currentMetrics}
            metricsHistory={metrics.metricsHistory}
            decisionState={metrics.decisionState}
          />
        )}
      </div>
    </div>
  );
}
