'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  DEFAULT_CONFIG,
  CONFIG_CONSTRAINTS,
  validateConfig,
  generateRoomName,
  saveConfigToStorage,
  loadConfigFromStorage,
  saveRoomToStorage,
  loadRoomFromStorage,
  SCENARIO_DESCRIPTIONS,
  LANGUAGE_OPTIONS,
  encodeConfig,
} from '@/lib/config';
import { ExperimentConfig, Scenario } from '@/lib/types';

export default function SetupPage() {
  const router = useRouter();

  // --- Form State ---
  const [roomName, setRoomName] = useState('');
  const [scenario, setScenario] = useState<Scenario>('A');
  const [language, setLanguage] = useState('en-US');
  const [config, setConfig] = useState<ExperimentConfig>(DEFAULT_CONFIG);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  // --- Load from localStorage on mount ---
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsHydrated(true);
    const savedConfig = loadConfigFromStorage();
    if (savedConfig) {
      setConfig(savedConfig);
    }
    const savedRoom = loadRoomFromStorage();
    if (savedRoom) {
      setRoomName(savedRoom);
    } else {
      setRoomName(generateRoomName());
    }
  }, []);

  // Show loading state during hydration to avoid flicker
  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // --- Config Update Handler ---
  const updateConfig = (key: keyof ExperimentConfig, value: number) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  // --- Generate New Room Name ---
  const handleGenerateRoom = () => {
    setRoomName(generateRoomName());
  };

  // --- Start Session ---
  const handleStartSession = () => {
    // Validate config
    const validation = validateConfig(config);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    // Validate room name
    if (!roomName.trim()) {
      setErrors(['Room name is required']);
      return;
    }

    // Save to localStorage
    saveConfigToStorage(config);
    saveRoomToStorage(roomName);

    // Encode config for URL
    const encodedConfig = encodeConfig(config);

    // Navigate to call page
    router.push(`/call/${encodeURIComponent(roomName)}?scenario=${scenario}&lang=${language}&config=${encodedConfig}`);
  };

  // --- Reset to Defaults ---
  const handleResetConfig = () => {
    setConfig(DEFAULT_CONFIG);
    setErrors([]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <header className="text-center mb-10">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            UZH Brainstorming
          </h1>
          <p className="text-slate-400">AI-Assisted Brainstorming Research Prototype</p>
        </header>

        {/* Main Card */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 p-6 shadow-xl">
          {/* Room Name */}
          <section className="mb-8">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Room Name
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="Enter room name..."
                className="flex-1 px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
              <button
                onClick={handleGenerateRoom}
                className="px-4 py-3 bg-slate-600 hover:bg-slate-500 rounded-lg transition-colors"
                title="Generate random room name"
              >
                🎲
              </button>
            </div>
          </section>

          {/* Scenario Selection */}
          <section className="mb-8">
            <label className="block text-sm font-medium text-slate-300 mb-3">
              Experiment Scenario
            </label>
            <div className="grid gap-3">
              {(Object.keys(SCENARIO_DESCRIPTIONS) as Scenario[]).map((s) => (
                <label
                  key={s}
                  className={`flex items-center p-4 rounded-lg border cursor-pointer transition-all ${
                    scenario === s
                      ? 'bg-blue-600/20 border-blue-500'
                      : 'bg-slate-700/30 border-slate-600 hover:border-slate-500'
                  }`}
                >
                  <input
                    type="radio"
                    name="scenario"
                    value={s}
                    checked={scenario === s}
                    onChange={(e) => setScenario(e.target.value as Scenario)}
                    className="sr-only"
                  />
                  <div className={`w-5 h-5 rounded-full border-2 mr-4 flex items-center justify-center ${
                    scenario === s ? 'border-blue-500' : 'border-slate-500'
                  }`}>
                    {scenario === s && <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />}
                  </div>
                  <div>
                    <span className="font-medium">{s === 'baseline' ? 'Baseline' : `Scenario ${s}`}</span>
                    <p className="text-sm text-slate-400 mt-0.5">{SCENARIO_DESCRIPTIONS[s]}</p>
                  </div>
                </label>
              ))}
            </div>
          </section>

          {/* Language Selection */}
          <section className="mb-8">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Language (Transcription & TTS)
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            >
              {LANGUAGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </section>

          {/* Advanced Configuration Toggle */}
          <section className="mb-6">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              <span className={`transform transition-transform ${showAdvanced ? 'rotate-90' : ''}`}>
                ▶
              </span>
              Advanced Configuration
            </button>
          </section>

          {/* Advanced Configuration Panel */}
          {showAdvanced && (
            <section className="mb-8 p-4 bg-slate-700/30 rounded-lg border border-slate-600">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-medium text-slate-200">Experiment Parameters</h3>
                <button
                  onClick={handleResetConfig}
                  className="text-xs px-3 py-1 bg-slate-600 hover:bg-slate-500 rounded transition-colors"
                >
                  Reset to Defaults
                </button>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {/* Window & Analysis */}
                <ConfigGroup title="Window & Analysis">
                  <ConfigInput
                    label="Window (sec)"
                    value={config.WINDOW_SECONDS}
                    onChange={(v) => updateConfig('WINDOW_SECONDS', v)}
                    constraints={CONFIG_CONSTRAINTS.WINDOW_SECONDS}
                    tooltip="Rolling window for metrics calculation"
                  />
                  <ConfigInput
                    label="Analyze every (ms)"
                    value={config.ANALYZE_EVERY_MS}
                    onChange={(v) => updateConfig('ANALYZE_EVERY_MS', v)}
                    constraints={CONFIG_CONSTRAINTS.ANALYZE_EVERY_MS}
                    tooltip="How often to compute metrics"
                  />
                </ConfigGroup>

                {/* Trigger Timing */}
                <ConfigGroup title="Trigger Timing">
                  <ConfigInput
                    label="Persistence (sec)"
                    value={config.PERSISTENCE_SECONDS}
                    onChange={(v) => updateConfig('PERSISTENCE_SECONDS', v)}
                    constraints={CONFIG_CONSTRAINTS.PERSISTENCE_SECONDS}
                    tooltip="How long threshold must be breached"
                  />
                  <ConfigInput
                    label="Cooldown (sec)"
                    value={config.COOLDOWN_SECONDS}
                    onChange={(v) => updateConfig('COOLDOWN_SECONDS', v)}
                    constraints={CONFIG_CONSTRAINTS.COOLDOWN_SECONDS}
                    tooltip="Min time between interventions"
                  />
                  <ConfigInput
                    label="Post-check (sec)"
                    value={config.POST_CHECK_SECONDS}
                    onChange={(v) => updateConfig('POST_CHECK_SECONDS', v)}
                    constraints={CONFIG_CONSTRAINTS.POST_CHECK_SECONDS}
                    tooltip="Time to wait before checking improvement"
                  />
                </ConfigGroup>

                {/* Thresholds */}
                <ConfigGroup title="Thresholds">
                  <ConfigInput
                    label="Imbalance (0-1)"
                    value={config.THRESHOLD_IMBALANCE}
                    onChange={(v) => updateConfig('THRESHOLD_IMBALANCE', v)}
                    constraints={CONFIG_CONSTRAINTS.THRESHOLD_IMBALANCE}
                    step={0.05}
                    tooltip="Trigger when participation imbalance exceeds this"
                  />
                  <ConfigInput
                    label="Repetition (0-1)"
                    value={config.THRESHOLD_REPETITION}
                    onChange={(v) => updateConfig('THRESHOLD_REPETITION', v)}
                    constraints={CONFIG_CONSTRAINTS.THRESHOLD_REPETITION}
                    step={0.05}
                    tooltip="Trigger when repetition rate exceeds this"
                  />
                  <ConfigInput
                    label="Stagnation (sec)"
                    value={config.THRESHOLD_STAGNATION_SECONDS}
                    onChange={(v) => updateConfig('THRESHOLD_STAGNATION_SECONDS', v)}
                    constraints={CONFIG_CONSTRAINTS.THRESHOLD_STAGNATION_SECONDS}
                    tooltip="Trigger when no new content for this long"
                  />
                </ConfigGroup>

                {/* Safety Limits */}
                <ConfigGroup title="Safety Limits">
                  <ConfigInput
                    label="TTS Rate Limit (sec)"
                    value={config.TTS_RATE_LIMIT_SECONDS}
                    onChange={(v) => updateConfig('TTS_RATE_LIMIT_SECONDS', v)}
                    constraints={CONFIG_CONSTRAINTS.TTS_RATE_LIMIT_SECONDS}
                    tooltip="Min time between TTS outputs"
                  />
                  <ConfigInput
                    label="Max Interventions / 10min"
                    value={config.MAX_INTERVENTIONS_PER_10MIN}
                    onChange={(v) => updateConfig('MAX_INTERVENTIONS_PER_10MIN', v)}
                    constraints={CONFIG_CONSTRAINTS.MAX_INTERVENTIONS_PER_10MIN}
                    tooltip="Hard limit on intervention frequency"
                  />
                </ConfigGroup>
              </div>
            </section>
          )}

          {/* Errors */}
          {errors.length > 0 && (
            <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded-lg">
              <h4 className="font-medium text-red-400 mb-2">Validation Errors</h4>
              <ul className="text-sm text-red-300 list-disc list-inside">
                {errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Start Button */}
          <button
            onClick={handleStartSession}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02]"
          >
            Start Brainstorming Session
          </button>
        </div>

        {/* Footer */}
        <footer className="mt-8 text-center text-sm text-slate-500">
          <p>University of Zurich - Research Prototype</p>
        </footer>
      </div>
    </div>
  );
}

// --- Helper Components ---

function ConfigGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide">{title}</h4>
      {children}
    </div>
  );
}

interface ConfigInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  constraints: { min: number; max: number };
  step?: number;
  tooltip?: string;
}

function ConfigInput({ label, value, onChange, constraints, step = 1, tooltip }: ConfigInputProps) {
  return (
    <div className="flex items-center gap-2" title={tooltip}>
      <label className="text-sm text-slate-300 w-32 truncate">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        min={constraints.min}
        max={constraints.max}
        step={step}
        className="flex-1 px-3 py-1.5 bg-slate-600/50 border border-slate-500 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
    </div>
  );
}
