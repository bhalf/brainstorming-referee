import InfoPopover from './InfoPopover';

interface ConfigInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  constraints: { min: number; max: number };
  step?: number;
  tooltip?: string;
  helpKey?: string;
}

/**
 * Numeric configuration input with label, min/max constraints, and optional help.
 * Displays a tooltip below the input when no helpKey is provided.
 *
 * @param label - Input label text.
 * @param value - Current numeric value.
 * @param onChange - Callback with the updated numeric value.
 * @param constraints - Min/max bounds for the input.
 * @param step - Step increment for the input control.
 * @param tooltip - Descriptive text shown below (only when helpKey is absent).
 * @param helpKey - Optional key for an InfoPopover replacing the tooltip.
 */
export default function ConfigInput({ label, value, onChange, constraints, step = 1, tooltip, helpKey }: ConfigInputProps) {
  return (
    <div className="flex flex-col group">
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-slate-300 min-w-0 flex-1">
          {label}
          {helpKey && <span className="ml-1 inline-flex align-middle"><InfoPopover helpKey={helpKey} size="xs" /></span>}
        </label>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          min={constraints.min}
          max={constraints.max}
          step={step}
          className="w-24 flex-shrink-0 px-2 py-1.5 bg-slate-600/50 border border-slate-600 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
        />
      </div>
      {tooltip && !helpKey && (
        <p className="text-[11px] text-slate-500 leading-tight mt-1">{tooltip}</p>
      )}
    </div>
  );
}
