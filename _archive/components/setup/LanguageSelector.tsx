'use client';

import { LANGUAGE_OPTIONS } from '@/lib/config';

interface LanguageSelectorProps {
  value: string;
  onChange: (language: string) => void;
}

export default function LanguageSelector({ value, onChange }: LanguageSelectorProps) {
  return (
    <section className="mb-5">
      <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
        Language (Transcription &amp; TTS)
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2.5 text-sm bg-slate-900/60 border border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-colors"
      >
        {LANGUAGE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </section>
  );
}
