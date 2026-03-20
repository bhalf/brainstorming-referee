'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { exportSession } from '@/lib/api-client';
import type { SessionExport } from '@/types';
import { formatDuration, getSessionDurationMs } from '@/components/review/utils';

// Dynamic imports to avoid SSR issues with Recharts
const OverviewTab = dynamic(() => import('@/components/review/OverviewTab'), { ssr: false });
const MetricsTimelineChart = dynamic(() => import('@/components/review/MetricsTimelineChart'), { ssr: false });
const StateDurationChart = dynamic(() => import('@/components/review/StateDurationChart'), { ssr: false });
const InterventionPanel = dynamic(() => import('@/components/review/InterventionPanel'), { ssr: false });
const ParticipantBreakdown = dynamic(() => import('@/components/review/ParticipantBreakdown'), { ssr: false });
const TranscriptTab = dynamic(() => import('@/components/review/TranscriptTab'), { ssr: false });
const IdeasTab = dynamic(() => import('@/components/review/IdeasTab'), { ssr: false });
const GoalsTab = dynamic(() => import('@/components/review/GoalsTab'), { ssr: false });
const TopicsTab = dynamic(() => import('@/components/review/TopicsTab'), { ssr: false });
const IdeasTimelineChart = dynamic(() => import('@/components/review/IdeasTimelineChart'), { ssr: false });
const IdeaBoard = dynamic(() => import('@/components/session/IdeaBoard'), { ssr: false });

type Tab = 'overview' | 'metrics' | 'interventions' | 'participants' | 'transcript' | 'ideas' | 'goals' | 'topics';

const TABS: { id: Tab; label: string; requiresFeature?: string }[] = [
  { id: 'overview', label: 'Übersicht' },
  { id: 'metrics', label: 'Metriken' },
  { id: 'interventions', label: 'Interventionen' },
  { id: 'participants', label: 'Teilnehmer' },
  { id: 'transcript', label: 'Transkript' },
  { id: 'ideas', label: 'Ideen', requiresFeature: 'ideas' },
  { id: 'goals', label: 'Ziele', requiresFeature: 'goals' },
  { id: 'topics', label: 'Themen' },
];

export default function ReviewPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [data, setData] = useState<SessionExport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  useEffect(() => {
    exportSession(sessionId)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-ambient flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="spinner mb-4" />
          <p className="text-sm text-[var(--text-tertiary)]">Lade Session-Daten...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-ambient flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <p className="text-rose-400 mb-4">{error || 'Session nicht gefunden'}</p>
          <button onClick={() => router.push('/dashboard')} className="btn-glass text-sm px-4 py-2">
            Zum Dashboard
          </button>
        </div>
      </div>
    );
  }

  const { session } = data;
  const durationMs = getSessionDurationMs(session.started_at, session.ended_at);
  const enabledFeatures = session.enabled_features || [];

  // Filter tabs by enabled features + data availability
  const visibleTabs = TABS.filter((tab) => {
    if (tab.id === 'topics') return (data.topics?.length ?? 0) > 0;
    if (!tab.requiresFeature) return true;
    return enabledFeatures.includes(tab.requiresFeature as any);
  });

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session-${sessionId}-export.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-ambient">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="animate-fade-in mb-6">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] text-sm mb-3 transition-colors inline-flex items-center gap-1"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Dashboard
          </button>

          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{session.title}</h1>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-[var(--text-tertiary)]">
                {session.started_at && (
                  <span>
                    {new Date(session.started_at).toLocaleDateString('de-CH', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                )}
                <span>{formatDuration(durationMs)}</span>
                <span>{data.participants.length} Teilnehmer</span>
                <span>{data.interventions.length} Interventionen</span>
                <span>{data.ideas.filter((i) => !i.is_deleted).length} Ideen</span>
              </div>
            </div>
            <button
              onClick={handleExportJSON}
              className="btn-glass text-xs px-4 py-2 shrink-0 inline-flex items-center gap-1.5"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
              Export JSON
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 mb-6 overflow-x-auto pb-1 animate-fade-in">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`text-sm px-4 py-2 rounded-xl font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-white/[0.04] border border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="animate-fade-in">
          {activeTab === 'overview' && <OverviewTab data={data} />}
          {activeTab === 'metrics' && (
            <div className="space-y-5">
              <MetricsTimelineChart data={data} />
              <StateDurationChart data={data} />
            </div>
          )}
          {activeTab === 'interventions' && <InterventionPanel data={data} />}
          {activeTab === 'participants' && <ParticipantBreakdown data={data} />}
          {activeTab === 'transcript' && <TranscriptTab data={data} />}
          {activeTab === 'ideas' && (
            <div className="space-y-5">
              <div className="glass overflow-hidden h-[500px]">
                <IdeaBoard
                  ideas={data.ideas}
                  connections={data.connections}
                  sessionId={sessionId}
                  language={session.language}
                  readOnly
                />
              </div>
              <IdeasTimelineChart data={data} />
              <IdeasTab data={data} />
            </div>
          )}
          {activeTab === 'goals' && <GoalsTab data={data} />}
          {activeTab === 'topics' && <TopicsTab data={data} />}
        </div>
      </div>
    </div>
  );
}
