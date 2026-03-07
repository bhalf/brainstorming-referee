'use client';

import { ReactNode, useState } from 'react';
import { Scenario, TranscriptSegment, MetricSnapshot, ExperimentConfig, DecisionEngineState, Intervention, VoiceSettings, SessionLog, ModelRoutingLogEntry } from '@/lib/types';
import { SCENARIO_DESCRIPTIONS } from '@/lib/config';
import DebugPanel from './DebugPanel';
import ChatFeed from './ChatFeed';
import AnalysisPanel from './AnalysisPanel';
import VoiceControls from './VoiceControls';
import ExportButton from './ExportButton';
import ModelRoutingPanel from './ModelRoutingPanel';
import TranscriptTab from './TranscriptTab';
import Panel from './shared/Panel';
import SectionHeader from './shared/SectionHeader';

// --- Grouped prop interfaces for clarity ---

export interface TranscriptControlProps {
  segments: TranscriptSegment[];
  interimTranscript?: string;
  isTranscribing: boolean;
  isTranscriptionSupported: boolean;
  onToggleTranscription: () => void;
  onAddSimulatedSegment?: (text: string) => void;
  transcriptionError?: string | null;
  speakingParticipants?: Array<{ id: string; displayName: string }>;
  isWhisperActive?: boolean;
}

export interface MetricsDisplayProps {
  currentMetrics: MetricSnapshot | null;
  metricsHistory: MetricSnapshot[];
  config: ExperimentConfig;
  decisionState: DecisionEngineState;
}

export interface VoiceControlProps {
  settings: VoiceSettings;
  onUpdateSettings: (updates: Partial<VoiceSettings>) => void;
  voices: SpeechSynthesisVoice[];
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
  children?: ReactNode;
}

type TabId = 'chat' | 'transcript' | 'analysis' | 'settings' | 'models' | 'debug';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'chat', label: 'Chat', icon: '💬' },
  { id: 'transcript', label: 'Transcript', icon: '📝' },
  { id: 'analysis', label: 'Analysis', icon: '📊' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
  { id: 'models', label: 'Models', icon: '🤖' },
  { id: 'debug', label: 'Debug', icon: '🔧' },
];

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
  children,
}: OverlayPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('transcript');

  return (
    <div className="h-full flex flex-col bg-slate-800/90 backdrop-blur-sm rounded-xl border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-white">AI Moderator</h2>
          <div className={`flex items-center gap-2 px-2 py-1 rounded text-xs ${isSessionActive
            ? 'bg-green-900/50 text-green-400'
            : 'bg-slate-700 text-slate-400'
            }`}>
            <span className={`w-2 h-2 rounded-full ${isSessionActive ? 'bg-green-400 animate-pulse' : 'bg-slate-500'}`} />
            {isSessionActive ? 'Active' : 'Inactive'}
          </div>
        </div>

        {/* Scenario Badge */}
        <div className="text-xs text-slate-400 bg-slate-700/50 rounded px-2 py-1.5">
          <span className="font-medium text-slate-300">
            {scenario === 'baseline' ? 'Baseline' : `Scenario ${scenario}`}:
          </span>{' '}
          {SCENARIO_DESCRIPTIONS[scenario].split(':')[1]?.trim() || SCENARIO_DESCRIPTIONS[scenario]}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-3 py-2.5 text-sm font-medium transition-colors ${activeTab === tab.id
              ? 'bg-slate-700/50 text-white border-b-2 border-blue-500'
              : 'text-slate-400 hover:text-white hover:bg-slate-700/30'
              }`}
          >
            <span className="mr-1.5">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'chat' && (
          <div className="h-full flex flex-col p-3">
            <ChatFeed interventions={interventions} />
            {children}
          </div>
        )}

        {activeTab === 'transcript' && (
          <TranscriptTab transcript={transcript} />
        )}

        {activeTab === 'analysis' && (
          <div className="h-full flex flex-col p-3">
            <AnalysisPanel
              currentMetrics={metrics.currentMetrics}
              config={metrics.config}
              decisionState={metrics.decisionState}
            />
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="h-full flex flex-col p-3 space-y-4 overflow-y-auto">
            <Panel>
              <SectionHeader icon="🔊" size="page">Voice Settings</SectionHeader>
              <VoiceControls
                settings={voice.settings}
                voices={voice.voices}
                isSpeaking={voice.isSpeaking}
                canSpeak={true}
                language={language}
                onUpdateSettings={voice.onUpdateSettings}
                onTestVoice={voice.onTestVoice}
                onCancel={voice.onCancelVoice}
              />
            </Panel>

            <Panel>
              <SectionHeader icon="📥" size="page">Export Session</SectionHeader>
              <ExportButton
                sessionLog={sessionLog}
                roomName={roomName}
              />
            </Panel>
          </div>
        )}

        {activeTab === 'models' && (
          <div className="h-full flex flex-col p-3">
            <ModelRoutingPanel logEntries={modelRoutingLog} />
          </div>
        )}

        {activeTab === 'debug' && (
          <div className="h-full flex flex-col p-3">
            <DebugPanel
              currentMetrics={metrics.currentMetrics}
              metricsHistory={metrics.metricsHistory}
              config={metrics.config}
              decisionState={metrics.decisionState}
              showConfig={true}
            />
          </div>
        )}
      </div>

      {/* Footer Controls */}
      <div className="p-4 border-t border-slate-700">
        <button
          onClick={onEndSession}
          className="w-full py-2.5 bg-red-600/80 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors"
        >
          End Session
        </button>
      </div>
    </div>
  );
}
