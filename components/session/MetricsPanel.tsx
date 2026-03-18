'use client';

import { useState, useMemo, useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { MetricSnapshot, EngineState, SessionParticipant, Intervention, InterventionIntent, CumulativeParticipation } from '@/types';

// ─── Props ────────────────────────────────────────────────────────────────────

interface MetricsPanelProps {
  latest: MetricSnapshot | null;
  history: MetricSnapshot[];
  engineState: EngineState | null;
  participants?: SessionParticipant[];
  interventions?: Intervention[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATE_CONFIG: Record<string, { color: string; gradient: string; label: string }> = {
  HEALTHY_EXPLORATION: { color: 'text-emerald-400', gradient: 'from-emerald-500/20 to-emerald-500/5', label: 'Gesunde Exploration' },
  HEALTHY_ELABORATION: { color: 'text-teal-400', gradient: 'from-teal-500/20 to-teal-500/5', label: 'Gesunde Vertiefung' },
  DOMINANCE_RISK: { color: 'text-rose-400', gradient: 'from-rose-500/20 to-rose-500/5', label: 'Dominanz-Risiko' },
  CONVERGENCE_RISK: { color: 'text-orange-400', gradient: 'from-orange-500/20 to-orange-500/5', label: 'Konvergenz-Risiko' },
  STALLED_DISCUSSION: { color: 'text-amber-400', gradient: 'from-amber-500/20 to-amber-500/5', label: 'Stagnation' },
};

const PHASE_CONFIG: Record<string, { bg: string; label: string }> = {
  MONITORING: { bg: 'bg-emerald-500/10 border-emerald-500/20', label: 'Monitoring' },
  CONFIRMING: { bg: 'bg-amber-500/10 border-amber-500/20', label: 'Bestätigung' },
  POST_CHECK: { bg: 'bg-indigo-500/10 border-indigo-500/20', label: 'Post-Check' },
  COOLDOWN: { bg: 'bg-white/5 border-white/10', label: 'Cooldown' },
};

interface TooltipEntry { description: string; formula?: string }

const METRIC_TOOLTIPS: Record<string, TooltipEntry> = {
  risk: {
    description: 'Ein Gesamtwert, der mehrere Signale kombiniert: Wie unausgewogen ist die Diskussion? Berücksichtigt, ob jemand dominiert, ob Leute schweigen und ob die Wortmeldungen ungleich verteilt sind.',
    formula: 'Hoch = Diskussion ist unausgewogen. Niedrig = alle beteiligen sich fair.',
  },
  balance: {
    description: 'Reden alle ungefähr gleich viel? 100% bedeutet perfekt ausgeglichen, 0% bedeutet eine Person dominiert komplett.',
    formula: 'Basiert auf den letzten 5 Minuten Gespräch.',
  },
  novelty: {
    description: 'Wie viel Prozent der Beiträge bringen etwas wirklich Neues ein, statt Gesagtes zu wiederholen? Wird über semantische Ähnlichkeit der Beiträge gemessen.',
    formula: 'Hoch = viele frische Ideen. Niedrig = es wird viel wiederholt.',
  },
  spread: {
    description: 'Wie unterschiedlich sind die Beiträge insgesamt voneinander? Hohe Werte bedeuten, dass viele verschiedene Themen angesprochen werden.',
    formula: 'Hoch = breites Spektrum. Niedrig = alles dreht sich um dasselbe.',
  },
  ideaRate: {
    description: 'Wie viele inhaltliche Beiträge kommen pro Minute? Misst das Diskussionstempo — nur Beiträge mit mehr als 2 Wörtern zählen.',
    formula: 'Hoch = schnelle, aktive Diskussion. Niedrig = wenig kommt.',
  },
  stagnation: {
    description: 'Wie viele Sekunden seit dem letzten wirklich neuen Gedanken? Kurze Zeiten bedeuten aktive Ideenentwicklung.',
    formula: 'Kurz = neue Ideen kommen. Lang = Diskussion stockt.',
  },
  silentRatio: {
    description: 'Wie viel Prozent der Gruppe schweigt? Als "still" gilt, wer weniger als 40% seines fairen Anteils redet (z.B. bei 4 Personen: unter 10%).',
    formula: 'Hoch = viele schweigen. 0% = alle reden mindestens ein bisschen.',
  },
  dominanceStreak: {
    description: 'Wie oft hat eine Person mehrmals hintereinander gesprochen, ohne dass jemand anderes dazwischen kam? Normalisiert auf die Gesamtzahl der Wortmeldungen.',
    formula: 'Hoch = jemand monopolisiert das Gespräch. Niedrig = Gespräch wechselt natürlich.',
  },
  gini: {
    description: 'Misst die Ungleichverteilung der Redezeit (Wortanzahl). 0% = alle reden exakt gleich viel, 100% = eine Person redet alles.',
    formula: 'Bekannter Ungleichheits-Index, wie bei Einkommensverteilung.',
  },
  hoover: {
    description: 'Wie viel Prozent der Redezeit müsste man umverteilen, damit alle gleich viel reden? Intuitiver als Gini.',
    formula: '0% = perfekt gleich. 50% = Hälfte müsste umverteilt werden.',
  },
  turnGini: {
    description: 'Wie ungleich sind die Wortmeldungen (Anzahl Turns) verteilt? Wie Gini, aber zählt die Anzahl der Redebeiträge statt der Wörter.',
    formula: 'Hoch = wenige Personen melden sich viel öfter. Niedrig = alle melden sich ähnlich oft.',
  },
  longTermBalance: {
    description: 'Balance über die letzten 10 Minuten — ein breiterer Blick als die normale Balance (5 Min). Glättet kurzzeitige Schwankungen.',
    formula: 'Hoch = insgesamt ausgewogen. Niedrig = über längere Zeit ungleich.',
  },
  cumulativeBalance: {
    description: 'Balance über die gesamte Session seit Beginn — wird nie zurückgesetzt. Zeigt das Gesamtbild der Beteiligung.',
    formula: 'Hoch = Session insgesamt fair. Niedrig = langfristige Dominanz.',
  },
  clusterCount: {
    description: 'Wie viele verschiedene Themen werden in der Diskussion besprochen? Wird über die inhaltliche Ähnlichkeit der Beiträge erkannt.',
    formula: 'Mehr Cluster = breitere Diskussion. Wenige = Fokus auf wenige Themen.',
  },
  concentration: {
    description: 'Kreist die Diskussion um ein Thema oder ist sie breit gestreut? Hohe Konzentration bedeutet, dass die meisten Beiträge zum gleichen Thema gehören.',
    formula: 'Hoch = enges Thema. Niedrig = breit gestreut.',
  },
  exploration: {
    description: 'Erforscht die Gruppe neue Richtungen (Exploration) oder vertieft sie bestehende Ideen (Vertiefung)? Zeigt die aktuelle Diskussionsdynamik.',
    formula: 'Links = neue Themen werden geöffnet. Rechts = bestehende Ideen werden ausgebaut.',
  },
  expansion: {
    description: 'Wird die Diskussion gerade breiter oder enger? Ein Trend-Indikator: positiv bedeutet neue Themen kommen dazu, negativ bedeutet Einengung.',
    formula: 'Positiv = Ideenraum wächst. Negativ = Gruppe verengt sich.',
  },
  piggybacking: {
    description: 'Wie stark baut jeder direkt auf dem Vorgänger auf? Hohe Werte bedeuten, die Gruppe denkt im Gleichschritt und baut aufeinander auf.',
    formula: 'Hoch = starker Aufbau aufeinander. Niedrig = unabhängige Beiträge.',
  },
};

// ─── Status helpers ───────────────────────────────────────────────────────────

type StatusType = 'good' | 'warn' | 'bad';

function getStatus(metric: string, value: number): { text: string; type: StatusType } {
  switch (metric) {
    case 'risk':
      if (value < 0.3) return { text: 'Ausgewogen', type: 'good' };
      if (value < 0.6) return { text: 'Leichtes Risiko', type: 'warn' };
      return { text: 'Hohes Risiko', type: 'bad' };
    case 'balance':
      if (value > 0.6) return { text: 'Ausgewogen', type: 'good' };
      if (value > 0.3) return { text: 'Ungleichmäßig', type: 'warn' };
      return { text: 'Stark ungleich', type: 'bad' };
    case 'novelty':
      if (value > 0.5) return { text: 'Frische Ideen', type: 'good' };
      if (value > 0.25) return { text: 'Wiederholungen', type: 'warn' };
      return { text: 'Ideenstau', type: 'bad' };
    case 'spread':
      if (value > 0.5) return { text: 'Gut verteilt', type: 'good' };
      if (value > 0.25) return { text: 'Teilweise verteilt', type: 'warn' };
      return { text: 'Eng gebündelt', type: 'bad' };
    case 'ideaRate':
      if (value >= 4) return { text: 'Hoch', type: 'good' };
      if (value >= 2) return { text: 'Moderat', type: 'good' };
      if (value >= 1) return { text: 'Niedrig', type: 'warn' };
      return { text: 'Sehr niedrig', type: 'bad' };
    case 'stagnation':
      if (value <= 30) return { text: 'Neuer Inhalt', type: 'good' };
      if (value <= 90) return { text: 'Verlangsamung', type: 'warn' };
      return { text: 'Stagnation', type: 'bad' };
    default:
      return { text: '', type: 'good' };
  }
}

const STATUS_TEXT_COLORS: Record<StatusType, string> = {
  good: 'text-emerald-400',
  warn: 'text-amber-400',
  bad: 'text-rose-400',
};

const GAUGE_COLORS: Record<StatusType, string> = {
  good: 'bg-emerald-500',
  warn: 'bg-amber-500',
  bad: 'bg-rose-500',
};

// ─── Micro-components ─────────────────────────────────────────────────────────

/** Sparkline for trend display in expanded details */
function Sparkline({ data, color = '#8b5cf6' }: { data: number[]; color?: string }) {
  const w = 64, h = 20;
  if (data.length < 2) return <div className="w-16 h-5 bg-white/[0.04] rounded" />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = 1 + (i / (data.length - 1)) * (w - 2);
    const y = 1 + (1 - (v - min) / range) * (h - 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <div className="bg-white/[0.04] rounded px-1 py-0.5 shrink-0">
      <svg width={w} height={h} className="block">
        <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function InfoTip({ tipKey }: { tipKey: string }) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const entry = METRIC_TOOLTIPS[tipKey];
  if (!entry) return null;

  const getPosition = (): React.CSSProperties => {
    if (!ref.current) return {};
    const rect = ref.current.getBoundingClientRect();
    const tipW = 280;
    const gap = 8;

    // Prefer right of icon, fallback left
    let left = rect.right + gap;
    if (left + tipW > window.innerWidth - 16) left = rect.left - tipW - gap;
    if (left < 16) left = 16;

    // Vertically near the icon, clamped to viewport
    let top = rect.top - 20;
    if (top < 16) top = 16;
    if (top + 140 > window.innerHeight) top = window.innerHeight - 150;

    return { position: 'fixed', left, top, width: tipW, zIndex: 9999 };
  };

  return (
    <>
      <button
        ref={ref}
        className="w-3.5 h-3.5 rounded-full border border-white/20 inline-flex items-center justify-center text-[8px] text-white/40 cursor-help hover:border-white/40 hover:text-white/60 transition-colors ml-1"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={(e) => { e.stopPropagation(); setShow(!show); }}
      >
        i
      </button>
      {show && typeof document !== 'undefined' && createPortal(
        <div
          style={getPosition()}
          className="bg-[#1a1a2e] border border-white/15 p-3 text-[11px] text-white/90 leading-relaxed rounded-xl shadow-2xl pointer-events-none animate-fade-in-scale"
        >
          <p>{entry.description}</p>
          {entry.formula && (
            <p className="mt-2 pt-2 border-t border-white/15 text-[10px] text-white/50 break-words">
              {entry.formula}
            </p>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}

function ShowMore({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors mt-1"
      >
        <span className={`transition-transform duration-200 ${open ? 'rotate-90' : ''}`}>▸</span>
        {open ? 'Weniger' : 'Mehr anzeigen'}
      </button>
      {open && <div className="space-y-3 mt-3 animate-fade-in">{children}</div>}
    </>
  );
}

/** Inline section divider — compact, no card wrapper */
function SectionDivider({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 pt-2 first:pt-0">
      <span className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider whitespace-nowrap">
        {children}
      </span>
      <div className="flex-1 h-px bg-white/[0.06]" />
    </div>
  );
}

/** Clean metric row: label + value + thin gauge + conditional status badge */
function MetricRow({ label, tipKey, displayValue, status, gaugeFill, gaugeThreshold }: {
  label: string;
  tipKey: string;
  displayValue: string;
  status: { text: string; type: StatusType };
  gaugeFill: number;
  gaugeThreshold?: number;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--text-secondary)] font-medium flex items-center">
          {label}
          <InfoTip tipKey={tipKey} />
        </span>
        <div className="flex items-center gap-2">
          {status.type !== 'good' && (
            <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-md ${
              status.type === 'warn' ? 'bg-amber-500/10 text-amber-400' : 'bg-rose-500/10 text-rose-400'
            }`}>
              {status.text}
            </span>
          )}
          <span className={`text-sm font-bold font-mono tabular-nums ${STATUS_TEXT_COLORS[status.type]}`}>{displayValue}</span>
        </div>
      </div>
      <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden relative">
        <div
          className={`h-full ${GAUGE_COLORS[status.type]} rounded-full transition-all duration-500`}
          style={{ width: `${Math.min(Math.max(gaugeFill, 0), 1) * 100}%` }}
        />
        {gaugeThreshold != null && (
          <div
            className="absolute top-0 bottom-0 w-px bg-white/20"
            style={{ left: `${gaugeThreshold * 100}%` }}
          />
        )}
      </div>
    </div>
  );
}

/** Simple gauge row for "show more" details */
function DetailGauge({ label, value, tipKey }: { label: string; value: number; tipKey?: string }) {
  const pct = Math.min(value, 1) * 100;
  const color = value >= 0.7 ? 'bg-rose-500' : value >= 0.4 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-[var(--text-tertiary)] flex items-center gap-1">
          {label}
          {tipKey && <InfoTip tipKey={tipKey} />}
        </span>
        <span className="text-[10px] font-mono text-[var(--text-secondary)]">{pct.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MetricsPanel({ latest, history, engineState, participants, interventions = [] }: MetricsPanelProps) {
  const identityToName = useMemo(() => {
    const map: Record<string, string> = {};
    if (participants) {
      for (const p of participants) map[p.livekit_identity] = p.display_name;
    }
    return map;
  }, [participants]);

  const [view, setView] = useState<'metrics' | 'interventions'>('metrics');

  // ── Staleness tracking ───────────────────────────────────────────────────
  const [now, setNow] = useState(() => Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => setNow(Date.now()), 5_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const computedAt = latest?.computed_at ? new Date(latest.computed_at).getTime() : null;
  const stalenessSeconds = computedAt ? Math.round((now - computedAt) / 1000) : null;

  // Extract sparkline data from history
  const spark = useMemo(() => {
    const recent = history.slice(-30);
    return {
      risk: recent.map(s => s.participation?.participation_risk_score ?? 0),
      balance: recent.map(s => s.participation?.balance ?? (1 - (s.participation?.gini_imbalance ?? 1))),
    };
  }, [history]);

  const p = latest?.participation ?? {
    volume_share: {}, turn_share: {}, gini_imbalance: 1, turn_share_gini: 0,
    hoover_imbalance: 0, turn_hoover: 0, balance: 0, silent_participant_ratio: 0,
    dominance_streak_score: 0, participation_risk_score: 0, long_term_balance: 0,
    cumulative_imbalance: 0, ideational_fluency_rate: 0,
  };
  const sd = latest?.semantic_dynamics ?? {
    novelty_rate: 0, cluster_concentration: 0, exploration_elaboration_ratio: 1,
    semantic_expansion_score: 0, cluster_count: 0, has_embeddings: false,
    stagnation_duration_seconds: 0, diversity: 0, piggybacking_score: 0,
  };
  const inf = latest?.inferred_state ?? {
    state: 'HEALTHY_EXPLORATION' as const, confidence: 0,
    secondary_state: null, secondary_confidence: 0, criteria_snapshot: {},
  };

  const stateConfig = STATE_CONFIG[inf.state] || STATE_CONFIG.HEALTHY_EXPLORATION;
  const phaseConfig = engineState ? (PHASE_CONFIG[engineState.phase] || PHASE_CONFIG.MONITORING) : null;
  const speakerCount = Object.keys(p.volume_share).length;

  // Derived statuses
  const riskStatus = getStatus('risk', p.participation_risk_score);
  const balanceStatus = speakerCount <= 1
    ? { text: 'Nur 1 Sprecher', type: 'bad' as StatusType }
    : getStatus('balance', p.balance);
  const noveltyStatus = getStatus('novelty', sd.novelty_rate);
  const spreadStatus = getStatus('spread', sd.diversity);
  const ideaRateStatus = getStatus('ideaRate', p.ideational_fluency_rate);
  const stagnationStatus = getStatus('stagnation', sd.stagnation_duration_seconds);

  // Speaker bars sorted by share
  const speakers = useMemo(() =>
    Object.entries(p.volume_share)
      .sort(([, a], [, b]) => b - a)
      .map(([id, share]) => ({
        name: identityToName[id] || id,
        share,
      })),
    [p.volume_share, identityToName],
  );

  // Cumulative session-wide data
  const cum = p.cumulative;
  const cumulativeSpeakers = useMemo(() => {
    if (!cum) return [];
    return Object.entries(cum.volume_share)
      .sort(([, a], [, b]) => b - a)
      .map(([id, share]) => ({
        name: identityToName[id] || id,
        share,
      }));
  }, [cum, identityToName]);

  // Exploration/Elaboration ratio
  const ratio = sd.exploration_elaboration_ratio;
  const explorationPct = (ratio / (1 + ratio)) * 100;

  if (!latest) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-[var(--text-tertiary)]">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-3 opacity-50">
          <path d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="text-sm">Erste Metriken erscheinen nach ~30 Sekunden...</p>
        <p className="text-[10px] text-[var(--text-tertiary)] mt-1.5">Danach live via Realtime</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* State Header — compact single-line */}
      <div className={`shrink-0 px-4 py-2.5 bg-gradient-to-br ${stateConfig.gradient} border-b border-[var(--border-glass)]`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full shrink-0 ${stateConfig.color.replace('text-', 'bg-')}`} />
            <span className={`text-sm font-semibold ${stateConfig.color}`}>{stateConfig.label}</span>
            <span className="text-[10px] font-mono text-[var(--text-tertiary)]">{(inf.confidence * 100).toFixed(0)}%</span>
          </div>
          <div className="flex items-center gap-1.5">
            {stalenessSeconds != null && stalenessSeconds > 30 && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-semibold ${
                stalenessSeconds > 120 ? 'bg-rose-500/15 text-rose-400' : 'bg-amber-500/15 text-amber-400'
              }`}>
                {stalenessSeconds > 120 ? 'Keine Daten' : `${stalenessSeconds}s`}
              </span>
            )}
            {phaseConfig && (
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${phaseConfig.bg}`}>
                {phaseConfig.label}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* View Switcher */}
      <div className="shrink-0 flex border-b border-[var(--border-glass)]">
        <button
          onClick={() => setView('metrics')}
          className={`flex-1 py-2.5 text-xs font-medium relative transition-colors ${
            view === 'metrics' ? 'text-indigo-400' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
          }`}
        >
          Metriken
          {view === 'metrics' && <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full" />}
        </button>
        <button
          onClick={() => setView('interventions')}
          className={`flex-1 py-2.5 text-xs font-medium relative transition-colors ${
            view === 'interventions' ? 'text-indigo-400' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
          }`}
        >
          Eingriffe{interventions.length > 0 ? ` (${interventions.length})` : ''}
          {view === 'interventions' && <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full" />}
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin">
        {view === 'metrics' ? (
          <>
            {/* ── BETEILIGUNG ── */}
            <SectionDivider>Beteiligung</SectionDivider>

            {/* Compact speaker bars */}
            {speakers.length > 0 && (
              <div className="space-y-0.5">
                {speakers.map(({ name, share }) => (
                  <div key={name} className="flex items-center gap-2 py-0.5">
                    <span className="text-[11px] text-[var(--text-secondary)] w-20 truncate shrink-0">{name}</span>
                    <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          share > 0.5 && speakerCount > 1
                            ? 'bg-gradient-to-r from-orange-500 to-rose-500'
                            : 'bg-gradient-to-r from-indigo-500 to-violet-500'
                        }`}
                        style={{ width: `${share * 100}%` }}
                      />
                    </div>
                    <span className={`text-[11px] font-mono tabular-nums w-8 text-right ${
                      share > 0.5 && speakerCount > 1 ? 'text-orange-400' : 'text-[var(--text-secondary)]'
                    }`}>
                      {(share * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2.5 mt-1">
              <MetricRow
                label="Risiko"
                tipKey="risk"
                displayValue={`${(p.participation_risk_score * 100).toFixed(0)}%`}
                status={speakerCount <= 1 ? { text: 'Nur 1 Sprecher', type: 'bad' } : riskStatus}
                gaugeFill={p.participation_risk_score}
                gaugeThreshold={0.5}
              />
              <MetricRow
                label="Balance"
                tipKey="balance"
                displayValue={`${(p.balance * 100).toFixed(0)}%`}
                status={balanceStatus}
                gaugeFill={p.balance}
                gaugeThreshold={0.5}
              />
            </div>

            <ShowMore>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[var(--text-tertiary)]">Trends</span>
                  <Sparkline data={spark.risk} color={riskStatus.type === 'good' ? '#22c55e' : '#f43f5e'} />
                  <Sparkline data={spark.balance} color={balanceStatus.type === 'good' ? '#22c55e' : '#f43f5e'} />
                </div>
                <DetailGauge label="Gini (Volumen)" value={p.gini_imbalance} tipKey="gini" />
                <DetailGauge label="Gini (Turns)" value={p.turn_share_gini} tipKey="turnGini" />
                <DetailGauge label="Hoover (Volumen)" value={p.hoover_imbalance} tipKey="hoover" />
                <DetailGauge label="Stille-Quote" value={p.silent_participant_ratio} tipKey="silentRatio" />
                <DetailGauge label="Dominanz-Streak" value={p.dominance_streak_score} tipKey="dominanceStreak" />
                <DetailGauge label="Langzeit-Balance" value={p.long_term_balance} tipKey="longTermBalance" />

                {/* Cumulative session-wide metrics */}
                {cum && (
                  <>
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider whitespace-nowrap">
                        Gesamt-Session
                      </span>
                      <div className="flex-1 h-px bg-white/[0.06]" />
                      <span className="text-[9px] font-mono text-[var(--text-tertiary)]">
                        {cum.total_words} Wörter · {cum.total_turns} Turns
                      </span>
                    </div>
                    {cumulativeSpeakers.map(({ name, share }) => (
                      <div key={name} className="flex items-center gap-2 py-0.5">
                        <span className="text-[10px] text-[var(--text-tertiary)] w-20 truncate shrink-0">{name}</span>
                        <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-cyan-500 to-blue-500"
                            style={{ width: `${share * 100}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-mono tabular-nums w-8 text-right text-[var(--text-tertiary)]">
                          {(share * 100).toFixed(0)}%
                        </span>
                      </div>
                    ))}
                    <DetailGauge label="Session-Balance" value={cum.balance} tipKey="cumulativeBalance" />
                  </>
                )}
              </div>
            </ShowMore>

            {/* ── IDEENQUALITÄT ── */}
            <SectionDivider>Ideenqualität</SectionDivider>

            <div className="space-y-2.5">
              <MetricRow
                label="Neuheit"
                tipKey="novelty"
                displayValue={`${(sd.novelty_rate * 100).toFixed(0)}%`}
                status={noveltyStatus}
                gaugeFill={sd.novelty_rate}
                gaugeThreshold={0.35}
              />
              <MetricRow
                label="Verteilung"
                tipKey="spread"
                displayValue={`${(sd.diversity * 100).toFixed(0)}%`}
                status={spreadStatus}
                gaugeFill={sd.diversity}
                gaugeThreshold={0.4}
              />
            </div>

            <ShowMore>
              <div className="space-y-3">
                {/* Exploration vs Vertiefung */}
                <div>
                  <div className="flex items-center gap-1 mb-1.5">
                    <span className="text-[10px] text-[var(--text-tertiary)]">Exploration vs. Vertiefung</span>
                    <InfoTip tipKey="exploration" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-violet-400 w-8 shrink-0">Expl.</span>
                    <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden flex">
                      <div className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-l-full transition-all duration-500" style={{ width: `${explorationPct}%` }} />
                      <div className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-r-full transition-all duration-500" style={{ width: `${100 - explorationPct}%` }} />
                    </div>
                    <span className="text-[9px] text-teal-400 w-8 shrink-0 text-right">Vert.</span>
                  </div>
                  <p className="text-center text-[9px] font-mono text-[var(--text-tertiary)] mt-0.5">
                    {explorationPct.toFixed(0)}% / {(100 - explorationPct).toFixed(0)}%
                  </p>
                </div>

                <DetailGauge label="Cluster-Anzahl" value={Math.min(sd.cluster_count / 10, 1)} tipKey="clusterCount" />
                <DetailGauge label="Konzentration" value={sd.cluster_concentration} tipKey="concentration" />
                <DetailGauge label="Expansion" value={Math.min(Math.max(sd.semantic_expansion_score + 0.5, 0), 1)} tipKey="expansion" />
                <DetailGauge label="Piggybacking" value={sd.piggybacking_score} tipKey="piggybacking" />

                {!sd.has_embeddings && (
                  <div className="p-2 rounded-lg border border-amber-500/20 bg-amber-500/5">
                    <p className="text-[10px] text-amber-400">Jaccard-Fallback — Embeddings werden generiert</p>
                  </div>
                )}
              </div>
            </ShowMore>

            {/* ── AKTIVITÄT ── */}
            <SectionDivider>Aktivität</SectionDivider>

            <div className="space-y-2.5">
              <MetricRow
                label="Ideenrate"
                tipKey="ideaRate"
                displayValue={`${p.ideational_fluency_rate.toFixed(1)}/m`}
                status={ideaRateStatus}
                gaugeFill={Math.min(p.ideational_fluency_rate / 10, 1)}
                gaugeThreshold={0.3}
              />
              <MetricRow
                label="Stagnation"
                tipKey="stagnation"
                displayValue={`${Math.round(sd.stagnation_duration_seconds)}s`}
                status={stagnationStatus}
                gaugeFill={Math.min(sd.stagnation_duration_seconds / 180, 1)}
                gaugeThreshold={0.5}
              />
            </div>

            {/* Measurement count */}
            <p className="text-[9px] text-[var(--text-tertiary)] text-center font-mono pt-1">
              {history.length} Messpunkte
            </p>
          </>
        ) : (
          <InterventionsTab interventions={interventions} />
        )}
      </div>
    </div>
  );
}

// ─── Interventions Tab ────────────────────────────────────────────────────────

const INTENT_COLORS: Record<InterventionIntent, { bg: string; text: string; dot: string }> = {
  PARTICIPATION_REBALANCING: { bg: 'bg-blue-500/10 border-blue-500/20', text: 'text-blue-400', dot: 'bg-blue-400' },
  PERSPECTIVE_BROADENING: { bg: 'bg-violet-500/10 border-violet-500/20', text: 'text-violet-400', dot: 'bg-violet-400' },
  REACTIVATION: { bg: 'bg-amber-500/10 border-amber-500/20', text: 'text-amber-400', dot: 'bg-amber-400' },
  ALLY_IMPULSE: { bg: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  NORM_REINFORCEMENT: { bg: 'bg-yellow-500/10 border-yellow-500/20', text: 'text-yellow-400', dot: 'bg-yellow-400' },
  GOAL_REFOCUS: { bg: 'bg-indigo-500/10 border-indigo-500/20', text: 'text-indigo-400', dot: 'bg-indigo-400' },
};

const INTENT_LABELS: Record<InterventionIntent, { label: string; reason: string }> = {
  PARTICIPATION_REBALANCING: { label: 'Beteiligungsausgleich', reason: 'Ungleichmässige Beteiligung erkannt — einige Teilnehmer dominieren das Gespräch.' },
  PERSPECTIVE_BROADENING: { label: 'Perspektivenerweiterung', reason: 'Diskussion konvergiert auf wenige Themen — neue Perspektiven werden benötigt.' },
  REACTIVATION: { label: 'Reaktivierung', reason: 'Gespräch stagniert — seit längerer Zeit keine neuen inhaltlichen Beiträge.' },
  ALLY_IMPULSE: { label: 'Ally-Impuls', reason: 'Moderationsimpuls durch Ally — unterstützt die Gesprächsdynamik.' },
  NORM_REINFORCEMENT: { label: 'Regel-Check', reason: 'Brainstorming-Regel wurde verletzt.' },
  GOAL_REFOCUS: { label: 'Ziel-Refokus', reason: 'Diskussion weicht von den definierten Zielen ab.' },
};

const METRIC_DISPLAY_LABELS: Record<string, string> = {
  participation_risk_score: 'Beteiligungsrisiko',
  gini_imbalance: 'Gini (Volumen)',
  balance: 'Balance',
  silent_participant_ratio: 'Stille-Quote',
  dominance_streak_score: 'Dominanz-Streak',
  novelty_rate: 'Neuheitsrate',
  stagnation_duration_seconds: 'Stagnation (s)',
  cluster_concentration: 'Cluster-Konzentration',
  diversity: 'Diversität',
  state: 'Zustand',
  confidence: 'Konfidenz',
};

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/** Flatten nested metrics object into key-value pairs for display */
function flattenMetrics(obj: Record<string, unknown>, prefix = ''): [string, string][] {
  const result: [string, string][] = [];
  for (const [key, val] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (val === null || val === undefined) continue;
    if (typeof val === 'object' && !Array.isArray(val)) {
      result.push(...flattenMetrics(val as Record<string, unknown>, fullKey));
    } else if (typeof val === 'number') {
      result.push([fullKey, val.toFixed(3)]);
    } else if (typeof val === 'boolean') {
      result.push([fullKey, val ? 'Ja' : 'Nein']);
    } else {
      result.push([fullKey, String(val)]);
    }
  }
  return result;
}

function InterventionCard({ iv }: { iv: Intervention }) {
  const [expanded, setExpanded] = useState(false);
  const colors = INTENT_COLORS[iv.intent] || INTENT_COLORS.PARTICIPATION_REBALANCING;
  const intentInfo = INTENT_LABELS[iv.intent] || { label: iv.intent, reason: '' };
  const metrics = iv.metrics_at_intervention;
  const flatMetrics = useMemo(
    () => metrics ? flattenMetrics(metrics) : [],
    [metrics],
  );

  return (
    <div className={`glass-sm p-3 border ${colors.bg}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`w-1.5 h-1.5 rounded-full ${colors.dot} shrink-0`} />
        <span className={`text-[10px] font-semibold uppercase tracking-wider ${colors.text}`}>{intentInfo.label}</span>
        <span className="text-[10px] text-[var(--text-tertiary)] ml-auto font-mono">{formatTime(iv.created_at)}</span>
      </div>
      <p className="text-[10px] text-[var(--text-tertiary)] mb-1.5 italic">{intentInfo.reason}</p>
      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{iv.text}</p>
      {iv.recovered !== undefined && (
        <p className="text-[10px] mt-1.5 font-mono text-[var(--text-tertiary)]">
          Erholung: {iv.recovered ? (
            <span className="text-emerald-400">Ja{iv.recovery_score != null ? ` (${(iv.recovery_score * 100).toFixed(0)}%)` : ''}</span>
          ) : (
            <span className="text-rose-400">Nein</span>
          )}
        </p>
      )}
      {flatMetrics.length > 0 && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors mt-2"
          >
            <span className={`transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}>▸</span>
            Metriken zum Zeitpunkt ({flatMetrics.length})
          </button>
          {expanded && (
            <div className="mt-2 space-y-1 animate-fade-in">
              {flatMetrics.map(([key, val]) => {
                const leafKey = key.split('.').pop() || key;
                const displayLabel = METRIC_DISPLAY_LABELS[leafKey] || key;
                return (
                  <div key={key} className="flex items-center justify-between text-[9px]">
                    <span className="text-[var(--text-tertiary)]">{displayLabel}</span>
                    <span className="font-mono text-[var(--text-secondary)]">{val}</span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function InterventionsTab({ interventions }: { interventions: Intervention[] }) {
  if (interventions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-[var(--text-tertiary)]">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-3 opacity-50">
          <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <p className="text-sm">Noch keine Eingriffe</p>
      </div>
    );
  }

  const sorted = [...interventions].reverse();

  return (
    <div className="space-y-2">
      {sorted.map((iv) => <InterventionCard key={iv.id} iv={iv} />)}
    </div>
  );
}
