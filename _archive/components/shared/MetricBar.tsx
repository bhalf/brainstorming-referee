import InfoPopover from './InfoPopover';

/** Props for the MetricBar component. */
interface MetricBarProps {
  label: string;
  icon: string;
  value: number;           // 0-1 (normalized)
  displayValue: string;    // formatted string shown right
  threshold: number;       // 0-1 position of threshold line
  higherIsBetter: boolean; // breach logic direction
  statusText: string;
  helpKey?: string;
}

/**
 * Visual metric bar with threshold indicator and breach detection.
 * Renders a progress bar with a yellow threshold line. Bar turns red when
 * the metric value breaches the threshold in the configured direction.
 *
 * @param label - Metric display name.
 * @param icon - Emoji icon shown before the label.
 * @param value - Normalized metric value (0-1).
 * @param displayValue - Formatted string shown to the right of the label.
 * @param threshold - Threshold position on the bar (0-1).
 * @param higherIsBetter - If true, values below threshold are breached.
 * @param statusText - Descriptive status text shown below the bar.
 * @param helpKey - Optional key for an InfoPopover with metric details.
 */
export default function MetricBar({
  label,
  icon,
  value,
  displayValue,
  threshold,
  higherIsBetter,
  statusText,
  helpKey,
}: MetricBarProps) {
  // Determine breach: for "higher is better" metrics, being below threshold is bad
  const breached = higherIsBetter ? value < threshold : value > threshold;
  const barColor = breached ? 'bg-red-500' : value === 0 ? 'bg-slate-600' : 'bg-green-500';
  const statusColor = breached ? 'text-red-400' : 'text-green-400';
  const barWidth = Math.min(100, Math.max(0, value * 100));
  const thresholdPos = Math.min(100, Math.max(0, threshold * 100));

  return (
    <div>
      <div className="flex justify-between items-baseline text-xs mb-1">
        <span className="text-slate-300 font-medium">
          {icon} {label}
          {helpKey && <span className="ml-1 inline-flex align-middle"><InfoPopover helpKey={helpKey} size="xs" /></span>}
        </span>
        <span className={`font-mono font-semibold ${statusColor}`}>{displayValue}</span>
      </div>

      <div className="relative h-2.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${barColor}`}
          style={{ width: `${barWidth}%` }}
        />
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-yellow-400/80"
          style={{ left: `${thresholdPos}%` }}
          title={`Threshold: ${(threshold * 100).toFixed(0)}%`}
        />
      </div>

      <div className={`text-xs mt-0.5 ${statusColor}`}>{statusText}</div>
    </div>
  );
}
