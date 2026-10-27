interface StatusDotProps {
  color: string;
  pulse?: boolean;
  size?: number;
}

export function StatusDot({ color, pulse = true, size = 8 }: StatusDotProps) {
  return (
    <span
      className={pulse ? 'status-dot status-dot-pulse' : 'status-dot'}
      style={{ width: size, height: size, backgroundColor: color, color }}
    />
  );
}
