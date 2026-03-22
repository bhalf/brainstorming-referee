'use client';

import ModuleSelector from '../ModuleSelector';
import type { ModerationLevel, FeatureKey } from '@/types';

const MODERATION_LEVELS: { value: ModerationLevel; label: string; description: string; icon: string }[] = [
  {
    value: 'none',
    label: 'Keine Moderation',
    description: 'Reines Brainstorming ohne KI-Eingriffe',
    icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
  },
  {
    value: 'moderation',
    label: 'Moderation',
    description: 'KI-Moderator greift bei Bedarf ein',
    icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  },
  {
    value: 'moderation_ally',
    label: 'Moderation + Impuls',
    description: 'Moderator + KI-Teilnehmer für Impulse',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
  },
];

interface StepModerationProps {
  moderationLevel: ModerationLevel;
  ttsEnabled: boolean;
  selectedFeatures: FeatureKey[];
  onModerationLevelChange: (level: ModerationLevel) => void;
  onTtsEnabledChange: (enabled: boolean) => void;
  onFeaturesChange: (features: FeatureKey[]) => void;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
}

export default function StepModeration({
  moderationLevel,
  ttsEnabled,
  selectedFeatures,
  onModerationLevelChange,
  onTtsEnabledChange,
  onFeaturesChange,
  onBack,
  onNext,
  onSkip,
}: StepModerationProps) {
  const disabledKeys: FeatureKey[] = moderationLevel !== 'none' ? ['metrics'] : [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-xl font-bold tracking-tight">KI & Features</h2>
          <p className="text-sm text-[var(--text-tertiary)] mt-1">Wie soll die KI deine Session unterstützen?</p>
        </div>
        <button
          type="button"
          onClick={onSkip}
          className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
        >
          Defaults beibehalten
        </button>
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
                onClick={() => onModerationLevelChange(level.value)}
                className={`flex items-start gap-3.5 p-4 rounded-xl border cursor-pointer transition-all w-full text-left ${
                  isSelected
                    ? 'border-indigo-500/40 bg-indigo-500/5'
                    : 'border-[var(--border-glass)] bg-white/[0.02] hover:bg-white/[0.04] hover:border-[var(--border-glass-hover)]'
                }`}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
                  isSelected ? 'bg-indigo-500/15' : 'bg-white/[0.04]'
                }`}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isSelected ? 'text-indigo-400' : 'text-[var(--text-tertiary)]'}>
                    <path d={level.icon} />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[var(--text-primary)] text-sm font-medium">{level.label}</span>
                  <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{level.description}</p>
                </div>
                <div className={`w-4 h-4 rounded-full border-2 mt-1 flex items-center justify-center transition-all flex-shrink-0 ${
                  isSelected ? 'border-indigo-500' : 'border-white/20'
                }`}>
                  {isSelected && <div className="w-2 h-2 rounded-full bg-indigo-500" />}
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
              onChange={(e) => onTtsEnabledChange(e.target.checked)}
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

      {/* Features */}
      <div className="animate-fade-in">
        <ModuleSelector
          selectedFeatures={selectedFeatures}
          onChange={onFeaturesChange}
          disabledKeys={disabledKeys}
        />
      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="btn-glass flex-1 py-3.5 text-base"
        >
          Zurück
        </button>
        <button
          type="button"
          onClick={onNext}
          className="btn-primary flex-1 py-3.5 text-base"
        >
          Weiter
        </button>
      </div>
    </div>
  );
}
