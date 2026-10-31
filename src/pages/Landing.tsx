import React, { useRef, useState, useEffect } from 'react';
import {
  Search,
  ArrowRight,
  Shield,
  Radio,
  ScanEye,
  SlidersHorizontal,
  FlaskConical,
  Compass,
  Waves,
  Ship,
  Wind,
  Thermometer,
  Layers,
  Crosshair,
  ArrowUpRight,
  Radar,
  Anchor,
  Activity,
  AlertTriangle,
  Cpu,
  FileCheck2,
  Database,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Clock,
  MapPin,
  TrendingUp,
} from 'lucide-react';

interface LandingProps {
  onEnter: (targetPage?: string) => void;
}

type OceanMode = 'currents' | 'ais' | 'sar' | 'bathymetry';

export function Landing({ onEnter }: LandingProps) {

  const [searchQuery, setSearchQuery] = useState('');
  const [activeOceanMode, setActiveOceanMode] = useState<OceanMode>('currents');
  const [selectedHotspot, setSelectedHotspot] = useState<string>('singapore');


  

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onEnter('dashboard');
  };

  const featureCards = [
    {
      id: 'dashboard',
      title: 'Command Center',
      desc: 'Tactical maritime surveillance & alert feed',
      page: 'dashboard',
      img: '/visuals/cards/social-track.jpg',
      icon: Shield,
    },
    {
      id: 'vessels',
      title: 'AIS Fleet Track',
      desc: '10,001 live vessel trajectories & dark fleet isolation',
      page: 'vessels',
      img: '/visuals/cards/ai-mode.jpg',
      icon: Radio,
    },
    {
      id: 'spill-detection',
      title: 'SAR AI Analysis',
      desc: 'Sentinel-1 U-Net++ segmentation & dB damping',
      page: 'spill-detection',
      img: '/visuals/cards/flood-dispatch.jpg',
      icon: ScanEye,
    },
    {
      id: 'fleet-builder',
      title: 'Custom Ship Studio',
      desc: 'Dark fleet kinematic simulator & spoof detection',
      page: 'fleet-builder',
      img: '/visuals/cards/crop-damage.jpg',
      icon: SlidersHorizontal,
    },
    {
      id: 'scenario-builder',
      title: 'Drift Simulator',
      desc: 'Copernicus Lagrangian reverse trajectory backtracking',
      page: 'scenario-builder',
      img: '/visuals/cards/social-track.jpg',
      icon: FlaskConical,
    },
  ];

  // Ocean Chokepoint Hotspots with real telemetry
  const hotspots: Record<
    string,
    {
      name: string;
      coords: string;
      latDMS: string;
      lonDMS: string;
      trafficLoad: string;
      driftVel: string;
      driftDeg: number;
      depth: string;
      sst: string;
      risk: 'NOMINAL' | 'ELEVATED' | 'CRITICAL';
      riskColor: string;
      tankers: number;
      sarStatus: string;
    }
  > = {
    singapore: {
      name: 'Singapore Strait TSS · Sector Alpha',
      coords: '01° 15.0\' N, 103° 48.0\' E',
      latDMS: '01° 15.0\' N',
      lonDMS: '103° 48.0\' E',
      trafficLoad: '87%',
      driftVel: '1.42 kn',
      driftDeg: 118,
      depth: '-24.5 m (Shelf)',
      sst: '28.6°C',
      risk: 'ELEVATED',
      riskColor: '#F59E0B',
      tankers: 412,
      sarStatus: 'Sentinel-1C Ingest: 14m ago',
    },
    malacca: {
      name: 'Strait of Malacca · One Fathom Bank',
      coords: '02° 53.0\' N, 101° 00.0\' E',
      latDMS: '02° 53.0\' N',
      lonDMS: '101° 00.0\' E',
      trafficLoad: '94%',
      driftVel: '1.85 kn',
      driftDeg: 305,
      depth: '-38.0 m (Channel)',
      sst: '29.1°C',
      risk: 'CRITICAL',
      riskColor: '#EF4444',
      tankers: 588,
      sarStatus: 'Anomaly: Bilge slick detected',
    },
    sunda: {
      name: 'Sunda Strait Chokepoint',
      coords: '05° 55.0\' S, 105° 53.0\' E',
      latDMS: '05° 55.0\' S',
      lonDMS: '105° 53.0\' E',
      trafficLoad: '62%',
      driftVel: '2.10 kn',
      driftDeg: 195,
      depth: '-120 m (Deep Trench)',
      sst: '27.8°C',
      risk: 'NOMINAL',
      riskColor: '#5FE38A',
      tankers: 176,
      sarStatus: 'Clear swath · No slicks',
    },
  };

  const currentHotspot = hotspots[selectedHotspot] || hotspots.singapore;

  return (
    <div className="relative min-h-screen w-full bg-[#060B10] text-white font-sans">
      {/* 1. 4K LOOPING EARTH VIDEO GLOBE (FIXED PINNED BACKGROUND) */}
      <div className="site-video-background" aria-hidden="true">
        
        <div className="site-video-overlay" />
      </div>

      {/* 2. DYNAMIC OCEANIC SURVEILLANCE HUD OVERLAY (Animated Streamlines, Shipping Lanes, Sonar) */}
      <div className="ocean-surveillance-hud-layer pointer-events-none" aria-hidden="true">
        {/* Dynamic Ocean Current Vector Streamlines */}
        {activeOceanMode === 'currents' && (
          <svg className="ocean-svg-overlay" viewBox="0 0 1920 1080" fill="none">
            <defs>
              <linearGradient id="currentGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#5FE38A" stopOpacity="0.8" />
                <stop offset="50%" stopColor="#5BC0BE" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="currentGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#5BC0BE" stopOpacity="0.7" />
                <stop offset="100%" stopColor="#5FE38A" stopOpacity="0" />
              </linearGradient>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Ocean Current Streamline curves flowing across the ocean basin */}
            <path
              d="M 680 540 Q 840 480 1020 530 T 1280 590"
              stroke="url(#currentGrad1)"
              strokeWidth="2.5"
              strokeDasharray="14 10"
              className="animate-flow-dash"
              filter="url(#glow)"
            />
            <path
              d="M 720 570 Q 880 510 1060 560 T 1320 620"
              stroke="url(#currentGrad1)"
              strokeWidth="2"
              strokeDasharray="18 12"
              className="animate-flow-dash-slow"
              opacity="0.85"
            />
            <path
              d="M 760 600 Q 920 540 1100 590 T 1360 650"
              stroke="url(#currentGrad2)"
              strokeWidth="1.8"
              strokeDasharray="12 8"
              className="animate-flow-dash-fast"
              opacity="0.7"
            />
            <path
              d="M 640 510 Q 800 450 980 500 T 1240 560"
              stroke="#5BC0BE"
              strokeWidth="1.2"
              strokeDasharray="8 14"
              className="animate-flow-dash"
              opacity="0.5"
            />

            {/* Velocity Vectors (Arrow nodes) */}
            <g className="animate-pulse-subtle">
              <circle cx="880" cy="510" r="3.5" fill="#5FE38A" />
              <line x1="880" y1="510" x2="905" y2="520" stroke="#5FE38A" strokeWidth="1.5" />
              <text x="912" y="524" fill="#5FE38A" fontSize="9" fontFamily="monospace" fontWeight="bold">
                1.42 kn → 118°
              </text>

              <circle cx="1060" cy="560" r="3.5" fill="#5BC0BE" />
              <line x1="1060" y1="560" x2="1085" y2="572" stroke="#5BC0BE" strokeWidth="1.5" />
              <text x="1092" y="576" fill="#5BC0BE" fontSize="9" fontFamily="monospace">
                1.18 kn → 125°
              </text>
            </g>
          </svg>
        )}

        {/* AIS Maritime Shipping Lanes with Active Vessels */}
        {activeOceanMode === 'ais' && (
          <svg className="ocean-svg-overlay" viewBox="0 0 1920 1080" fill="none">
            {/* Singapore TSS Eastbound & Westbound Lanes */}
            <path
              d="M 660 520 L 890 510 L 1020 540 L 1220 620"
              stroke="#5FE38A"
              strokeWidth="2.5"
              strokeDasharray="6 4"
              className="opacity-80"
            />
            <path
              d="M 670 540 L 900 530 L 1030 560 L 1230 640"
              stroke="#5BC0BE"
              strokeWidth="1.8"
              strokeDasharray="6 4"
              className="opacity-70"
            />

            {/* Vessel Nodes along the corridor */}
            <g>
              {/* VLCC Tanker */}
              <circle cx="890" cy="510" r="6" fill="#5FE38A" className="animate-ping" opacity="0.4" />
              <circle cx="890" cy="510" r="4" fill="#5FE38A" />

              {/* Chemical Tanker */}
              <circle cx="1020" cy="540" r="4.5" fill="#3B82F6" />
              <circle cx="1020" cy="540" r="8" stroke="#3B82F6" strokeWidth="1" strokeDasharray="2 2" className="animate-spin-slow" />

              {/* Suspect Tanker (Dark Fleet / Anomaly) */}
              <circle cx="780" cy="516" r="5" fill="#EF4444" className="animate-pulse" />
              <circle cx="780" cy="516" r="12" stroke="#EF4444" strokeWidth="1" strokeDasharray="3 3" />
              <text x="796" y="520" fill="#EF4444" fontSize="10" fontFamily="monospace" fontWeight="bold">
                DARK FLEET · AIS OFF
              </text>
            </g>
          </svg>
        )}

        {/* Sentinel-1 SAR Radar Swath Sweep */}
        {activeOceanMode === 'sar' && (
          <svg className="ocean-svg-overlay" viewBox="0 0 1920 1080" fill="none">
            {/* SAR Swath Polygon */}
            <polygon
              points="740,380 980,360 1180,680 940,710"
              fill="rgba(95, 227, 138, 0.08)"
              stroke="#5FE38A"
              strokeWidth="1.5"
              strokeDasharray="8 6"
              className="animate-pulse-subtle"
            />
            {/* Radar Beam Scan Line */}
            <line
              x1="860"
              y1="370"
              x2="1060"
              y2="695"
              stroke="#5FE38A"
              strokeWidth="2"
              className="animate-radar-beam"
              filter="drop-shadow(0 0 8px #5FE38A)"
            />
            <text x="750" y="405" fill="#5FE38A" fontSize="11" fontFamily="monospace" fontWeight="bold">
              SENTINEL-1C · C-BAND SAR (IW SLC)
            </text>
            <text x="750" y="420" fill="#94A3B8" fontSize="9" fontFamily="monospace">
              INCIDENCE: 38.4° · VV/VH CO-POL
            </text>
          </svg>
        )}

        {/* Bathymetry & Acoustic Sonar Grid */}
        {activeOceanMode === 'bathymetry' && (
          <svg className="ocean-svg-overlay" viewBox="0 0 1920 1080" fill="none">
            {/* Concentric Sonar Rings */}
            <circle cx="960" cy="540" r="80" stroke="#5BC0BE" strokeWidth="1" strokeDasharray="4 4" opacity="0.6" />
            <circle cx="960" cy="540" r="160" stroke="#5BC0BE" strokeWidth="1" strokeDasharray="6 6" opacity="0.4" />
            <circle cx="960" cy="540" r="260" stroke="#5BC0BE" strokeWidth="1" strokeDasharray="8 8" opacity="0.25" />
            
            {/* Sonar Depth Soundings */}
            <g fill="#5BC0BE" fontFamily="monospace" fontSize="10">
              <text x="890" y="535">-22.4 m (Shelf)</text>
              <text x="1050" y="580">-85.0 m (Passage)</text>
              <text x="1180" y="660">-1,240 m (Abyssal)</text>
            </g>
          </svg>
        )}
      </div>

      {/* 3. STICKY TOP NAVIGATION BAR */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-6 md:px-10 py-4 backdrop-blur-2xl bg-[#060B10]/75 border-b border-white/[0.08] transition-all">
        <div className="flex items-center gap-3">
          {/* Orbital Radar Mark */}
          <div className="relative w-8 h-8 flex items-center justify-center shrink-0">
            <svg width="30" height="30" viewBox="0 0 28 28" fill="none">
              <circle
                cx="14"
                cy="14"
                r="11"
                stroke="#5FE38A"
                strokeWidth="1.8"
                strokeDasharray="44 12"
                className="opacity-90"
              />
              <circle cx="14" cy="14" r="5" fill="#5FE38A" />
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
            <span className="text-[19px] font-extrabold tracking-tight text-white leading-tight">
              Sagar<span className="text-[#5FE38A]">Drishti</span>
            </span>
            <div className="text-[8px] font-bold tracking-[0.2em] text-[#94A3B8] uppercase">
              MARITIME & OCEAN INTELLIGENCE
            </div>
          </div>
        </div>

        {/* Center Nav Link Capsules */}
        <div className="hidden lg:flex items-center gap-1 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.06]">
          {[
            { label: 'Overview', href: '#hero' },
            { label: 'Modules', href: '#modules' },
            { label: 'AI Engines', href: '#engines' },
            { label: 'Telemetry', href: '#telemetry' },
            { label: 'Workflow', href: '#workflow' },
          ].map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="px-3.5 py-1 text-xs text-[#CBD5E1] hover:text-white rounded-full hover:bg-white/[0.06] transition-all"
            >
              {item.label}
            </a>
          ))}
        </div>

        {/* Enter CTA */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onEnter('dashboard')}
            className="btn-sat-primary"
          >
            <span>Launch Command Center</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </header>

      {/* 4. MAIN HERO SECTION */}
      <section id="hero" className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-10 pt-10 pb-16">
        <div className="flex flex-col lg:flex-row items-start justify-between min-h-[460px] gap-8">
          {/* Left Hero Text & Search */}
          <div className="max-w-[580px] z-10 pt-2">
            {/* Eyebrow */}
            <div className="flex items-center gap-2 mb-3.5">
              <span className="w-5 h-0.5 bg-[#5FE38A] rounded-full inline-block" />
              <span className="font-mono text-[11px] font-bold tracking-[0.16em] text-[#94A3B8] uppercase">
                COPERNICUS DRIFT · SENTINEL-1 SAR · DARK FLEET AIS
              </span>
            </div>

            {/* Title */}
            <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-extrabold tracking-[-0.035em] text-white leading-[1.08] mb-4">
              Ocean Intelligence,
              <br />
              <span className="text-[#5FE38A]">Made Queryable.</span>
            </h1>

            {/* Subtitle */}
            <p className="text-[14.5px] text-[#94A3B8] leading-relaxed mb-6 max-w-[520px]">
              Sentinel-1 SAR semantic segmentation meets 10,001 real-time AIS vessel telemetry and Copernicus surface currents.
              Detect oil discharges, simulate reverse ocean drift, and unmask dark fleet polluters.
            </p>

            {/* SatQuery Search Bar */}
            <form onSubmit={handleSearchSubmit} className="home-search-bar">
              <Search size={18} className="text-[#64748B] shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Query MMSI 566780000, Singapore Strait TSS, or SAR spill coordinates…"
                className="w-full text-[14px] text-white placeholder-[#64748B] bg-transparent border-none outline-none"
              />
              <button
                type="submit"
                className="btn-sat-primary px-4 py-2 shrink-0 text-xs"
              >
                <span>Query</span>
                <ArrowRight size={12} />
              </button>
            </form>

            {/* Quick Example Query Pills */}
            <div className="flex items-center gap-2 flex-wrap pt-1 mb-6">
              <span className="text-[11px] text-[#64748B] font-medium">Try query:</span>
              {[
                'Sentinel-1 C-Band scene in Singapore Strait',
                'Prime suspect vessel attribution',
                'Backtrack discharge 8h reverse drift',
              ].map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => onEnter('dashboard')}
                  className="example-pill text-[11.5px]"
                >
                  {ex}
                </button>
              ))}
            </div>

            {/* Interactive Ocean Layer Selector Pills */}
            <div className="pt-2">
              <div className="text-[11px] font-mono uppercase tracking-wider text-[#94A3B8] mb-2 flex items-center gap-2">
                <Waves size={13} className="text-[#5FE38A]" />
                <span>Ocean Surveillance Modes</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  { id: 'currents', label: 'Ocean Currents & Drift', icon: Waves },
                  { id: 'ais', label: 'AIS Shipping Lanes', icon: Ship },
                  { id: 'sar', label: 'Sentinel-1 SAR Swaths', icon: Radar },
                  { id: 'bathymetry', label: 'Sonar Bathymetry', icon: Anchor },
                ].map((mode) => {
                  const Icon = mode.icon;
                  const isActive = activeOceanMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      onClick={() => setActiveOceanMode(mode.id as OceanMode)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-[#5FE38A]/15 text-[#5FE38A] border border-[#5FE38A]/50 shadow-[0_0_12px_rgba(95,227,138,0.2)]'
                          : 'bg-white/[0.04] text-[#94A3B8] border border-white/[0.08] hover:text-white hover:bg-white/[0.08]'
                      }`}
                    >
                      <Icon size={12} />
                      <span>{mode.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Floating Ocean Tactical HUD (Matching User Reference Image Design) */}
          <div className="w-full lg:w-auto flex flex-col items-end gap-4 z-20">
            {/* Chokepoint Selector Pills */}
            <div className="flex items-center gap-1.5 bg-[#0D1720]/80 p-1 rounded-xl border border-white/[0.08] backdrop-blur-md">
              <span className="text-[10px] font-mono text-[#94A3B8] px-2 uppercase">Surveillance Target:</span>
              {[
                { id: 'singapore', label: 'Singapore TSS' },
                { id: 'malacca', label: 'Malacca Strait' },
                { id: 'sunda', label: 'Sunda Strait' },
              ].map((hp) => (
                <button
                  key={hp.id}
                  onClick={() => setSelectedHotspot(hp.id)}
                  className={`text-[11px] font-medium px-2.5 py-1 rounded-lg transition-all ${
                    selectedHotspot === hp.id
                      ? 'bg-[#5FE38A] text-[#060B10] font-bold shadow-[0_2px_8px_rgba(95,227,138,0.3)]'
                      : 'text-[#CBD5E1] hover:text-white hover:bg-white/[0.05]'
                  }`}
                >
                  {hp.label}
                </button>
              ))}
            </div>

            {/* THE FROSTED GLASS TACTICAL OCEAN CARD */}
            <div className="ocean-tactical-card group">
              {/* Card Header with Directional Pointer Reticle */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  {/* Circular Radar Bearing Reticle */}
                  <div className="relative w-9 h-9 flex items-center justify-center rounded-full bg-[#5FE38A]/10 border border-[#5FE38A]/30">
                    {/* Compass North Ring */}
                    <div
                      className="absolute inset-0 rounded-full border border-dashed border-[#5FE38A]/40"
                      style={{ transform: `rotate(${currentHotspot.driftDeg}deg)` }}
                    />
                    {/* Directional Heading Pointer Arrow */}
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="#5FE38A"
                      className="transition-transform duration-500"
                      style={{ transform: `rotate(${currentHotspot.driftDeg}deg)` }}
                    >
                      <path d="M12 2L4 21L12 17L20 21L12 2Z" />
                    </svg>
                  </div>

                  <div>
                    <div className="text-[11px] font-mono uppercase tracking-wider text-[#94A3B8]">
                      Maritime Traffic Density
                    </div>
                    <div className="text-[13px] font-bold text-white truncate max-w-[200px]">
                      {currentHotspot.name.split('·')[0]}
                    </div>
                  </div>
                </div>

                {/* Inspect Action Arrow */}
                <button
                  onClick={() => onEnter('vessels')}
                  className="p-1.5 rounded-lg bg-white/[0.06] hover:bg-[#5FE38A] hover:text-[#060B10] text-[#94A3B8] transition-all"
                  title="Inspect in AIS Fleet Track"
                >
                  <ArrowUpRight size={16} />
                </button>
              </div>

              {/* Big Percentage Metric */}
              <div className="flex items-baseline justify-between mb-3.5 pb-3 border-b border-white/[0.08]">
                <div>
                  <div className="text-3xl font-extrabold text-white tracking-tight flex items-baseline gap-1">
                    <span>{currentHotspot.trafficLoad}</span>
                    <span className="text-xs font-mono font-medium text-[#5FE38A]">LOAD</span>
                  </div>
                  <div className="text-[10.5px] text-[#94A3B8] mt-0.5">
                    {currentHotspot.tankers} tankers active in corridor
                  </div>
                </div>

                <div className="text-right">
                  <div
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold"
                    style={{
                      backgroundColor: `${currentHotspot.riskColor}20`,
                      color: currentHotspot.riskColor,
                      border: `1px solid ${currentHotspot.riskColor}50`,
                    }}
                  >
                    <AlertTriangle size={10} />
                    <span>{currentHotspot.risk}</span>
                  </div>
                  <div className="text-[9.5px] font-mono text-[#64748B] mt-1">DISCHARGE RISK</div>
                </div>
              </div>

              {/* Real Oceanographic Telemetry Grid */}
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                  <div className="text-[#64748B] text-[9.5px] flex items-center gap-1 mb-0.5">
                    <Waves size={10} className="text-[#5FE38A]" />
                    <span>SURFACE CURRENT</span>
                  </div>
                  <div className="font-bold text-white flex items-center justify-between">
                    <span>{currentHotspot.driftVel}</span>
                    <span className="text-[#5FE38A] font-normal">{currentHotspot.driftDeg}°</span>
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                  <div className="text-[#64748B] text-[9.5px] flex items-center gap-1 mb-0.5">
                    <Anchor size={10} className="text-[#5BC0BE]" />
                    <span>BATHYMETRIC DEPTH</span>
                  </div>
                  <div className="font-bold text-[#5BC0BE]">{currentHotspot.depth}</div>
                </div>

                <div className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                  <div className="text-[#64748B] text-[9.5px] flex items-center gap-1 mb-0.5">
                    <Thermometer size={10} className="text-[#F59E0B]" />
                    <span>SEA TEMP (SST)</span>
                  </div>
                  <div className="font-bold text-white">{currentHotspot.sst}</div>
                </div>

                <div className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                  <div className="text-[#64748B] text-[9.5px] flex items-center gap-1 mb-0.5">
                    <Radar size={10} className="text-[#3B82F6]" />
                    <span>SAR COVERAGE</span>
                  </div>
                  <div className="font-bold text-[#3B82F6] truncate">Sentinel-1C</div>
                </div>
              </div>

              {/* Waypoint Way-markers */}
              <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-white/[0.06] text-[10px] text-[#94A3B8]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#3B82F6] inline-block shadow-[0_0_6px_#3B82F6]" />
                  <span className="w-2 h-2 rounded-full bg-[#EF4444] inline-block shadow-[0_0_6px_#EF4444]" />
                  <span className="w-2 h-2 rounded-full bg-[#F59E0B] inline-block shadow-[0_0_6px_#F59E0B]" />
                  <span className="w-2 h-2 rounded-full bg-[#5FE38A] inline-block shadow-[0_0_6px_#5FE38A]" />
                  <span className="ml-1 text-[9.5px] font-mono">4 SENSOR NODES</span>
                </div>
                <span className="font-mono text-[#5FE38A] text-[9.5px]">{currentHotspot.coords}</span>
              </div>
            </div>

            {/* Bottom Realtime Marine Reticle Coordinates */}
            <div className="flex items-center gap-3">
              <div className="reticle-icon">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#5FE38A" strokeWidth="1.6">
                  <circle cx="12" cy="12" r="7" strokeDasharray="3 3" />
                  <line x1="12" y1="2" x2="12" y2="6" />
                  <line x1="12" y1="18" x2="12" y2="22" />
                  <line x1="2" y1="12" x2="6" y2="12" />
                  <line x1="18" y1="12" x2="22" y2="12" />
                </svg>
              </div>
              <div className="reticle-coords">
                <span className="font-mono text-xs font-bold text-[#5FE38A]">{currentHotspot.latDMS}</span>
                <span className="font-mono text-xs text-[#5FE38A]/70">{currentHotspot.lonDMS}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll Indicator Prompt */}
        <div className="flex justify-center mt-6">
          <a
            href="#modules"
            className="flex flex-col items-center gap-1.5 text-xs text-[#94A3B8] hover:text-[#5FE38A] transition-colors py-2 px-4 rounded-full bg-white/[0.02] border border-white/[0.06] backdrop-blur-md"
          >
            <span className="font-mono text-[10px] uppercase tracking-widest">Explore Ocean Intelligence Modules</span>
            <ChevronDown size={14} className="animate-bounce text-[#5FE38A]" />
          </a>
        </div>
      </section>

      {/* 5. SATQUERY 5-CARD HORIZONTAL MODULE TILES (SECTION #MODULES) */}
      <section id="modules" className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-10 py-12 border-t border-white/[0.06]">
        <div className="flex items-end justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-4 h-0.5 bg-[#5FE38A] rounded-full inline-block" />
              <span className="font-mono text-[10px] font-bold tracking-[0.2em] text-[#94A3B8] uppercase">
                INTEGRATED SUITE
              </span>
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              Operational Command Modules
            </h2>
          </div>
          <button
            onClick={() => onEnter('dashboard')}
            className="hidden sm:flex items-center gap-2 text-xs font-medium text-[#5FE38A] hover:underline"
          >
            <span>Open All in Command Deck</span>
            <ArrowRight size={13} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 mb-8" aria-label="Feature modules">
          {featureCards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.id}
                onClick={() => onEnter(card.page)}
                style={{ backgroundImage: `url(${card.img})` }}
                className="module-card-tile group text-left cursor-pointer focus:outline-none"
              >
                <div className="module-card-overlay" />
                <div className="module-card-text">
                  <div className="flex items-center gap-1.5 mb-1 text-[#5FE38A]">
                    <Icon size={14} />
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider">
                      MODULE
                    </span>
                  </div>
                  <h3 className="group-hover:text-[#5FE38A] transition-colors">
                    {card.title}
                  </h3>
                  <p>{card.desc}</p>
                </div>
                <div className="module-card-arrow group-hover:scale-110">
                  <ArrowRight size={14} />
                </div>
              </button>
            );
          })}
        </div>

        {/* Oceanographic Stats Summary Ribbon */}
        <div className="flex flex-wrap items-center justify-between gap-6 p-6 rounded-2xl bg-[#09121C]/80 border border-white/[0.08] backdrop-blur-xl shadow-2xl">
          <div className="flex items-center gap-6 flex-wrap">
            <div className="stat-col">
              <strong>10,001</strong>
              <span>AIS Ships Tracked</span>
            </div>
            <div className="stat-divider" />
            <div className="stat-col">
              <strong className="stat-accent">1.42 kn</strong>
              <span>Copernicus Drift</span>
            </div>
            <div className="stat-divider" />
            <div className="stat-col">
              <strong className="text-[#5BC0BE]">C-Band</strong>
              <span>Sentinel-1 SAR Radar</span>
            </div>
            <div className="stat-divider" />
            <div className="stat-col">
              <strong className="text-[#F59E0B]">28.6°C</strong>
              <span>Sea Surface Temp</span>
            </div>
            <div className="stat-divider" />
            <div className="stat-col">
              <strong>&lt; 2.0s</strong>
              <span>Inference Latency</span>
            </div>
          </div>

          <button
            onClick={() => onEnter('dashboard')}
            className="btn-sat-ghost text-xs"
          >
            <span>Enter Realtime Command Deck</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </section>

      {/* 6. DEEP DIVE: THREE CORE OCEANIC SURVEILLANCE ENGINES (SECTION #ENGINES) */}
      <section id="engines" className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-10 py-16 border-t border-white/[0.06]">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#5FE38A]/10 border border-[#5FE38A]/30 text-[#5FE38A] text-xs font-mono uppercase tracking-wider mb-3">
            <Cpu size={13} />
            <span>Multi-Sensor Sensor Fusion</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight mb-4">
            How SagarDrishti Detects & Attributes Marine Discharges
          </h2>
          <p className="text-sm md:text-base text-[#94A3B8] leading-relaxed">
            Combining orbital radar physics with hydrodynamic Lagrangian simulations and AIS kinematic anomaly detection to generate court-ready evidence dossiers.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Engine 1: SAR Neural Segmentation */}
          <div className="p-6 md:p-8 rounded-2xl bg-[#09121C]/80 border border-white/[0.08] backdrop-blur-xl hover:border-[#5FE38A]/40 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-[#5FE38A]/10 border border-[#5FE38A]/30 flex items-center justify-center text-[#5FE38A] mb-5 group-hover:scale-105 transition-transform">
              <Radar size={24} />
            </div>
            <div className="text-[11px] font-mono text-[#5FE38A] uppercase tracking-wider mb-1">
              ENGINE 01 · RADAR PHYSICS
            </div>
            <h3 className="text-xl font-bold text-white mb-3">
              Sentinel-1 SAR C-Band Neural Segmentation
            </h3>
            <p className="text-sm text-[#94A3B8] leading-relaxed mb-5">
              PyTorch U-Net++ with ResNet-34 encoder analyzes 5.405 GHz dual-polarization (VV/VH) radar backscatter damping. Differentiates genuine mineral crude oil from biogenic lookalikes with 94.2% precision.
            </p>
            <div className="pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs font-mono text-[#CBD5E1]">
              <span>Inference Time</span>
              <span className="text-[#5FE38A] font-bold">380 ms / tile</span>
            </div>
          </div>

          {/* Engine 2: Copernicus Reverse Trajectory */}
          <div className="p-6 md:p-8 rounded-2xl bg-[#09121C]/80 border border-white/[0.08] backdrop-blur-xl hover:border-[#5BC0BE]/40 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-[#5BC0BE]/10 border border-[#5BC0BE]/30 flex items-center justify-center text-[#5BC0BE] mb-5 group-hover:scale-105 transition-transform">
              <Waves size={24} />
            </div>
            <div className="text-[11px] font-mono text-[#5BC0BE] uppercase tracking-wider mb-1">
              ENGINE 02 · HYDRODYNAMICS
            </div>
            <h3 className="text-xl font-bold text-white mb-3">
              Copernicus 4D Reverse Drift Backtracking
            </h3>
            <p className="text-sm text-[#94A3B8] leading-relaxed mb-5">
              Lagrangian particle advection simulates ocean currents, Stokes wave drift, and 3% Ekman windage backward in time up to 72 hours. Pinpoints the spatio-temporal cone where the discharge occurred.
            </p>
            <div className="pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs font-mono text-[#CBD5E1]">
              <span>Model Integration</span>
              <span className="text-[#5BC0BE] font-bold">CMEMS Global 0.083°</span>
            </div>
          </div>

          {/* Engine 3: Dark Fleet & AIS Telemetry */}
          <div className="p-6 md:p-8 rounded-2xl bg-[#09121C]/80 border border-white/[0.08] backdrop-blur-xl hover:border-[#F59E0B]/40 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/30 flex items-center justify-center text-[#F59E0B] mb-5 group-hover:scale-105 transition-transform">
              <Radio size={24} />
            </div>
            <div className="text-[11px] font-mono text-[#F59E0B] uppercase tracking-wider mb-1">
              ENGINE 03 · KINEMATICS
            </div>
            <h3 className="text-xl font-bold text-white mb-3">
              Dark Fleet Kinematics & AIS Anomaly Scoring
            </h3>
            <p className="text-sm text-[#94A3B8] leading-relaxed mb-5">
              Scans 10,001+ commercial vessel tracks for transponder blackouts, mid-ocean loitering, draught change anomalies (illegal ship-to-ship transfers), and cross-matches historical trajectory cones.
            </p>
            <div className="pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs font-mono text-[#CBD5E1]">
              <span>Fleet Telemetry</span>
              <span className="text-[#F59E0B] font-bold">10,001 Active MMSIs</span>
            </div>
          </div>
        </div>
      </section>

      {/* 7. LIVE MARITIME CHOKEPOINT TELEMETRY MATRIX (SECTION #TELEMETRY) */}
      <section id="telemetry" className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-10 py-16 border-t border-white/[0.06]">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-4 h-0.5 bg-[#5FE38A] rounded-full inline-block" />
              <span className="font-mono text-[10px] font-bold tracking-[0.2em] text-[#94A3B8] uppercase">
                GLOBAL CHOKEPOINTS
              </span>
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              Live Oceanic Surveillance Corridors
            </h2>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-[#94A3B8]">
            <span className="w-2 h-2 rounded-full bg-[#5FE38A] animate-pulse" />
            <span>TELEMETRY INGESTION ACTIVE · REFRESH 5s</span>
          </div>
        </div>

        {/* Chokepoint Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            {
              corridor: 'Singapore Strait TSS',
              sub: 'Traffic Separation Scheme',
              coords: "01° 15' N, 103° 48' E",
              drift: '1.42 kn @ 118° ESE',
              depth: '-24.5 m (Shelf)',
              tankers: 412,
              status: 'CRITICAL ATTENTION',
              statusColor: 'text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/30',
              pass: 'Sentinel-1C in 14m',
            },
            {
              corridor: 'Strait of Malacca',
              sub: 'One Fathom Bank Chokepoint',
              coords: "02° 53' N, 101° 00' E",
              drift: '1.85 kn @ 305° NW',
              depth: '-38.0 m (Channel)',
              tankers: 588,
              status: 'ELEVATED SURVEILLANCE',
              statusColor: 'text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/30',
              pass: 'Sentinel-1A ingested',
            },
            {
              corridor: 'Sunda Strait',
              sub: 'Java Sea to Indian Ocean',
              coords: "05° 55' S, 105° 53' E",
              drift: '2.10 kn @ 195° SSW',
              depth: '-120 m (Deep Trench)',
              tankers: 176,
              status: 'NOMINAL FLOW',
              statusColor: 'text-[#5FE38A] bg-[#5FE38A]/10 border-[#5FE38A]/30',
              pass: 'Sentinel-1B in 2h 40m',
            },
            {
              corridor: 'Bab-el-Mandeb & Red Sea',
              sub: 'Gulf of Aden Transit',
              coords: "12° 35' N, 043° 20' E",
              drift: '1.15 kn @ 045° NE',
              depth: '-185 m (Abyssal Trench)',
              tankers: 320,
              status: 'HIGH ALERT (DARK AIS)',
              statusColor: 'text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/30',
              pass: 'SAR Acquisition Ready',
            },
          ].map((item) => (
            <div
              key={item.corridor}
              className="p-5 rounded-xl bg-[#09121C]/80 border border-white/[0.08] backdrop-blur-xl hover:border-white/[0.2] transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[9.5px] font-mono font-bold px-2 py-0.5 rounded-full border ${item.statusColor}`}>
                    {item.status}
                  </span>
                  <span className="text-[10px] font-mono text-[#64748B]">{item.pass}</span>
                </div>
                <h4 className="text-base font-bold text-white mb-0.5">{item.corridor}</h4>
                <div className="text-[11px] text-[#94A3B8] mb-4">{item.sub}</div>

                <div className="space-y-2 text-xs font-mono mb-4">
                  <div className="flex justify-between text-[#94A3B8] border-b border-white/[0.04] pb-1.5">
                    <span>Coordinates</span>
                    <span className="text-[#CBD5E1]">{item.coords}</span>
                  </div>
                  <div className="flex justify-between text-[#94A3B8] border-b border-white/[0.04] pb-1.5">
                    <span>Surface Drift</span>
                    <span className="text-[#5FE38A] font-bold">{item.drift}</span>
                  </div>
                  <div className="flex justify-between text-[#94A3B8] border-b border-white/[0.04] pb-1.5">
                    <span>Depth Clearance</span>
                    <span className="text-[#5BC0BE]">{item.depth}</span>
                  </div>
                  <div className="flex justify-between text-[#94A3B8]">
                    <span>Active Tankers</span>
                    <span className="text-white font-bold">{item.tankers}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => onEnter('vessels')}
                className="w-full py-2 px-3 rounded-lg bg-white/[0.04] hover:bg-[#5FE38A] hover:text-[#060B10] text-[#CBD5E1] text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
              >
                <span>Track Corridor Fleet</span>
                <ArrowRight size={12} />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* 8. OPERATIONAL WORKFLOW: FROM SAR INGESTION TO LEGAL EVIDENCE (SECTION #WORKFLOW) */}
      <section id="workflow" className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-10 py-16 border-t border-white/[0.06]">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#5BC0BE]/10 border border-[#5BC0BE]/30 text-[#5BC0BE] text-xs font-mono uppercase tracking-wider mb-3">
            <FileCheck2 size={13} />
            <span>Evidence Pipeline</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight mb-3">
            5-Stage Attribution Workflow
          </h2>
          <p className="text-sm text-[#94A3B8]">
            Automated intelligence pipeline transforming raw satellite telemetry into legally binding maritime enforcement dossiers.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {[
            {
              step: '01',
              title: 'Satellite Ingest',
              desc: 'Automated retrieval of Sentinel-1 C-Band SAR GRD / SLC granules via Copernicus Open Access API.',
              icon: Radar,
            },
            {
              step: '02',
              title: 'Neural Mask',
              desc: 'PyTorch U-Net++ infers pixel-level discharge contours with dB backscatter contrast calculation.',
              icon: ScanEye,
            },
            {
              step: '03',
              title: 'Drift Backtrack',
              desc: 'Lagrangian 4D particle advection simulates reverse current vectors to identify the release time-window.',
              icon: Waves,
            },
            {
              step: '04',
              title: 'AIS Attribution',
              desc: 'Intersects reverse drift cone with historical trajectory logs across 10,001 vessels to isolate prime suspect.',
              icon: Radio,
            },
            {
              step: '05',
              title: 'Court Dossier',
              desc: 'Exports cryptographic evidence packet containing timestamped imagery, MMSI data, and trajectory proofs.',
              icon: FileCheck2,
            },
          ].map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={item.step}
                className="relative p-5 rounded-xl bg-[#09121C]/80 border border-white/[0.08] backdrop-blur-xl flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-2xl font-black font-mono text-[#5FE38A]/60">
                      {item.step}
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center text-[#5FE38A]">
                      <Icon size={16} />
                    </div>
                  </div>
                  <h4 className="text-base font-bold text-white mb-2">{item.title}</h4>
                  <p className="text-xs text-[#94A3B8] leading-relaxed">{item.desc}</p>
                </div>
                {idx < 4 && (
                  <div className="hidden lg:block absolute -right-2.5 top-1/2 -translate-y-1/2 z-20 text-[#5FE38A]">
                    <ChevronRight size={16} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 9. BOTTOM COMMAND CENTER LAUNCH BANNER & FOOTER */}
      <section className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-10 py-16 border-t border-white/[0.06]">
        <div className="p-8 md:p-12 rounded-3xl bg-gradient-to-br from-[#0D1720] via-[#09121C] to-[#060B10] border border-[#5FE38A]/30 shadow-[0_0_50px_rgba(95,227,138,0.12)] flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="max-w-2xl text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#5FE38A]/10 border border-[#5FE38A]/30 text-[#5FE38A] text-xs font-mono uppercase tracking-wider mb-4">
              <Shield size={13} />
              <span>Operational Status: Ready</span>
            </div>
            <h3 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight mb-3">
              Ready to Monitor the High Seas?
            </h3>
            <p className="text-sm md:text-base text-[#94A3B8] leading-relaxed">
              Launch SagarDrishti to access live Sentinel-1 SAR telemetry, track 10,001 commercial vessels, and initiate reverse drift trajectory simulations.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
            <button
              onClick={() => onEnter('dashboard')}
              className="btn-sat-primary px-6 py-3.5 text-sm font-bold flex items-center gap-2"
            >
              <span>Launch Command Center</span>
              <ArrowRight size={16} />
            </button>
            <button
              onClick={() => onEnter('spill-detection')}
              className="btn-sat-ghost px-5 py-3.5 text-xs font-semibold"
            >
              <span>Inspect SAR Inference AI</span>
            </button>
          </div>
        </div>

        {/* Tactical Footer */}
        <footer className="flex flex-col md:flex-row items-center justify-between pt-12 pb-6 text-xs text-[#64748B] gap-4">
          <div className="flex items-center gap-3">
            <span className="font-bold text-white tracking-tight">SagarDrishti</span>
            <span>·</span>
            <span>Maritime & Ocean Intelligence System</span>
            <span>·</span>
            <span className="text-[#5FE38A] font-mono">v2.4.0-PROD</span>
          </div>

          <div className="flex items-center gap-6">
            <a href="#hero" className="hover:text-white transition-colors">Back to Top ↑</a>
            <button onClick={() => onEnter('dashboard')} className="hover:text-white transition-colors">Command Center</button>
            <button onClick={() => onEnter('vessels')} className="hover:text-white transition-colors">AIS Fleet Track</button>
            <button onClick={() => onEnter('spill-detection')} className="hover:text-white transition-colors">SAR AI Analysis</button>
          </div>
        </footer>
      </section>
    </div>
  );
}
