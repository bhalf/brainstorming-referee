'use client';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Size variant. 'sm' for inline model routing, 'md' for settings. */
  size?: 'sm' | 'md';
  disabled?: boolean;
}

/** Consistent toggle switch used across settings, model routing, etc. */
export default function Toggle({
  checked,
  onChange,
  size = 'md',
  disabled = false,
}: ToggleProps) {
  const trackSize = size === 'sm' ? 'w-8 h-4' : 'w-12 h-6';
  const thumbSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
  const thumbOffset = size === 'sm'
    ? (checked ? 'left-4' : 'left-0.5')
    : (checked ? 'left-7' : 'left-1');

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative ${trackSize} rounded-full transition-colors ${
        checked ? 'bg-blue-600' : 'bg-slate-600'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`absolute top-0.5 ${thumbSize} rounded-full bg-white transition-transform ${thumbOffset}`}
      />
    </button>
  );
}
