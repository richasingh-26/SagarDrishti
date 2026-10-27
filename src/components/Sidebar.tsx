import {
  LayoutDashboard,
  ScanEye,
  Ship,
  FlaskConical,
  TrendingUp,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type PageId =
  | 'dashboard'
  | 'fleet-builder'
  | 'spill-detection'
  | 'vessels'
  | 'scenario-builder'
  | 'evidence'
  | 'prediction';

interface NavItem {
  id: PageId;
  label: string;
  icon: LucideIcon;
  badge?: number;
  goldStar?: boolean;
  isNew?: boolean;
}

interface SidebarProps {
  active: PageId;
  onNavigate: (page: PageId) => void;
  anomalyCount: number;
  alertCount?: number;
}

export function Sidebar({ active, onNavigate, anomalyCount }: SidebarProps) {
  const items: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'fleet-builder', label: 'Custom Ship Studio', icon: Ship, isNew: true },
    { id: 'vessels', label: 'Vessel Intelligence', icon: Ship, badge: anomalyCount },
    { id: 'spill-detection', label: 'Spill Detection (SAR)', icon: ScanEye },
    { id: 'scenario-builder', label: 'Scenario Builder', icon: FlaskConical },
    { id: 'prediction', label: 'Future Prediction', icon: TrendingUp },
  ];

  return (
    <nav className="fixed left-0 top-14 bottom-0 w-56 bg-[rgba(7,15,30,0.85)] backdrop-blur-lg border-r border-cyan-dim flex flex-col py-3 z-40">
      <div className="px-3 mb-2">
        <span className="section-label">Navigation</span>
      </div>
      <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium text-left ${
                isActive ? 'nav-item-active' : 'nav-item'
              }`}
            >
              <Icon size={16} className="shrink-0" />
              <span className="flex-1 truncate">{item.label}</span>
              {item.goldStar && <span className="text-[#FFD700] text-xs">★</span>}
              {item.isNew && (
                <span className="px-1.5 py-0.5 rounded text-[0.5625rem] font-bold bg-[rgba(168,85,247,0.15)] text-[#A855F7] border border-[rgba(168,85,247,0.3)]">
                  NEW
                </span>
              )}
              {item.badge !== undefined && item.badge > 0 && (
                <span
                  className="px-1.5 py-0.5 rounded text-[0.625rem] font-bold bg-[rgba(255,68,68,0.15)] text-[#FF4444]"
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="px-3 pt-2 border-t border-cyan-dim">
        <div className="section-label mb-1">Case</div>
        <div className="metric-value text-xs text-[#00D4FF]">#SAG-2026-001</div>
        <div className="text-[0.625rem] text-muted mt-0.5">Singapore Strait</div>
      </div>
    </nav>
  );
}
