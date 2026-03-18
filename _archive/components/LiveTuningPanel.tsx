'use client';

import { useState, useCallback } from 'react';
import { ExperimentConfig } from '@/lib/types';
import { CONFIG_CONSTRAINTS, DEFAULT_CONFIG } from '@/lib/config';
import Panel from './shared/Panel';
import SectionHeader from './shared/SectionHeader';
import TuningSlider from './shared/TuningSlider';
import WeightsEditor from './shared/WeightsEditor';

interface LiveTuningPanelProps {
  config: ExperimentConfig;
  onUpdateConfig: (key: keyof ExperimentConfig, value: ExperimentConfig[keyof ExperimentConfig]) => void;
  onResetAll: () => void;
}

/** Collapsible group wrapper with an optional per-group reset button. */
interface TuningGroupProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  onReset?: () => void;
}

function TuningGroup({ title, children, defaultOpen = false, onReset }: TuningGroupProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-slate-700/50 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 bg-slate-800/30 hover:bg-slate-800/50 transition-colors"
      >
        <span className="text-xs font-medium text-slate-300 uppercase tracking-wide">{title}</span>
        <div className="flex items-center gap-2">
          {onReset && isOpen && (
            <span
              onClick={(e) => { e.stopPropagation(); onReset(); }}
              className="text-[10px] text-slate-500 hover:text-blue-400 transition-colors cursor-pointer"
            >
              Reset
            </span>
          )}
          <span className={`text-slate-500 text-xs transition-transform ${isOpen ? 'rotate-90' : ''}`}>▶</span>
        </div>
      </button>
      {isOpen && (
        <div className="px-3 py-3 space-y-3 bg-slate-800/10">
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Live experiment tuning panel providing real-time adjustment of detection thresholds,
 * intervention timing, and advanced cosine similarity parameters.
 * Changes take effect on the next analysis cycle.
 *
 * @param config - Current experiment configuration values.
 * @param onUpdateConfig - Callback to update a single config key.
 * @param onResetAll - Callback to reset all config values to defaults.
 */
export default function LiveTuningPanel({ config, onUpdateConfig, onResetAll }: LiveTuningPanelProps) {
  const handleUpdate = useCallback((key: keyof ExperimentConfig, value: number) => {
    onUpdateConfig(key, value);
  }, [onUpdateConfig]);

  const handleWeightsUpdate = useCallback((weights: [number, number, number, number]) => {
    onUpdateConfig('PARTICIPATION_RISK_WEIGHTS', weights);
  }, [onUpdateConfig]);

  // Reset a subset of config keys to their default values
  const resetGroup = useCallback((keys: (keyof ExperimentConfig)[]) => {
    for (const key of keys) {
      onUpdateConfig(key, DEFAULT_CONFIG[key]);
    }
  }, [onUpdateConfig]);

  return (
    <div className="h-full overflow-y-auto space-y-3 p-1">
      <Panel>
        <div className="flex items-center justify-between mb-2">
          <SectionHeader icon="🎛️" size="page">Live Tuning</SectionHeader>
          <button
            onClick={onResetAll}
            className="text-xs px-2.5 py-1 bg-slate-700 hover:bg-slate-600 rounded transition-colors text-slate-300"
          >
            Reset All
          </button>
        </div>
        <p className="text-[10px] text-slate-500">
          Changes take effect on next analysis cycle ({config.ANALYZE_EVERY_MS}ms).
        </p>
      </Panel>

      {/* Rule Check Toggle */}
      <Panel>
        <label className="flex items-center gap-3 cursor-pointer">
          <div
            className={`relative w-10 h-5 rounded-full transition-colors ${config.RULE_CHECK_ENABLED ? 'bg-blue-600' : 'bg-slate-600'}`}
            onClick={() => onUpdateConfig('RULE_CHECK_ENABLED', !config.RULE_CHECK_ENABLED)}
          >
            <div
              className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${config.RULE_CHECK_ENABLED ? 'translate-x-5' : ''}`}
            />
          </div>
          <span className="text-xs text-slate-300">Brainstorming Rule Check</span>
        </label>
      </Panel>

      {/* 1. Detection Thresholds */}
      <TuningGroup
        title="Detection Thresholds"
        defaultOpen={true}
        onReset={() => resetGroup([
          'THRESHOLD_PARTICIPATION_RISK', 'THRESHOLD_NOVELTY_RATE',
          'THRESHOLD_CLUSTER_CONCENTRATION', 'THRESHOLD_SILENT_PARTICIPANT',
        ])}
      >
        <TuningSlider
          label="Participation Risk"
          value={config.THRESHOLD_PARTICIPATION_RISK}
          defaultValue={DEFAULT_CONFIG.THRESHOLD_PARTICIPATION_RISK}
          min={CONFIG_CONSTRAINTS.THRESHOLD_PARTICIPATION_RISK.min}
          max={CONFIG_CONSTRAINTS.THRESHOLD_PARTICIPATION_RISK.max}
          step={0.05}
          description="Above this value, participation is flagged as imbalanced"
          onChange={(v) => handleUpdate('THRESHOLD_PARTICIPATION_RISK', v)}
        />
        <TuningSlider
          label="Novelty Rate"
          value={config.THRESHOLD_NOVELTY_RATE}
          defaultValue={DEFAULT_CONFIG.THRESHOLD_NOVELTY_RATE}
          min={CONFIG_CONSTRAINTS.THRESHOLD_NOVELTY_RATE.min}
          max={CONFIG_CONSTRAINTS.THRESHOLD_NOVELTY_RATE.max}
          step={0.05}
          description="Below this, ideas are converging too much"
          onChange={(v) => handleUpdate('THRESHOLD_NOVELTY_RATE', v)}
        />
        <TuningSlider
          label="Topic Concentration"
          value={config.THRESHOLD_CLUSTER_CONCENTRATION}
          defaultValue={DEFAULT_CONFIG.THRESHOLD_CLUSTER_CONCENTRATION}
          min={CONFIG_CONSTRAINTS.THRESHOLD_CLUSTER_CONCENTRATION.min}
          max={CONFIG_CONSTRAINTS.THRESHOLD_CLUSTER_CONCENTRATION.max}
          step={0.05}
          description="Above this, topic range is considered too narrow"
          onChange={(v) => handleUpdate('THRESHOLD_CLUSTER_CONCENTRATION', v)}
        />
        <TuningSlider
          label="Silent Participant"
          value={config.THRESHOLD_SILENT_PARTICIPANT}
          defaultValue={DEFAULT_CONFIG.THRESHOLD_SILENT_PARTICIPANT}
          min={CONFIG_CONSTRAINTS.THRESHOLD_SILENT_PARTICIPANT.min}
          max={CONFIG_CONSTRAINTS.THRESHOLD_SILENT_PARTICIPANT.max}
          step={0.01}
          description="Below this speaking share, someone is counted as 'silent'"
          onChange={(v) => handleUpdate('THRESHOLD_SILENT_PARTICIPANT', v)}
        />
      </TuningGroup>

      {/* 2. Intervention Timing */}
      <TuningGroup
        title="Intervention Timing"
        onReset={() => resetGroup([
          'CONFIRMATION_SECONDS', 'COOLDOWN_SECONDS', 'POST_CHECK_SECONDS',
          'MAX_INTERVENTIONS_PER_10MIN', 'TTS_RATE_LIMIT_SECONDS',
        ])}
      >
        <TuningSlider
          label="Confirmation Wait"
          value={config.CONFIRMATION_SECONDS}
          defaultValue={DEFAULT_CONFIG.CONFIRMATION_SECONDS}
          min={CONFIG_CONSTRAINTS.CONFIRMATION_SECONDS.min}
          max={CONFIG_CONSTRAINTS.CONFIRMATION_SECONDS.max}
          step={5}
          unit="s"
          description="Problem must persist this long before intervention"
          onChange={(v) => handleUpdate('CONFIRMATION_SECONDS', v)}
        />
        <TuningSlider
          label="Cooldown"
          value={config.COOLDOWN_SECONDS}
          defaultValue={DEFAULT_CONFIG.COOLDOWN_SECONDS}
          min={CONFIG_CONSTRAINTS.COOLDOWN_SECONDS.min}
          max={CONFIG_CONSTRAINTS.COOLDOWN_SECONDS.max}
          step={10}
          unit="s"
          description="Pause after an intervention before next one"
          onChange={(v) => handleUpdate('COOLDOWN_SECONDS', v)}
        />
        <TuningSlider
          label="Post-Check"
          value={config.POST_CHECK_SECONDS}
          defaultValue={DEFAULT_CONFIG.POST_CHECK_SECONDS}
          min={CONFIG_CONSTRAINTS.POST_CHECK_SECONDS.min}
          max={CONFIG_CONSTRAINTS.POST_CHECK_SECONDS.max}
          step={5}
          unit="s"
          description="Wait before checking if intervention had effect"
          onChange={(v) => handleUpdate('POST_CHECK_SECONDS', v)}
        />
        <TuningSlider
          label="Max Interventions / 10min"
          value={config.MAX_INTERVENTIONS_PER_10MIN}
          defaultValue={DEFAULT_CONFIG.MAX_INTERVENTIONS_PER_10MIN}
          min={CONFIG_CONSTRAINTS.MAX_INTERVENTIONS_PER_10MIN.min}
          max={CONFIG_CONSTRAINTS.MAX_INTERVENTIONS_PER_10MIN.max}
          step={1}
          description="Hard cap on interventions per 10-minute window"
          onChange={(v) => handleUpdate('MAX_INTERVENTIONS_PER_10MIN', v)}
        />
        <TuningSlider
          label="TTS Rate Limit"
          value={config.TTS_RATE_LIMIT_SECONDS}
          defaultValue={DEFAULT_CONFIG.TTS_RATE_LIMIT_SECONDS}
          min={CONFIG_CONSTRAINTS.TTS_RATE_LIMIT_SECONDS.min}
          max={CONFIG_CONSTRAINTS.TTS_RATE_LIMIT_SECONDS.max}
          step={5}
          unit="s"
          description="Minimum gap between voice outputs"
          onChange={(v) => handleUpdate('TTS_RATE_LIMIT_SECONDS', v)}
        />
      </TuningGroup>

      {/* 3. Advanced — cosine thresholds, weights, computation params */}
      <TuningGroup
        title="Advanced"
        onReset={() => resetGroup([
          'NOVELTY_COSINE_THRESHOLD', 'CLUSTER_MERGE_THRESHOLD', 'STAGNATION_NOVELTY_THRESHOLD',
          'EXPLORATION_COSINE_THRESHOLD', 'ELABORATION_COSINE_THRESHOLD',
          'WINDOW_SECONDS', 'ANALYZE_EVERY_MS',
          'RECOVERY_IMPROVEMENT_THRESHOLD',
        ])}
      >
        <p className="text-[10px] text-yellow-400/70 mb-2">Cosine similarity thresholds calibrated for text-embedding-3-large.</p>

        <TuningSlider
          label="Novelty Cosine"
          value={config.NOVELTY_COSINE_THRESHOLD}
          defaultValue={DEFAULT_CONFIG.NOVELTY_COSINE_THRESHOLD}
          min={CONFIG_CONSTRAINTS.NOVELTY_COSINE_THRESHOLD.min}
          max={CONFIG_CONSTRAINTS.NOVELTY_COSINE_THRESHOLD.max}
          step={0.05}
          description="Below this similarity = 'novel' segment"
          onChange={(v) => handleUpdate('NOVELTY_COSINE_THRESHOLD', v)}
        />
        <TuningSlider
          label="Cluster Merge"
          value={config.CLUSTER_MERGE_THRESHOLD}
          defaultValue={DEFAULT_CONFIG.CLUSTER_MERGE_THRESHOLD}
          min={CONFIG_CONSTRAINTS.CLUSTER_MERGE_THRESHOLD.min}
          max={CONFIG_CONSTRAINTS.CLUSTER_MERGE_THRESHOLD.max}
          step={0.05}
          description="Above this similarity, segment joins existing cluster"
          onChange={(v) => handleUpdate('CLUSTER_MERGE_THRESHOLD', v)}
        />
        <TuningSlider
          label="Stagnation Novelty"
          value={config.STAGNATION_NOVELTY_THRESHOLD}
          defaultValue={DEFAULT_CONFIG.STAGNATION_NOVELTY_THRESHOLD}
          min={CONFIG_CONSTRAINTS.STAGNATION_NOVELTY_THRESHOLD.min}
          max={CONFIG_CONSTRAINTS.STAGNATION_NOVELTY_THRESHOLD.max}
          step={0.05}
          description="Below this = 'new content' for stagnation detection"
          onChange={(v) => handleUpdate('STAGNATION_NOVELTY_THRESHOLD', v)}
        />
        <TuningSlider
          label="Exploration"
          value={config.EXPLORATION_COSINE_THRESHOLD}
          defaultValue={DEFAULT_CONFIG.EXPLORATION_COSINE_THRESHOLD}
          min={CONFIG_CONSTRAINTS.EXPLORATION_COSINE_THRESHOLD.min}
          max={CONFIG_CONSTRAINTS.EXPLORATION_COSINE_THRESHOLD.max}
          step={0.05}
          description="Avg similarity below this = exploration mode"
          onChange={(v) => handleUpdate('EXPLORATION_COSINE_THRESHOLD', v)}
        />
        <TuningSlider
          label="Elaboration"
          value={config.ELABORATION_COSINE_THRESHOLD}
          defaultValue={DEFAULT_CONFIG.ELABORATION_COSINE_THRESHOLD}
          min={CONFIG_CONSTRAINTS.ELABORATION_COSINE_THRESHOLD.min}
          max={CONFIG_CONSTRAINTS.ELABORATION_COSINE_THRESHOLD.max}
          step={0.05}
          description="Max similarity above this = elaboration mode"
          onChange={(v) => handleUpdate('ELABORATION_COSINE_THRESHOLD', v)}
        />

        <div className="border-t border-slate-700/50 pt-3 mt-1">
          <WeightsEditor
            weights={config.PARTICIPATION_RISK_WEIGHTS}
            labels={['Hoover Index', 'Silent Ratio', 'Dominance', 'Turn Hoover']}
            onChange={handleWeightsUpdate}
          />
        </div>

        <div className="border-t border-slate-700/50 pt-3 mt-1 space-y-3">
          <TuningSlider
            label="Analysis Window"
            value={config.WINDOW_SECONDS}
            defaultValue={DEFAULT_CONFIG.WINDOW_SECONDS}
            min={CONFIG_CONSTRAINTS.WINDOW_SECONDS.min}
            max={CONFIG_CONSTRAINTS.WINDOW_SECONDS.max}
            step={10}
            unit="s"
            description="Rolling time window for metrics computation"
            onChange={(v) => handleUpdate('WINDOW_SECONDS', v)}
          />
          <TuningSlider
            label="Computation Interval"
            value={config.ANALYZE_EVERY_MS}
            defaultValue={DEFAULT_CONFIG.ANALYZE_EVERY_MS}
            min={CONFIG_CONSTRAINTS.ANALYZE_EVERY_MS.min}
            max={CONFIG_CONSTRAINTS.ANALYZE_EVERY_MS.max}
            step={500}
            unit="ms"
            description="How often metrics are recomputed"
            onChange={(v) => handleUpdate('ANALYZE_EVERY_MS', v)}
          />
          <TuningSlider
            label="Recovery Threshold"
            value={config.RECOVERY_IMPROVEMENT_THRESHOLD}
            defaultValue={DEFAULT_CONFIG.RECOVERY_IMPROVEMENT_THRESHOLD}
            min={CONFIG_CONSTRAINTS.RECOVERY_IMPROVEMENT_THRESHOLD.min}
            max={CONFIG_CONSTRAINTS.RECOVERY_IMPROVEMENT_THRESHOLD.max}
            step={0.01}
            description="Improvement needed to count as 'recovered' after intervention"
            onChange={(v) => handleUpdate('RECOVERY_IMPROVEMENT_THRESHOLD', v)}
          />
        </div>
      </TuningGroup>
    </div>
  );
}
