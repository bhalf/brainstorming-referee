'use client';

interface DebugMetricRowProps {
  label: string;
  value: string;
  threshold: string;
  isBreached?: boolean;
}

/** Compact metric row for debug/diagnostic panels showing value vs threshold. */
export default function DebugMetricRow({ label, value, threshold, isBreached }: DebugMetricRowProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-400 text-xs">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`font-mono ${isBreached ? 'text-red-400' : 'text-white'}`}>
          {value}
        </span>
        <span className="text-slate-600 text-xs">/ {threshold}</span>
        {isBreached && (
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        )}
      </div>
    </div>
  );
}
