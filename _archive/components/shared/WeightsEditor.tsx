'use client';

import { DEFAULT_CONFIG } from '@/lib/config';

/**
 * Editor for a 4-element weight vector that must sum to 1.0.
 * Displays individual sliders for each weight, a live sum indicator,
 * a normalize button (when sum != 1.0), and a reset-to-defaults button.
 *
 * Used in SettingsTab and LiveTuningPanel for participation risk weight tuning.
 */

export interface WeightsEditorProps {
  /** Current weight values — exactly 4 elements */
  weights: [number, number, number, number];
  /** Display labels for each weight (e.g. ["Hoover", "Silent", "Dominance", "Turn"]) */
  labels: string[];
  /** Called when any weight changes */
  onChange: (weights: [number, number, number, number]) => void;
}

export default function WeightsEditor({ weights, labels, onChange }: WeightsEditorProps) {
  const sum = weights.reduce((a, b) => a + b, 0);
  const isValid = Math.abs(sum - 1.0) <= 0.01;
  const defaults = DEFAULT_CONFIG.PARTICIPATION_RISK_WEIGHTS;

  /** Update a single weight at the given index */
  const handleChange = (index: number, value: number) => {
    const newWeights = [...weights] as [number, number, number, number];
    newWeights[index] = value;
    onChange(newWeights);
  };

  /** Proportionally scale all weights so they sum to exactly 1.0 */
  const handleNormalize = () => {
    if (sum === 0) { onChange([0.25, 0.25, 0.25, 0.25]); return; }
    const normalized = weights.map(w => Math.round((w / sum) * 100) / 100) as [number, number, number, number];
    // Correct rounding error by adjusting the first weight
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
            type="range" value={w}
            onChange={(e) => handleChange(i, parseFloat(e.target.value))}
            min={0} max={1} step={0.05}
            className="flex-1 h-1 bg-slate-700 rounded-full appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500"
          />
          <input
            type="number" value={w}
            onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) handleChange(i, Math.max(0, Math.min(1, v))); }}
            min={0} max={1} step={0.05}
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
