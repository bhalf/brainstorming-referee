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
        <p className="text-sm text-[var(--text-tertiary)] mt-1">Definiere das Thema eurer Brainstorming-Session</p>
      </div>

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Brainstorming-Thema</label>
        <p className="text-xs text-[var(--text-tertiary)] mb-2">
          Die Kernfrage oder das Thema, das die Gruppe bearbeiten soll. Der KI-Moderator nutzt dies, um Interventionen thematisch passend zu formulieren.
        </p>
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="z.B. Wie können wir die Onboarding-Experience für neue Mitarbeitende verbessern?"
          className="input-glass text-lg"
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && canProceed && onNext()}
        />
        <p className="text-xs text-[var(--text-tertiary)] mt-1.5 leading-relaxed">
          Tipp: Formuliere eine konkrete Frage statt eines Stichwortes.
          {' '}<span className="text-[var(--text-secondary)]">&quot;Wie verbessern wir das Onboarding?&quot;</span> funktioniert besser als <span className="text-[var(--text-secondary)]">&quot;Onboarding&quot;</span>.
        </p>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
          Kontext &amp; Hintergrund <span className="text-[var(--text-tertiary)] font-normal">(optional)</span>
        </label>
        <p className="text-xs text-[var(--text-tertiary)] mb-2">
          Zusätzliche Infos helfen der KI, ein thematisches Raster zu erstellen und blinde Flecken zu erkennen, z.B. wer die Zielgruppe ist oder welche Aspekte relevant sind.
        </p>
        <textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder={"z.B. Wir sind ein 50-Personen-Startup. Neue Mitarbeitende brauchen aktuell 3 Monate bis zur vollen Produktivität. Fokus auf: Remote-Onboarding, Buddy-System, Tooling, Kulturvermittlung."}
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
