'use client';

import { useState, useEffect } from 'react';
import { createSession } from '@/lib/api-client';
import WizardProgress from './WizardProgress';
import SessionSuccess from './SessionSuccess';
import StepBasics from './steps/StepBasics';
import StepModeration from './steps/StepModeration';
import StepGoals from './steps/StepGoals';
import type { ModerationLevel, FeatureKey, Session } from '@/types';

interface GoalFormData {
  label: string;
  description: string;
  expanded: boolean;
  subgoals: { label: string; description: string }[];
}

const WIZARD_STEPS = [
  { label: 'Grundlagen' },
  { label: 'KI & Features' },
  { label: 'Details' },
];

export default function CreateSessionWizard() {
  const [step, setStep] = useState(1);
  const [quickCreate, setQuickCreate] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [language, setLanguage] = useState('de-CH');
  const [moderationLevel, setModerationLevel] = useState<ModerationLevel>('moderation');
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [selectedFeatures, setSelectedFeatures] = useState<FeatureKey[]>([]);
  const [goals, setGoals] = useState<GoalFormData[]>([]);
  const [plannedDuration, setPlannedDuration] = useState<number | ''>('');
  const [autoHost, setAutoHost] = useState(true);
  const [participantMetrics, setParticipantMetrics] = useState(true);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdSession, setCreatedSession] = useState<Session | null>(null);

  // Auto-enable metrics when moderation is active
  useEffect(() => {
    if (moderationLevel !== 'none' && !selectedFeatures.includes('metrics')) {
      setSelectedFeatures((prev) => [...prev, 'metrics']);
    }
  }, [moderationLevel]); // eslint-disable-line react-hooks/exhaustive-deps

  const goToStep = (s: number) => {
    setError(null);
    setStep(s);
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;

    setIsSubmitting(true);
    setError(null);

    const showGoals = selectedFeatures.includes('goals');

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

  // --- Success screen ---
  if (createdSession) {
    return <SessionSuccess session={createdSession} />;
  }

  // --- Quick Create mode ---
  if (quickCreate) {
    return (
      <div className="max-w-lg mx-auto space-y-5 animate-fade-in">
        <div className="text-center mb-2">
          <h2 className="text-xl font-bold tracking-tight">Schnell erstellen</h2>
          <p className="text-sm text-[var(--text-tertiary)] mt-1">
            Session mit Standardeinstellungen erstellen
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Titel</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="z.B. Produktideen Q2"
            className="input-glass text-lg"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && title.trim() && handleSubmit()}
          />
        </div>

        <p className="text-xs text-[var(--text-tertiary)]">
          Defaults: Moderation, Deutsch (CH), Metriken-Analyse
        </p>

        {error && (
          <div className="glass-sm p-3 border-rose-500/20 bg-rose-500/5 animate-fade-in">
            <p className="text-sm text-rose-400">{error}</p>
          </div>
        )}

        <button
          type="button"
          onClick={handleSubmit}
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

        <button
          type="button"
          onClick={() => setQuickCreate(false)}
          className="block mx-auto text-sm text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
        >
          Alle Optionen anzeigen
        </button>
      </div>
    );
  }

  // --- Wizard ---
  return (
    <div className="max-w-lg mx-auto">
      <WizardProgress
        currentStep={step}
        steps={WIZARD_STEPS}
        onStepClick={goToStep}
      />

      {/* Error banner */}
      {error && (
        <div className="glass-sm p-3 border-rose-500/20 bg-rose-500/5 animate-fade-in mb-5">
          <p className="text-sm text-rose-400">{error}</p>
        </div>
      )}

      {step === 1 && (
        <StepBasics
          title={title}
          description={description}
          language={language}
          onTitleChange={setTitle}
          onDescriptionChange={setDescription}
          onLanguageChange={setLanguage}
          onNext={() => goToStep(2)}
        />
      )}

      {step === 2 && (
        <StepModeration
          moderationLevel={moderationLevel}
          ttsEnabled={ttsEnabled}
          selectedFeatures={selectedFeatures}
          onModerationLevelChange={setModerationLevel}
          onTtsEnabledChange={setTtsEnabled}
          onFeaturesChange={setSelectedFeatures}
          onBack={() => goToStep(1)}
          onNext={() => goToStep(3)}
          onSkip={() => goToStep(3)}
        />
      )}

      {step === 3 && (
        <StepGoals
          plannedDuration={plannedDuration}
          goals={goals}
          autoHost={autoHost}
          participantMetrics={participantMetrics}
          selectedFeatures={selectedFeatures}
          onPlannedDurationChange={setPlannedDuration}
          onGoalsChange={setGoals}
          onAutoHostChange={setAutoHost}
          onParticipantMetricsChange={setParticipantMetrics}
          onBack={() => goToStep(2)}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
        />
      )}

      {/* Quick create link */}
      {step === 1 && (
        <div className="text-center mt-6">
          <button
            type="button"
            onClick={() => setQuickCreate(true)}
            className="text-sm text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
          >
            Schnell erstellen — nur Titel eingeben
          </button>
        </div>
      )}
    </div>
  );
}
