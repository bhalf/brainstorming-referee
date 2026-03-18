'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { getSession, getLivekitToken, endSession, promoteToCoHost, transferHost } from '@/lib/api-client';
import { useSessionData } from '@/lib/hooks/useSessionData';
import type { Session, FeatureKey, SessionParticipant } from '@/types';

const VideoGrid = dynamic(() => import('@/components/session/VideoGrid'));
const TranscriptFeed = dynamic(() => import('@/components/session/TranscriptFeed'));
const MetricsPanel = dynamic(() => import('@/components/session/MetricsPanel'));
const IdeaBoard = dynamic(() => import('@/components/session/IdeaBoard'));
const InterventionOverlay = dynamic(() => import('@/components/session/InterventionOverlay'));
const GoalsPanel = dynamic(() => import('@/components/session/GoalsPanel'));
const SummaryPanel = dynamic(() => import('@/components/session/SummaryPanel'));

type Tab = 'transcript' | 'metrics' | 'ideas' | 'goals' | 'summary';

const ALL_TABS: { id: Tab; label: string; icon: string; feature?: FeatureKey }[] = [
  { id: 'transcript', label: 'Transkript', icon: 'M4 6h16M4 12h16M4 18h12' },
  { id: 'metrics', label: 'Metriken', icon: 'M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z', feature: 'metrics' },
  { id: 'ideas', label: 'Ideen', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z', feature: 'ideas' },
  { id: 'goals', label: 'Ziele', icon: 'M13 10V3L4 14h7v7l9-11h-7z', feature: 'goals' },
  { id: 'summary', label: 'Zusammenfassung', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', feature: 'summary' },
];

// Deterministic color from identity string
const AVATAR_COLORS = [
  'bg-indigo-500', 'bg-violet-500', 'bg-pink-500', 'bg-rose-500',
  'bg-amber-500', 'bg-emerald-500', 'bg-teal-500', 'bg-cyan-500',
];

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getAvatarColor(identity: string) {
  return AVATAR_COLORS[hashCode(identity) % AVATAR_COLORS.length];
}

// --- Idle Countdown Hook ---
function useIdleCountdown(idleSinceAt: string | null, timeoutMinutes = 5) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!idleSinceAt) { setRemaining(null); return; }

    const endTime = new Date(idleSinceAt).getTime() + timeoutMinutes * 60 * 1000;
    const tick = () => {
      const left = Math.max(0, endTime - Date.now());
      setRemaining(Math.ceil(left / 1000));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [idleSinceAt, timeoutMinutes]);

  if (remaining === null) return null;
  const min = Math.floor(remaining / 60);
  const sec = remaining % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

// --- Participant Avatar ---
function ParticipantAvatar({ participant, showControls, isHost: viewerIsHost, sessionId }: {
  participant: SessionParticipant;
  showControls: boolean;
  isHost: boolean;
  sessionId: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const handlePromote = async () => {
    setMenuOpen(false);
    try { await promoteToCoHost(sessionId, participant.livekit_identity); } catch { /* best effort */ }
  };

  const handleTransfer = async () => {
    setMenuOpen(false);
    try { await transferHost(sessionId, participant.livekit_identity); } catch { /* best effort */ }
  };

  const initial = participant.display_name.charAt(0).toUpperCase();
  const color = getAvatarColor(participant.livekit_identity);
  const isParticipantHost = participant.role === 'host';
  const isParticipantCoHost = participant.role === 'co_host';

  return (
    <div ref={ref} className="relative group">
      <div
        className={`relative w-8 h-8 rounded-full ${color} flex items-center justify-center text-xs font-bold text-white cursor-default`}
        title={`${participant.display_name}${isParticipantHost ? ' (Host)' : isParticipantCoHost ? ' (Co-Host)' : ''}`}
        onClick={() => showControls && setMenuOpen(!menuOpen)}
      >
        {initial}
        {participant.is_active && (
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[var(--bg-base)]" />
        )}
        {isParticipantHost && (
          <span className="absolute -top-1 -right-1 text-[8px]">👑</span>
        )}
        {isParticipantCoHost && (
          <span className="absolute -top-1 -right-1 text-[8px]">⭐</span>
        )}
      </div>

      {/* Dropdown menu for host controls */}
      {menuOpen && showControls && participant.role !== 'host' && (
        <div className="absolute top-full right-0 mt-1 z-50 w-48 glass-sm p-1 rounded-xl border border-[var(--border-glass)] shadow-xl animate-fade-in">
          {viewerIsHost && (
            <>
              {participant.role !== 'co_host' && (
                <button
                  onClick={handlePromote}
                  className="w-full text-left px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-white/[0.06] rounded-lg transition-colors"
                >
                  Zum Co-Host machen
                </button>
              )}
              <button
                onClick={handleTransfer}
                className="w-full text-left px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-white/[0.06] rounded-lg transition-colors"
              >
                Host übergeben
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function SessionPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = params.id as string;

  const [session, setSession] = useState<Session | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('transcript');
  const [isConnected, setIsConnected] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);
  const [mobileView, setMobileView] = useState<'video' | 'ideas' | 'panel'>('video');
  const [isTTSPlaying, setIsTTSPlaying] = useState(false);

  const myIdentity = searchParams.get('identity');
  const myName = searchParams.get('name');

  const data = useSessionData(sessionId, myIdentity);

  // Redirect to join page if no identity (user hasn't joined properly)
  useEffect(() => {
    if (!myIdentity && session?.join_code) {
      router.replace(`/join/${session.join_code}`);
    }
  }, [myIdentity, session, router]);

  // Use realtime session state for idle/ended detection
  const liveSession = data.realtimeSession ?? session;
  const enabledFeatures = liveSession?.enabled_features ?? [];
  const hasModeration = liveSession ? liveSession.moderation_level !== 'none' : false;
  const hasFeature = (f: FeatureKey) => enabledFeatures.includes(f);
  const visibleTabs = ALL_TABS.filter((t) => !t.feature || hasFeature(t.feature));

  const idleCountdown = useIdleCountdown(data.isIdle ? (liveSession?.idle_since_at ?? null) : null);

  // Auto-redirect on ended
  useEffect(() => {
    if (!data.isEnded) return;
    const timeout = setTimeout(() => router.push('/dashboard'), 5000);
    return () => clearTimeout(timeout);
  }, [data.isEnded, router]);

  useEffect(() => {
    async function init() {
      try {
        const sessionData = await getSession(sessionId);
        setSession(sessionData);

        if (!myIdentity) return; // Will redirect via useEffect above

        const tokenResult = await getLivekitToken(sessionId, myIdentity, myName || myIdentity);
        setToken(tokenResult.token);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Session konnte nicht geladen werden');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [sessionId, myIdentity, myName]);

  useEffect(() => {
    setIsMounted(true);
    const mql = window.matchMedia('(min-width: 1024px)');
    setIsDesktop(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  const handleEndSession = useCallback(async () => {
    try {
      await endSession(sessionId);
    } catch {
      // Best effort
    }
    router.push('/dashboard');
  }, [sessionId, router]);

  const handleDisconnected = useCallback(() => {
    router.push('/dashboard');
  }, [router]);

  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || '';

  // Participant display (max 4 + overflow)
  const visibleParticipants = useMemo(() => data.participants.slice(0, 4), [data.participants]);
  const overflowCount = Math.max(0, data.participants.length - 4);
  const showHostControls = data.isHost || data.isCoHost;

  if (loading) {
    return (
      <div className="min-h-screen bg-ambient flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="spinner mx-auto mb-4" />
          <p className="text-[var(--text-tertiary)] text-sm">Session wird geladen...</p>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-ambient flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <p className="text-rose-400 mb-4">{error || 'Session nicht gefunden'}</p>
          <button onClick={() => router.push('/')} className="btn-glass text-sm px-4 py-2">
            Zur Startseite
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen overflow-hidden flex flex-col" style={{ background: 'var(--bg-base)', height: '100dvh' }}>
      {/* Ended Modal */}
      {data.isEnded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass p-8 rounded-2xl text-center max-w-sm mx-4">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/5 mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-tertiary)]">
                <path d="M18.36 6.64A9 9 0 015.64 18.36M5.64 5.64A9 9 0 0118.36 18.36" />
              </svg>
            </div>
            <h2 className="text-lg font-bold mb-2">Session wurde beendet</h2>
            <p className="text-sm text-[var(--text-tertiary)] mb-6">Weiterleitung zum Dashboard in wenigen Sekunden...</p>
            <button
              onClick={() => router.push('/dashboard')}
              className="btn-primary text-sm px-6 py-2.5"
            >
              Zum Dashboard
            </button>
          </div>
        </div>
      )}

      {/* Idle Banner */}
      {data.isIdle && !data.isEnded && (
        <div className="shrink-0 bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5 flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
              <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
            </svg>
            <span className="text-sm text-amber-300">
              Session pausiert — alle haben den Raum verlassen. Sie können jederzeit neu beitreten.
            </span>
          </div>
          {idleCountdown && (
            <span className="text-xs font-mono text-amber-400/70 shrink-0 ml-3">
              Auto-End in {idleCountdown}
            </span>
          )}
        </div>
      )}

      {/* Header */}
      <header className="h-13 shrink-0 bg-white/[0.03] backdrop-blur-xl border-b border-[var(--border-glass)] flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors p-1"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <h1 className="text-[var(--text-primary)] font-medium text-sm truncate max-w-[200px]">
            {session.title}
          </h1>
          <span className="text-xs font-mono bg-white/[0.06] text-[var(--text-tertiary)] px-2.5 py-1 rounded-lg">
            {session.join_code}
          </span>

          {/* Own Role Badge */}
          {data.isHost && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">
              Host
            </span>
          )}
          {data.isCoHost && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/10 text-white/60 border border-white/10">
              Co-Host
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Participant Avatars */}
          {visibleParticipants.length > 0 && (
            <div className="flex items-center -space-x-1.5">
              {visibleParticipants.map((p) => (
                <ParticipantAvatar
                  key={p.id}
                  participant={p}
                  showControls={showHostControls}
                  isHost={data.isHost}
                  sessionId={sessionId}
                />
              ))}
              {overflowCount > 0 && (
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-medium text-[var(--text-tertiary)] border-2 border-[var(--bg-base)]">
                  +{overflowCount}
                </div>
              )}
            </div>
          )}

          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${
            isConnected
              ? 'bg-emerald-500/10 text-emerald-400'
              : 'bg-amber-500/10 text-amber-400'
          }`}>
            <span className={isConnected ? 'status-dot status-dot-live' : 'status-dot status-dot-connecting'} />
            {isConnected ? 'Verbunden' : 'Verbinde...'}
          </div>
          {data.isConnected && (
            <span className="text-xs text-[var(--text-tertiary)] bg-white/[0.04] px-2 py-1 rounded-md">Realtime</span>
          )}
          {(data.isHost || data.isCoHost) && (
            <button
              onClick={handleEndSession}
              className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg text-xs font-medium border border-rose-500/20 transition-all"
            >
              Beenden
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* Desktop Layout */}
        {isMounted && isDesktop && (
          <div className="flex-1 min-h-0 flex overflow-hidden">
            {/* Left: Video */}
            <div className="w-[60%] min-w-0">
              {hasModeration ? (
                <InterventionOverlay
                  intervention={data.latestIntervention}
                  onDismiss={data.dismissIntervention}
                  isTTSPlaying={isTTSPlaying}
                >
                  {token && (
                    <VideoGrid
                      token={token}
                      serverUrl={livekitUrl}
                      onConnectionChange={setIsConnected}
                      onDisconnected={handleDisconnected}
                      onTTSStateChange={setIsTTSPlaying}
                    />
                  )}
                </InterventionOverlay>
              ) : (
                token && (
                  <VideoGrid
                    token={token}
                    serverUrl={livekitUrl}
                    onConnectionChange={setIsConnected}
                    onDisconnected={handleDisconnected}
                  />
                )
              )}
            </div>

            {/* Right: Tabbed Sidebar */}
            <div className="w-[40%] min-w-0 border-l border-[var(--border-glass)] flex flex-col bg-white/[0.01]">
              {/* Tab Bar */}
              <div className="flex border-b border-[var(--border-glass)] px-1">
                {visibleTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-all relative ${
                      activeTab === tab.id
                        ? 'text-indigo-400'
                        : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                    }`}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d={tab.icon} />
                    </svg>
                    {tab.label}
                    {activeTab === tab.id && (
                      <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full" />
                    )}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="flex-1 min-h-0 overflow-hidden">
                <div className={activeTab === 'transcript' ? 'h-full' : 'hidden'}>
                  <TranscriptFeed segments={data.segments} />
                </div>
                {hasFeature('metrics') && (
                  <div className={activeTab === 'metrics' ? 'h-full' : 'hidden'}>
                    <MetricsPanel
                      latest={data.latestMetrics}
                      history={data.metricsHistory}
                      engineState={data.engineState}
                      participants={data.allParticipants}
                      interventions={data.interventions}
                    />
                  </div>
                )}
                {hasFeature('ideas') && (
                  <div className={activeTab === 'ideas' ? 'h-full relative' : 'hidden'}>
                    <IdeaBoard
                      ideas={data.ideas}
                      connections={data.connections}
                      sessionId={sessionId}
                      language={liveSession?.language}
                    />
                  </div>
                )}
                {hasFeature('goals') && (
                  <div className={activeTab === 'goals' ? 'h-full' : 'hidden'}>
                    <GoalsPanel goals={data.goals} />
                  </div>
                )}
                {hasFeature('summary') && (
                  <div className={activeTab === 'summary' ? 'h-full' : 'hidden'}>
                    <SummaryPanel summary={data.summary} updatedAt={data.summaryUpdatedAt} />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Mobile Layout */}
        {isMounted && !isDesktop && (
          <>
            <div className="flex-1 w-full min-h-0 overflow-hidden">
              <div className={`h-full ${mobileView === 'video' ? 'block' : 'hidden'}`}>
                {hasModeration ? (
                  <InterventionOverlay
                    intervention={data.latestIntervention}
                    onDismiss={data.dismissIntervention}
                    isTTSPlaying={isTTSPlaying}
                  >
                    {token && (
                      <VideoGrid
                        token={token}
                        serverUrl={livekitUrl}
                        onConnectionChange={setIsConnected}
                        onDisconnected={handleDisconnected}
                        onTTSStateChange={setIsTTSPlaying}
                      />
                    )}
                  </InterventionOverlay>
                ) : (
                  token && (
                    <VideoGrid
                      token={token}
                      serverUrl={livekitUrl}
                      onConnectionChange={setIsConnected}
                      onDisconnected={handleDisconnected}
                    />
                  )
                )}
              </div>
              {hasFeature('ideas') && (
                <div className={`h-full relative ${mobileView === 'ideas' ? 'block' : 'hidden'}`}>
                  <IdeaBoard ideas={data.ideas} connections={data.connections} sessionId={sessionId} language={liveSession?.language} />
                </div>
              )}
              <div className={`h-full ${mobileView === 'panel' ? 'block' : 'hidden'}`}>
                <div className="h-full flex flex-col">
                  <div className="flex border-b border-[var(--border-glass)] overflow-x-auto px-1">
                    {visibleTabs.filter((t) => t.id !== 'ideas').map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-3 py-2.5 text-xs font-medium whitespace-nowrap relative ${
                          activeTab === tab.id ? 'text-indigo-400' : 'text-[var(--text-tertiary)]'
                        }`}
                      >
                        {tab.label}
                        {activeTab === tab.id && (
                          <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full" />
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="flex-1 min-h-0 overflow-hidden">
                    {activeTab === 'transcript' && <TranscriptFeed segments={data.segments} />}
                    {activeTab === 'metrics' && hasFeature('metrics') && <MetricsPanel latest={data.latestMetrics} history={data.metricsHistory} engineState={data.engineState} participants={data.allParticipants} interventions={data.interventions} />}
                    {activeTab === 'goals' && hasFeature('goals') && <GoalsPanel goals={data.goals} />}
                    {activeTab === 'summary' && hasFeature('summary') && <SummaryPanel summary={data.summary} updatedAt={data.summaryUpdatedAt} />}
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile Bottom Tab Bar */}
            <nav className="shrink-0 bg-white/[0.03] backdrop-blur-xl border-t border-[var(--border-glass)] flex items-stretch bottom-tab-bar">
              {[
                { id: 'video' as const, label: 'Video', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z', show: true },
                { id: 'ideas' as const, label: 'Ideen', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z', show: hasFeature('ideas') },
                { id: 'panel' as const, label: 'Panel', icon: 'M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z', show: true },
              ].filter((t) => t.show).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setMobileView(tab.id)}
                  className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[52px] transition-all ${
                    mobileView === tab.id
                      ? 'text-indigo-400'
                      : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                  }`}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d={tab.icon} />
                  </svg>
                  <span className="text-[10px] font-medium">{tab.label}</span>
                </button>
              ))}
            </nav>
          </>
        )}
      </div>
    </div>
  );
}
