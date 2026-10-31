import { useEffect, useState } from 'react';
import { Activity, Radio, Brain, Zap, Anchor } from 'lucide-react';
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

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-[#0A1018] border-b border-white/[0.08] flex items-center justify-between px-5 gap-3">
      {/* Brand */}
      <button
        onClick={onOpenLanding}
        className="flex items-center gap-2 shrink-0 group"
        title="Return to 3D Earth"
      >
        <Anchor size={18} className="text-[#5BC0BE]" />
        <span className="text-[15px] font-bold text-white tracking-tight">
          Sagar<span className="text-[#5BC0BE]">Drishti</span>
        </span>
        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#5BC0BE]/15 text-[#5BC0BE] border border-[#5BC0BE]/30 ml-0.5">
          SIH 2026
        </span>
      </button>

      {/* Center Status Indicators */}
      <div className="hidden md:flex items-center gap-5 text-[11px]">
        <div className="flex items-center gap-1.5">
          <StatusDot color={sarAvailable ? '#5FE38A' : '#F59E0B'} size={6} />
          <span className="text-[#94A3B8]">SENTINEL-1</span>
          <span className={`font-semibold ${sarAvailable ? 'text-[#5FE38A]' : 'text-[#F59E0B]'}`}>
            {sarAvailable ? 'AVAILABLE' : 'PENDING'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Radio size={11} className="text-[#5BC0BE]" />
          <span className="text-[#94A3B8]">AIS FEED</span>
          <span className="font-semibold text-white">
            {online ? `${totalVessels.toLocaleString()} ships` : 'OFFLINE'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Brain size={11} className={unetLoaded ? 'text-[#5FE38A]' : 'text-[#F59E0B]'} />
          <span className="text-[#94A3B8]">U-NET++</span>
          <span className={`font-semibold ${unetLoaded ? 'text-[#5FE38A]' : 'text-[#F59E0B]'}`}>
            {unetLoaded ? 'LOADED' : 'OFFLINE'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Zap size={11} className={online ? 'text-[#5FE38A]' : 'text-[#F59E0B]'} />
          <span className="text-[#94A3B8]">BACKEND</span>
          <span className={`font-semibold ${online ? 'text-[#5FE38A]' : 'text-[#EF4444]'}`}>
            {online ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>
      </div>

      {/* Right: Clock + CTA */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="hidden sm:flex items-center gap-1.5 text-[11px]">
          <Activity size={11} className="text-[#5FE38A]" />
          <span className="font-mono text-[#94A3B8]">{clock}</span>
        </div>
        <button
          onClick={onInvestigate}
          className="px-4 py-1.5 rounded text-xs font-bold bg-[#0D7377] hover:bg-[#0F8E92] text-white border border-[#5BC0BE]/40 transition-all"
        >
          RUN FULL INVESTIGATION
        </button>
      </div>
    </header>
  );
}
