'use client';

import { useState, useCallback } from 'react';
import { ExperimentConfig } from '@/lib/types';
import { CONFIG_CONSTRAINTS, DEFAULT_CONFIG } from '@/lib/config';
import Panel from './shared/Panel';
import SectionHeader from './shared/SectionHeader';

interface LiveTuningPanelProps {
  config: ExperimentConfig;
  onUpdateConfig: (key: keyof ExperimentConfig, value: number | [number, number, number, number]) => void;
  onResetAll: () => void;
}

// --- Slider + Input combo ---

interface TuningSliderProps {
  label: string;
  value: number;
  defaultValue: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  description?: string;
  onChange: (value: number) => void;
}

function TuningSlider({ label, value, defaultValue, min, max, step, unit, description, onChange }: TuningSliderProps) {
  const isModified = Math.abs(value - defaultValue) > step * 0.1;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
          {label}
          {isModified && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" title="Modified" />}
        </label>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            value={value}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v)));
            }}
            min={min}
            max={max}
            step={step}
            className="w-20 px-1.5 py-0.5 bg-slate-700/50 border border-slate-600 rounded text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {unit && <span className="text-[10px] text-slate-500 w-4">{unit}</span>}
          {isModified && (
            <button
              onClick={() => onChange(defaultValue)}
              className="text-[10px] text-slate-500 hover:text-blue-400 transition-colors"
              title={`Reset to ${defaultValue}`}
            >
              ↩
            </button>
          )}
        </div>
      </div>
      <input
        type="range"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        min={min}
        max={max}
        step={step}
        className="w-full h-1 bg-slate-700 rounded-full appearance-none cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500
          [&::-webkit-slider-thumb]:hover:bg-blue-400 [&::-webkit-slider-thumb]:transition-colors"
      />
      {description && (
        <p className="text-[10px] text-slate-500 leading-tight">{description}</p>
      )}
    </div>
  );
}

// --- Collapsible Group ---

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

// --- Weights Editor ---

interface WeightsEditorProps {
  weights: [number, number, number, number];
  labels: string[];
  onChange: (weights: [number, number, number, number]) => void;
}

function WeightsEditor({ weights, labels, onChange }: WeightsEditorProps) {
  const sum = weights.reduce((a, b) => a + b, 0);
  const isValid = Math.abs(sum - 1.0) <= 0.01;
  const defaults = DEFAULT_CONFIG.PARTICIPATION_RISK_WEIGHTS;

  const handleChange = (index: number, value: number) => {
    const newWeights = [...weights] as [number, number, number, number];
    newWeights[index] = value;
    onChange(newWeights);
  };

  const handleNormalize = () => {
    if (sum === 0) {
      onChange([0.25, 0.25, 0.25, 0.25]);
      return;
    }
    const normalized = weights.map(w => Math.round((w / sum) * 100) / 100) as [number, number, number, number];
    const diff = 1.0 - normalized.reduce((a, b) => a + b, 0);
    normalized[0] = Math.round((normalized[0] + diff) * 100) / 100;
    onChange(normalized);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-300">Risk Weights</span>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-mono ${isValid ? 'text-green-400' : 'text-red-400'}`}>
            Σ = {sum.toFixed(2)}
          </span>
          {!isValid && (
            <button onClick={handleNormalize} className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors">
              Normalize
            </button>
          )}
          <button
            onClick={() => onChange([...defaults] as [number, number, number, number])}
            className="text-[10px] text-slate-500 hover:text-blue-400 transition-colors"
            title="Reset to defaults"
          >
            ↩
          </button>
        </div>
      </div>
      {weights.map((w, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 w-20 truncate">{labels[i]}</span>
          <input
            type="range"
            value={w}
            onChange={(e) => handleChange(i, parseFloat(e.target.value))}
            min={0}
            max={1}
            step={0.05}
            className="flex-1 h-1 bg-slate-700 rounded-full appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500"
          />
          <input
            type="number"
            value={w}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v)) handleChange(i, Math.max(0, Math.min(1, v)));
            }}
            min={0}
            max={1}
            step={0.05}
            className="w-14 px-1 py-0.5 bg-slate-700/50 border border-slate-600 rounded text-[10px] text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      ))}
      <p className="text-[10px] text-slate-500 leading-tight">
        Hoover Index, Silent Ratio, Dominance Streak, Turn Hoover. Must sum to 1.0.
      </p>
    </div>
  );
}

// --- Main Component ---

export default function LiveTuningPanel({ config, onUpdateConfig, onResetAll }: LiveTuningPanelProps) {
  const handleUpdate = useCallback((key: keyof ExperimentConfig, value: number) => {
    onUpdateConfig(key, value);
  }, [onUpdateConfig]);

  const handleWeightsUpdate = useCallback((weights: [number, number, number, number]) => {
    onUpdateConfig('PARTICIPATION_RISK_WEIGHTS', weights);
  }, [onUpdateConfig]);

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

      {/* 1. Detection Thresholds — when to trigger interventions */}
      <TuningGroup
        title="Detection Thresholds"
        defaultOpen={true}
        onReset={() => resetGroup([
          'THRESHOLD_PARTICIPATION_RISK', 'THRESHOLD_NOVELTY_RATE',
          'THRESHOLD_CLUSTER_CONCENTRATION', 'THRESHOLD_SILENT_PARTICIPANT',
          'THRESHOLD_IMBALANCE', 'THRESHOLD_REPETITION', 'THRESHOLD_STAGNATION_SECONDS',
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
        <TuningSlider
          label="Repetition"
          value={config.THRESHOLD_REPETITION}
          defaultValue={DEFAULT_CONFIG.THRESHOLD_REPETITION}
          min={CONFIG_CONSTRAINTS.THRESHOLD_REPETITION.min}
          max={CONFIG_CONSTRAINTS.THRESHOLD_REPETITION.max}
          step={0.05}
          description="Above this semantic similarity, conversation is going in circles"
          onChange={(v) => handleUpdate('THRESHOLD_REPETITION', v)}
        />
        <TuningSlider
          label="Stagnation"
          value={config.THRESHOLD_STAGNATION_SECONDS}
          defaultValue={DEFAULT_CONFIG.THRESHOLD_STAGNATION_SECONDS}
          min={CONFIG_CONSTRAINTS.THRESHOLD_STAGNATION_SECONDS.min}
          max={CONFIG_CONSTRAINTS.THRESHOLD_STAGNATION_SECONDS.max}
          step={5}
          unit="s"
          description="Seconds without new content before stagnation is flagged"
          onChange={(v) => handleUpdate('THRESHOLD_STAGNATION_SECONDS', v)}
        />
      </TuningGroup>

      {/* 2. Intervention Timing — how the engine reacts */}
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
          'WINDOW_SECONDS', 'ANALYZE_EVERY_MS', 'PERSISTENCE_SECONDS',
          'RECOVERY_IMPROVEMENT_THRESHOLD', 'THRESHOLD_IMBALANCE',
        ])}
      >
        <p className="text-[10px] text-yellow-400/70 mb-2">Cosine similarity thresholds calibrated for text-embedding-3-small.</p>

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
          <TuningSlider
            label="Balance Threshold"
            value={config.THRESHOLD_IMBALANCE}
            defaultValue={DEFAULT_CONFIG.THRESHOLD_IMBALANCE}
            min={CONFIG_CONSTRAINTS.THRESHOLD_IMBALANCE.min}
            max={CONFIG_CONSTRAINTS.THRESHOLD_IMBALANCE.max}
            step={0.05}
            description="Hoover index above which imbalance is flagged"
            onChange={(v) => handleUpdate('THRESHOLD_IMBALANCE', v)}
          />
          <TuningSlider
            label="Persistence (Legacy)"
            value={config.PERSISTENCE_SECONDS}
            defaultValue={DEFAULT_CONFIG.PERSISTENCE_SECONDS}
            min={CONFIG_CONSTRAINTS.PERSISTENCE_SECONDS.min}
            max={CONFIG_CONSTRAINTS.PERSISTENCE_SECONDS.max}
            step={5}
            unit="s"
            description="Legacy v1 threshold duration"
            onChange={(v) => handleUpdate('PERSISTENCE_SECONDS', v)}
          />
        </div>
      </TuningGroup>
    </div>
  );
}
