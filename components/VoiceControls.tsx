'use client';

import { VoiceSettings } from '@/lib/types';
import { CloudTTSVoice } from '@/lib/tts/useCloudTTS';
import Toggle from './shared/Toggle';

const OPENAI_VOICES: { id: CloudTTSVoice; label: string; description: string }[] = [
  { id: 'nova', label: 'Nova', description: 'Warm, conversational' },
  { id: 'alloy', label: 'Alloy', description: 'Balanced, neutral' },
  { id: 'ash', label: 'Ash', description: 'Soft, gentle' },
  { id: 'coral', label: 'Coral', description: 'Clear, informative' },
  { id: 'echo', label: 'Echo', description: 'Smooth, calm' },
  { id: 'fable', label: 'Fable', description: 'Expressive, British' },
  { id: 'onyx', label: 'Onyx', description: 'Deep, authoritative' },
  { id: 'sage', label: 'Sage', description: 'Wise, composed' },
  { id: 'shimmer', label: 'Shimmer', description: 'Bright, upbeat' },
];

interface VoiceControlsProps {
  settings: VoiceSettings;
  isSpeaking: boolean;
  canSpeak: boolean;
  onUpdateSettings: (updates: Partial<VoiceSettings>) => void;
  onTestVoice: () => void;
  onCancel: () => void;
}

export default function VoiceControls({
  settings,
  isSpeaking,
  canSpeak,
  onUpdateSettings,
  onTestVoice,
  onCancel,
}: VoiceControlsProps) {
  return (
    <div className="space-y-4">
      {/* Enable/Disable Toggle */}
      <div className="flex items-center justify-between">
        <label className="text-sm text-slate-300">Enable Voice</label>
        <Toggle checked={settings.enabled} onChange={(v) => onUpdateSettings({ enabled: v })} />
      </div>

      {settings.enabled && (
        <>
          {/* Voice Selection */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Voice (OpenAI TTS)
            </label>
            <select
              value={settings.voiceName || 'nova'}
              onChange={(e) => onUpdateSettings({ voiceName: e.target.value })}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {OPENAI_VOICES.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  {voice.label} — {voice.description}
                </option>
              ))}
            </select>
          </div>

          {/* Speed Slider */}
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs text-slate-400">Speed</label>
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
              {isSpeaking ? 'Speaking...' : 'Test Voice'}
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
