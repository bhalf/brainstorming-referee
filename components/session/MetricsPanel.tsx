'use client';

import { useState, useMemo, useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { MetricSnapshot, EngineState, SessionParticipant, Intervention, InterventionIntent } from '@/types';

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
    description: 'Partizipations-Composite: Kombination aus Ungleichverteilung und Dominanz-Streak. Wird direkt als DOMINANCE_RISK Score im Zwei-Schicht-System verwendet.',
    formula: 'max(Hoover, Silent) × 0.65 + Dominanz-Streak × 0.35',
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
  hoover: {
    description: 'Wie viel Prozent der Redezeit müsste man umverteilen, damit alle gleich viel reden? Intuitiver als Gini.',
    formula: '0% = perfekt gleich. 50% = Hälfte müsste umverteilt werden.',
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
      if (value < 0.6) return { text: 'Leicht ungleich', type: 'warn' };
      return { text: 'Stark ungleich', type: 'bad' };
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

// ─── Insight generation ──────────────────────────────────────────────────────

interface Insight {
  id: string;
  severity: 'warn' | 'bad';
  title: string;
  action: string;
  icon: string; // SVG path
}

const ICON_PATHS = {
  dominance: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  stagnation: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  convergence: 'M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4',
  silent: 'M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2',
  balance: 'M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3',
  novelty: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
};

function generateInsights(
  p: MetricSnapshot['participation'],
  sd: MetricSnapshot['semantic_dynamics'],
  inf: MetricSnapshot['inferred_state'],
  identityToName: Record<string, string>,
  totalParticipants: number,
): Insight[] {
  const insights: Insight[] = [];
  const speakerCount = Object.keys(p.volume_share).length;
  // Use actual participant count (includes non-speakers) for fair share
  const participantCount = Math.max(totalParticipants, speakerCount);

  // 1. Dominance / high participation risk
  const pComposite = p.participation_composite || 0;
  const sorted = Object.entries(p.volume_share).sort(([, a], [, b]) => b - a);
  const topShare = sorted.length > 0 ? sorted[0][1] : 0;
  if (participantCount > 1 && (pComposite > 0.35 || topShare > 0.50 || inf.state === 'DOMINANCE_RISK')) {
    if (sorted.length > 0) {
      const [topName] = sorted[0];
      const others = sorted.slice(1).map(([name]) => name);
      const othersStr = others.length === 1 ? others[0] : 'andere';
      insights.push({
        id: 'dominance',
        severity: topShare > 0.7 ? 'bad' : 'warn',
        title: `${topName} redet ${(topShare * 100).toFixed(0)}% der Zeit`,
        action: `${othersStr} einbeziehen`,
        icon: ICON_PATHS.dominance,
      });
    }
  }

  // 2. Stagnation
  if (sd.stagnation_duration_seconds > 90 || inf.state === 'STALLED_DISCUSSION') {
    const mins = Math.floor(sd.stagnation_duration_seconds / 60);
    const secs = Math.round(sd.stagnation_duration_seconds % 60);
    const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    insights.push({
      id: 'stagnation',
      severity: sd.stagnation_duration_seconds > 150 ? 'bad' : 'warn',
      title: `Seit ${timeStr} keine neuen Ideen`,
      action: 'Neues Unterthema einbringen?',
      icon: ICON_PATHS.stagnation,
    });
  }

  // 3. Convergence
  if (sd.cluster_concentration > 0.6 || inf.state === 'CONVERGENCE_RISK') {
    insights.push({
      id: 'convergence',
      severity: sd.cluster_concentration > 0.8 ? 'bad' : 'warn',
      title: 'Diskussion dreht sich im Kreis',
      action: 'Neue Perspektive einbringen?',
      icon: ICON_PATHS.convergence,
    });
  }

  // 4. Silent participant — use totalParticipants to detect truly silent people
  if (participantCount > 1 && p.silent_participant_ratio > 0) {
    const fair = 1 / participantCount;
    // Find speakers with very low share
    const quietSpeakers = Object.entries(p.volume_share)
      .filter(([, share]) => share < fair * 0.4)
      .map(([name]) => name);
    // Find participants who haven't spoken at all (not in volume_share)
    const spokenNames = new Set(Object.keys(p.volume_share));
    const silentParticipants = Object.values(identityToName)
      .filter(name => !spokenNames.has(name));
    const allQuiet = [...silentParticipants, ...quietSpeakers];
    if (allQuiet.length > 0) {
      const label = allQuiet.length === 1
        ? `${allQuiet[0]} schweigt`
        : `${allQuiet.join(', ')} schweigen`;
      insights.push({
        id: 'silent',
        severity: 'warn',
        title: label,
        action: 'Direkt ansprechen?',
        icon: ICON_PATHS.silent,
      });
    }
  }

  // 5. Balance warning (only if not already showing dominance)
  if (participantCount > 1 && p.balance < 0.35 && !insights.some(i => i.id === 'dominance')) {
    insights.push({
      id: 'balance',
      severity: p.balance < 0.2 ? 'bad' : 'warn',
      title: 'Beteiligung stark ungleich',
      action: 'Balance beachten',
      icon: ICON_PATHS.balance,
    });
  }

  // 6. Low novelty (only if not already showing stagnation)
  if (sd.novelty_rate < 0.15 && sd.stagnation_duration_seconds <= 90 && !insights.some(i => i.id === 'stagnation')) {
    insights.push({
      id: 'novelty',
      severity: 'warn',
      title: 'Wenig neue Ideen',
      action: 'Thema wechseln?',
      icon: ICON_PATHS.novelty,
    });
  }

  // Sort by severity (bad first), take max 3
  insights.sort((a, b) => (a.severity === 'bad' ? 0 : 1) - (b.severity === 'bad' ? 0 : 1));
  return insights.slice(0, 3);
}

// ─── Micro-components ─────────────────────────────────────────────────────────

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
    let left = rect.right + gap;
    if (left + tipW > window.innerWidth - 16) left = rect.left - tipW - gap;
    if (left < 16) left = 16;
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

function SectionDivider({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 pt-3 first:pt-0">
      <span className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-widest whitespace-nowrap">
        {children}
      </span>
      <div className="flex-1 h-px bg-gradient-to-r from-white/[0.08] to-transparent" />
    </div>
  );
}

function MetricRow({ label, tipKey, displayValue, status, gaugeFill, gaugeThreshold }: {
  label: string;
  tipKey: string;
  displayValue: string;
  status: { text: string; type: StatusType };
  gaugeFill: number;
  gaugeThreshold?: number;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--text-secondary)] font-medium flex items-center">
          {label}
          <InfoTip tipKey={tipKey} />
        </span>
        <div className="flex items-center gap-2">
          {status.type !== 'good' && (
            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-md border ${
              status.type === 'warn' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            }`}>
              {status.text}
            </span>
          )}
          <span className={`text-sm font-bold font-mono tabular-nums ${STATUS_TEXT_COLORS[status.type]}`}>{displayValue}</span>
        </div>
      </div>
      <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden relative">
        <div
          className={`h-full ${GAUGE_COLORS[status.type]} rounded-full transition-all duration-700 ease-out`}
          style={{ width: `${Math.min(Math.max(gaugeFill, 0), 1) * 100}%` }}
        />
        {gaugeThreshold != null && (
          <div
            className="absolute top-0 bottom-0 w-px bg-white/25"
            style={{ left: `${gaugeThreshold * 100}%` }}
          />
        )}
      </div>
    </div>
  );
}

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
        <span className="text-[10px] font-mono text-[var(--text-secondary)] tabular-nums">{pct.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-700 ease-out`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── Insight Card ────────────────────────────────────────────────────────────

function InsightCard({ insight }: { insight: Insight }) {
  const colors = insight.severity === 'bad'
    ? { bg: 'bg-rose-500/8 border-rose-500/20', icon: 'bg-rose-500/15 text-rose-400', title: 'text-rose-300', action: 'text-rose-400/70' }
    : { bg: 'bg-amber-500/8 border-amber-500/20', icon: 'bg-amber-500/15 text-amber-400', title: 'text-amber-300', action: 'text-amber-400/70' };

  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl border ${colors.bg} animate-fade-in`}>
      <div className={`w-8 h-8 rounded-lg ${colors.icon} flex items-center justify-center shrink-0`}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d={insight.icon} />
        </svg>
      </div>
      <div className="min-w-0 pt-0.5">
        <p className={`text-xs font-semibold ${colors.title} leading-snug`}>{insight.title}</p>
        <p className={`text-[11px] ${colors.action} mt-0.5`}>{insight.action}</p>
      </div>
    </div>
  );
}

// ─── Collapsible Section ─────────────────────────────────────────────────────

function CollapsibleSection({ title, badge, defaultOpen = false, children }: {
  title: string;
  badge?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-white/[0.06]">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-white/[0.02] transition-all"
      >
        <div className="flex items-center gap-2">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-200 ${open ? 'rotate-90' : ''}`}>
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span className="font-semibold tracking-wide">{title}</span>
          {badge && (
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-white/[0.06] text-[var(--text-tertiary)]">{badge}</span>
          )}
        </div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform duration-200 opacity-40 ${open ? 'rotate-180' : ''}`}>
          <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 animate-fade-in">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Raw Metrics (Details) ───────────────────────────────────────────────────

function RawMetricsDetails({ p, sd, inf, engineState, speakers, cumulativeSpeakers, spark, identityToName, history }: {
  p: MetricSnapshot['participation'];
  sd: MetricSnapshot['semantic_dynamics'];
  inf: MetricSnapshot['inferred_state'];
  engineState: EngineState | null;
  speakers: { name: string; share: number }[];
  cumulativeSpeakers: { name: string; share: number }[];
  spark: { risk: number[]; balance: number[] };
  identityToName: Record<string, string>;
  history: MetricSnapshot[];
}) {
  const speakerCount = Object.keys(p.volume_share).length;
  const pComposite = p.participation_composite || 0;
  const riskStatus = getStatus('risk', pComposite);
  const balanceStatus = speakerCount <= 1
    ? { text: 'Nur 1 Sprecher', type: 'bad' as StatusType }
    : getStatus('balance', p.balance);
  const noveltyStatus = getStatus('novelty', sd.novelty_rate);
  const spreadStatus = getStatus('spread', sd.diversity);
  const ideaRateStatus = getStatus('ideaRate', p.ideational_fluency_rate);
  const stagnationStatus = getStatus('stagnation', sd.stagnation_duration_seconds);

  const ratio = sd.exploration_elaboration_ratio;
  const explorationPct = (ratio / (1 + ratio)) * 100;

  const stateConfig = STATE_CONFIG[inf.state] || STATE_CONFIG.HEALTHY_EXPLORATION;
  const phaseConfig = engineState ? (PHASE_CONFIG[engineState.phase] || PHASE_CONFIG.MONITORING) : null;
  const cum = p.cumulative;

  return (
    <>
      {/* Engine State Details */}
      <div className="glass-sm p-2.5 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[var(--text-tertiary)]">Zustand</span>
          <span className={`text-[11px] font-medium ${stateConfig.color}`}>{stateConfig.label}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[var(--text-tertiary)]">Konfidenz</span>
          <span className="text-[11px] font-mono text-[var(--text-secondary)]">{(inf.confidence * 100).toFixed(0)}%</span>
        </div>
        {inf.secondary_state && inf.secondary_confidence < inf.confidence && (
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[var(--text-tertiary)]">Sekundär</span>
            <span className="text-[11px] font-mono text-[var(--text-secondary)]">
              {STATE_CONFIG[inf.secondary_state]?.label ?? inf.secondary_state} ({(inf.secondary_confidence * 100).toFixed(0)}%)
            </span>
          </div>
        )}
        {phaseConfig && (
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[var(--text-tertiary)]">Phase</span>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${phaseConfig.bg}`}>{phaseConfig.label}</span>
          </div>
        )}

        {/* State formula scores — always shown so user can see competition between states */}
        {inf.criteria_snapshot && Object.keys(inf.criteria_snapshot).length > 0 && (() => {
          const sorted = Object.entries(inf.criteria_snapshot).sort(([, a], [, b]) => b - a);
          const topState = sorted[0]?.[0];
          const topScore = sorted[0]?.[1] ?? 0;
          const activeScore = inf.criteria_snapshot[inf.state] ?? 0;
          const isSuppressed = topState !== inf.state;
          return (
            <div className="pt-1.5 mt-1.5 border-t border-white/[0.06] space-y-1">
              <span className="text-[9px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">Formel-Scores</span>
              {isSuppressed && (
                <p className="text-[8px] text-amber-500/60 leading-tight">
                  {topScore - activeScore > 0.20
                    ? 'Aufwärmphase — Risiko-Erkennung noch nicht aktiv'
                    : 'Vorsprung zu knapp für Wechsel (Stabilisierung)'}
                </p>
              )}
              {sorted.map(([state, score]) => {
                const cfg = STATE_CONFIG[state];
                if (!cfg) return null;
                const isActive = state === inf.state;
                return (
                  <div key={state} className="flex items-center gap-2">
                    <span className={`text-[9px] w-[90px] truncate ${isActive ? cfg.color + ' font-semibold' : 'text-[var(--text-tertiary)]'}`}>
                      {cfg.label}
                    </span>
                    <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${isActive ? 'opacity-100' : 'opacity-40'}`}
                        style={{
                          width: `${Math.min(score * 100, 100)}%`,
                          background: state.includes('RISK') || state === 'STALLED_DISCUSSION'
                            ? 'linear-gradient(to right, #f43f5e, #fb923c)'
                            : 'linear-gradient(to right, #10b981, #14b8a6)',
                        }}
                      />
                    </div>
                    <span className={`text-[9px] font-mono w-8 text-right ${isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'}`}>
                      {(score * 100).toFixed(0)}%
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* Beteiligung */}
      <SectionDivider>Beteiligung</SectionDivider>

      <div className="space-y-2.5">
        <MetricRow label="Ungleichgewicht" tipKey="risk" displayValue={`${(pComposite * 100).toFixed(0)}%`} status={speakerCount <= 1 ? { text: 'Nur 1 Sprecher', type: 'bad' } : riskStatus} gaugeFill={pComposite} gaugeThreshold={0.5} />
        <MetricRow label="Balance" tipKey="balance" displayValue={`${(p.balance * 100).toFixed(0)}%`} status={balanceStatus} gaugeFill={p.balance} gaugeThreshold={0.5} />
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[10px] text-[var(--text-tertiary)]">Trends</span>
        <Sparkline data={spark.risk} color={riskStatus.type === 'good' ? '#22c55e' : '#f43f5e'} />
        <Sparkline data={spark.balance} color={balanceStatus.type === 'good' ? '#22c55e' : '#f43f5e'} />
      </div>

      <div className="space-y-3">
        <DetailGauge label="Hoover (Volumen)" value={p.hoover_imbalance} tipKey="hoover" />
        <DetailGauge label="Stille-Quote" value={p.silent_participant_ratio} tipKey="silentRatio" />
        <DetailGauge label="Dominanz-Streak" value={p.dominance_streak_score} tipKey="dominanceStreak" />
        <DetailGauge label="Langzeit-Balance" value={p.long_term_balance} tipKey="longTermBalance" />
      </div>

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

      {/* Ideenqualität */}
      <SectionDivider>Ideenqualität</SectionDivider>

      <div className="space-y-2.5">
        <MetricRow label="Neuheit" tipKey="novelty" displayValue={`${(sd.novelty_rate * 100).toFixed(0)}%`} status={noveltyStatus} gaugeFill={sd.novelty_rate} gaugeThreshold={0.35} />
        <MetricRow label="Verteilung" tipKey="spread" displayValue={`${(sd.diversity * 100).toFixed(0)}%`} status={spreadStatus} gaugeFill={sd.diversity} gaugeThreshold={0.4} />
      </div>

      <div className="space-y-3">
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
        <DetailGauge label="Piggybacking" value={sd.piggybacking_score} tipKey="piggybacking" />
        {!sd.has_embeddings && (
          <div className="p-2 rounded-lg border border-amber-500/20 bg-amber-500/5">
            <p className="text-[10px] text-amber-400">Jaccard-Fallback — Embeddings werden generiert</p>
          </div>
        )}
      </div>

      {/* Aktivität */}
      <SectionDivider>Aktivität</SectionDivider>

      <div className="space-y-2.5">
        <MetricRow label="Ideenrate" tipKey="ideaRate" displayValue={`${p.ideational_fluency_rate.toFixed(1)}/m`} status={ideaRateStatus} gaugeFill={Math.min(p.ideational_fluency_rate / 10, 1)} gaugeThreshold={0.3} />
        <MetricRow label="Stagnation" tipKey="stagnation" displayValue={`${Math.round(sd.stagnation_duration_seconds)}s`} status={stagnationStatus} gaugeFill={Math.min(sd.stagnation_duration_seconds / 150, 1)} gaugeThreshold={0.5} />
      </div>

      <p className="text-[9px] text-[var(--text-tertiary)] text-center font-mono pt-1">
        {history.length} Messpunkte
      </p>
    </>
  );
}

// ─── Interventions Tab (kept as-is) ──────────────────────────────────────────

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
  participation_composite: 'Partizipations-Komposit',
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
  if (isNaN(d.getTime())) return '\u2014';
  return d.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

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
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-[var(--text-tertiary)] font-mono">{formatTime(iv.created_at)}</span>
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${colors.dot} shrink-0`} />
          <span className={`text-[10px] font-medium ${colors.text}`}>{intentInfo.label}</span>
          {iv.recovered !== undefined && (
            <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-md ${
              iv.recovered ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
            }`}>
              {iv.recovered ? `Erholt${iv.recovery_score != null ? ` ${(iv.recovery_score * 100).toFixed(0)}%` : ''}` : 'Nicht erholt'}
            </span>
          )}
        </div>
      </div>
      <p className="text-xs text-[var(--text-primary)] leading-relaxed">{iv.text}</p>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors mt-2"
      >
        <span className={`transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}>&#9656;</span>
        Details
      </button>
      {expanded && (
        <div className="mt-2 space-y-2 animate-fade-in">
          <p className="text-[10px] text-[var(--text-tertiary)] italic">{intentInfo.reason}</p>
          {flatMetrics.length > 0 && (
            <div className="space-y-1 pt-1 border-t border-white/[0.06]">
              <span className="text-[9px] text-[var(--text-tertiary)] font-semibold uppercase tracking-wider">Metriken</span>
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
        </div>
      )}
    </div>
  );
}

function InterventionsTab({ interventions }: { interventions: Intervention[] }) {
  if (interventions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-[var(--text-tertiary)]">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-2 opacity-50">
          <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <p className="text-xs">Noch keine Eingriffe</p>
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

// ─── Main Component: Coach Mode ──────────────────────────────────────────────

export default function MetricsPanel({ latest, history, engineState, participants, interventions = [] }: MetricsPanelProps) {
  const identityToName = useMemo(() => {
    const map: Record<string, string> = {};
    if (participants) {
      for (const p of participants) map[p.livekit_identity] = p.display_name;
    }
    return map;
  }, [participants]);

  // Staleness tracking
  const [now, setNow] = useState(() => Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    intervalRef.current = setInterval(() => setNow(Date.now()), 5_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const computedAt = latest?.computed_at ? new Date(latest.computed_at).getTime() : null;
  const stalenessSeconds = computedAt ? Math.round((now - computedAt) / 1000) : null;

  // Sparkline data
  const spark = useMemo(() => {
    const recent = history.slice(-30);
    return {
      risk: recent.map(s => s.participation?.participation_composite ?? s.participation?.participation_risk_score ?? 0),
      balance: recent.map(s => s.participation?.balance ?? 0),
    };
  }, [history]);

  const p = latest?.participation ?? {
    volume_share: {}, turn_share: {},
    hoover_imbalance: 0, turn_hoover: 0, balance: 0, silent_participant_ratio: 0,
    dominance_streak_score: 0, participation_composite: 0, long_term_balance: 0,
    cumulative_imbalance: 0, ideational_fluency_rate: 0,
  };
  const sd = latest?.semantic_dynamics ?? {
    novelty_rate: 0, cluster_concentration: 0, exploration_elaboration_ratio: 1,
    cluster_count: 0, has_embeddings: false,
    stagnation_duration_seconds: 0, diversity: 0, piggybacking_score: 0,
  };
  const inf = latest?.inferred_state ?? {
    state: 'HEALTHY_EXPLORATION' as const, confidence: 0,
    secondary_state: null, secondary_confidence: 0, criteria_snapshot: {},
  };

  const speakerCount = Object.keys(p.volume_share).length;

  // Total participant count (includes non-speakers) for correct fair-share calculation
  const totalParticipants = participants?.length ?? Object.keys(p.volume_share).length;

  // Generate actionable insights
  const insights = useMemo(
    () => generateInsights(p, sd, inf, identityToName, totalParticipants),
    [p, sd, inf, identityToName, totalParticipants],
  );

  // Speaker bars
  const speakers = useMemo(() =>
    Object.entries(p.volume_share)
      .sort(([, a], [, b]) => b - a)
      .map(([id, share]) => ({
        name: identityToName[id] || id,
        share,
      })),
    [p.volume_share, identityToName],
  );

  const cumulativeSpeakers = useMemo(() => {
    if (!p.cumulative) return [];
    return Object.entries(p.cumulative.volume_share)
      .sort(([, a], [, b]) => b - a)
      .map(([id, share]) => ({
        name: identityToName[id] || id,
        share,
      }));
  }, [p.cumulative, identityToName]);

  // Determine header state — always from backend state inference (single source of truth).
  // Insights serve as supplementary early-warning cards but never override the header.
  const isRiskState = ['DOMINANCE_RISK', 'CONVERGENCE_RISK', 'STALLED_DISCUSSION'].includes(inf.state);
  const stateConfig = STATE_CONFIG[inf.state] || STATE_CONFIG.HEALTHY_EXPLORATION;

  const headerConfig = isRiskState
    ? {
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        ),
        title: stateConfig.label,
        subtitle: getStateSummaryCoach(inf.state),
        bg: stateConfig.gradient,
        titleColor: stateConfig.color,
        subtitleColor: stateConfig.color.replace('400', '400/60'),
      }
    : {
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        ),
        title: inf.state === 'HEALTHY_ELABORATION' ? 'Ideen werden vertieft' : 'Session läuft gut',
        subtitle: inf.state === 'HEALTHY_ELABORATION'
          ? 'Bestehende Ideen werden produktiv ausgebaut.'
          : 'Neue Themen werden erkundet — gute Dynamik.',
        bg: 'from-emerald-500/15 to-emerald-500/5',
        titleColor: 'text-emerald-400',
        subtitleColor: 'text-emerald-400/60',
      };

  // Empty state
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
      {/* ── Coach Header ── */}
      <div className={`shrink-0 px-4 py-4 bg-gradient-to-br ${headerConfig.bg} border-b border-[var(--border-glass)]`}>
        <div className="flex items-start gap-3">
          <div className="shrink-0 mt-0.5">{headerConfig.icon}</div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className={`text-sm font-bold ${headerConfig.titleColor} leading-tight`}>
                {headerConfig.title}
              </h3>
              {stalenessSeconds != null && stalenessSeconds > 30 && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold shrink-0 border ${
                  stalenessSeconds > 120
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                }`}>
                  {stalenessSeconds > 120 ? 'Veraltet' : `${stalenessSeconds}s`}
                </span>
              )}
            </div>
            <p className={`text-[11px] ${headerConfig.subtitleColor} mt-1 leading-relaxed`}>
              {headerConfig.subtitle}
            </p>
          </div>
        </div>
      </div>

      {/* ── Scrollable Coach Content ── */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
        <div className="px-4 py-3 space-y-3">
          {/* Insight Cards */}
          {insights.length > 0 && (
            <div className="space-y-2">
              {insights.map(insight => (
                <InsightCard key={insight.id} insight={insight} />
              ))}
            </div>
          )}

          {/* Speaker Bars */}
          {speakers.length > 0 && speakerCount > 1 && (
            <div className="glass-sm p-3 space-y-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-widest">
                  Beteiligung
                </span>
                <span className="text-[10px] font-mono text-[var(--text-tertiary)]">
                  {speakerCount} Sprecher
                </span>
              </div>
              {speakers.map(({ name, share }) => (
                <div key={name} className="flex items-center gap-2">
                  <span className="text-[11px] text-[var(--text-secondary)] w-20 truncate shrink-0 font-medium">{name}</span>
                  <div className="flex-1 h-2 bg-white/[0.06] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ease-out ${
                        share > 0.6 && speakerCount > 1
                          ? 'bg-gradient-to-r from-orange-500 to-rose-500'
                          : 'bg-gradient-to-r from-indigo-500 to-violet-500'
                      }`}
                      style={{ width: `${share * 100}%` }}
                    />
                  </div>
                  <span className={`text-[11px] font-mono tabular-nums w-9 text-right font-semibold ${
                    share > 0.6 && speakerCount > 1 ? 'text-orange-400' : 'text-[var(--text-secondary)]'
                  }`}>
                    {(share * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Mini Stats */}
          <div className="flex items-center justify-center gap-3 text-[10px] text-[var(--text-tertiary)] font-mono py-1.5">
            <span>{p.ideational_fluency_rate.toFixed(1)} Ideen/min</span>
            <span className="w-px h-3 bg-white/[0.08]" />
            <span>{history.length} Snapshots</span>
            {p.cumulative && (
              <>
                <span className="w-px h-3 bg-white/[0.08]" />
                <span>{p.cumulative.total_words} Wörter</span>
              </>
            )}
          </div>
        </div>

        {/* ── Expandable: Raw Metrics ── */}
        <CollapsibleSection title="Rohdaten" badge={`${history.length}`}>
          <RawMetricsDetails
            p={p}
            sd={sd}
            inf={inf}
            engineState={engineState}
            speakers={speakers}
            cumulativeSpeakers={cumulativeSpeakers}
            spark={spark}
            identityToName={identityToName}
            history={history}
          />
        </CollapsibleSection>

        {/* ── Expandable: Interventions ── */}
        <CollapsibleSection title="Eingriffe" badge={interventions.length > 0 ? `${interventions.length}` : undefined}>
          <InterventionsTab interventions={interventions} />
        </CollapsibleSection>
      </div>
    </div>
  );
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function getStateSummaryCoach(state: string): string {
  switch (state) {
    case 'HEALTHY_EXPLORATION':
      return 'Neue Themen werden erkundet — gute Dynamik.';
    case 'HEALTHY_ELABORATION':
      return 'Bestehende Ideen werden produktiv vertieft.';
    case 'DOMINANCE_RISK':
      return 'Beteiligung ist unausgewogen — einzelne dominieren.';
    case 'CONVERGENCE_RISK':
      return 'Diskussion verengt sich — wenig neue Perspektiven.';
    case 'STALLED_DISCUSSION':
      return 'Diskussion stockt — keine frischen Ideen.';
    default:
      return '';
  }
}
