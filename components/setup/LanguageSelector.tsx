'use client';

import { LANGUAGE_OPTIONS } from '@/lib/config';

interface LanguageSelectorProps {
  value: string;
  onChange: (language: string) => void;
}

export default function LanguageSelector({ value, onChange }: LanguageSelectorProps) {
  return (
    <section className="mb-8">
      <label className="block text-sm font-medium text-slate-300 mb-2">
        Language (Transcription & TTS)
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
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
