'use client';

import { VoiceSettings } from '@/lib/types';

interface VoiceControlsProps {
  settings: VoiceSettings;
  voices: SpeechSynthesisVoice[];
  isSpeaking: boolean;
  canSpeak: boolean;
  language: string; // Session language for filtering
  onUpdateSettings: (updates: Partial<VoiceSettings>) => void;
  onTestVoice: () => void;
  onCancel: () => void;
}

export default function VoiceControls({
  settings,
  voices,
  isSpeaking,
  canSpeak,
  language,
  onUpdateSettings,
  onTestVoice,
  onCancel,
}: VoiceControlsProps) {
  const langPrefix = language.split('-')[0]; // 'en' from 'en-US'

  // Filter voices: show matching language first, then others
  const matchingVoices = voices.filter((v) =>
    v.lang.replace('_', '-').startsWith(langPrefix)
  );
  const otherVoices = voices.filter(
    (v) => !v.lang.replace('_', '-').startsWith(langPrefix)
  );

  // Sort: remote (enhanced) voices first within each group
  const sortByQuality = (a: SpeechSynthesisVoice, b: SpeechSynthesisVoice) => {
    // Remote voices (higher quality) first
    if (a.localService !== b.localService) return a.localService ? 1 : -1;
    return a.name.localeCompare(b.name);
  };

  const sortedMatching = [...matchingVoices].sort(sortByQuality);
  const sortedOther = [...otherVoices].sort(sortByQuality);

  const getVoiceLabel = (voice: SpeechSynthesisVoice): string => {
    const quality = voice.localService ? '' : ' ★';
    return `${voice.name} (${voice.lang})${quality}`;
  };

  return (
    <div className="space-y-4">
      {/* Enable/Disable Toggle */}
      <div className="flex items-center justify-between">
        <label className="text-sm text-slate-300">Enable Voice</label>
        <button
          onClick={() => onUpdateSettings({ enabled: !settings.enabled })}
          className={`relative w-12 h-6 rounded-full transition-colors ${settings.enabled ? 'bg-blue-600' : 'bg-slate-600'
            }`}
        >
          <span
            className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${settings.enabled ? 'left-7' : 'left-1'
              }`}
          />
        </button>
      </div>

      {settings.enabled && (
        <>
          {/* Voice Selection */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Voice <span className="text-slate-600">(★ = enhanced quality)</span>
            </label>
            <select
              value={settings.voiceName}
              onChange={(e) => onUpdateSettings({ voiceName: e.target.value })}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {sortedMatching.length > 0 && (
                <optgroup label={`${langPrefix.toUpperCase()} Voices`}>
                  {sortedMatching.map((voice) => (
                    <option key={voice.name} value={voice.name}>
                      {getVoiceLabel(voice)}
                    </option>
                  ))}
                </optgroup>
              )}
              {sortedOther.length > 0 && (
                <optgroup label="Other Voices">
                  {sortedOther.map((voice) => (
                    <option key={voice.name} value={voice.name}>
                      {getVoiceLabel(voice)}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          {/* Rate Slider */}
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs text-slate-400">Rate</label>
              <span className="text-xs text-slate-500">{settings.rate.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={settings.rate}
              onChange={(e) => onUpdateSettings({ rate: parseFloat(e.target.value) })}
              className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>

          {/* Pitch Slider */}
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs text-slate-400">Pitch</label>
              <span className="text-xs text-slate-500">{settings.pitch.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={settings.pitch}
              onChange={(e) => onUpdateSettings({ pitch: parseFloat(e.target.value) })}
              className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>

          {/* Volume Slider */}
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs text-slate-400">Volume</label>
              <span className="text-xs text-slate-500">{Math.round(settings.volume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={settings.volume}
              onChange={(e) => onUpdateSettings({ volume: parseFloat(e.target.value) })}
              className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>

          {/* Test & Cancel Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={onTestVoice}
              disabled={!canSpeak || isSpeaking}
              className={`flex-1 py-2 rounded text-sm font-medium transition-colors ${canSpeak && !isSpeaking
                  ? 'bg-blue-600 hover:bg-blue-500 text-white'
                  : 'bg-slate-600 text-slate-400 cursor-not-allowed'
                }`}
            >
              {isSpeaking ? '🔊 Speaking...' : '🔊 Test Voice'}
            </button>
            {isSpeaking && (
              <button
                onClick={onCancel}
                className="px-4 py-2 bg-red-600/80 hover:bg-red-600 text-white rounded text-sm font-medium"
              >
                Stop
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
