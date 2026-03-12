import InfoPopover from './InfoPopover';

/** Props for the RadialGauge component. */
interface RadialGaugeProps {
  label: string;
  icon: string;
  value: number;           // 0-1 (normalized)
  displayValue: string;    // formatted string shown center
  threshold: number;       // 0-1 position of threshold marker
  higherIsBetter: boolean; // breach logic direction
  statusText: string;
  helpKey?: string;
}

// Arc geometry constants
const SIZE = 90;
const STROKE = 8;
const RADIUS = (SIZE - STROKE) / 2;
const CENTER = SIZE / 2;
const START_ANGLE = 135;   // degrees — bottom-left
const SWEEP = 270;         // degrees — 270° arc (leaves a gap at bottom)

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

/**
 * Radial gauge meter with SVG arc, threshold marker, and breach detection.
 * Renders a 270-degree arc that fills based on the metric value.
 * Color transitions from green to red when the threshold is breached.
 */
export default function RadialGauge({
  label,
  icon,
  value,
  displayValue,
  threshold,
  higherIsBetter,
  statusText,
  helpKey,
}: RadialGaugeProps) {
  const breached = higherIsBetter ? value < threshold : value > threshold;
  const clampedValue = Math.min(1, Math.max(0, value));
  const clampedThreshold = Math.min(1, Math.max(0, threshold));

  // Arc paths
  const bgEndAngle = START_ANGLE + SWEEP;
  const valueEndAngle = START_ANGLE + SWEEP * clampedValue;
  const thresholdAngle = START_ANGLE + SWEEP * clampedThreshold;

  const bgArc = describeArc(CENTER, CENTER, RADIUS, START_ANGLE, bgEndAngle);
  const valueArc = clampedValue > 0.005
    ? describeArc(CENTER, CENTER, RADIUS, START_ANGLE, valueEndAngle)
    : '';

  // Threshold tick position
  const thresholdPoint = polarToCartesian(CENTER, CENTER, RADIUS, thresholdAngle);

  // Colors
  const arcColor = breached ? '#ef4444' : clampedValue === 0 ? '#475569' : '#22c55e';
  const glowColor = breached ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.2)';
  const statusColor = breached ? 'text-red-400' : 'text-green-400';
  const valueColor = breached ? 'text-red-400' : 'text-slate-100';

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="drop-shadow-sm"
        >
          {/* Glow filter */}
          <defs>
            <filter id={`glow-${label.replace(/\s/g, '')}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Background arc */}
          <path
            d={bgArc}
            fill="none"
            stroke="#334155"
            strokeWidth={STROKE}
            strokeLinecap="round"
          />

          {/* Value arc */}
          {valueArc && (
            <path
              d={valueArc}
              fill="none"
              stroke={arcColor}
              strokeWidth={STROKE}
              strokeLinecap="round"
              filter={`url(#glow-${label.replace(/\s/g, '')})`}
              style={{
                transition: 'stroke 0.4s ease, d 0.5s ease-out',
              }}
            />
          )}

          {/* Threshold marker (small circle on the arc) */}
          <circle
            cx={thresholdPoint.x}
            cy={thresholdPoint.y}
            r={3}
            fill="#facc15"
            stroke="#1e293b"
            strokeWidth={1.5}
          />
        </svg>

        {/* Center value */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-lg font-bold font-mono leading-none ${valueColor}`}>
            {displayValue}
          </span>
        </div>
      </div>

      {/* Label + status */}
      <div className="text-center mt-0.5 max-w-[100px]">
        <div className="text-xs text-slate-300 font-medium leading-tight">
          {icon} {label}
          {helpKey && <span className="ml-0.5 inline-flex align-middle"><InfoPopover helpKey={helpKey} size="xs" /></span>}
        </div>
        <div className={`text-[10px] leading-tight mt-0.5 ${statusColor}`}>
          {statusText}
        </div>
      </div>
    </div>
  );
}
