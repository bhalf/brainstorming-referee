'use client';

import { useIALang, useSetIALang } from '@/lib/interview-analysis/i18n';

export default function LanguageToggle() {
  const lang = useIALang();
  const setLang = useSetIALang();

  return (
    <div className="ia-lang-toggle">
      <button
        className={`ia-lang-toggle-btn ${lang === 'de' ? 'ia-lang-toggle-btn--active' : ''}`}
        onClick={() => setLang('de')}
      >
        DE
      </button>
      <button
        className={`ia-lang-toggle-btn ${lang === 'en' ? 'ia-lang-toggle-btn--active' : ''}`}
        onClick={() => setLang('en')}
      >
        EN
      </button>
    </div>
  );
}
