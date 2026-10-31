import type { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  color?: 'cyan' | 'gold' | 'success' | 'warning' | 'danger' | 'muted' | 'purple' | 'accent';
  className?: string;
  dot?: boolean;
}

const colorMap: Record<string, { bg: string; text: string; border: string; dotColor: string }> = {
  accent: {
    bg: 'bg-[rgba(95,227,138,0.12)]',
    text: 'text-[#5FE38A]',
    border: 'border-[rgba(95,227,138,0.35)]',
    dotColor: '#5FE38A',
  },
  success: {
    bg: 'bg-[rgba(95,227,138,0.12)]',
    text: 'text-[#5FE38A]',
    border: 'border-[rgba(95,227,138,0.35)]',
    dotColor: '#5FE38A',
  },
  cyan: {
    bg: 'bg-[rgba(91,192,190,0.12)]',
    text: 'text-[#5BC0BE]',
    border: 'border-[rgba(91,192,190,0.3)]',
    dotColor: '#5BC0BE',
  },
  gold: {
    bg: 'bg-[rgba(245,158,11,0.12)]',
    text: 'text-[#F59E0B]',
    border: 'border-[rgba(245,158,11,0.3)]',
    dotColor: '#F59E0B',
  },
  warning: {
    bg: 'bg-[rgba(245,158,11,0.12)]',
    text: 'text-[#F59E0B]',
    border: 'border-[rgba(245,158,11,0.3)]',
    dotColor: '#F59E0B',
  },
  danger: {
    bg: 'bg-[rgba(239,68,68,0.12)]',
    text: 'text-[#EF4444]',
    border: 'border-[rgba(239,68,68,0.35)]',
    dotColor: '#EF4444',
  },
  purple: {
    bg: 'bg-[rgba(192,132,252,0.12)]',
    text: 'text-[#D8B4FE]',
    border: 'border-[rgba(192,132,252,0.3)]',
    dotColor: '#D8B4FE',
  },
  muted: {
    bg: 'bg-[rgba(148,163,184,0.1)]',
    text: 'text-[#94A3B8]',
    border: 'border-[rgba(148,163,184,0.2)]',
    dotColor: '#94A3B8',
  },
};

export function Badge({ children, color = 'accent', className = '', dot = false }: BadgeProps) {
  const conf = colorMap[color] || colorMap.accent;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[0.6875rem] font-semibold tracking-wide border ${conf.bg} ${conf.text} ${conf.border} backdrop-blur-md ${className}`}
    >
      {dot && (
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: conf.dotColor }}
        />
      )}
      {children}
    </span>
  );
}
