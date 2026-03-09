'use client';

import { useState, ReactNode } from 'react';
import {
    Scenario, Intervention, ExperimentConfig,
    VoiceSettings, SessionLog, ModelRoutingLogEntry,
} from '@/lib/types';
import type { LiveSummaryState } from '@/lib/hooks/useLiveSummary';
import { SCENARIO_DESCRIPTIONS } from '@/lib/config';
import { computeOverallHealth, SystemHealthProps } from './SystemHealthPanel';
import type { TranscriptControlProps, MetricsDisplayProps, VoiceControlProps } from './OverlayPanel';
import ChatFeed from './ChatFeed';
import AnalysisPanel from './AnalysisPanel';
import VoiceControls from './VoiceControls';
import ExportButton from './ExportButton';
import ModelRoutingPanel from './ModelRoutingPanel';
import LiveTuningPanel from './LiveTuningPanel';
import TranscriptTab from './TranscriptTab';
import SystemHealthPanel from './SystemHealthPanel';
import DebugPanel from './DebugPanel';
import LiveSummaryTab from './LiveSummaryTab';
import Panel from './shared/Panel';
import SectionHeader from './shared/SectionHeader';

// ─── Types ────────────────────────────────────────────────────────────────────

type RightTab = 'transcript' | 'ideas' | 'summary' | 'analysis' | 'controls';

const RIGHT_TABS: { id: RightTab; icon: string; label: string }[] = [
    { id: 'transcript', icon: '📝', label: 'Transcript' },
    { id: 'ideas', icon: '💡', label: 'Ideas' },
    { id: 'summary', icon: '📋', label: 'Summary' },
    { id: 'analysis', icon: '📊', label: 'Analysis' },
    { id: 'controls', icon: '⚙️', label: 'Controls' },
];

export interface DesktopTabLayoutProps {
    // Content slots
    liveKitSlot: ReactNode;
    ideaBoardSlot: ReactNode;

    // Data
    scenario: Scenario;
    isSessionActive: boolean;
    onEndSession: () => void;
    transcript: TranscriptControlProps;
    metrics: MetricsDisplayProps;
    voice: VoiceControlProps;
    interventions: Intervention[];
    sessionLog: SessionLog;
    modelRoutingLog: ModelRoutingLogEntry[];
    onUpdateConfig?: (key: keyof ExperimentConfig, value: number | boolean | [number, number, number, number]) => void;
    onResetConfig?: () => void;
    health?: SystemHealthProps;
    roomName: string;
    liveSummary: LiveSummaryState;
}

// ─── Controls sub-panel ───────────────────────────────────────────────────────

type ControlSection = 'voice' | 'chat' | 'models' | 'health' | 'tuning' | 'debug';

const CONTROL_SECTIONS: { id: ControlSection; icon: string; label: string }[] = [
    { id: 'chat', icon: '💬', label: 'Chat' },
    { id: 'voice', icon: '🔊', label: 'Voice' },
    { id: 'models', icon: '🤖', label: 'Models' },
    { id: 'health', icon: '🩺', label: 'Health' },
    { id: 'tuning', icon: '🎛️', label: 'Tuning' },
    { id: 'debug', icon: '🔧', label: 'Debug' },
];

function ControlsPanel({
    voice, sessionLog, modelRoutingLog, metrics, health, interventions,
    onUpdateConfig, onResetConfig, onEndSession, roomName,
}: Pick<DesktopTabLayoutProps,
    'voice' | 'sessionLog' | 'modelRoutingLog' | 'metrics' | 'health' | 'interventions' |
    'onUpdateConfig' | 'onResetConfig' | 'onEndSession' | 'roomName'
>) {
    const [section, setSection] = useState<ControlSection>('voice');

    return (
        <div className="h-full flex flex-col">
            {/* Section tabs */}
            <div className="flex gap-1 p-2 border-b border-slate-700 flex-wrap shrink-0">
                {CONTROL_SECTIONS.map(s => (
                    <button
                        key={s.id}
                        onClick={() => setSection(s.id)}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${section === s.id
                            ? 'bg-blue-600/30 text-blue-300 border border-blue-600/50'
                            : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                            }`}
                    >
                        <span>{s.icon}</span>
                        <span>{s.label}</span>
                    </button>
                ))}
            </div>

            {/* Section content */}
            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
                {section === 'chat' && (
                    <ChatFeed interventions={interventions} />
                )}
                {section === 'voice' && (
                    <>
                        <Panel>
                            <SectionHeader icon="🔊" size="page">Voice Settings</SectionHeader>
                            <VoiceControls
                                settings={voice.settings}
                                isSpeaking={voice.isSpeaking}
                                canSpeak={true}
                                onUpdateSettings={voice.onUpdateSettings}
                                onTestVoice={voice.onTestVoice}
                                onCancel={voice.onCancelVoice}
                            />
                        </Panel>
                        <Panel>
                            <SectionHeader icon="📥" size="page">Export Session</SectionHeader>
                            <ExportButton sessionLog={sessionLog} roomName={roomName} />
                        </Panel>
                    </>
                )}
                {section === 'models' && (
                    <ModelRoutingPanel logEntries={modelRoutingLog} />
                )}
                {section === 'health' && health && (
                    <SystemHealthPanel health={health} />
                )}
                {section === 'tuning' && onUpdateConfig && onResetConfig && (
                    <LiveTuningPanel
                        config={metrics.config}
                        onUpdateConfig={onUpdateConfig}
                        onResetAll={onResetConfig}
                    />
                )}
                {section === 'debug' && (
                    <DebugPanel
                        currentMetrics={metrics.currentMetrics}
                        metricsHistory={metrics.metricsHistory}
                        config={metrics.config}
                        decisionState={metrics.decisionState}
                        showConfig={true}
                    />
                )}
            </div>

            {/* End session */}
            <div className="p-3 border-t border-slate-700 shrink-0">
                <button
                    onClick={onEndSession}
                    className="w-full py-2 bg-red-600/80 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                    End Session
                </button>
            </div>
        </div>
    );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function DesktopTabLayout(props: DesktopTabLayoutProps) {
    const [activeTab, setActiveTab] = useState<RightTab>('transcript');

    const overallHealth = props.health ? computeOverallHealth(props.health) : null;

    return (
        <div className="h-full flex">
            {/* ── Left: Video (always visible) ── */}
            <div className="flex-1 w-1/2 min-w-0 min-h-0 p-2 pr-0">
                {props.liveKitSlot}
            </div>

            {/* ── Right: Tabbed Panel ── */}
            <div className="flex-1 w-1/2 shrink-0 flex flex-col border-l border-slate-700 bg-slate-800/90 backdrop-blur-sm">

                {/* Panel header: scenario + health + active status */}
                <div className="px-3 py-2 border-b border-slate-700 shrink-0">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-white">AI Moderator</span>
                        <div className="flex items-center gap-1.5">
                            {overallHealth && (
                                <button
                                    onClick={() => setActiveTab('controls')}
                                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition-colors ${overallHealth === 'healthy' ? 'bg-green-900/30 text-green-400 hover:bg-green-900/50' :
                                        overallHealth === 'degraded' ? 'bg-yellow-900/30 text-yellow-400 hover:bg-yellow-900/50' :
                                            'bg-red-900/30 text-red-400 hover:bg-red-900/50'
                                        }`}
                                    title="System Health"
                                >
                                    <span className={`w-1.5 h-1.5 rounded-full ${overallHealth === 'healthy' ? 'bg-green-400' :
                                        overallHealth === 'degraded' ? 'bg-yellow-400 animate-pulse' :
                                            'bg-red-400 animate-pulse'
                                        }`} />
                                    <span>{overallHealth === 'error' ? 'Issues' : overallHealth === 'degraded' ? 'Warn' : 'OK'}</span>
                                </button>
                            )}
                            <span className={`text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1 ${props.isSessionActive ? 'bg-green-900/50 text-green-400' : 'bg-slate-700 text-slate-400'
                                }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${props.isSessionActive ? 'bg-green-400 animate-pulse' : 'bg-slate-500'
                                    }`} />
                                {props.isSessionActive ? 'Active' : 'Inactive'}
                            </span>
                        </div>
                    </div>
                    <div className="text-xs text-slate-400 bg-slate-700/40 rounded px-2 py-1 leading-tight">
                        <span className="font-medium text-slate-300">
                            {props.scenario === 'baseline' ? 'Baseline' : `Scenario ${props.scenario}`}:
                        </span>{' '}
                        {SCENARIO_DESCRIPTIONS[props.scenario].split(':')[1]?.trim() || SCENARIO_DESCRIPTIONS[props.scenario]}
                    </div>
                </div>

                {/* Tab bar */}
                <div className="flex border-b border-slate-700 shrink-0">
                    {RIGHT_TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-xs font-medium transition-colors border-b-2 ${activeTab === tab.id
                                ? 'text-white border-blue-500 bg-slate-700/40'
                                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-700/20'
                                }`}
                        >
                            <span className="text-base leading-none">{tab.icon}</span>
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </div>

                {/* Tab content — always mounted to preserve state */}
                <div className="flex-1 min-h-0 overflow-hidden">
                    <div className={`h-full ${activeTab === 'transcript' ? 'block' : 'hidden'}`}>
                        <TranscriptTab transcript={props.transcript} />
                    </div>

                    <div className={`h-full overflow-hidden ${activeTab === 'ideas' ? 'block' : 'hidden'}`}>
                        {props.ideaBoardSlot}
                    </div>

                    <div className={`h-full overflow-y-auto p-3 ${activeTab === 'analysis' ? 'block' : 'hidden'}`}>
                        <AnalysisPanel
                            currentMetrics={props.metrics.currentMetrics}
                            config={props.metrics.config}
                            decisionState={props.metrics.decisionState}
                        />
                    </div>

                    <div className={`h-full ${activeTab === 'summary' ? 'block' : 'hidden'}`}>
                        <LiveSummaryTab liveSummary={props.liveSummary} />
                    </div>

                    <div className={`h-full ${activeTab === 'controls' ? 'block' : 'hidden'}`}>
                        <ControlsPanel
                            voice={props.voice}
                            sessionLog={props.sessionLog}
                            modelRoutingLog={props.modelRoutingLog}
                            metrics={props.metrics}
                            health={props.health}
                            interventions={props.interventions}
                            onUpdateConfig={props.onUpdateConfig}
                            onResetConfig={props.onResetConfig}
                            onEndSession={props.onEndSession}
                            roomName={props.roomName}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
