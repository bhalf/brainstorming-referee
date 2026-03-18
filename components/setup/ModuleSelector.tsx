'use client';

import type { FeatureKey } from '@/types';

interface ModuleSelectorProps {
  selectedFeatures: FeatureKey[];
  onChange: (features: FeatureKey[]) => void;
  disabledKeys?: FeatureKey[];
}

const FEATURES: { key: FeatureKey; label: string; description: string; icon: string }[] = [
  {
    key: 'metrics',
    label: 'Metriken-Analyse',
    description: 'Echtzeit-Analyse der Gesprächsdynamik',
    icon: 'M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
  },
  {
    key: 'ideas',
    label: 'Ideen-Extraktion',
    description: 'KI erkennt automatisch Ideen',
    icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
  },
  {
    key: 'summary',
    label: 'Live-Zusammenfassung',
    description: 'Laufende Session-Zusammenfassung',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  },
  {
    key: 'goals',
    label: 'Ziel-Tracking',
    description: 'Fortschritt zu definierten Zielen',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
  },
  {
    key: 'rules',
    label: 'Regel-Überwachung',
    description: 'Erkennung von Regelverstössen',
    icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  },
];

export default function ModuleSelector({ selectedFeatures, onChange, disabledKeys = [] }: ModuleSelectorProps) {
  const toggle = (key: FeatureKey) => {
    if (disabledKeys.includes(key)) return;
    if (selectedFeatures.includes(key)) {
      onChange(selectedFeatures.filter((f) => f !== key));
    } else {
      onChange([...selectedFeatures, key]);
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-[var(--text-secondary)]">Features</label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {FEATURES.map((feat) => {
          const isSelected = selectedFeatures.includes(feat.key);
          const isDisabled = disabledKeys.includes(feat.key);
          return (
            <button
              key={feat.key}
              type="button"
              onClick={() => toggle(feat.key)}
              disabled={isDisabled}
              className={`relative text-left p-3.5 rounded-xl border transition-all ${
                isDisabled
                  ? 'border-indigo-500/30 bg-indigo-500/5 cursor-not-allowed opacity-75'
                  : isSelected
                    ? 'border-indigo-500/40 bg-indigo-500/5'
                    : 'border-[var(--border-glass)] bg-white/[0.02] hover:bg-white/[0.04] hover:border-[var(--border-glass-hover)]'
              }`}
              title={isDisabled ? 'Wird für Moderation benötigt' : undefined}
            >
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                  isSelected || isDisabled ? 'bg-indigo-500/15' : 'bg-white/[0.04]'
                }`}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isSelected || isDisabled ? 'text-indigo-400' : 'text-[var(--text-tertiary)]'}>
                    <path d={feat.icon} />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <span className={`font-medium text-sm ${isSelected || isDisabled ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                    {feat.label}
                  </span>
                  <p className="text-xs text-[var(--text-tertiary)] mt-0.5 line-clamp-1">{feat.description}</p>
                </div>
                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                  isSelected || isDisabled ? 'bg-indigo-500 border-indigo-500' : 'border-white/20'
                }`}>
                  {(isSelected || isDisabled) && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
              </div>
              {isDisabled && (
                <span className="absolute -top-2 right-3 text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded-full">
                  Benötigt
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
