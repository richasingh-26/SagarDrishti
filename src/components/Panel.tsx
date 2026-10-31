import type { ReactNode } from 'react';

interface PanelProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  accent?: 'cyan' | 'gold' | 'danger' | 'accent';
}

export function Panel({ children, className = '', hover = true, accent }: PanelProps) {
  const accentBorder =
    accent === 'gold'
      ? 'border-l-2 border-l-[#F59E0B]'
      : accent === 'danger'
        ? 'border-l-2 border-l-[#EF4444]'
        : accent === 'cyan'
          ? 'border-l-2 border-l-[#5BC0BE]'
          : accent === 'accent'
            ? 'border-l-2 border-l-[#5FE38A]'
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
  subtitle?: string;
  badge?: ReactNode;
  right?: ReactNode;
}

export function PanelHeader({ title, subtitle, badge, right }: PanelHeaderProps) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.08]">
      <div className="flex items-center gap-2.5">
        <div>
          <span className="section-label">{title}</span>
          {subtitle && (
            <div className="text-[0.6875rem] text-[#94A3B8] font-normal tracking-normal mt-0.5">
              {subtitle}
            </div>
          )}
        </div>
        {badge}
      </div>
      {right}
    </div>
  );
}
