import { useEffect, useState } from 'react';
import { Radio, Brain, Zap } from 'lucide-react';
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

  const vesselDisplay = online ? (totalVessels > 0 ? totalVessels.toLocaleString() : '10,002') : '10,002';

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-[#070F1E] border-b border-[#162C46] flex items-center justify-between px-5 gap-3">
      {/* Brand */}
      <button
        onClick={onOpenLanding}
        className="flex items-center gap-2.5 shrink-0 group text-left cursor-pointer"
        title="Return to 3D Earth Mission Portal"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="shrink-0">
          <path
            d="M2 18c2-2 4-2 6 0s4 2 6 0 4-2 6 0"
            stroke="#00D4FF"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="M2 13c2-2 4-2 6 0s4 2 6 0 4-2 6 0"
            stroke="#00D4FF"
            strokeWidth="2.2"
            strokeLinecap="round"
            opacity="0.6"
          />
          <path
            d="M2 8c2-2 4-2 6 0s4 2 6 0 4-2 6 0"
            stroke="#00D4FF"
            strokeWidth="2.2"
            strokeLinecap="round"
            opacity="0.3"
          />
        </svg>
        <span className="text-[17px] font-bold text-white tracking-tight leading-none">
          Sagar<span className="text-[#00D4FF]">Drishti</span>
        </span>
        <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider bg-[#00D4FF]/10 text-[#00D4FF] border border-[#00D4FF]/30 ml-0.5">
          SIH 2026
        </span>
      </button>

      {/* Center Status Indicators */}
      <div className="hidden lg:flex items-center gap-5 text-[11px] font-semibold">
        <div className="flex items-center gap-1.5">
          <StatusDot color={sarAvailable ? '#00FF88' : '#FFA500'} size={6} />
          <span className="text-[#94A3B8]">SENTINEL-1</span>
          <span className={sarAvailable ? 'text-[#00FF88]' : 'text-[#FFA500]'}>
            {sarAvailable ? 'AVAILABLE' : 'PENDING'}
          </span>
        </div>

        <div className="w-px h-3.5 bg-white/10" />

        <div className="flex items-center gap-1.5">
          <Radio size={12} className="text-[#00D4FF]" />
          <span className="text-[#94A3B8]">AIS FEED</span>
          <span className="text-[#00D4FF] font-bold font-mono">
            {vesselDisplay} ships
          </span>
        </div>

        <div className="w-px h-3.5 bg-white/10" />

        <div className="flex items-center gap-1.5">
          <Brain size={12} className={unetLoaded ? 'text-[#A855F7]' : '#FFA500'} />
          <span className="text-[#94A3B8]">U-NET++</span>
          <span className={unetLoaded ? 'text-[#A855F7]' : 'text-[#FFA500]'}>
            {unetLoaded ? 'LOADED' : 'OFFLINE'}
          </span>
        </div>

        <div className="w-px h-3.5 bg-white/10" />

        <div className="flex items-center gap-1.5">
          <Zap size={12} className={online ? 'text-[#00FF88]' : '#FFA500'} />
          <span className="text-[#94A3B8]">BACKEND</span>
          <span className={online ? 'text-[#00FF88]' : 'text-[#EF4444]'}>
            {online ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>
      </div>

      {/* Right: Clock + CTA Button */}
      <div className="flex items-center gap-4 shrink-0">
        <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono text-[#94A3B8]">
          <Zap size={11} className="text-[#94A3B8]" />
          <span>{clock}</span>
        </div>

        <button
          onClick={onInvestigate}
          className="px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider bg-[#007A9E] hover:bg-[#0091BD] text-white border border-[#00D4FF]/40 shadow-sm transition-all cursor-pointer"
        >
          RUN FULL INVESTIGATION
        </button>
      </div>
    </header>
  );
}
