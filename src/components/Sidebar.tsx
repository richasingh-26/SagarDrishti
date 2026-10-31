import {
  LayoutDashboard,
  ScanEye,
  Ship,
  FlaskConical,
  TrendingUp,
  SlidersHorizontal,
  Compass,
  Sparkles,
  Moon,
  Sun,
  Palette,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';

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
  const { theme, setTheme } = useTheme();
  const items: NavItem[] = [
    { id: 'dashboard', label: 'Command Center', icon: LayoutDashboard },
    { id: 'vessels', label: 'AIS Fleet Track', icon: Ship, badge: anomalyCount },
    { id: 'spill-detection', label: 'SAR AI Analysis', icon: ScanEye },
    { id: 'fleet-builder', label: 'Custom Ship Studio', icon: SlidersHorizontal, isNew: true },
    { id: 'scenario-builder', label: 'Drift Simulator', icon: FlaskConical },
    { id: 'prediction', label: 'Spill Forecast', icon: TrendingUp },
  ];

  return (
    <nav className="fixed left-0 top-16 bottom-0 w-60 bg-[#060B10]/85 backdrop-blur-xl border-r border-white/[0.08] flex flex-col py-4 z-40">
      <div className="px-4 mb-3 flex items-center justify-between">
        <span className="section-label">MISSION VIEWS</span>
        <span className="text-[10px] text-[#5FE38A] font-mono font-semibold">LIVE</span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-semibold text-left transition-all ${
                isActive
                  ? 'bg-[#5FE38A]/10 text-white border border-[#5FE38A]/40 shadow-[0_0_20px_rgba(95,227,138,0.15)]'
                  : 'text-[#94A3B8] hover:text-white hover:bg-white/[0.04] border border-transparent'
              }`}
            >
              <Icon
                size={17}
                className={isActive ? 'text-[#5FE38A]' : 'text-[#64748B]'}
              />
              <span className="flex-1 truncate">{item.label}</span>
              {item.isNew && (
                <span className="px-1.5 py-0.5 rounded-full text-[0.5625rem] font-bold bg-[#D8B4FE]/15 text-[#D8B4FE] border border-[#D8B4FE]/30">
                  NEW
                </span>
              )}
              {item.badge !== undefined && item.badge > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[0.625rem] font-bold bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Theme Switcher */}
      <div className="mx-3 mb-2 p-2 rounded-xl bg-white/[0.02] border border-white/[0.08] space-y-1.5">
        <div className="flex items-center justify-between text-[10px] px-1">
          <span className="section-label">SYSTEM THEME</span>
          <Palette size={11} className="text-[#5FE38A]" />
        </div>
        <div className="grid grid-cols-3 gap-1 p-0.5 rounded-lg bg-black/20 border border-white/[0.06]">
          <button
            onClick={() => setTheme('default')}
            className={`py-1 rounded text-[10px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
              theme === 'default'
                ? 'bg-[#5FE38A] text-[#060B10] shadow-sm'
                : 'text-[#94A3B8] hover:text-white'
            }`}
            title="Default Oceanic Cyberpunk"
          >
            <Sparkles size={10} />
            <span>Def</span>
          </button>
          <button
            onClick={() => setTheme('black')}
            className={`py-1 rounded text-[10px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
              theme === 'black'
                ? 'bg-[#5FE38A] text-[#060B10] shadow-sm'
                : 'text-[#94A3B8] hover:text-white'
            }`}
            title="Pitch Black OLED"
          >
            <Moon size={10} />
            <span>Blk</span>
          </button>
          <button
            onClick={() => setTheme('white')}
            className={`py-1 rounded text-[10px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
              theme === 'white'
                ? 'bg-[#10B981] text-white shadow-sm'
                : 'text-[#94A3B8] hover:text-white'
            }`}
            title="Daylight White"
          >
            <Sun size={10} />
            <span>Wht</span>
          </button>
        </div>
      </div>

      {/* Case Footer Card (SatQuery Info Card style) */}
      <div className="mx-3 p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.08] space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="section-label">ACTIVE AREA</span>
          <Compass size={12} className="text-[#5FE38A]" />
        </div>
        <div className="font-bold text-[13px] text-white">Singapore Strait TSS</div>
        <div className="text-[11px] text-[#94A3B8] font-mono">Case #SAG-2026-001</div>
        <div className="pt-1 flex items-center gap-1.5 text-[10px] text-[#5FE38A]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#5FE38A] animate-ping" />
          <span>Continuous Watch Active</span>
        </div>
      </div>
    </nav>
  );
}
