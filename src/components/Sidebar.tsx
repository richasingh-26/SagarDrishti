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
    { id: 'vessels', label: 'Vessel Intellige...', icon: Ship, badge: anomalyCount || 500 },
    { id: 'spill-detection', label: 'Spill Detection (SAR)', icon: ScanEye },
    { id: 'scenario-builder', label: 'Scenario Builder', icon: FlaskConical },
    { id: 'prediction', label: 'Future Prediction', icon: TrendingUp },
  ];

  return (
    <nav className="fixed left-0 top-14 bottom-0 w-52 bg-[#070F1E] border-r border-[#162C46] flex flex-col py-4 z-40">
      <div className="px-4 mb-3">
        <span className="text-[10px] font-bold tracking-[0.15em] text-[#64748B] uppercase">
          NAVIGATION
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-2 space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-left transition-all cursor-pointer ${
                isActive
                  ? 'border border-[#00D4FF] bg-[#00D4FF]/10 text-white font-semibold shadow-[0_0_12px_rgba(0,212,255,0.15)]'
                  : 'text-[#94A3B8] hover:text-white hover:bg-white/[0.04] border border-transparent'
              }`}
            >
              <Icon size={15} className={isActive ? 'text-[#00D4FF]' : 'text-[#64748B]'} />
              <span className="flex-1 truncate">{item.label}</span>
              {item.isNew && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#A855F7]/15 text-[#A855F7] border border-[#A855F7]/30">
                  NEW
                </span>
              )}
              {item.badge !== undefined && item.badge > 0 && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Case Footer */}
      <div className="px-4 pt-3 border-t border-[#162C46]">
        <div className="text-[10px] font-bold tracking-wider text-[#64748B] uppercase">CASE</div>
        <div className="text-xs font-mono font-bold text-[#00D4FF] mt-0.5">#SAG-2026-001</div>
        <div className="text-[11px] text-[#94A3B8] mt-0.5">Singapore Strait</div>
      </div>
    </nav>
  );
}
