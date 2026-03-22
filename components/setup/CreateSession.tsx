'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createSession, joinSession } from '@/lib/api-client';
import ModuleSelector from './ModuleSelector';
import type { ModerationLevel, FeatureKey, Session } from '@/types';

const LANGUAGES = [
  { value: 'de-CH', label: 'Deutsch (CH)' },
  { value: 'de-DE', label: 'Deutsch (DE)' },
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (GB)' },
  { value: 'fr-FR', label: 'Français' },
];

const MODERATION_LEVELS: { value: ModerationLevel; label: string; description: string }[] = [
  { value: 'none', label: 'Keine Moderation', description: 'Reines Brainstorming ohne KI-Eingriffe' },
  { value: 'moderation', label: 'Moderation', description: 'KI-Moderator greift bei Bedarf ein' },
  { value: 'moderation_ally', label: 'Moderation + Impuls', description: 'Moderator + KI-Teilnehmer für Impulse' },
];

const DURATION_PRESETS = [15, 30, 45, 60, 90];

interface GoalFormData {
  label: string;
  description: string;
  expanded: boolean;
  subgoals: { label: string; description: string }[];
}

export default function CreateSession() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [language, setLanguage] = useState('de-CH');
  const [moderationLevel, setModerationLevel] = useState<ModerationLevel>('moderation');
  const [selectedFeatures, setSelectedFeatures] = useState<FeatureKey[]>([]);
  const [goals, setGoals] = useState<GoalFormData[]>([]);
  const [plannedDuration, setPlannedDuration] = useState<number | ''>('');
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [autoHost, setAutoHost] = useState(true);
  const [participantMetrics, setParticipantMetrics] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdSession, setCreatedSession] = useState<Session | null>(null);

  // Auto-enable metrics when moderation is active
  useEffect(() => {
    if (moderationLevel !== 'none' && !selectedFeatures.includes('metrics')) {
      setSelectedFeatures((prev) => [...prev, 'metrics']);
    }
  }, [moderationLevel]); // eslint-disable-line react-hooks/exhaustive-deps

  const disabledKeys: FeatureKey[] = moderationLevel !== 'none' ? ['metrics'] : [];
  const showGoals = selectedFeatures.includes('goals');

  // --- Goal handlers ---

  const handleAddGoal = () => {
    setGoals((prev) => [...prev, { label: '', description: '', expanded: true, subgoals: [] }]);
  };

  const handleRemoveGoal = (index: number) => {
    setGoals((prev) => prev.filter((_, i) => i !== index));
  };

  const handleGoalChange = (index: number, field: 'label' | 'description', value: string) => {
    setGoals((prev) => prev.map((g, i) => (i === index ? { ...g, [field]: value } : g)));
  };

  const toggleGoalExpanded = (index: number) => {
    setGoals((prev) => prev.map((g, i) => (i === index ? { ...g, expanded: !g.expanded } : g)));
  };

  const handleAddSubgoal = (goalIndex: number) => {
    setGoals((prev) =>
      prev.map((g, i) =>
        i === goalIndex
          ? { ...g, expanded: true, subgoals: [...g.subgoals, { label: '', description: '' }] }
          : g
      )
    );
  };

  const handleRemoveSubgoal = (goalIndex: number, subIndex: number) => {
    setGoals((prev) =>
      prev.map((g, i) =>
        i === goalIndex
          ? { ...g, subgoals: g.subgoals.filter((_, si) => si !== subIndex) }
          : g
      )
    );
  };

  const handleSubgoalChange = (
    goalIndex: number,
    subIndex: number,
    field: 'label' | 'description',
    value: string
  ) => {
    setGoals((prev) =>
      prev.map((g, i) =>
        i === goalIndex
          ? {
              ...g,
              subgoals: g.subgoals.map((s, si) =>
                si === subIndex ? { ...s, [field]: value } : s
              ),
            }
          : g
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const session = await createSession({
        title: title.trim(),
        description: description.trim() || undefined,
        language,
        moderation_level: moderationLevel,
        features: selectedFeatures,
        goals: showGoals
          ? goals
              .filter((g) => g.label.trim())
              .map((g) => ({
                label: g.label.trim(),
                description: g.description.trim() || undefined,
                subgoals: g.subgoals
                  .filter((s) => s.label.trim())
                  .map((s) => ({
                    label: s.label.trim(),
                    description: s.description.trim() || undefined,
                  })),
              }))
          : undefined,
        planned_duration_minutes: plannedDuration || undefined,
        config: {
          tts_enabled: ttsEnabled,
          ...(!autoHost ? { auto_host: false } : {}),
          ...(!participantMetrics ? { participant_metrics: false } : {}),
        },
      });
      setCreatedSession(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Session konnte nicht erstellt werden');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Success: Show join code + host name input ---
  const [hostName, setHostName] = useState('');
  const [isJoiningAsHost, setIsJoiningAsHost] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const handleStartAsHost = async () => {
    if (!createdSession || !hostName.trim()) return;
    setIsJoiningAsHost(true);
    setJoinError(null);
    try {
      const result = await joinSession(createdSession.join_code, hostName.trim());
      const params = new URLSearchParams({
        identity: result.participant.livekit_identity,
        name: hostName.trim(),
      });
      router.push(`/session/${createdSession.id}?${params.toString()}`);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Beitreten fehlgeschlagen');
      setIsJoiningAsHost(false);
    }
  };

  if (createdSession) {
    return (
      <div className="max-w-md mx-auto text-center animate-fade-in-scale">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/10 mb-5">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold tracking-tight">Session erstellt</h2>
        <p className="text-[var(--text-secondary)] text-sm mt-2">{createdSession.title}</p>

        <div className="glass p-6 mt-6">
          <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-3">Join-Code</p>
          <p className="text-4xl font-mono font-bold tracking-[0.2em] bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
            {createdSession.join_code}
          </p>
          <button
            onClick={() => navigator.clipboard.writeText(createdSession.join_code)}
            className="mt-4 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors inline-flex items-center gap-1.5"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
            Code kopieren
          </button>
        </div>

        {/* Host name input */}
        <div className="glass p-5 mt-4 text-left">
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Dein Name</label>
          <input
            type="text"
            value={hostName}
            onChange={(e) => setHostName(e.target.value)}
            placeholder="z.B. Anna"
            className="input-glass text-center text-lg"
            onKeyDown={(e) => e.key === 'Enter' && handleStartAsHost()}
            autoFocus
          />
          {joinError && (
            <p className="text-sm text-rose-400 mt-2">{joinError}</p>
          )}
        </div>

        <div className="flex gap-3 justify-center mt-6">
          <button
            onClick={() => {
              const url = `${window.location.origin}/join/${createdSession.join_code}`;
              navigator.clipboard.writeText(url);
            }}
            className="btn-glass text-sm px-4 py-2.5"
          >
            Link kopieren
          </button>
          <button
            onClick={handleStartAsHost}
            disabled={isJoiningAsHost || !hostName.trim()}
            className="btn-primary text-sm px-5 py-2.5"
          >
            {isJoiningAsHost ? (
              <span className="inline-flex items-center gap-2">
                <span className="spinner w-4 h-4 border-white/30 border-t-white" />
                Beitreten...
              </span>
            ) : 'Session starten'}
          </button>
        </div>
      </div>
    );
  }

  // --- Form ---
  return (
    <form onSubmit={handleSubmit} className="max-w-lg mx-auto space-y-5">
      <h2 className="text-xl font-bold tracking-tight">Neue Session</h2>

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Titel</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="z.B. Produktideen Q2"
          className="input-glass"
          required
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Beschreibung (optional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Worum geht es in dieser Session? Kontext hilft der KI, relevantere Themen zu erkennen."
          className="input-glass w-full resize-none"
          rows={2}
        />
      </div>

      {/* Language */}
      <div>
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Sprache</label>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="select-glass"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.value} value={lang.value}>{lang.label}</option>
          ))}
        </select>
      </div>

      {/* Moderation Level */}
      <div>
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-3">Moderations-Stufe</label>
        <div className="space-y-2">
          {MODERATION_LEVELS.map((level) => {
            const isSelected = moderationLevel === level.value;
            return (
              <button
                type="button"
                key={level.value}
                onClick={() => setModerationLevel(level.value)}
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all w-full text-left ${
                  isSelected
                    ? 'border-indigo-500/40 bg-indigo-500/5'
                    : 'border-[var(--border-glass)] bg-white/[0.02] hover:bg-white/[0.04] hover:border-[var(--border-glass-hover)]'
                }`}
              >
                <div className={`w-4 h-4 rounded-full border-2 mt-0.5 flex items-center justify-center transition-all flex-shrink-0 ${
                  isSelected ? 'border-indigo-500' : 'border-white/20'
                }`}>
                  {isSelected && <div className="w-2 h-2 rounded-full bg-indigo-500" />}
                </div>
                <div>
                  <span className="text-[var(--text-primary)] text-sm font-medium">{level.label}</span>
                  <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{level.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* TTS toggle — only visible with moderation */}
      {moderationLevel !== 'none' && (
        <div className="animate-fade-in">
          <label className="flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all select-none border-[var(--border-glass)] bg-white/[0.02] hover:bg-white/[0.04] hover:border-[var(--border-glass-hover)]">
            <input
              type="checkbox"
              checked={ttsEnabled}
              onChange={(e) => setTtsEnabled(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded accent-indigo-500"
            />
            <div>
              <span className="text-[var(--text-primary)] text-sm font-medium">Sprachausgabe (TTS)</span>
              <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                KI-Moderator spricht Interventionen laut aus. Deaktivieren für nur Text-Overlays.
              </p>
            </div>
          </label>
        </div>
      )}

      {/* Session Access Controls */}
      <div>
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-3">Teilnehmer-Einstellungen</label>
        <div className="space-y-2">
          <label className="flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all select-none border-[var(--border-glass)] bg-white/[0.02] hover:bg-white/[0.04] hover:border-[var(--border-glass-hover)]">
            <input
              type="checkbox"
              checked={!autoHost}
              onChange={(e) => setAutoHost(!e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded accent-indigo-500"
            />
            <div>
              <span className="text-[var(--text-primary)] text-sm font-medium">Kein Host unter Teilnehmern</span>
              <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                Niemand erhält Host-Rechte. Teilnehmer können nur beitreten und zuhören — kein Pausieren oder Beenden.
              </p>
            </div>
          </label>
          {selectedFeatures.includes('metrics') && (
            <label className="flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all select-none border-[var(--border-glass)] bg-white/[0.02] hover:bg-white/[0.04] hover:border-[var(--border-glass-hover)]">
              <input
                type="checkbox"
                checked={!participantMetrics}
                onChange={(e) => setParticipantMetrics(!e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded accent-indigo-500"
              />
              <div>
                <span className="text-[var(--text-primary)] text-sm font-medium">Metriken vor Teilnehmern verbergen</span>
                <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                  Teilnehmer sehen keine Echtzeit-Metriken. Nur Hosts und Co-Hosts haben Zugriff.
                </p>
              </div>
            </label>
          )}
        </div>
      </div>

      {/* Features — always visible */}
      <div className="animate-fade-in">
        <ModuleSelector
          selectedFeatures={selectedFeatures}
          onChange={setSelectedFeatures}
          disabledKeys={disabledKeys}
        />
      </div>

      {/* Planned Duration */}
      <div>
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
          Geplante Dauer (optional)
        </label>
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            {DURATION_PRESETS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setPlannedDuration(plannedDuration === d ? '' : d)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  plannedDuration === d
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                    : 'bg-white/[0.03] text-[var(--text-tertiary)] border border-[var(--border-glass)] hover:bg-white/[0.06]'
                }`}
              >
                {d} min
              </button>
            ))}
          </div>
          <span className="text-[var(--text-tertiary)] text-xs">oder</span>
          <input
            type="number"
            value={plannedDuration}
            onChange={(e) => setPlannedDuration(e.target.value ? parseInt(e.target.value) : '')}
            placeholder="..."
            min={5}
            max={180}
            className="input-glass w-20 text-center text-sm"
          />
          <span className="text-xs text-[var(--text-tertiary)]">min</span>
        </div>
        <p className="text-xs text-[var(--text-tertiary)] mt-1.5">
          Aktiviert zeitbasierte Ziel-Erinnerungen durch den KI-Moderator
        </p>
      </div>

      {/* Goals */}
      {showGoals && (
        <div className="space-y-3 animate-fade-in">
          <label className="block text-sm font-medium text-[var(--text-secondary)]">Gesprächsziele</label>
          {goals.map((goal, gi) => (
            <div key={gi} className="rounded-xl border border-[var(--border-glass)] bg-white/[0.02] overflow-hidden">
              {/* Goal header */}
              <div className="flex items-center gap-2 p-3">
                <button
                  type="button"
                  onClick={() => toggleGoalExpanded(gi)}
                  className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors flex-shrink-0"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`transition-transform duration-200 ${goal.expanded ? 'rotate-90' : ''}`}
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
                <input
                  type="text"
                  value={goal.label}
                  onChange={(e) => handleGoalChange(gi, 'label', e.target.value)}
                  placeholder={`Ziel ${gi + 1}`}
                  className="input-glass flex-1 text-sm"
                />
                {goal.subgoals.length > 0 && (
                  <span className="text-[10px] text-[var(--text-tertiary)] bg-white/[0.05] px-1.5 py-0.5 rounded flex-shrink-0">
                    {goal.subgoals.length} Teilziel{goal.subgoals.length !== 1 ? 'e' : ''}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handleRemoveGoal(gi)}
                  className="text-[var(--text-tertiary)] hover:text-rose-400 transition-colors px-1 flex-shrink-0"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Expanded: description + subgoals */}
              {goal.expanded && (
                <div className="px-3 pb-3 space-y-2.5 animate-fade-in">
                  <div className="ml-6">
                    <textarea
                      value={goal.description}
                      onChange={(e) => handleGoalChange(gi, 'description', e.target.value)}
                      placeholder="Beschreibung (optional)"
                      className="input-glass text-xs w-full resize-none"
                      rows={2}
                    />
                  </div>

                  {/* Subgoals */}
                  <div className="ml-6 border-l-2 border-indigo-500/20 pl-3 space-y-2">
                    {goal.subgoals.map((sub, si) => (
                      <div key={si} className="space-y-1">
                        <div className="flex gap-2 items-center">
                          <input
                            type="text"
                            value={sub.label}
                            onChange={(e) => handleSubgoalChange(gi, si, 'label', e.target.value)}
                            placeholder={`Teilziel ${si + 1}`}
                            className="input-glass flex-1 text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveSubgoal(gi, si)}
                            className="text-[var(--text-tertiary)] hover:text-rose-400 transition-colors px-1 flex-shrink-0"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </div>
                        <input
                          type="text"
                          value={sub.description}
                          onChange={(e) => handleSubgoalChange(gi, si, 'description', e.target.value)}
                          placeholder="Beschreibung (optional)"
                          className="input-glass text-xs w-full opacity-60 focus:opacity-100"
                        />
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => handleAddSubgoal(gi)}
                      className="text-xs text-indigo-400/70 hover:text-indigo-300 transition-colors inline-flex items-center gap-1 pt-0.5"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      Teilziel hinzufügen
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={handleAddGoal}
            className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors inline-flex items-center gap-1"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Ziel hinzufügen
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="glass-sm p-3 border-rose-500/20 bg-rose-500/5 animate-fade-in">
          <p className="text-sm text-rose-400">{error}</p>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={isSubmitting || !title.trim()}
        className="btn-primary w-full py-3.5 text-base"
      >
        {isSubmitting ? (
          <span className="inline-flex items-center gap-2">
            <span className="spinner w-4 h-4 border-white/30 border-t-white" />
            Erstelle...
          </span>
        ) : 'Session erstellen'}
      </button>
    </form>
  );
}
