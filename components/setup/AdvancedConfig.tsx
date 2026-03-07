'use client';

import { useState } from 'react';
import { ExperimentConfig } from '@/lib/types';
import { CONFIG_CONSTRAINTS, DEFAULT_CONFIG } from '@/lib/config';
import ConfigGroup from '@/components/shared/ConfigGroup';
import ConfigInput from '@/components/shared/ConfigInput';

interface AdvancedConfigProps {
  config: ExperimentConfig;
  onUpdateConfig: (key: keyof ExperimentConfig, value: number) => void;
  onReset: () => void;
}

export default function AdvancedConfig({ config, onUpdateConfig, onReset }: AdvancedConfigProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <>
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

      {showAdvanced && (
        <section className="mb-8 p-4 bg-slate-700/30 rounded-lg border border-slate-600">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium text-slate-200">Experiment Parameters</h3>
            <button
              onClick={onReset}
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
                onChange={(v) => onUpdateConfig('WINDOW_SECONDS', v)}
                constraints={CONFIG_CONSTRAINTS.WINDOW_SECONDS}
                tooltip="Rolling time window (in seconds) used by the AI to calculate conversation metrics."
              />
              <ConfigInput
                label="Analyze every (ms)"
                value={config.ANALYZE_EVERY_MS}
                onChange={(v) => onUpdateConfig('ANALYZE_EVERY_MS', v)}
                constraints={CONFIG_CONSTRAINTS.ANALYZE_EVERY_MS}
                tooltip="Interval (in milliseconds) at which the metrics are updated and evaluated."
              />
            </ConfigGroup>

            {/* Trigger Timing */}
            <ConfigGroup title="Trigger Timing">
              <ConfigInput
                label="Persistence (sec)"
                value={config.PERSISTENCE_SECONDS}
                onChange={(v) => onUpdateConfig('PERSISTENCE_SECONDS', v)}
                constraints={CONFIG_CONSTRAINTS.PERSISTENCE_SECONDS}
                tooltip="Time (in seconds) a threshold must be continuously breached before the AI intervenes."
              />
              <ConfigInput
                label="Cooldown (sec)"
                value={config.COOLDOWN_SECONDS}
                onChange={(v) => onUpdateConfig('COOLDOWN_SECONDS', v)}
                constraints={CONFIG_CONSTRAINTS.COOLDOWN_SECONDS}
                tooltip="Mandatory wait time (in seconds) before the AI is allowed to intervene again."
              />
              <ConfigInput
                label="Post-check (sec)"
                value={config.POST_CHECK_SECONDS}
                onChange={(v) => onUpdateConfig('POST_CHECK_SECONDS', v)}
                constraints={CONFIG_CONSTRAINTS.POST_CHECK_SECONDS}
                tooltip="Time (in seconds) to wait after an intervention before evaluating if it helped."
              />
            </ConfigGroup>

            {/* Thresholds */}
            <ConfigGroup title="Thresholds">
              <ConfigInput
                label="Imbalance (0-1)"
                value={config.THRESHOLD_IMBALANCE}
                onChange={(v) => onUpdateConfig('THRESHOLD_IMBALANCE', v)}
                constraints={CONFIG_CONSTRAINTS.THRESHOLD_IMBALANCE}
                step={0.05}
                tooltip="Gini coefficient (0-1). AI triggers if someone dominates the conversation too much."
              />
              <ConfigInput
                label="Repetition (0-1)"
                value={config.THRESHOLD_REPETITION}
                onChange={(v) => onUpdateConfig('THRESHOLD_REPETITION', v)}
                constraints={CONFIG_CONSTRAINTS.THRESHOLD_REPETITION}
                step={0.05}
                tooltip="Semantic similarity (0-1). AI triggers if the conversation goes around in circles."
              />
              <ConfigInput
                label="Stagnation (sec)"
                value={config.THRESHOLD_STAGNATION_SECONDS}
                onChange={(v) => onUpdateConfig('THRESHOLD_STAGNATION_SECONDS', v)}
                constraints={CONFIG_CONSTRAINTS.THRESHOLD_STAGNATION_SECONDS}
                tooltip="AI triggers when no substantially new ideas are generated for this long (in seconds)."
              />
            </ConfigGroup>

            {/* Safety Limits */}
            <ConfigGroup title="Safety Limits">
              <ConfigInput
                label="TTS Rate Limit (sec)"
                value={config.TTS_RATE_LIMIT_SECONDS}
                onChange={(v) => onUpdateConfig('TTS_RATE_LIMIT_SECONDS', v)}
                constraints={CONFIG_CONSTRAINTS.TTS_RATE_LIMIT_SECONDS}
                tooltip="Minimum time (in seconds) required between two consecutive AI voice outputs."
              />
              <ConfigInput
                label="Max Interv. / 10min"
                value={config.MAX_INTERVENTIONS_PER_10MIN}
                onChange={(v) => onUpdateConfig('MAX_INTERVENTIONS_PER_10MIN', v)}
                constraints={CONFIG_CONSTRAINTS.MAX_INTERVENTIONS_PER_10MIN}
                tooltip="Hard maximum of allowed AI interventions within a 10-minute window."
              />
            </ConfigGroup>
          </div>
        </section>
      )}
    </>
  );
}
