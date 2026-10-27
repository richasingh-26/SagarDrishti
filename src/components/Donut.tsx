interface DonutProps {
  value: number;
  max?: number;
  size?: number;
  thickness?: number;
  color?: string;
  trackColor?: string;
  label?: string;
  sublabel?: string;
}

export function Donut({
  value,
  max = 100,
  size = 80,
  thickness = 8,
  color = '#00D4FF',
  trackColor = 'rgba(0, 212, 255, 0.1)',
  label,
  sublabel,
}: DonutProps) {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(value / max, 1);
  const offset = circumference * (1 - pct);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={trackColor}
            strokeWidth={thickness}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={thickness}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s ease-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="metric-value text-sm font-semibold" style={{ color }}>
            {label ?? `${value}%`}
          </span>
        </div>
      </div>
      {sublabel && <span className="section-label text-[0.625rem]">{sublabel}</span>}
    </div>
  );
}
