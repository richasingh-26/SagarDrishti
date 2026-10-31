import { useEffect, useState } from 'react';
import { Activity, Radio, Brain, Zap, Globe, Shield, User } from 'lucide-react';
import { StatusDot } from './StatusDot';
import type { PageId } from './Sidebar';

interface CommandBarProps {
  online: boolean;
  totalVessels: number;
  sarAvailable: boolean;
  unetLoaded: boolean;
  activePage: PageId;
  onNavigate: (page: PageId) => void;
  onInvestigate: () => void;
  onOpenLanding?: () => void;
}

export function CommandBar({
  online,
  totalVessels,
  sarAvailable,
  unetLoaded,
  activePage,
  onNavigate,
  onInvestigate,
  onOpenLanding,
}: CommandBarProps) {
  const [clock, setClock] = useState('');

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(now.toISOString().slice(11, 19) + ' UTC');
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const navTabs: { id: PageId; label: string }[] = [
    { id: 'dashboard', label: 'Command Center' },
    { id: 'vessels', label: 'AIS Fleet Track' },
    { id: 'spill-detection', label: 'SAR AI Analysis' },
    { id: 'fleet-builder', label: 'Custom Studio' },
    { id: 'scenario-builder', label: 'Drift Simulator' },
    { id: 'prediction', label: 'Forecast' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-[#060B10]/80 backdrop-blur-xl border-b border-white/[0.08] flex items-center justify-between px-6 gap-4">
      {/* Brand Lockup (Exact SatQuery Style) */}
      <div className="flex items-center gap-6 shrink-0">
        <button
          onClick={onOpenLanding}
          className="flex items-center gap-2.5 group text-left transition-transform hover:scale-[1.02]"
          title="Return to 3D Earth Mission Portal"
        >
          {/* Orbital Orbit Ring Logo */}
          <div className="relative w-8 h-8 flex items-center justify-center shrink-0">
            <svg width="30" height="30" viewBox="0 0 28 28" fill="none">
              <circle
                cx="14"
                cy="14"
                r="11"
                stroke="#5FE38A"
                strokeWidth="1.8"
                strokeDasharray="44 12"
                className="opacity-90 transition-transform group-hover:rotate-45"
              />
              <circle cx="14" cy="14" r="5" fill="#5FE38A" className="shadow-glow" />
              <ellipse
                cx="14"
                cy="14"
                rx="13"
                ry="5"
                stroke="#5FE38A"
                strokeWidth="1.2"
                transform="rotate(-25 14 14)"
                strokeDasharray="28 8"
                opacity="0.8"
              />
            </svg>
          </div>
          <div>
            <div className="text-[17px] font-extrabold tracking-tight text-white leading-tight">
              Sagar<span className="text-[#5FE38A]">Drishti</span>
            </div>
            <div className="text-[8px] font-bold tracking-[0.2em] text-[#94A3B8] uppercase">
              MARITIME INTELLIGENCE
            </div>
          </div>
        </button>

        {/* SatQuery Capsule Nav Links */}
        <nav className="hidden lg:flex items-center gap-1.5 pl-2">
          {navTabs.map((tab) => {
            const isActive = activePage === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onNavigate(tab.id)}
                className={`text-[12.5px] px-3.5 py-1.5 transition-all ${
                  isActive ? 'nav-item-active' : 'nav-item'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Center: SatQuery Status Dot Ribbon */}
      <div className="hidden xl:flex items-center gap-4 px-4 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.08]">
        <div className="flex items-center gap-2 text-xs">
          <StatusDot color={sarAvailable ? '#5FE38A' : '#F59E0B'} size={7} />
          <span className="text-[11px] text-[#94A3B8]">Sentinel-1</span>
          <span
            className={`text-[11px] font-semibold ${
              sarAvailable ? 'text-[#5FE38A]' : 'text-[#F59E0B]'
            }`}
          >
            {sarAvailable ? 'ONLINE' : 'PENDING'}
          </span>
        </div>
        <div className="w-px h-3.5 bg-white/10" />
        <div className="flex items-center gap-2 text-xs">
          <Radio size={12} className="text-[#5BC0BE]" />
          <span className="text-[11px] text-[#94A3B8]">AIS Fleet</span>
          <span className="text-[11px] font-semibold text-white">
            {online ? `${totalVessels.toLocaleString()} ships` : 'OFFLINE'}
          </span>
        </div>
        <div className="w-px h-3.5 bg-white/10" />
        <div className="flex items-center gap-2 text-xs">
          <Brain size={12} className={unetLoaded ? 'text-[#A8E6A3]' : 'text-[#F59E0B]'} />
          <span className="text-[11px] text-[#94A3B8]">U-Net++</span>
          <span
            className={`text-[11px] font-semibold ${
              unetLoaded ? 'text-[#5FE38A]' : 'text-[#F59E0B]'
            }`}
          >
            {unetLoaded ? 'LOADED' : 'OFFLINE'}
          </span>
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.06]">
          <Activity size={11} className="text-[#5FE38A]" />
          <span className="font-mono text-[11px] text-[#94A3B8]">{clock}</span>
        </div>

        {onOpenLanding && (
          <button
            onClick={onOpenLanding}
            className="btn-sat-ghost text-xs hidden sm:inline-flex"
            title="3D Earth Satellite View"
          >
            <Globe size={13} className="text-[#5FE38A]" />
            <span>3D Earth</span>
          </button>
        )}

        <button onClick={onInvestigate} className="btn-sat-primary">
          <Shield size={14} />
          <span>Full Forensic Pass</span>
        </button>

        {/* SatQuery User Profile Circle */}
        <button
          className="w-9 h-9 rounded-full bg-white/[0.04] hover:bg-[#5FE38A]/10 border border-white/[0.15] hover:border-[#5FE38A] text-[#CBD5E1] hover:text-[#5FE38A] flex items-center justify-center transition-all cursor-pointer"
          title="Security Clearance: Level 4"
        >
          <User size={16} />
        </button>
      </div>
    </header>
  );
}
