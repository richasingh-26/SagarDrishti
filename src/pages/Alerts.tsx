import { Bell, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/Badge';
import { Panel, PanelHeader } from '@/components/Panel';
import { StatusDot } from '@/components/StatusDot';
import type { ActivityEvent } from '@/hooks/useDashboardData';

interface AlertsProps {
  events: ActivityEvent[];
}

export function Alerts({ events }: AlertsProps) {
  const colorMap: Record<string, string> = {
    danger: '#FF4444',
    warning: '#FFA500',
    info: '#00D4FF',
    success: '#00FF88',
  };

  const iconMap: Record<string, typeof AlertTriangle> = {
    danger: AlertTriangle,
    warning: AlertTriangle,
    info: Info,
    success: CheckCircle2,
  };

  // Dynamic alerts from real events
  const alerts = events
    .filter((e) => e.level === 'danger' || e.level === 'warning')
    .slice(0, 10);

  const dangerCount = alerts.filter((a) => a.level === 'danger').length;
  const warningCount = alerts.filter((a) => a.level === 'warning').length;

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="glass-panel overflow-hidden">
          <PanelHeader
            title="Active Alerts"
            right={
              <div className="flex items-center gap-2">
                {dangerCount > 0 && <Badge color="danger">{dangerCount} CRITICAL</Badge>}
                {warningCount > 0 && <Badge color="warning">{warningCount} WARNING</Badge>}
                {dangerCount === 0 && warningCount === 0 && (
                  <Badge color="cyan">NO ALERTS</Badge>
                )}
              </div>
            }
          />
          <div className="p-4 space-y-3">
            {alerts.length === 0 && (
              <div className="text-xs text-muted text-center py-8">
                No active alerts — all systems nominal
              </div>
            )}
            {alerts.map((alert, i) => {
              const color = colorMap[alert.level];
              return (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 rounded-md bg-[rgba(0,212,255,0.03)] hover:bg-[rgba(0,212,255,0.06)] transition-colors"
                  style={{ borderLeft: `2px solid ${color}` }}
                >
                  <span className="metric-value text-[0.625rem] text-muted">{alert.time}</span>
                  <span className="text-xs text-white/80">{alert.text}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* System events */}
        <div className="glass-panel overflow-hidden">
          <PanelHeader title="System Event Log" right={<Bell size={14} className="text-muted" />} />
          <div className="p-2 space-y-1 max-h-64 overflow-y-auto">
            {events.map((evt, i) => (
              <div key={i} className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-[rgba(0,212,255,0.04)]">
                <span className="metric-value text-[0.625rem] text-muted shrink-0 mt-0.5">{evt.time}</span>
                <StatusDot color={colorMap[evt.level]} size={6} pulse={false} />
                <span className="text-xs text-white/80">{evt.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
