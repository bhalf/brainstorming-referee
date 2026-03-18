'use client';

import { useState } from 'react';
import { ExperimentConfig } from '@/lib/types';
import { CONFIG_CONSTRAINTS, DEFAULT_CONFIG } from '@/lib/config';
import ConfigGroup from '@/components/shared/ConfigGroup';
import ConfigInput from '@/components/shared/ConfigInput';

interface AdvancedConfigProps {
  config: ExperimentConfig;
  onUpdateConfig: (key: keyof ExperimentConfig, value: number | boolean) => void;
  onReset: () => void;
}

export default function AdvancedConfig({ config, onUpdateConfig, onReset }: AdvancedConfigProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <>
      {/* Rule Check Toggle (always visible) */}
      <section className="mb-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <div
            className={`relative w-10 h-5 rounded-full transition-colors ${config.RULE_CHECK_ENABLED ? 'bg-blue-600' : 'bg-slate-600'}`}
            onClick={() => onUpdateConfig('RULE_CHECK_ENABLED', !config.RULE_CHECK_ENABLED)}
          >
            <div
              className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${config.RULE_CHECK_ENABLED ? 'translate-x-5' : ''}`}
            />
          </div>
          <span className="text-sm text-slate-300">Brainstorming Rules (Osborn&apos;s 4 Rules)</span>
        </label>
        <p className="text-xs text-slate-500 mt-1 ml-13">
          When enabled, the AI detects rule violations (criticism, premature evaluation, etc.) and gently reminds the group.
        </p>
      </section>

      <section className="mb-4">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          <span className={`transform transition-transform text-[10px] ${showAdvanced ? 'rotate-90' : ''}`}>
            ▶
          </span>
          Advanced Configuration
        </button>
      </section>

      {showAdvanced && (
        <section className="mb-5 p-4 bg-slate-900/40 rounded-lg border border-slate-700/60">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium text-slate-200">Experiment Parameters</h3>
            <button
              onClick={onReset}
              className="text-xs px-3 py-1 bg-slate-600 hover:bg-slate-500 rounded transition-colors"
            >
              Reset to Defaults
            </button>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Window & Analysis */}
            <ConfigGroup title="Window & Analysis" helpKey="config.windowGroup">
              <ConfigInput
                label="Window (sec)"
                helpKey="config.windowSeconds"
                value={config.WINDOW_SECONDS}
                onChange={(v) => onUpdateConfig('WINDOW_SECONDS', v)}
                constraints={CONFIG_CONSTRAINTS.WINDOW_SECONDS}
                tooltip="Rolling time window (in seconds) used by the AI to calculate conversation metrics."
              />
              <ConfigInput
                label="Analyze every (ms)"
                helpKey="config.analyzeEveryMs"
                value={config.ANALYZE_EVERY_MS}
                onChange={(v) => onUpdateConfig('ANALYZE_EVERY_MS', v)}
                constraints={CONFIG_CONSTRAINTS.ANALYZE_EVERY_MS}
                tooltip="Interval (in milliseconds) at which the metrics are updated and evaluated."
              />
            </ConfigGroup>

            {/* Intervention Timing */}
            <ConfigGroup title="Intervention Timing" helpKey="config.triggerGroup">
              <ConfigInput
                label="Confirmation (sec)"
                helpKey="config.confirmationSeconds"
                value={config.CONFIRMATION_SECONDS}
                onChange={(v) => onUpdateConfig('CONFIRMATION_SECONDS', v)}
                constraints={CONFIG_CONSTRAINTS.CONFIRMATION_SECONDS}
                tooltip="Time (in seconds) a metric-based problem must persist before the AI intervenes."
              />
              <ConfigInput
                label="Cooldown (sec)"
                helpKey="config.cooldownSeconds"
                value={config.COOLDOWN_SECONDS}
                onChange={(v) => onUpdateConfig('COOLDOWN_SECONDS', v)}
                constraints={CONFIG_CONSTRAINTS.COOLDOWN_SECONDS}
                tooltip="Mandatory wait time (in seconds) before the AI is allowed to intervene again."
              />
              <ConfigInput
                label="Post-check (sec)"
                helpKey="config.postCheckSeconds"
                value={config.POST_CHECK_SECONDS}
                onChange={(v) => onUpdateConfig('POST_CHECK_SECONDS', v)}
                constraints={CONFIG_CONSTRAINTS.POST_CHECK_SECONDS}
                tooltip="Time (in seconds) to wait after an intervention before evaluating if it helped."
              />
            </ConfigGroup>

            {/* Detection Thresholds */}
            <ConfigGroup title="Detection Thresholds" helpKey="config.thresholdGroup">
              <ConfigInput
                label="Participation Risk (0-1)"
                helpKey="config.thresholdParticipationRisk"
                value={config.THRESHOLD_PARTICIPATION_RISK}
                onChange={(v) => onUpdateConfig('THRESHOLD_PARTICIPATION_RISK', v)}
                constraints={CONFIG_CONSTRAINTS.THRESHOLD_PARTICIPATION_RISK}
                step={0.05}
                tooltip="Composite risk score. AI triggers if participation imbalance exceeds this."
              />
              <ConfigInput
                label="Novelty Rate (0-1)"
                helpKey="config.thresholdNoveltyRate"
                value={config.THRESHOLD_NOVELTY_RATE}
                onChange={(v) => onUpdateConfig('THRESHOLD_NOVELTY_RATE', v)}
                constraints={CONFIG_CONSTRAINTS.THRESHOLD_NOVELTY_RATE}
                step={0.05}
                tooltip="Below this, ideas are converging and the AI may intervene."
              />
              <ConfigInput
                label="Cluster Concentration (0-1)"
                helpKey="config.thresholdClusterConcentration"
                value={config.THRESHOLD_CLUSTER_CONCENTRATION}
                onChange={(v) => onUpdateConfig('THRESHOLD_CLUSTER_CONCENTRATION', v)}
                constraints={CONFIG_CONSTRAINTS.THRESHOLD_CLUSTER_CONCENTRATION}
                step={0.05}
                tooltip="Above this, topic range is too narrow and the AI may intervene."
              />
            </ConfigGroup>

            {/* Safety Limits */}
            <ConfigGroup title="Safety Limits" helpKey="config.safetyGroup">
              <ConfigInput
                label="TTS Rate Limit (sec)"
                helpKey="config.ttsRateLimit"
                value={config.TTS_RATE_LIMIT_SECONDS}
                onChange={(v) => onUpdateConfig('TTS_RATE_LIMIT_SECONDS', v)}
                constraints={CONFIG_CONSTRAINTS.TTS_RATE_LIMIT_SECONDS}
                tooltip="Minimum time (in seconds) required between two consecutive AI voice outputs."
              />
              <ConfigInput
                label="Max Interv. / 10min"
                helpKey="config.maxInterventions"
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
