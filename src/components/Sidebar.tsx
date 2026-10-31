import {
  LayoutDashboard,
  ScanEye,
  Ship,
  FlaskConical,
  TrendingUp,
  SlidersHorizontal,
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
  isNew?: boolean;
}

interface SidebarProps {
  active: PageId;
  onNavigate: (page: PageId) => void;
  anomalyCount: number;
  alertCount?: number;
  onOpenLanding?: () => void;
}

export function Sidebar({ active, onNavigate, anomalyCount }: SidebarProps) {
  const items: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'fleet-builder', label: 'Custom Ship ...', icon: SlidersHorizontal, isNew: true },
    { id: 'vessels', label: 'Vessel Intellige...', icon: Ship, badge: anomalyCount },
    { id: 'spill-detection', label: 'Spill Detection (SAR)', icon: ScanEye },
    { id: 'scenario-builder', label: 'Scenario Builder', icon: FlaskConical },
    { id: 'prediction', label: 'Future Prediction', icon: TrendingUp },
  ];

  return (
    <nav className="fixed left-0 top-14 bottom-0 w-48 bg-[#0A1018] border-r border-white/[0.08] flex flex-col py-4 z-40">
      <div className="px-4 mb-3">
        <span className="text-[10px] font-bold tracking-[0.15em] text-[#64748B] uppercase">
          NAVIGATION
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-0.5">
        {items.map((item) => {
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-2 px-4 py-2.5 text-[13px] text-left transition-all border-l-2 ${
                isActive
                  ? 'border-l-[#5BC0BE] bg-[#5BC0BE]/8 text-white font-semibold'
                  : 'border-l-transparent text-[#94A3B8] hover:text-white hover:bg-white/[0.03]'
              }`}
            >
              <span className="flex-1 truncate">{item.label}</span>
              {item.isNew && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#5BC0BE]/15 text-[#5BC0BE]">
                  NEW
                </span>
              )}
              {item.badge !== undefined && item.badge > 0 && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#EF4444]/15 text-[#EF4444]">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Case Footer */}
      <div className="mx-3 mt-auto pt-3 border-t border-white/[0.06] space-y-1">
        <span className="text-[10px] font-bold tracking-[0.15em] text-[#64748B] uppercase">
          CASE
        </span>
        <div className="font-bold text-[12px] text-[#5BC0BE] font-mono">#SAG-2026-001</div>
        <div className="text-[11px] text-[#94A3B8]">Singapore Strait</div>
      </div>
    </nav>
  );
}
