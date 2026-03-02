'use client';

import { ReactNode, useState } from 'react';
import { Scenario, TranscriptSegment, MetricSnapshot, ExperimentConfig, DecisionEngineState, Intervention, VoiceSettings, SessionLog, ModelRoutingLogEntry } from '@/lib/types';
import { SCENARIO_DESCRIPTIONS } from '@/lib/config';
import TranscriptFeed from './TranscriptFeed';
import DebugPanel from './DebugPanel';
import ChatFeed from './ChatFeed';
import VoiceControls from './VoiceControls';
import ExportButton from './ExportButton';
import ModelRoutingPanel from './ModelRoutingPanel';

interface OverlayPanelProps {
  scenario: Scenario;
  isSessionActive: boolean;
  onEndSession: () => void;
  // Transcript props
  transcriptSegments: TranscriptSegment[];
  interimTranscript?: string;
  isTranscribing: boolean;
  isTranscriptionSupported: boolean;
  onToggleTranscription: () => void;
  onAddSimulatedSegment?: (text: string) => void;
  transcriptionError?: string | null;
  // Metrics props
  currentMetrics: MetricSnapshot | null;
  metricsHistory: MetricSnapshot[];
  config: ExperimentConfig;
  decisionState: DecisionEngineState;
  // Interventions
  interventions: Intervention[];
  // Voice
  voiceSettings: VoiceSettings;
  onUpdateVoiceSettings: (updates: Partial<VoiceSettings>) => void;
  voices: SpeechSynthesisVoice[];
  isSpeaking: boolean;
  onTestVoice: () => void;
  onCancelVoice: () => void;
  // Session
  language: string;
  sessionLog: SessionLog;
  modelRoutingLog: ModelRoutingLogEntry[];
  roomName: string;
  children?: ReactNode;
}

type TabId = 'chat' | 'transcript' | 'settings' | 'models' | 'debug';

export default function OverlayPanel({
  scenario,
  isSessionActive,
  onEndSession,
  transcriptSegments,
  interimTranscript = '',
  isTranscribing,
  isTranscriptionSupported,
  onToggleTranscription,
  onAddSimulatedSegment,
  transcriptionError,
  currentMetrics,
  metricsHistory,
  config,
  decisionState,
  interventions,
  voiceSettings,
  onUpdateVoiceSettings,
  voices,
  isSpeaking,
  onTestVoice,
  onCancelVoice,
  language,
  sessionLog,
  modelRoutingLog,
  roomName,
  children,
}: OverlayPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('transcript');
  const [simText, setSimText] = useState('');

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: 'chat', label: 'Chat', icon: '💬' },
    { id: 'transcript', label: 'Transcript', icon: '📝' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
    { id: 'models', label: 'Models', icon: '🤖' },
    { id: 'debug', label: 'Debug', icon: '🔧' },
  ];

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
        {tabs.map((tab) => (
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
          <div className="h-full flex flex-col">
            {/* Transcription Controls */}
            <div className="p-3 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isTranscriptionSupported ? (
                  <button
                    onClick={onToggleTranscription}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isTranscribing
                      ? 'bg-red-600/80 hover:bg-red-600 text-white'
                      : 'bg-blue-600/80 hover:bg-blue-600 text-white'
                      }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${isTranscribing ? 'bg-white animate-pulse' : 'bg-white/50'}`} />
                    {isTranscribing ? 'Stop' : 'Start'} 🎤
                  </button>
                ) : (
                  <span className="text-xs text-yellow-400">
                    ⚠️ Simulation mode (no mic)
                  </span>
                )}
              </div>
              {transcriptSegments.length > 0 && (
                <span className="text-xs text-slate-500">
                  {transcriptSegments.length} segments
                </span>
              )}
            </div>

            {/* Error display */}
            {transcriptionError && (
              <div className="px-3 py-2 bg-red-900/30 text-red-400 text-xs">
                {transcriptionError}
              </div>
            )}

            {/* Simulation Input (fallback when no mic) */}
            {!isTranscriptionSupported && onAddSimulatedSegment && (
              <div className="px-3 py-2 border-b border-slate-700">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={simText}
                    onChange={(e) => setSimText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && simText.trim()) {
                        onAddSimulatedSegment(simText.trim());
                        setSimText('');
                      }
                    }}
                    placeholder="Paste/type transcript..."
                    className="flex-1 px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => {
                      if (simText.trim()) {
                        onAddSimulatedSegment(simText.trim());
                        setSimText('');
                      }
                    }}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-medium"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}

            {/* Transcript Feed */}
            <div className="flex-1 overflow-hidden p-3">
              <TranscriptFeed
                segments={transcriptSegments}
                interimText={interimTranscript}
                showTimestamps={true}
              />
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="h-full flex flex-col p-3 space-y-4 overflow-y-auto">
            {/* Voice Settings */}
            <section className="bg-slate-700/30 rounded-lg p-3">
              <h3 className="text-sm font-medium text-slate-300 mb-3">🔊 Voice Settings</h3>
              <VoiceControls
                settings={voiceSettings}
                voices={voices}
                isSpeaking={isSpeaking}
                canSpeak={true}
                language={language}
                onUpdateSettings={onUpdateVoiceSettings}
                onTestVoice={onTestVoice}
                onCancel={onCancelVoice}
              />
            </section>

            {/* Export */}
            <section className="bg-slate-700/30 rounded-lg p-3">
              <h3 className="text-sm font-medium text-slate-300 mb-3">📥 Export Session</h3>
              <ExportButton
                sessionLog={sessionLog}
                roomName={roomName}
              />
            </section>
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
              currentMetrics={currentMetrics}
              metricsHistory={metricsHistory}
              config={config}
              decisionState={decisionState}
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










