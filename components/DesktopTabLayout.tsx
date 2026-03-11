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
import DashboardTab from './DashboardTab';
import SettingsTab from './SettingsTab';
import TranscriptTab from './TranscriptTab';

// ─── Types ────────────────────────────────────────────────────────────────────

type RightTab = 'dashboard' | 'ideas' | 'transcript' | 'settings';

const RIGHT_TABS: { id: RightTab; icon: string; label: string }[] = [
    { id: 'dashboard', icon: '📊', label: 'Dashboard' },
    { id: 'ideas', icon: '💡', label: 'Ideas' },
    { id: 'transcript', icon: '📝', label: 'Transcript' },
    { id: 'settings', icon: '⚙️', label: 'Settings' },
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

/**
 * Desktop tab container with a fixed 60/40 split: video on the left,
 * tabbed panel (Dashboard, Ideas, Transcript, Settings) on the right.
 * All tab contents stay mounted to preserve scroll position and state.
 *
 * @param props.liveKitSlot - Rendered LiveKit video component.
 * @param props.ideaBoardSlot - Rendered idea board component.
 * @param props.scenario - Active experiment scenario.
 * @param props.health - System health status for header indicator.
 * @param props.liveSummary - AI-generated session summary for the dashboard.
 */
export default function DesktopTabLayout(props: DesktopTabLayoutProps) {
    const [activeTab, setActiveTab] = useState<RightTab>('dashboard');

    // Derive overall system health for the compact header indicator
    const overallHealth = props.health ? computeOverallHealth(props.health) : null;

    return (
        <div className="h-full flex">
            {/* ── Left: Video (60%) ── */}
            <div className="flex flex-col min-w-0 min-h-0 p-2 pr-0" style={{ width: '60%' }}>
                <div className="flex-1 min-h-0">
                    {props.liveKitSlot}
                </div>
            </div>

            {/* ── Right: Tabbed Panel (40%) ── */}
            <div className="flex flex-col border-l border-slate-700 bg-slate-800/90 backdrop-blur-sm" style={{ width: '40%' }}>

                {/* Panel header */}
                <div className="px-3 py-2 border-b border-slate-700 shrink-0">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-white">AI Moderator</span>
                        <div className="flex items-center gap-1.5">
                            {overallHealth && (
                                <button
                                    onClick={() => setActiveTab('settings')}
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
                    <div className={`h-full ${activeTab === 'dashboard' ? 'block' : 'hidden'}`}>
                        <DashboardTab
                            currentMetrics={props.metrics.currentMetrics}
                            config={props.metrics.config}
                            decisionState={props.metrics.decisionState}
                            interventions={props.interventions}
                            liveSummary={props.liveSummary}
                        />
                    </div>

                    <div className={`h-full ${activeTab === 'ideas' ? 'block' : 'hidden'}`}>
                        {props.ideaBoardSlot}
                    </div>

                    <div className={`h-full ${activeTab === 'transcript' ? 'block' : 'hidden'}`}>
                        <TranscriptTab transcript={props.transcript} />
                    </div>

                    <div className={`h-full ${activeTab === 'settings' ? 'block' : 'hidden'}`}>
                        <SettingsTab
                            voice={props.voice}
                            config={props.metrics.config}
                            onUpdateConfig={props.onUpdateConfig}
                            onResetConfig={props.onResetConfig}
                            health={props.health}
                            modelRoutingLog={props.modelRoutingLog}
                            sessionLog={props.sessionLog}
                            roomName={props.roomName}
                            onEndSession={props.onEndSession}
                            currentMetrics={props.metrics.currentMetrics}
                            metricsHistory={props.metrics.metricsHistory}
                            decisionState={props.metrics.decisionState}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
