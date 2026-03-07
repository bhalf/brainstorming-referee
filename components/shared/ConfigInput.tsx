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

export default function ConfigInput({ label, value, onChange, constraints, step = 1, tooltip, helpKey }: ConfigInputProps) {
  return (
    <div className="flex flex-col group">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-slate-300 w-36 flex-shrink-0">
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
          className="flex-1 px-3 py-1.5 bg-slate-600/50 border border-slate-600 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
        />
      </div>
      {tooltip && (
        <div className="flex gap-2 mt-1">
          <div className="w-36 flex-shrink-0"></div>
          <p className="text-xs text-slate-400 leading-tight flex-1">{tooltip}</p>
        </div>
      )}
    </div>
  );
}
