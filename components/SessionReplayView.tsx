'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Panel from '@/components/shared/Panel';
import MetricBar from '@/components/shared/MetricBar';
import type {
  TranscriptSegment,
  MetricSnapshot,
  Intervention,
  Idea,
  ExperimentConfig,
  ConversationStateName,
  InterventionAnnotation,
  AnnotationRelevance,
  AnnotationEffectiveness,
} from '@/lib/types';
import { formatTime, formatPercent } from '@/lib/utils/format';

// --- Types ---

interface SessionExport {
  metadata: {
    sessionId: string;
    roomName: string;
    scenario: string;
    startTime: number;
    endTime: number | null;
    language: string;
  };
  activeConfig: ExperimentConfig;
  promptVersion: string | null;
  engineVersion: string | null;
  transcriptSegments: TranscriptSegment[];
  metricSnapshots: Array<MetricSnapshot & { inferredState?: unknown; timestamp: number }>;
  interventions: Intervention[];
  ideas: Idea[];
  modelRoutingLog: Array<{
    id: string;
    timestamp: string;
    task: string;
    model: string;
    latencyMs: number;
    success: boolean;
    error: string | null;
  }>;
}

type TimelineEventType = 'segment' | 'intervention' | 'state_change';

interface TimelineEvent {
  type: TimelineEventType;
  timestamp: number;
  segment?: TranscriptSegment;
  intervention?: Intervention;
  stateChange?: { state: ConversationStateName; confidence: number };
}

type FilterSet = Set<TimelineEventType>;

// --- Helpers ---

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

function formatRelativeTime(timestamp: number, startTime: number): string {
  const elapsed = Math.max(0, timestamp - startTime);
  const totalSec = Math.floor(elapsed / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const STATE_COLORS: Record<ConversationStateName, string> = {
  HEALTHY_EXPLORATION: 'text-green-400',
  HEALTHY_ELABORATION: 'text-emerald-400',
  DOMINANCE_RISK: 'text-red-400',
  CONVERGENCE_RISK: 'text-yellow-400',
  STALLED_DISCUSSION: 'text-orange-400',
};

const STATE_BG_COLORS: Record<ConversationStateName, string> = {
  HEALTHY_EXPLORATION: 'bg-green-500/20 border-green-500/40',
  HEALTHY_ELABORATION: 'bg-emerald-500/20 border-emerald-500/40',
  DOMINANCE_RISK: 'bg-red-500/20 border-red-500/40',
  CONVERGENCE_RISK: 'bg-yellow-500/20 border-yellow-500/40',
  STALLED_DISCUSSION: 'bg-orange-500/20 border-orange-500/40',
};

const RECOVERY_BADGE: Record<string, { text: string; color: string }> = {
  recovered: { text: 'Recovered', color: 'bg-green-500/30 text-green-300' },
  partial: { text: 'Partial', color: 'bg-yellow-500/30 text-yellow-300' },
  not_recovered: { text: 'Not recovered', color: 'bg-red-500/30 text-red-300' },
  pending: { text: 'Pending', color: 'bg-slate-500/30 text-slate-300' },
};

// --- Speaker Colors ---

const SPEAKER_COLORS = [
  'text-blue-300', 'text-purple-300', 'text-cyan-300', 'text-pink-300',
  'text-amber-300', 'text-lime-300', 'text-rose-300', 'text-teal-300',
];

function getSpeakerColor(speaker: string, speakerList: string[]): string {
  const idx = speakerList.indexOf(speaker);
  return SPEAKER_COLORS[idx % SPEAKER_COLORS.length];
}

// --- Component ---

export default function SessionReplayView({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [data, setData] = useState<SessionExport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterSet>(new Set(['segment', 'intervention', 'state_change']));
  const [expandedInterventions, setExpandedInterventions] = useState<Set<string>>(new Set());
  const [selectedSnapshot, setSelectedSnapshot] = useState<number | null>(null);
  const [annotations, setAnnotations] = useState<Map<string, InterventionAnnotation>>(new Map());
  const [savingAnnotation, setSavingAnnotation] = useState<string | null>(null);

  // Fetch session data + annotations in parallel
  useEffect(() => {
    async function load() {
      try {
        const [sessionRes, annotRes] = await Promise.all([
          fetch(`/api/session/export?sessionId=${encodeURIComponent(sessionId)}`),
          fetch(`/api/annotations?sessionId=${encodeURIComponent(sessionId)}`),
        ]);

        if (!sessionRes.ok) {
          setError(sessionRes.status === 404 ? 'Session not found' : `Error ${sessionRes.status}`);
          return;
        }
        setData(await sessionRes.json());

        if (annotRes.ok) {
          const annotData = await annotRes.json();
          const map = new Map<string, InterventionAnnotation>();
          for (const a of annotData.annotations || []) {
            map.set(a.interventionId, a);
          }
          setAnnotations(map);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load session');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [sessionId]);

  const saveAnnotation = useCallback(async (
    interventionId: string,
    updates: Partial<Pick<InterventionAnnotation, 'rating' | 'relevance' | 'effectiveness' | 'notes'>>,
  ) => {
    setSavingAnnotation(interventionId);
    const existing = annotations.get(interventionId);
    const merged = {
      interventionId,
      sessionId,
      rating: updates.rating ?? existing?.rating ?? null,
      relevance: updates.relevance ?? existing?.relevance ?? null,
      effectiveness: updates.effectiveness ?? existing?.effectiveness ?? null,
      notes: updates.notes ?? existing?.notes ?? null,
      annotator: 'researcher',
    };

    try {
      const res = await fetch('/api/annotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(merged),
      });
      if (res.ok) {
        const { id } = await res.json();
        setAnnotations(prev => {
          const next = new Map(prev);
          next.set(interventionId, {
            id,
            ...merged,
            sessionId,
            createdAt: existing?.createdAt ?? Date.now(),
            updatedAt: Date.now(),
          } as InterventionAnnotation);
          return next;
        });
      }
    } catch { /* silent */ }
    setSavingAnnotation(null);
  }, [sessionId, annotations]);

  // Derive speakers
  const speakers = useMemo(() => {
    if (!data) return [];
    const set = new Set<string>();
    for (const s of data.transcriptSegments) set.add(s.speaker);
    return Array.from(set);
  }, [data]);

  // Build timeline events
  const timelineEvents = useMemo(() => {
    if (!data) return [];
    const events: TimelineEvent[] = [];

    // Transcript segments (only final)
    for (const seg of data.transcriptSegments) {
      if (seg.isFinal) {
        events.push({ type: 'segment', timestamp: seg.timestamp, segment: seg });
      }
    }

    // Interventions
    for (const int of data.interventions) {
      events.push({ type: 'intervention', timestamp: int.timestamp, intervention: int });
    }

    // State changes (from metric snapshots — deduplicate consecutive same-state)
    let lastState: string | null = null;
    for (const snap of data.metricSnapshots) {
      const inferred = snap.inferredState as { state?: ConversationStateName; confidence?: number } | undefined;
      if (inferred?.state && inferred.state !== lastState) {
        events.push({
          type: 'state_change',
          timestamp: snap.timestamp,
          stateChange: { state: inferred.state, confidence: inferred.confidence ?? 0 },
        });
        lastState = inferred.state;
      }
    }

    events.sort((a, b) => a.timestamp - b.timestamp);
    return events;
  }, [data]);

  const filteredEvents = useMemo(
    () => timelineEvents.filter(e => filters.has(e.type)),
    [timelineEvents, filters],
  );

  const toggleFilter = useCallback((type: TimelineEventType) => {
    setFilters(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const toggleIntervention = useCallback((id: string) => {
    setExpandedInterventions(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // --- Render ---

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Loading session...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || 'No data'}</p>
          <button onClick={() => router.push('/')} className="text-blue-400 hover:text-blue-300 text-sm">
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const { metadata, activeConfig } = data;
  const duration = metadata.endTime ? metadata.endTime - metadata.startTime : null;
  const interventionCount = data.interventions.length;
  const segmentCount = data.transcriptSegments.filter(s => s.isFinal).length;
  const recoveredCount = data.interventions.filter(i => i.recoveryResult === 'recovered').length;

  // Closest metric snapshot for detail panel
  const activeSnapshot = selectedSnapshot !== null
    ? data.metricSnapshots[selectedSnapshot]
    : data.metricSnapshots[data.metricSnapshots.length - 1] ?? null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 py-6 max-w-7xl">

        {/* Header */}
        <header className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => router.push('/')}
              className="text-slate-400 hover:text-white transition-colors text-sm"
            >
              &larr; Back
            </button>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              Session Replay
            </h1>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-slate-400">
            <span>Room: <span className="text-white">{metadata.roomName}</span></span>
            <span>Scenario: <span className="text-white">{metadata.scenario}</span></span>
            <span>Language: <span className="text-white">{metadata.language}</span></span>
            {duration && <span>Duration: <span className="text-white">{formatDuration(duration)}</span></span>}
            <span>Started: <span className="text-white">{formatTime(metadata.startTime)}</span></span>
            {data.promptVersion && <span>Prompt: <span className="text-white">{data.promptVersion}</span></span>}
          </div>
        </header>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <StatCard label="Speakers" value={speakers.length.toString()} />
          <StatCard label="Segments" value={segmentCount.toString()} />
          <StatCard label="Interventions" value={interventionCount.toString()} />
          <StatCard label="Recovery" value={interventionCount > 0 ? `${((recoveredCount / interventionCount) * 100).toFixed(0)}%` : 'N/A'} />
          <StatCard label="Ideas" value={data.ideas.length.toString()} />
        </div>

        {/* Main Layout: Timeline + Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Timeline (2/3) */}
          <div className="lg:col-span-2">
            {/* Filters */}
            <div className="flex gap-2 mb-4">
              <FilterButton
                label={`Segments (${segmentCount})`}
                active={filters.has('segment')}
                onClick={() => toggleFilter('segment')}
                color="blue"
              />
              <FilterButton
                label={`Interventions (${interventionCount})`}
                active={filters.has('intervention')}
                onClick={() => toggleFilter('intervention')}
                color="purple"
              />
              <FilterButton
                label="State Changes"
                active={filters.has('state_change')}
                onClick={() => toggleFilter('state_change')}
                color="emerald"
              />
            </div>

            {/* Timeline */}
            <div className="space-y-1">
              {filteredEvents.length === 0 ? (
                <div className="text-center text-slate-500 py-12">No events match filters</div>
              ) : (
                filteredEvents.map((event, i) => (
                  <TimelineEventRow
                    key={`${event.type}-${event.timestamp}-${i}`}
                    event={event}
                    startTime={metadata.startTime}
                    speakers={speakers}
                    expanded={event.intervention ? expandedInterventions.has(event.intervention.id) : false}
                    onToggle={event.intervention ? () => toggleIntervention(event.intervention!.id) : undefined}
                    annotation={event.intervention ? annotations.get(event.intervention.id) : undefined}
                    onSaveAnnotation={saveAnnotation}
                    isSaving={event.intervention ? savingAnnotation === event.intervention.id : false}
                  />
                ))
              )}
            </div>
          </div>

          {/* Sidebar (1/3) */}
          <div className="space-y-4">
            {/* Metric Snapshots Timeline */}
            <Panel>
              <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">
                Metric Snapshots ({data.metricSnapshots.length})
              </h3>
              {data.metricSnapshots.length > 0 && activeSnapshot ? (
                <>
                  {/* Mini timeline scrubber */}
                  <div className="mb-4">
                    <input
                      type="range"
                      min={0}
                      max={data.metricSnapshots.length - 1}
                      value={selectedSnapshot ?? data.metricSnapshots.length - 1}
                      onChange={e => setSelectedSnapshot(Number(e.target.value))}
                      className="w-full accent-blue-500"
                    />
                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                      <span>{formatRelativeTime(data.metricSnapshots[0].timestamp, metadata.startTime)}</span>
                      <span className="text-slate-300 font-mono">
                        {formatRelativeTime(activeSnapshot.timestamp, metadata.startTime)}
                      </span>
                      <span>{formatRelativeTime(data.metricSnapshots[data.metricSnapshots.length - 1].timestamp, metadata.startTime)}</span>
                    </div>
                  </div>

                  {/* State Badge */}
                  {(activeSnapshot as MetricSnapshot & { inferredState?: { state: ConversationStateName; confidence: number } }).inferredState && (
                    <div className={`text-center text-xs font-medium px-3 py-1.5 rounded-md border mb-3 ${STATE_BG_COLORS[(activeSnapshot as MetricSnapshot & { inferredState: { state: ConversationStateName } }).inferredState.state]}`}>
                      {(activeSnapshot as MetricSnapshot & { inferredState: { state: ConversationStateName; confidence: number } }).inferredState.state.replace(/_/g, ' ')}
                      <span className="ml-1 opacity-70">
                        ({formatPercent((activeSnapshot as MetricSnapshot & { inferredState: { confidence: number } }).inferredState.confidence)})
                      </span>
                    </div>
                  )}

                  {/* Metric Bars */}
                  <div className="space-y-3">
                    <MetricBar
                      label="Participation"
                      icon="P"
                      value={activeSnapshot.participationImbalance}
                      displayValue={formatPercent(activeSnapshot.participationImbalance)}
                      threshold={0.5}
                      higherIsBetter={false}
                      statusText={activeSnapshot.participationImbalance > 0.5 ? 'Imbalanced' : 'Balanced'}
                    />
                    <MetricBar
                      label="Repetition"
                      icon="R"
                      value={activeSnapshot.semanticRepetitionRate}
                      displayValue={formatPercent(activeSnapshot.semanticRepetitionRate)}
                      threshold={0.5}
                      higherIsBetter={false}
                      statusText={activeSnapshot.semanticRepetitionRate > 0.5 ? 'High repetition' : 'Novel'}
                    />
                    <MetricBar
                      label="Stagnation"
                      icon="S"
                      value={Math.min(1, activeSnapshot.stagnationDuration / 120)}
                      displayValue={`${activeSnapshot.stagnationDuration.toFixed(0)}s`}
                      threshold={0.5}
                      higherIsBetter={false}
                      statusText={activeSnapshot.stagnationDuration > 60 ? 'Stalled' : 'Active'}
                    />
                    <MetricBar
                      label="Diversity"
                      icon="D"
                      value={activeSnapshot.diversityDevelopment}
                      displayValue={formatPercent(activeSnapshot.diversityDevelopment)}
                      threshold={0.3}
                      higherIsBetter={true}
                      statusText={activeSnapshot.diversityDevelopment < 0.3 ? 'Low diversity' : 'Diverse'}
                    />
                  </div>
                </>
              ) : (
                <p className="text-slate-500 text-xs">No metric data</p>
              )}
            </Panel>

            {/* Ideas */}
            {data.ideas.length > 0 && (
              <Panel>
                <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">
                  Ideas ({data.ideas.length})
                </h3>
                <div className="space-y-2">
                  {data.ideas.map(idea => (
                    <div key={idea.id} className="bg-slate-800/50 rounded p-2">
                      <div className="text-sm text-white font-medium">{idea.title}</div>
                      {idea.description && (
                        <div className="text-xs text-slate-400 mt-0.5">{idea.description}</div>
                      )}
                      <div className="text-xs text-slate-500 mt-1">
                        {idea.author} &middot; {idea.source}
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
            )}

            {/* Model Routing */}
            {data.modelRoutingLog.length > 0 && (
              <Panel>
                <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">
                  Model Routing ({data.modelRoutingLog.length})
                </h3>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {data.modelRoutingLog.map(entry => (
                    <div key={entry.id} className="flex justify-between text-xs">
                      <span className="text-slate-300">{entry.task}</span>
                      <span className="text-slate-500">
                        {entry.model} &middot; {entry.latencyMs}ms
                        {!entry.success && <span className="text-red-400 ml-1">FAIL</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </Panel>
            )}

            {/* Export */}
            <Panel>
              <button
                onClick={() => {
                  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `session-${sessionId}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="w-full py-2 bg-slate-600 hover:bg-slate-500 rounded-lg text-sm font-medium transition-colors"
              >
                Download JSON Export
              </button>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Sub-components ---

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-center">
      <div className="text-lg font-bold text-white">{value}</div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  );
}

const FILTER_ACTIVE_STYLES: Record<string, string> = {
  blue: 'bg-blue-500/20 border-blue-500/50 text-blue-300',
  purple: 'bg-purple-500/20 border-purple-500/50 text-purple-300',
  emerald: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300',
};

function FilterButton({ label, active, onClick, color }: {
  label: string;
  active: boolean;
  onClick: () => void;
  color: string;
}) {
  const activeClass = active
    ? (FILTER_ACTIVE_STYLES[color] ?? FILTER_ACTIVE_STYLES.blue)
    : 'bg-slate-800/50 border-slate-700 text-slate-500';
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${activeClass}`}
    >
      {label}
    </button>
  );
}

function TimelineEventRow({ event, startTime, speakers, expanded, onToggle, annotation, onSaveAnnotation, isSaving }: {
  event: TimelineEvent;
  startTime: number;
  speakers: string[];
  expanded: boolean;
  onToggle?: () => void;
  annotation?: InterventionAnnotation;
  onSaveAnnotation?: (interventionId: string, updates: Partial<Pick<InterventionAnnotation, 'rating' | 'relevance' | 'effectiveness' | 'notes'>>) => void;
  isSaving?: boolean;
}) {
  const relTime = formatRelativeTime(event.timestamp, startTime);

  if (event.type === 'segment' && event.segment) {
    const seg = event.segment;
    return (
      <div className="flex gap-3 py-1 px-2 hover:bg-slate-800/30 rounded group">
        <span className="text-xs text-slate-600 font-mono w-12 shrink-0 pt-0.5">{relTime}</span>
        <span className="text-xs text-slate-600 w-0.5 shrink-0 bg-blue-500/30 rounded" />
        <div className="min-w-0">
          <span className={`text-xs font-medium ${getSpeakerColor(seg.speaker, speakers)}`}>
            {seg.speaker}
          </span>
          <span className="text-sm text-slate-300 ml-2">{seg.text}</span>
        </div>
      </div>
    );
  }

  if (event.type === 'intervention' && event.intervention) {
    const int = event.intervention;
    const recoveryInfo = int.recoveryResult ? RECOVERY_BADGE[int.recoveryResult] : null;
    const hasAnnotation = annotation && (annotation.rating || annotation.relevance || annotation.effectiveness);
    return (
      <div className="my-2">
        <button
          onClick={onToggle}
          className="w-full flex gap-3 py-2 px-3 bg-purple-500/10 border border-purple-500/30 rounded-lg hover:bg-purple-500/15 transition-colors text-left"
        >
          <span className="text-xs text-slate-500 font-mono w-12 shrink-0 pt-0.5">{relTime}</span>
          <span className="text-xs text-slate-600 w-0.5 shrink-0 bg-purple-500/50 rounded" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-medium text-purple-300 uppercase">
                {int.type}
              </span>
              {int.intent && (
                <span className="text-xs text-purple-400/70">
                  {int.intent.replace(/_/g, ' ')}
                </span>
              )}
              {recoveryInfo && (
                <span className={`text-xs px-1.5 py-0.5 rounded ${recoveryInfo.color}`}>
                  {recoveryInfo.text}
                </span>
              )}
              {hasAnnotation && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">
                  Annotated
                </span>
              )}
              {int.modelUsed && (
                <span className="text-xs text-slate-600">{int.modelUsed}</span>
              )}
            </div>
            <p className="text-sm text-slate-200">{int.text}</p>
            {expanded && (
              <div className="mt-2 space-y-3">
                {/* Technical details */}
                <div className="text-xs text-slate-500 space-y-1">
                  <div>Trigger: {int.trigger} | Spoken: {int.spoken ? 'Yes' : 'No'}</div>
                  {int.latencyMs !== undefined && <div>Latency: {int.latencyMs}ms</div>}
                  {int.triggeringState && <div>Triggering state: {int.triggeringState} ({formatPercent(int.stateConfidence ?? 0)})</div>}
                  {int.recoveryCheckedAt && <div>Recovery checked: {formatRelativeTime(int.recoveryCheckedAt, startTime)}</div>}
                </div>

                {/* Annotation Form */}
                {onSaveAnnotation && (
                  <AnnotationForm
                    interventionId={int.id}
                    annotation={annotation}
                    onSave={onSaveAnnotation}
                    isSaving={isSaving ?? false}
                  />
                )}
              </div>
            )}
          </div>
        </button>
      </div>
    );
  }

  if (event.type === 'state_change' && event.stateChange) {
    const sc = event.stateChange;
    return (
      <div className="flex gap-3 py-1.5 px-2">
        <span className="text-xs text-slate-600 font-mono w-12 shrink-0 pt-0.5">{relTime}</span>
        <span className="text-xs text-slate-600 w-0.5 shrink-0 bg-emerald-500/30 rounded" />
        <div className={`text-xs font-medium ${STATE_COLORS[sc.state]}`}>
          {sc.state.replace(/_/g, ' ')}
          <span className="opacity-60 ml-1">({formatPercent(sc.confidence)})</span>
        </div>
      </div>
    );
  }

  return null;
}

// --- Annotation Form ---

const RATING_LABELS = ['', 'Poor', 'Below Avg', 'Average', 'Good', 'Excellent'];

const RELEVANCE_OPTIONS: { value: AnnotationRelevance; label: string }[] = [
  { value: 'relevant', label: 'Relevant' },
  { value: 'partially_relevant', label: 'Partial' },
  { value: 'not_relevant', label: 'Not relevant' },
];

const EFFECTIVENESS_OPTIONS: { value: AnnotationEffectiveness; label: string }[] = [
  { value: 'effective', label: 'Effective' },
  { value: 'partially_effective', label: 'Partial' },
  { value: 'not_effective', label: 'Not effective' },
];

function AnnotationForm({ interventionId, annotation, onSave, isSaving }: {
  interventionId: string;
  annotation?: InterventionAnnotation;
  onSave: (id: string, updates: Partial<Pick<InterventionAnnotation, 'rating' | 'relevance' | 'effectiveness' | 'notes'>>) => void;
  isSaving: boolean;
}) {
  const [notes, setNotes] = useState(annotation?.notes ?? '');
  const [notesTimer, setNotesTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const handleNotesChange = (value: string) => {
    setNotes(value);
    if (notesTimer) clearTimeout(notesTimer);
    setNotesTimer(setTimeout(() => {
      onSave(interventionId, { notes: value });
    }, 800));
  };

  return (
    <div
      className="bg-slate-800/60 rounded-md p-3 border border-slate-600/50 space-y-2"
      onClick={e => e.stopPropagation()}
    >
      <div className="text-xs font-medium text-slate-400 uppercase tracking-wide">
        Annotation {isSaving && <span className="text-blue-400 ml-1">Saving...</span>}
      </div>

      {/* Rating */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500 w-16 shrink-0">Rating:</span>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map(r => (
            <button
              key={r}
              onClick={() => onSave(interventionId, { rating: r })}
              title={RATING_LABELS[r]}
              className={`w-6 h-6 rounded text-xs font-medium transition-colors ${
                annotation?.rating === r
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        {annotation?.rating && (
          <span className="text-xs text-slate-500">{RATING_LABELS[annotation.rating]}</span>
        )}
      </div>

      {/* Relevance */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500 w-16 shrink-0">Relevance:</span>
        <div className="flex gap-1">
          {RELEVANCE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => onSave(interventionId, { relevance: opt.value })}
              className={`px-2 py-1 rounded text-xs transition-colors ${
                annotation?.relevance === opt.value
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Effectiveness */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500 w-16 shrink-0">Effect:</span>
        <div className="flex gap-1">
          {EFFECTIVENESS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => onSave(interventionId, { effectiveness: opt.value })}
              className={`px-2 py-1 rounded text-xs transition-colors ${
                annotation?.effectiveness === opt.value
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <textarea
          value={notes}
          onChange={e => handleNotesChange(e.target.value)}
          placeholder="Notes (optional)..."
          rows={2}
          className="w-full bg-slate-700/50 border border-slate-600 rounded px-2 py-1.5 text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
        />
      </div>
    </div>
  );
}
