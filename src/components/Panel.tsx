import type { ReactNode } from 'react';

interface PanelProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  accent?: 'cyan' | 'gold' | 'danger';
}

export function Panel({ children, className = '', hover = false, accent }: PanelProps) {
  const accentBorder =
    accent === 'gold'
      ? 'border-l-2 border-l-[#FFD700]'
      : accent === 'danger'
        ? 'border-l-2 border-l-[#FF4444]'
        : accent === 'cyan'
          ? 'border-l-2 border-l-[#00D4FF]'
          : '';

  return (
    <div
      className={`glass-panel ${hover ? 'glass-panel-hover' : ''} ${accentBorder} ${className}`}
    >
      {children}
    </div>
  );
}

interface PanelHeaderProps {
  title: string;
  badge?: ReactNode;
  right?: ReactNode;
}

export function PanelHeader({ title, badge, right }: PanelHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-cyan-dim">
      <div className="flex items-center gap-2">
        <span className="section-label">{title}</span>
        {badge}
      </div>
      {right}
    </div>
  );
}
