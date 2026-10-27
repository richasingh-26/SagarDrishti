import type { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  color?: 'cyan' | 'gold' | 'success' | 'warning' | 'danger' | 'muted';
  className?: string;
}

const colorMap: Record<string, string> = {
  cyan: 'bg-[rgba(0,212,255,0.12)] text-[#00D4FF] border-[rgba(0,212,255,0.3)]',
  gold: 'bg-[rgba(255,215,0,0.12)] text-[#FFD700] border-[rgba(255,215,0,0.3)]',
  success: 'bg-[rgba(0,255,136,0.12)] text-[#00FF88] border-[rgba(0,255,136,0.3)]',
  warning: 'bg-[rgba(255,165,0,0.12)] text-[#FFA500] border-[rgba(255,165,0,0.3)]',
  danger: 'bg-[rgba(255,68,68,0.12)] text-[#FF4444] border-[rgba(255,68,68,0.3)]',
  muted: 'bg-[rgba(136,153,170,0.12)] text-[#8899AA] border-[rgba(136,153,170,0.2)]',
};

export function Badge({ children, color = 'cyan', className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[0.625rem] font-semibold uppercase tracking-wider border ${colorMap[color]} ${className}`}
    >
      {children}
    </span>
  );
}
