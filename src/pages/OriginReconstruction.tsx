import { Panel, PanelHeader } from '@/components/Panel';
import { Badge } from '@/components/Badge';
import { Crosshair, MapPin, Clock, Navigation } from 'lucide-react';

export function OriginReconstruction() {
  const steps = [
    { label: 'Satellite Detection', time: 'T+0h', desc: 'Oil slick identified in Sentinel-1 SAR imagery', color: '#FF4444' },
    { label: 'Drift Modeling', time: 'T-2h', desc: 'Reverse drift simulation using Copernicus currents', color: '#FFA500' },
    { label: 'Wind Correction', time: 'T-4h', desc: 'ERA5 wind forcing applied to backtrack trajectory', color: '#A855F7' },
    { label: 'Origin Zone', time: 'T-6h', desc: '0.07° radius zone established — 3 vessels in proximity', color: '#FFD700' },
    { label: 'Vessel Matching', time: 'T-6h', desc: 'Prime suspect identified via attribution model', color: '#00D4FF' },
  ];

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="glass-panel overflow-hidden">
          <PanelHeader
            title="Origin Reconstruction"
            right={<Badge color="gold"><Crosshair size={10} /> BACKTRACKING</Badge>}
          />
          <div className="p-6">
            {/* Origin zone visualization */}
            <div className="relative h-64 glass-panel rounded-lg overflow-hidden mb-6">
              <svg className="w-full h-full" viewBox="0 0 600 260">
                {/* Grid */}
                {Array.from({ length: 15 }).map((_, i) => (
                  <line key={`v${i}`} x1={i * 40} y1={0} x2={i * 40} y2={260} stroke="rgba(0,212,255,0.05)" />
                ))}
                {Array.from({ length: 7 }).map((_, i) => (
                  <line key={`h${i}`} x1={0} y1={i * 40} x2={600} y2={i * 40} stroke="rgba(0,212,255,0.05)" />
                ))}

                {/* Backward trajectory */}
                <path
                  d="M 500 80 Q 380 100 280 140 T 120 180"
                  fill="none"
                  stroke="#FFD700"
                  strokeWidth="2"
                  strokeDasharray="6 4"
                >
                  <animate attributeName="stroke-dashoffset" from="0" to="-20" dur="1s" repeatCount="indefinite" />
                </path>

                {/* Current spill position */}
                <circle cx="500" cy="80" r="6" fill="#FF4444" />
                <circle cx="500" cy="80" r="12" fill="none" stroke="#FF4444" strokeWidth="1" opacity="0.4">
                  <animate attributeName="r" from="6" to="18" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" from="0.6" to="0" dur="2s" repeatCount="indefinite" />
                </circle>
                <text x="510" y="76" fill="#FF4444" fontSize="10" fontWeight="600">SPILL (T+0h)</text>

                {/* Origin zone */}
                <circle cx="120" cy="180" r="30" fill="rgba(255,215,0,0.06)" stroke="#FFD700" strokeWidth="1.5" strokeDasharray="3 3" />
                <circle cx="120" cy="180" r="5" fill="#FFD700" />
                <text x="135" y="184" fill="#FFD700" fontSize="10" fontWeight="600">ORIGIN ZONE</text>

                {/* Vessel positions at origin */}
                <circle cx="110" cy="175" r="3" fill="#FFD700" />
                <text x="100" y="165" fill="#FFD700" fontSize="8">SUSPECT #1</text>
                <circle cx="130" cy="185" r="2.5" fill="#FF4444" />
                <text x="138" y="200" fill="#FF4444" fontSize="8">SUSPECT #2</text>
                <circle cx="115" cy="195" r="2.5" fill="#FF4444" />
                <text x="100" y="210" fill="#FF4444" fontSize="8">SUSPECT #3</text>

                {/* Labels */}
                <text x="300" y="30" fill="rgba(136,153,170,0.5)" fontSize="9" textAnchor="middle">REVERSE DRIFT TRAJECTORY</text>
              </svg>
            </div>

            {/* Steps */}
            <div className="space-y-3">
              {steps.map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center border shrink-0"
                      style={{ borderColor: step.color, backgroundColor: step.color + '15' }}
                    >
                      {i === 0 && <MapPin size={14} style={{ color: step.color }} />}
                      {i === 1 && <Navigation size={14} style={{ color: step.color }} />}
                      {i === 2 && <Clock size={14} style={{ color: step.color }} />}
                      {i === 3 && <Crosshair size={14} style={{ color: step.color }} />}
                      {i === 4 && <MapPin size={14} style={{ color: step.color }} />}
                    </div>
                    {i < steps.length - 1 && <div className="w-px h-8 bg-cyan-dim mt-1" />}
                  </div>
                  <div className="pb-4 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">{step.label}</span>
                      <span className="metric-value text-[0.625rem] text-muted">{step.time}</span>
                    </div>
                    <div className="text-xs text-muted mt-0.5">{step.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="w-72 shrink-0 p-4 pl-0 space-y-3">
        <div className="glass-panel p-4 space-y-2">
          <span className="section-label">Origin Coordinates</span>
          <div className="metric-value text-sm text-[#FFD700]">1.2643°N, 103.8401°E</div>
          <div className="text-xs text-muted">Singapore Strait — shipping lane 3</div>
        </div>
        <div className="glass-panel p-4 space-y-2">
          <span className="section-label">Backtrack Duration</span>
          <div className="metric-value text-2xl text-white">6h 14m</div>
          <div className="text-xs text-muted">From detection to estimated origin</div>
        </div>
        <div className="glass-panel p-4 space-y-2">
          <span className="section-label">Vessels in Zone</span>
          <div className="metric-value text-2xl text-[#FF4444]">3</div>
          <div className="text-xs text-muted">Within 0.07° radius at origin time</div>
        </div>
        <div className="glass-panel p-4 space-y-2">
          <span className="section-label">Model Confidence</span>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-[rgba(0,212,255,0.08)] rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#FFA500] to-[#FFD700] rounded-full" style={{ width: '92%' }} />
            </div>
            <span className="metric-value text-sm text-[#FFD700]">92%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
