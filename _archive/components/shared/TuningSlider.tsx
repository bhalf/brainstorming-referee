'use client';

/**
 * Reusable slider + number input combo for tuning numeric parameters.
 * Shows a range slider with a paired numeric input, a modification indicator dot,
 * and a reset button when the value differs from the default.
 *
 * Used in SettingsTab and LiveTuningPanel for experiment configuration.
 */

export interface TuningSliderProps {
  /** Display label shown above the slider */
  label: string;
  /** Current value */
  value: number;
  /** Default/baseline value — used to detect modifications and enable reset */
  defaultValue: number;
  /** Minimum allowed value */
  min: number;
  /** Maximum allowed value */
  max: number;
  /** Step increment for both slider and number input */
  step: number;
  /** Optional unit label (e.g. "s", "%") shown after the number input */
  unit?: string;
  /** Optional description text shown below the slider */
  description?: string;
  /** Called when the value changes (from slider or number input) */
  onChange: (value: number) => void;
}

export default function TuningSlider({
  label, value, defaultValue, min, max, step, unit, description, onChange,
}: TuningSliderProps) {
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
