import { useEffect, useRef, useState, useMemo } from 'react';
import { Badge } from '@/components/Badge';
import { Panel, PanelHeader } from '@/components/Panel';
import { StatusDot } from '@/components/StatusDot';
import {
  TrendingUp,
  AlertTriangle,
  Clock,
  Play,
  Pause,
  RotateCcw,
  Wind,
  Waves,
  ShieldAlert,
  Navigation,
  MapPin,
  Sliders,
} from 'lucide-react';

const FORECAST_TIMES = [
  { label: '+6h', value: 6 },
  { label: '+12h', value: 12 },
  { label: '+24h', value: 24 },
  { label: '+48h', value: 48 },
  { label: '+72h', value: 72 },
];

interface CoastalRisk {
  name: string;
  type: string;
  distKm: number;
  baseEtaHours: number;
  color: string;
  xRatio: number;
  yRatio: number;
}

const BASE_COASTAL_RISKS: CoastalRisk[] = [
  {
    name: 'Sentosa & Southern Islands Reef',
    type: 'Coral & Marine Reserve',
    distKm: 14.5,
    baseEtaHours: 18,
    color: '#FF4444',
    xRatio: 0.72,
    yRatio: 0.28,
  },
  {
    name: 'Jurong Petrochemical Bunkering',
    type: 'Critical Maritime Infrastructure',
    distKm: 22.0,
    baseEtaHours: 28,
    color: '#FF8C00',
    xRatio: 0.82,
    yRatio: 0.52,
  },
  {
    name: 'Riau Coastal Mangrove Habitat',
    type: 'Protected Ecological Zone',
    distKm: 34.0,
    baseEtaHours: 44,
    color: '#FFD700',
    xRatio: 0.58,
    yRatio: 0.84,
  },
];

interface ForecastMapProps {
  selectedTime: number;
  windSpeed: number;
  currentSpeed: number;
  spillVolume: number;
  driftDistanceKm: number;
  spreadAreaKm2: number;
}

function ForecastMap({
  selectedTime,
  windSpeed,
  currentSpeed,
  spillVolume,
  driftDistanceKm,
  spreadAreaKm2,
}: ForecastMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let frame = 0;

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      // Deep Ocean Background
      const oceanGrad = ctx.createLinearGradient(0, 0, w, h);
      oceanGrad.addColorStop(0, '#06101E');
      oceanGrad.addColorStop(1, '#0A182E');
      ctx.fillStyle = oceanGrad;
      ctx.fillRect(0, 0, w, h);

      // Hydrodynamic Tactical Grid
      ctx.strokeStyle = 'rgba(0, 212, 255, 0.06)';
      ctx.lineWidth = 1;
      const gridSize = 45;
      for (let x = 0; x < w; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Coastline & Islands Geometry (Singapore Strait Archetype)
      ctx.fillStyle = 'rgba(18, 38, 62, 0.85)';
      ctx.strokeStyle = 'rgba(0, 212, 255, 0.3)';
      ctx.lineWidth = 1.5;

      // Northern Mainland Coast
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(w, 0);
      ctx.lineTo(w, h * 0.22);
      ctx.bezierCurveTo(w * 0.85, h * 0.25, w * 0.7, h * 0.16, w * 0.5, h * 0.2);
      ctx.bezierCurveTo(w * 0.35, h * 0.24, w * 0.2, h * 0.15, 0, h * 0.24);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Southern Island Chain
      ctx.beginPath();
      ctx.ellipse(w * 0.65, h * 0.82, w * 0.16, h * 0.08, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.ellipse(w * 0.28, h * 0.78, w * 0.12, h * 0.06, 0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Shipping TSS Channel lines
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.15)';
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(0, h * 0.48);
      ctx.lineTo(w, h * 0.44);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, h * 0.56);
      ctx.lineTo(w, h * 0.52);
      ctx.stroke();
      ctx.setLineDash([]);

      // --- SPILL ORIGIN & ADVANCING SLICK ---
      const originX = w * 0.25;
      const originY = h * 0.50;

      // Drift Vector Scaling (exact mapping to km distance on map)
      // Map scale: total width ~ 60 km
      const kmToPixels = w / 55;
      const driftAngleRad = 15 * (Math.PI / 180); // East-Southeast drift
      const currentDriftPx = driftDistanceKm * kmToPixels;
      const targetX = originX + currentDriftPx * Math.cos(driftAngleRad);
      const targetY = originY + currentDriftPx * Math.sin(driftAngleRad);

      // Fay Physical Spreading Radius (km -> px)
      const baseRadiusPx = Math.sqrt(spreadAreaKm2 / Math.PI) * kmToPixels * 1.6;
      const pulse = Math.sin(frame * 0.03) * 2;

      // 1. Historical Trajectory Trail & Step Milestones
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.4)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      ctx.lineTo(targetX, targetY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Waypoint Markers along the trajectory
      const steps = [0.25, 0.5, 0.75, 1.0];
      steps.forEach((ratio) => {
        const stepX = originX + (targetX - originX) * ratio;
        const stepY = originY + (targetY - originY) * ratio;
        const stepDist = (driftDistanceKm * ratio).toFixed(1);
        const stepTime = Math.round(selectedTime * ratio);

        ctx.fillStyle = ratio === 1.0 ? '#FF4444' : '#FFD700';
        ctx.beginPath();
        ctx.arc(stepX, stepY, ratio === 1.0 ? 5 : 3, 0, Math.PI * 2);
        ctx.fill();

        if (ratio === 1.0 || (ratio === 0.5 && selectedTime >= 24)) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
          ctx.font = '10px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`+${stepTime}h (${stepDist} km)`, stepX, stepY - 10);
        }
      });

      // 2. Multi-Layer Volumetric Oil Slick Dispersion
      // Outer Dispersion Plume
      const outerGrad = ctx.createRadialGradient(
        targetX,
        targetY,
        0,
        targetX,
        targetY,
        baseRadiusPx * 1.8 + pulse
      );
      outerGrad.addColorStop(0, 'rgba(255, 68, 68, 0.45)');
      outerGrad.addColorStop(0.4, 'rgba(255, 120, 50, 0.25)');
      outerGrad.addColorStop(0.8, 'rgba(255, 180, 0, 0.10)');
      outerGrad.addColorStop(1, 'transparent');

      ctx.fillStyle = outerGrad;
      ctx.beginPath();
      // Ellipse elongated along drift heading
      ctx.ellipse(
        targetX,
        targetY,
        baseRadiusPx * 1.8 + pulse,
        baseRadiusPx * 1.1 + pulse * 0.6,
        driftAngleRad,
        0,
        Math.PI * 2
      );
      ctx.fill();

      // Heavy Core Slick
      const coreGrad = ctx.createRadialGradient(
        targetX,
        targetY,
        0,
        targetX,
        targetY,
        baseRadiusPx * 0.9
      );
      coreGrad.addColorStop(0, 'rgba(255, 40, 40, 0.85)');
      coreGrad.addColorStop(0.6, 'rgba(200, 30, 30, 0.6)');
      coreGrad.addColorStop(1, 'transparent');

      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.ellipse(
        targetX,
        targetY,
        baseRadiusPx * 0.9,
        baseRadiusPx * 0.6,
        driftAngleRad,
        0,
        Math.PI * 2
      );
      ctx.fill();

      // Dynamic Surface Particles
      const particleCount = Math.min(60, Math.floor(spreadAreaKm2 * 1.5) + 15);
      ctx.fillStyle = '#FFDD55';
      for (let p = 0; p < particleCount; p++) {
        const pAngle = (p / particleCount) * Math.PI * 2 + frame * 0.01;
        const pDist = Math.random() * (baseRadiusPx * 1.3);
        const px = targetX + Math.cos(pAngle) * pDist;
        const py = targetY + Math.sin(pAngle) * (pDist * 0.65);
        ctx.globalAlpha = 0.35 + Math.sin(frame * 0.05 + p) * 0.25;
        ctx.beginPath();
        ctx.arc(px, py, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;

      // 3. Origin Anchor Pin
      ctx.fillStyle = '#00D4FF';
      ctx.beginPath();
      ctx.arc(originX, originY, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#00D4FF';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('T+0h Origin', originX + 8, originY + 4);

      // 4. Coastal Vulnerability Zones & Live Distance Lines
      BASE_COASTAL_RISKS.forEach((risk) => {
        const rx = w * risk.xRatio;
        const ry = h * risk.yRatio;

        // Current distance from advancing slick to this coastal zone
        const distFromSlickPx = Math.hypot(rx - targetX, ry - targetY);
        const distFromSlickKm = Math.max(0.8, distFromSlickPx / kmToPixels);

        // Pulsing Risk Ring
        const ringPulse = Math.sin(frame * 0.04 + risk.xRatio * 5) * 3;
        ctx.strokeStyle = risk.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(rx, ry, 10 + ringPulse, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = risk.color;
        ctx.beginPath();
        ctx.arc(rx, ry, 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Distance proximity dotted guide line if approaching
        if (distFromSlickKm < 25) {
          ctx.strokeStyle = risk.color;
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 4]);
          ctx.beginPath();
          ctx.moveTo(targetX, targetY);
          ctx.lineTo(rx, ry);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Label
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 10px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(risk.name, rx + 12, ry - 3);

        ctx.fillStyle = risk.color;
        ctx.font = '9px Inter, sans-serif';
        const etaHours = Math.max(1, Math.round(distFromSlickKm / (currentSpeed * 1.852 + 0.5)));
        ctx.fillText(`${risk.type} • ${distFromSlickKm.toFixed(1)} km (ETA: ${etaHours}h)`, rx + 12, ry + 10);
      });

      // 5. Tactical Scale Bar in Bottom Left
      const scaleBarKm = 10;
      const scaleBarPx = scaleBarKm * kmToPixels;
      const scaleX = 20;
      const scaleY = h - 25;

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(scaleX, scaleY);
      ctx.lineTo(scaleX + scaleBarPx, scaleY);
      ctx.moveTo(scaleX, scaleY - 4);
      ctx.lineTo(scaleX, scaleY + 4);
      ctx.moveTo(scaleX + scaleBarPx, scaleY - 4);
      ctx.lineTo(scaleX + scaleBarPx, scaleY + 4);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${scaleBarKm} km Nautical Scale`, scaleX + scaleBarPx / 2, scaleY - 6);

      // 6. Current Drift Telemetry HUD Overlay (Top Right)
      ctx.fillStyle = 'rgba(10, 22, 40, 0.85)';
      ctx.strokeStyle = 'rgba(0, 212, 255, 0.3)';
      ctx.lineWidth = 1;
      const hudW = 180;
      const hudH = 65;
      const hudX = w - hudW - 15;
      const hudY = 15;
      ctx.fillRect(hudX, hudY, hudW, hudH);
      ctx.strokeRect(hudX, hudY, hudW, hudH);

      ctx.fillStyle = '#00D4FF';
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`DRIFT AT T+${selectedTime} HOURS`, hudX + 10, hudY + 18);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '9px Inter, sans-serif';
      ctx.fillText(`Net Displacement:`, hudX + 10, hudY + 34);
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(`${driftDistanceKm.toFixed(1)} km`, hudX + 115, hudY + 34);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '9px Inter, sans-serif';
      ctx.fillText(`Dispersed Area:`, hudX + 10, hudY + 50);
      ctx.fillStyle = '#FF4444';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(`${spreadAreaKm2.toFixed(1)} km²`, hudX + 115, hudY + 50);

      ctx.restore();
      frame++;
      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [selectedTime, windSpeed, currentSpeed, spillVolume, driftDistanceKm, spreadAreaKm2]);

  return <canvas ref={canvasRef} className="w-full h-full block rounded-lg" />;
}

export function FuturePrediction() {
  const [selectedTime, setSelectedTime] = useState<number>(24);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [windSpeed, setWindSpeed] = useState<number>(14.0); // knots
  const [currentSpeed, setCurrentSpeed] = useState<number>(1.4); // knots
  const [spillVolume, setSpillVolume] = useState<number>(450); // m3

  // Physics Fay Spreading & Advection Calculations
  // Total drift speed = (100% surface current + ~3% wind) in knots
  const netDriftSpeedKnots = currentSpeed + windSpeed * 0.03;
  // 1 knot = 1.852 km/h
  const driftDistanceKm = parseFloat((netDriftSpeedKnots * 1.852 * selectedTime).toFixed(1));

  // Fay Area Expansion law: Area(t) ~ A0 * (1 + k * t^0.6)
  const baseAreaKm2 = (spillVolume / 1000) * 4.5;
  const spreadAreaKm2 = parseFloat(
    (baseAreaKm2 * (1 + 0.85 * Math.pow(selectedTime, 0.72))).toFixed(1)
  );

  // Peak slick thickness in microns (decays with spreading)
  const peakThicknessMicrons = Math.max(
    12,
    Math.round((spillVolume * 1000) / (spreadAreaKm2 * 1000000 * 0.001))
  );

  // Time-lapse autoplay animation
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setSelectedTime((prev) => {
        if (prev >= 72) return 1;
        return prev + 1;
      });
    }, 400);

    return () => clearInterval(interval);
  }, [isPlaying]);

  return (
    <div className="flex h-full overflow-hidden bg-bg-base text-white">
      {/* LEFT / CENTER: Dynamic Forecast Canvas & Timeline Controls */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col">
        {/* Forecast Map Canvas Panel */}
        <div className="glass-panel overflow-hidden flex-1 min-h-[440px] flex flex-col">
          <PanelHeader
            title="72-Hour Hydrodynamic Oil Spill Forecast"
            right={
              <div className="flex items-center gap-2">
                <Badge color="warning">
                  <TrendingUp size={10} /> FAY SPREADING MODEL
                </Badge>
                <Badge color="cyan">T+{selectedTime}h ACTIVE</Badge>
              </div>
            }
          />
          <div className="flex-1 p-2 relative">
            <ForecastMap
              selectedTime={selectedTime}
              windSpeed={windSpeed}
              currentSpeed={currentSpeed}
              spillVolume={spillVolume}
              driftDistanceKm={driftDistanceKm}
              spreadAreaKm2={spreadAreaKm2}
            />
          </div>
        </div>

        {/* TIMELINE CONTROLS & CONTINUOUS TIME SLIDER */}
        <div className="glass-panel p-4 space-y-3 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="section-label text-white">Forecast Horizon</span>
              <span className="text-xs text-muted">|</span>
              <span className="metric-value text-base text-[#00D4FF] font-bold">
                T+{selectedTime} Hours ({(selectedTime / 24).toFixed(1)} Days)
              </span>
            </div>

            {/* Play / Pause Time Lapse */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsPlaying((p) => !p)}
                className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition-all ${
                  isPlaying
                    ? 'bg-[#FF4444] text-white animate-pulse'
                    : 'bg-[#00D4FF]/20 hover:bg-[#00D4FF]/30 text-[#00D4FF] border border-[#00D4FF]/40'
                }`}
              >
                {isPlaying ? <Pause size={13} /> : <Play size={13} fill="currentColor" />}
                {isPlaying ? 'Pause Time-Lapse' : 'Play Auto Forecast'}
              </button>
              <button
                onClick={() => {
                  setIsPlaying(false);
                  setSelectedTime(6);
                }}
                className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-muted hover:text-white transition-all border border-cyan-dim/30"
                title="Reset to +6h"
              >
                <RotateCcw size={13} />
              </button>
            </div>
          </div>

          {/* Continuous Range Slider */}
          <div className="space-y-1">
            <input
              type="range"
              min="1"
              max="72"
              step="1"
              value={selectedTime}
              onChange={(e) => {
                setIsPlaying(false);
                setSelectedTime(Number(e.target.value));
              }}
              className="w-full accent-[#00D4FF] h-2 bg-black/40 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[0.625rem] text-muted font-mono">
              <span>T+1h (Immediate)</span>
              <span>T+24h (1 Day)</span>
              <span>T+48h (2 Days)</span>
              <span>T+72h (3 Days)</span>
            </div>
          </div>

          {/* Quick Preset Time Buttons */}
          <div className="grid grid-cols-5 gap-2 pt-1">
            {FORECAST_TIMES.map((t) => (
              <button
                key={t.label}
                onClick={() => {
                  setIsPlaying(false);
                  setSelectedTime(t.value);
                }}
                className={`py-2 px-2 rounded-lg text-xs font-bold transition-all border ${
                  selectedTime === t.value
                    ? 'bg-[#00D4FF] text-black border-[#00D4FF] shadow-lg shadow-[#00D4FF]/20'
                    : 'bg-[rgba(10,22,40,0.6)] text-muted border-cyan-dim/30 hover:border-cyan-dim hover:text-white'
                }`}
              >
                {t.label} ({((netDriftSpeedKnots * 1.852 * t.value)).toFixed(1)} km)
              </button>
            ))}
          </div>
        </div>

        {/* METRICS ROW */}
        <div className="grid grid-cols-4 gap-3 shrink-0">
          <div className="glass-panel p-3.5 border-l-2 border-l-[#FFA500]">
            <span className="section-label block mb-1">DRIFT DISPLACEMENT</span>
            <div className="metric-value text-2xl font-bold text-[#FFA500] font-mono">
              {driftDistanceKm} <span className="text-sm">km</span>
            </div>
            <span className="text-[0.625rem] text-muted block mt-0.5">
              Speed: {(netDriftSpeedKnots * 1.852).toFixed(1)} km/h
            </span>
          </div>

          <div className="glass-panel p-3.5 border-l-2 border-l-[#FF4444]">
            <span className="section-label block mb-1">DISPERSED SLICK AREA</span>
            <div className="metric-value text-2xl font-bold text-[#FF4444] font-mono">
              {spreadAreaKm2} <span className="text-sm">km²</span>
            </div>
            <span className="text-[0.625rem] text-muted block mt-0.5">
              Radius: ~{Math.sqrt(spreadAreaKm2 / Math.PI).toFixed(1)} km
            </span>
          </div>

          <div className="glass-panel p-3.5 border-l-2 border-l-[#00D4FF]">
            <span className="section-label block mb-1">CORE THICKNESS</span>
            <div className="metric-value text-2xl font-bold text-[#00D4FF] font-mono">
              {peakThicknessMicrons} <span className="text-sm">µm</span>
            </div>
            <span className="text-[0.625rem] text-muted block mt-0.5">
              {peakThicknessMicrons > 50 ? 'Heavy Crude Emulsion' : 'Thin Sheen & Plume'}
            </span>
          </div>

          <div className="glass-panel p-3.5 border-l-2 border-l-[#FFD700]">
            <span className="section-label block mb-1">FIRST SHORELINE ETA</span>
            <div className="metric-value text-2xl font-bold text-[#FFD700] font-mono">
              {selectedTime >= 18 ? 'IMPACT' : `${18 - selectedTime}h`}
            </div>
            <span className="text-[0.625rem] text-muted block mt-0.5">
              {selectedTime >= 18 ? 'Active Shoreline Threat' : 'Time to deploy booms'}
            </span>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: Metocean Forcing Sliders & Dynamic Coastal Impact Assessment */}
      <div className="w-84 shrink-0 p-4 pl-0 overflow-y-auto space-y-4 flex flex-col">
        {/* Metocean Forcing Controls */}
        <div className="glass-panel p-4 space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="section-label flex items-center gap-1.5 text-white">
              <Sliders size={13} className="text-[#00D4FF]" /> Hydrodynamic Forcing
            </span>
            <Badge color="cyan">LIVE FORCING</Badge>
          </div>

          {/* Wind Speed */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-1.5 text-muted">
                <Wind size={12} className="text-[#00E5FF]" /> ERA5 Wind Velocity
              </label>
              <span className="metric-value text-[#00E5FF] font-mono font-bold">{windSpeed} kn</span>
            </div>
            <input
              type="range"
              min="0"
              max="35"
              step="1"
              value={windSpeed}
              onChange={(e) => setWindSpeed(Number(e.target.value))}
              className="w-full accent-[#00E5FF]"
            />
          </div>

          {/* Surface Current Speed */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-1.5 text-muted">
                <Waves size={12} className="text-[#38EF7D]" /> Copernicus Current
              </label>
              <span className="metric-value text-[#38EF7D] font-mono font-bold">{currentSpeed} kn</span>
            </div>
            <input
              type="range"
              min="0"
              max="5"
              step="0.1"
              value={currentSpeed}
              onChange={(e) => setCurrentSpeed(Number(e.target.value))}
              className="w-full accent-[#38EF7D]"
            />
          </div>

          {/* Initial Spill Volume */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-1.5 text-muted">
                <ShieldAlert size={12} className="text-[#FF4444]" /> Discharge Volume
              </label>
              <span className="metric-value text-[#FF4444] font-mono font-bold">{spillVolume} m³</span>
            </div>
            <input
              type="range"
              min="50"
              max="2000"
              step="25"
              value={spillVolume}
              onChange={(e) => setSpillVolume(Number(e.target.value))}
              className="w-full accent-[#FF4444]"
            />
          </div>
        </div>

        {/* Coastal Vulnerability Leaderboard */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="section-label flex items-center gap-1.5 text-white">
              <AlertTriangle size={13} className="text-[#FFD700]" /> Coastal Risk Telemetry
            </span>
            <span className="text-[0.625rem] text-muted font-mono">T+{selectedTime}h</span>
          </div>

          {BASE_COASTAL_RISKS.map((risk) => {
            // Calculate remaining distance in km as slick drifts forward
            const remainingKm = Math.max(0, parseFloat((risk.distKm - driftDistanceKm * 0.75).toFixed(1)));
            const isImpacted = remainingKm <= 1.0;
            const etaHours = isImpacted ? 0 : Math.max(1, Math.round(remainingKm / (netDriftSpeedKnots * 1.852)));

            return (
              <div
                key={risk.name}
                className={`glass-panel p-3.5 space-y-2 border transition-all ${
                  isImpacted
                    ? 'border-[#FF4444] bg-[rgba(255,68,68,0.12)]'
                    : 'border-cyan-dim/40 bg-[rgba(10,22,40,0.6)]'
                }`}
                style={{ borderLeft: `3px solid ${isImpacted ? '#FF4444' : risk.color}` }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      {isImpacted && <AlertTriangle size={12} className="text-[#FF4444] animate-pulse" />}
                      {risk.name}
                    </div>
                    <div className="text-[0.625rem] text-muted">{risk.type}</div>
                  </div>
                  <Badge color={isImpacted ? 'danger' : risk.color === '#FF4444' ? 'danger' : 'warning'}>
                    {isImpacted ? 'BREACHED' : `${risk.distKm} KM BUFFER`}
                  </Badge>
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-cyan-dim/20">
                  <span className="text-[0.6875rem] text-muted">Distance to Slick:</span>
                  <span className={`font-mono font-bold ${isImpacted ? 'text-[#FF4444]' : 'text-white'}`}>
                    {isImpacted ? '0.0 km (Direct Impact)' : `${remainingKm} km`}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-[0.6875rem] text-muted">Time to Shoreline:</span>
                  <span className={`font-mono font-bold ${isImpacted ? 'text-[#FF4444]' : 'text-[#FFD700]'}`}>
                    {isImpacted ? 'CONTAMINATION ACTIVE' : `ETA ~${etaHours} hours`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Model Science Spec Box */}
        <div className="glass-panel p-3 space-y-2 mt-auto">
          <div className="flex items-center gap-2">
            <TrendingUp size={14} className="text-[#00D4FF]" />
            <span className="section-label">Prediction Equations</span>
          </div>
          <div className="space-y-1 text-[0.625rem] text-muted leading-relaxed">
            <div>• <b>Advection:</b> V_net = V_curr + 0.03 · W_10</div>
            <div>• <b>Fay Gravity-Viscous Spreading:</b> r(t) = k1 · (Δg · V² / ν)^1/6 · t^1/2</div>
            <div>• <b>Weathering:</b> Evaporation & photo-oxidation loss rate ~ 1.2% / hr</div>
          </div>
        </div>
      </div>
    </div>
  );
}
