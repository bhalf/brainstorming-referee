'use client';

const LANGUAGES = [
  { value: 'de-CH', label: 'Deutsch (CH)' },
  { value: 'de-DE', label: 'Deutsch (DE)' },
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (GB)' },
  { value: 'fr-FR', label: 'Français' },
];

interface StepBasicsProps {
  title: string;
  description: string;
  language: string;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onLanguageChange: (value: string) => void;
  onNext: () => void;
}

export default function StepBasics({
  title,
  description,
  language,
  onTitleChange,
  onDescriptionChange,
  onLanguageChange,
  onNext,
}: StepBasicsProps) {
  const canProceed = title.trim().length > 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center mb-2">
        <h2 className="text-xl font-bold tracking-tight">Grundlagen</h2>
        <p className="text-sm text-[var(--text-tertiary)] mt-1">Gib deiner Session einen Namen</p>
      </div>

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Titel</label>
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="z.B. Produktideen Q2"
          className="input-glass text-lg"
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && canProceed && onNext()}
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
          Beschreibung <span className="text-[var(--text-tertiary)] font-normal">(optional)</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Worum geht es in dieser Session? Kontext hilft der KI, relevantere Themen zu erkennen."
          className="input-glass w-full resize-none"
          rows={3}
        />
      </div>

      {/* Language */}
      <div>
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Sprache</label>
        <select
          value={language}
          onChange={(e) => onLanguageChange(e.target.value)}
          className="select-glass"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.value} value={lang.value}>{lang.label}</option>
          ))}
        </select>
      </div>

      {/* Next */}
      <button
        type="button"
        onClick={onNext}
        disabled={!canProceed}
        className="btn-primary w-full py-3.5 text-base"
      >
        Weiter
      </button>
    </div>
  );
}
