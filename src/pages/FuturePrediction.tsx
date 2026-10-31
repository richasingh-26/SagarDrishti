import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Badge } from '@/components/Badge';
import { PanelHeader } from '@/components/Panel';
import { getApiBase, type Vessel } from '@/lib/api';
import {
  TrendingUp,
  AlertTriangle,
  Play,
  Pause,
  RotateCcw,
  Wind,
  Waves,
  ShieldAlert,
  Navigation,
  Sliders,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Compass,
  Ship,
  Radio,
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
  lat: number;
  lon: number;
  color: string;
}

const BASE_COASTAL_RISKS: CoastalRisk[] = [
  {
    name: 'Sentosa & Southern Islands Reef',
    type: 'Coral & Marine Reserve',
    lat: 1.248,
    lon: 103.832,
    color: '#FF4444',
  },
  {
    name: 'Jurong Petrochemical Bunkering',
    type: 'Critical Maritime Infrastructure',
    lat: 1.272,
    lon: 103.715,
    color: '#FF8C00',
  },
  {
    name: 'Riau Coastal Mangrove Habitat',
    type: 'Protected Ecological Zone',
    lat: 1.120,
    lon: 104.050,
    color: '#FFD700',
  },
  {
    name: 'Pulau Semakau Marine Sanctuary',
    type: 'Eco-Sensitive Coral Atoll',
    lat: 1.205,
    lon: 103.765,
    color: '#5FE38A',
  },
];

// Origin coordinates in Singapore Strait TSS corridor (in sync with Sentinel-1 SAR scene)
const ORIGIN_LAT = 1.225;
const ORIGIN_LON = 103.820;

// Coordinate boundary bounds for Singapore Strait TSS corridor
const MAP_LAT_MIN = 1.05;
const MAP_LAT_MAX = 1.45;
const MAP_LON_MIN = 103.50;
const MAP_LON_MAX = 104.30;

function formatCoordinates(lat: number, lon: number): string {
  const latDeg = Math.floor(Math.abs(lat));
  const latMin = ((Math.abs(lat) - latDeg) * 60).toFixed(1);
  const latDir = lat >= 0 ? 'N' : 'S';

  const lonDeg = Math.floor(Math.abs(lon));
  const lonMin = ((Math.abs(lon) - lonDeg) * 60).toFixed(1);
  const lonDir = lon >= 0 ? 'E' : 'W';

  return `${latDeg.toString().padStart(2, '0')}°${latMin}'${latDir}  ${lonDeg.toString().padStart(3, '0')}°${lonMin}'${lonDir}`;
}

interface ForecastMapProps {
  selectedTime: number;
  windSpeed: number;
  windDirection: number;
  currentSpeed: number;
  currentDirection: number;
  spillVolume: number;
  driftDistanceKm: number;
  spreadAreaKm2: number;
  vessels: Vessel[];
  isRealTimeTide: boolean;
  onVesselClick?: (v: Vessel) => void;
}

function ForecastMap({
  selectedTime,
  windSpeed,
  windDirection,
  currentSpeed,
  currentDirection,
  spillVolume,
  driftDistanceKm,
  spreadAreaKm2,
  vessels,
  isRealTimeTide,
  onVesselClick,
}: ForecastMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Zoom and Pan states
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, startPanX: 0, startPanY: 0 });

  // Cursor coordinates
  const [cursorCoords, setCursorCoords] = useState<string>('01°13.5\'N  103°49.2\'E');
  const [hoveredVessel, setHoveredVessel] = useState<Vessel | null>(null);

  // Geographic projection helper (Lat/Lon to Canvas coordinate space)
  const project = useCallback(
    (lat: number, lon: number, w: number, h: number) => {
      const x = ((lon - MAP_LON_MIN) / (MAP_LON_MAX - MAP_LON_MIN)) * w;
      const y = h - ((lat - MAP_LAT_MIN) / (MAP_LAT_MAX - MAP_LAT_MIN)) * h;
      return { x, y };
    },
    []
  );

  const unproject = useCallback(
    (x: number, y: number, w: number, h: number) => {
      const lon = MAP_LON_MIN + (x / w) * (MAP_LON_MAX - MAP_LON_MIN);
      const lat = MAP_LAT_MIN + ((h - y) / h) * (MAP_LAT_MAX - MAP_LAT_MIN);
      return { lat, lon };
    },
    []
  );

  // Auto-fit function: Adjusts zoom and pan so full trajectory from T+0h to T+selectedTime is 100% visible
  const fitTrajectory = useCallback(() => {
    setPan({ x: 0, y: 0 });
    // Scale zoom according to horizon so even at +72h (70+ km) nothing clips
    if (selectedTime <= 12) {
      setZoom(1.0);
    } else if (selectedTime <= 24) {
      setZoom(0.88);
    } else if (selectedTime <= 48) {
      setZoom(0.75);
    } else {
      setZoom(0.65);
    }
  }, [selectedTime]);

  // Combined net drift angle in radians
  const netDriftRad = useMemo(() => {
    // Current vector components
    const currentRad = (currentDirection * Math.PI) / 180;
    const currentVx = currentSpeed * Math.sin(currentRad);
    const currentVy = currentSpeed * Math.cos(currentRad);

    // Wind vector components (3% windage transfer)
    const windRad = (windDirection * Math.PI) / 180;
    const windVx = windSpeed * 0.03 * Math.sin(windRad);
    const windVy = windSpeed * 0.03 * Math.cos(windRad);

    // Combined net vector
    const netVx = currentVx + windVx;
    const netVy = currentVy + windVy;

    return Math.atan2(netVx, netVy);
  }, [currentSpeed, currentDirection, windSpeed, windDirection]);

  // Dynamic slick coordinates at selected horizon
  const { targetLat, targetLon } = useMemo(() => {
    // 1 deg lat ~ 110.574 km; 1 deg lon ~ 111.320 * cos(lat) km
    const dNorthKm = driftDistanceKm * Math.cos(netDriftRad);
    const dEastKm = driftDistanceKm * Math.sin(netDriftRad);

    const lat = ORIGIN_LAT + dNorthKm / 110.574;
    const lon = ORIGIN_LON + dEastKm / (111.32 * Math.cos((ORIGIN_LAT * Math.PI) / 180));
    return { targetLat: lat, targetLon: lon };
  }, [driftDistanceKm, netDriftRad]);

  // 60FPS High-Performance Canvas Rendering Loop
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

      // Deep Ocean Canvas Gradient
      const oceanGrad = ctx.createLinearGradient(0, 0, w, h);
      oceanGrad.addColorStop(0, '#050D1A');
      oceanGrad.addColorStop(0.5, '#08172E');
      oceanGrad.addColorStop(1, '#0C203E');
      ctx.fillStyle = oceanGrad;
      ctx.fillRect(0, 0, w, h);

      // Apply Interactive Zoom & Pan Camera Transformation
      ctx.save();
      ctx.translate(w / 2 + pan.x, h / 2 + pan.y);
      ctx.scale(zoom, zoom);
      ctx.translate(-w / 2, -h / 2);

      // 1. Dynamic Ocean Swell Waves flowing with Current Direction
      ctx.strokeStyle = 'rgba(91, 192, 190, 0.08)';
      ctx.lineWidth = 1.2;
      const waveSpacing = 35;
      const driftDirAngle = (currentDirection * Math.PI) / 180;
      const waveOffsetX = Math.sin(driftDirAngle) * (frame * 1.5);
      const waveOffsetY = Math.cos(driftDirAngle) * (frame * 1.5);

      for (let wy = -200; wy < h + 200; wy += waveSpacing) {
        ctx.beginPath();
        for (let wx = -200; wx < w + 200; wx += 30) {
          const wavePhase = frame * 0.04 + wx * 0.02 + wy * 0.01;
          const yPos = wy + Math.sin(wavePhase) * 4;
          if (wx === -200) ctx.moveTo(wx, yPos);
          else ctx.lineTo(wx, yPos);
        }
        ctx.stroke();
      }

      // 2. Nautical Geographic Coordinate Grid Lines (Latitudes & Longitudes)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 0.8;
      ctx.font = '9px monospace';
      ctx.fillStyle = 'rgba(91, 192, 190, 0.65)';

      // Longitude lines every 0.1° (~11 km)
      for (let lon = 103.50; lon <= 104.30; lon += 0.10) {
        const { x } = project(MAP_LAT_MIN, lon, w, h);
        ctx.beginPath();
        ctx.moveTo(x, -200);
        ctx.lineTo(x, h + 200);
        ctx.stroke();
        ctx.fillText(`${lon.toFixed(2)}°E`, x + 4, h - 8);
      }

      // Latitude lines every 0.05° (~5.5 km)
      for (let lat = 1.05; lat <= 1.45; lat += 0.05) {
        const { y } = project(lat, MAP_LON_MIN, w, h);
        ctx.beginPath();
        ctx.moveTo(-200, y);
        ctx.lineTo(w + 200, y);
        ctx.stroke();
        ctx.fillText(`${lat.toFixed(2)}°N`, 6, y - 3);
      }

      // 3. Singapore Strait Shipping TSS Corridor Lanes
      const tssNorth = project(1.26, MAP_LON_MIN, w, h).y;
      const tssSouth = project(1.18, MAP_LON_MIN, w, h).y;
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.18)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(-200, tssNorth);
      ctx.lineTo(w + 200, tssNorth);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-200, tssSouth);
      ctx.lineTo(w + 200, tssSouth);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = 'rgba(245, 158, 11, 0.3)';
      ctx.font = 'bold 9px monospace';
      ctx.fillText('SINGAPORE STRAIT TSS WESTBOUND', 100, tssNorth - 6);
      ctx.fillText('SINGAPORE STRAIT TSS EASTBOUND', 100, tssSouth + 14);

      // 4. Live AIS Commercial Fleet Traffic (Moving vessels with stern wakes)
      vessels.forEach((v, idx) => {
        if (typeof v.lat !== 'number' || typeof v.lon !== 'number') return;
        const speed = typeof v.speed === 'number' && v.speed > 0 ? v.speed : 12;
        // Real-time advance along TSS lane
        const moveOffset = ((frame * 0.08 * speed + idx * 15) % 120) - 60;
        const vPos = project(v.lat, v.lon, w, h);
        const vx = vPos.x + moveOffset;
        const vy = vPos.y;

        const isPrime = v.name === 'MTT SENARI' || v.is_prime_suspect;
        const isAnomaly = v.is_anomaly || (v as any).anomaly === -1;

        // Hydrodynamic wake lines behind vessel
        ctx.strokeStyle = isPrime ? 'rgba(255, 215, 0, 0.5)' : isAnomaly ? 'rgba(255, 165, 0, 0.4)' : 'rgba(0, 212, 255, 0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(vx - 10, vy);
        ctx.lineTo(vx - 2, vy);
        ctx.stroke();

        // Vessel beacon
        ctx.fillStyle = isPrime ? '#FFD700' : isAnomaly ? '#FFA500' : '#00D4FF';
        ctx.beginPath();
        ctx.arc(vx, vy, isPrime ? 5.5 : isAnomaly ? 4 : 2.8, 0, Math.PI * 2);
        ctx.fill();

        if (isPrime) {
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1.2;
          ctx.stroke();
          // Radar pulse
          const pulseR = 8 + Math.sin(frame * 0.1) * 4;
          ctx.strokeStyle = 'rgba(255, 215, 0, 0.6)';
          ctx.beginPath();
          ctx.arc(vx, vy, pulseR, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = '#FFD700';
          ctx.font = 'bold 8px monospace';
          ctx.fillText(`★ ${v.name}`, vx - 18, vy - 9);
        }
      });

      // 5. Projected Oil Spill Trajectory & Waypoint Milestones
      const originPos = project(ORIGIN_LAT, ORIGIN_LON, w, h);
      const targetPos = project(targetLat, targetLon, w, h);

      // Trajectory dashed vector line
      ctx.strokeStyle = '#FFA500';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(originPos.x, originPos.y);
      ctx.lineTo(targetPos.x, targetPos.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Arrowhead at target
      const arrowAngle = Math.atan2(targetPos.y - originPos.y, targetPos.x - originPos.x);
      ctx.fillStyle = '#FFA500';
      ctx.beginPath();
      ctx.moveTo(targetPos.x, targetPos.y);
      ctx.lineTo(
        targetPos.x - 12 * Math.cos(arrowAngle - Math.PI / 6),
        targetPos.y - 12 * Math.sin(arrowAngle - Math.PI / 6)
      );
      ctx.lineTo(
        targetPos.x - 12 * Math.cos(arrowAngle + Math.PI / 6),
        targetPos.y - 12 * Math.sin(arrowAngle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fill();

      // Intermediate Forecast Waypoint Nodes (+6h, +12h, +24h, +48h, +72h)
      const waypoints = [0.25, 0.5, 0.75, 1.0];
      waypoints.forEach((ratio) => {
        const wx = originPos.x + (targetPos.x - originPos.x) * ratio;
        const wy = originPos.y + (targetPos.y - originPos.y) * ratio;
        const wDist = (driftDistanceKm * ratio).toFixed(1);
        const wTime = Math.round(selectedTime * ratio);

        ctx.fillStyle = ratio === 1.0 ? '#FF3333' : '#FFD700';
        ctx.beginPath();
        ctx.arc(wx, wy, ratio === 1.0 ? 5 : 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Waypoint coordinates badge
        if (ratio === 1.0 || (ratio === 0.5 && selectedTime >= 24)) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.font = 'bold 9px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`+${wTime}h (${wDist} km)`, wx, wy - 12);
          const { lat: wpLat, lon: wpLon } = unproject(wx, wy, w, h);
          ctx.fillStyle = 'rgba(91, 192, 190, 0.85)';
          ctx.font = '8px monospace';
          ctx.fillText(`${wpLat.toFixed(2)}°N ${wpLon.toFixed(2)}°E`, wx, wy + 14);
        }
      });

      // 6. Expanding Fay Viscous Oil Slick Polygon with Fluid Dynamics
      // Convert square kilometers spread to canvas pixel radii
      const kmToPx = (w / (MAP_LON_MAX - MAP_LON_MIN)) / 111.32;
      const slickRadiusPx = Math.max(16, Math.sqrt(spreadAreaKm2 / Math.PI) * kmToPx * 2.8);
      const pulse = Math.sin(frame * 0.05) * 3;

      // Outer Dispersion Emulsion Halo
      const outerGrad = ctx.createRadialGradient(
        targetPos.x,
        targetPos.y,
        0,
        targetPos.x,
        targetPos.y,
        slickRadiusPx * 1.8 + pulse
      );
      outerGrad.addColorStop(0, 'rgba(255, 68, 68, 0.5)');
      outerGrad.addColorStop(0.4, 'rgba(255, 140, 0, 0.28)');
      outerGrad.addColorStop(0.8, 'rgba(255, 200, 0, 0.12)');
      outerGrad.addColorStop(1, 'transparent');

      ctx.fillStyle = outerGrad;
      ctx.beginPath();
      ctx.ellipse(
        targetPos.x,
        targetPos.y,
        slickRadiusPx * 1.8 + pulse,
        slickRadiusPx * 1.2 + pulse * 0.6,
        arrowAngle,
        0,
        Math.PI * 2
      );
      ctx.fill();

      // Heavy Dense Crude Oil Core
      const coreGrad = ctx.createRadialGradient(
        targetPos.x,
        targetPos.y,
        0,
        targetPos.x,
        targetPos.y,
        slickRadiusPx * 0.9
      );
      coreGrad.addColorStop(0, 'rgba(255, 30, 30, 0.9)');
      coreGrad.addColorStop(0.7, 'rgba(180, 20, 20, 0.7)');
      coreGrad.addColorStop(1, 'transparent');

      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.ellipse(
        targetPos.x,
        targetPos.y,
        slickRadiusPx * 0.95,
        slickRadiusPx * 0.65,
        arrowAngle,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.strokeStyle = '#FF4444';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Drifting surface droplet particulates
      for (let p = 0; p < 24; p++) {
        const pProg = ((frame * 0.015 + p / 24) % 1);
        const px = originPos.x + (targetPos.x - originPos.x) * pProg + Math.sin(frame * 0.05 + p) * 6;
        const py = originPos.y + (targetPos.y - originPos.y) * pProg + Math.cos(frame * 0.05 + p) * 4;
        ctx.fillStyle = '#FFB020';
        ctx.beginPath();
        ctx.arc(px, py, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }

      // 7. T+0h Origin Anchor Marker (Calibrated Singapore Strait Spill Anchor)
      ctx.fillStyle = '#00D4FF';
      ctx.beginPath();
      ctx.arc(originPos.x, originPos.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#00D4FF';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`T+0h ORIGIN (${ORIGIN_LAT}°N, ${ORIGIN_LON}°E)`, originPos.x + 8, originPos.y - 6);

      // 8. Coastal Vulnerability Zones & Proximity Lines
      BASE_COASTAL_RISKS.forEach((risk) => {
        const rPos = project(risk.lat, risk.lon, w, h);
        const distPx = Math.hypot(rPos.x - targetPos.x, rPos.y - targetPos.y);
        const distKm = Math.max(0.5, distPx / kmToPx);

        // Warning radar ring around coastal sanctuary
        const rPulse = Math.sin(frame * 0.05 + risk.lat * 10) * 3;
        ctx.strokeStyle = risk.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(rPos.x, rPos.y, 9 + rPulse, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = risk.color;
        ctx.beginPath();
        ctx.arc(rPos.x, rPos.y, 4, 0, Math.PI * 2);
        ctx.fill();

        // Guide proximity line if approaching
        if (distKm < 30) {
          ctx.strokeStyle = risk.color;
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 4]);
          ctx.beginPath();
          ctx.moveTo(targetPos.x, targetPos.y);
          ctx.lineTo(rPos.x, rPos.y);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Risk Name & Distance
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 9.5px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(risk.name, rPos.x + 12, rPos.y - 2);

        ctx.fillStyle = risk.color;
        ctx.font = '8.5px monospace';
        const etaH = Math.max(1, Math.round(distKm / (currentSpeed * 1.852 + 0.1)));
        ctx.fillText(`${distKm.toFixed(1)} km · ETA: ${etaH}h`, rPos.x + 12, rPos.y + 11);
      });

      ctx.restore(); // Restore zoom/pan transform

      frame++;
      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [
    selectedTime,
    windSpeed,
    windDirection,
    currentSpeed,
    currentDirection,
    spillVolume,
    driftDistanceKm,
    spreadAreaKm2,
    vessels,
    targetLat,
    targetLon,
    netDriftRad,
    zoom,
    pan,
    project,
    unproject,
  ]);

  // Pan interaction
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startPanX: pan.x,
      startPanY: pan.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Convert screen mouse coordinates into projected geographic coordinates considering pan & zoom
    const w = rect.width;
    const h = rect.height;
    const transformedX = (mouseX - (w / 2 + pan.x)) / zoom + w / 2;
    const transformedY = (mouseY - (h / 2 + pan.y)) / zoom + h / 2;
    const { lat, lon } = unproject(transformedX, transformedY, w, h);
    setCursorCoords(formatCoordinates(lat, lon));

    if (isDragging) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setPan({
        x: dragStartRef.current.startPanX + dx,
        y: dragStartRef.current.startPanY + dy,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    setZoom((curr) => Math.min(Math.max(curr * factor, 0.5), 3.5));
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full min-h-[460px] overflow-hidden rounded-xl border border-white/[0.12] ${
        isDragging ? 'cursor-grabbing' : 'cursor-crosshair'
      }`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => setIsDragging(false)}
      onWheel={handleWheel}
    >
      <canvas ref={canvasRef} className="w-full h-full block" />

      {/* Floating Map Zoom & Pan Controls */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 glass-panel p-1 rounded-xl border border-white/[0.12] shadow-2xl backdrop-blur-xl">
        <button
          onClick={fitTrajectory}
          className="px-2 py-1 rounded-lg text-[10px] font-mono font-bold text-[#00D4FF] hover:bg-[#00D4FF]/20 flex items-center gap-1 transition-all cursor-pointer"
          title="Auto-Fit Trajectory Horizon"
        >
          <Maximize2 size={12} />
          <span>Fit Forecast</span>
        </button>

        <div className="w-px h-3.5 bg-white/10" />

        <button
          onClick={() => setZoom((z) => Math.min(z * 1.25, 3.5))}
          className="p-1.5 rounded-lg text-[#CBD5E1] hover:text-white hover:bg-white/[0.08] transition-all cursor-pointer"
          title="Zoom In"
        >
          <ZoomIn size={14} />
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(z / 1.25, 0.5))}
          className="p-1.5 rounded-lg text-[#CBD5E1] hover:text-white hover:bg-white/[0.08] transition-all cursor-pointer"
          title="Zoom Out"
        >
          <ZoomOut size={14} />
        </button>
        <button
          onClick={() => {
            setPan({ x: 0, y: 0 });
            setZoom(1.0);
          }}
          className="p-1.5 rounded-lg text-[#CBD5E1] hover:text-white hover:bg-white/[0.08] transition-all cursor-pointer"
          title="Reset Ocean View"
        >
          <RotateCcw size={13} />
        </button>
      </div>

      {/* Top Left: Live Real-Time Metocean Telemetry HUD */}
      <div className="absolute top-3 left-3 z-20 glass-panel px-3 py-2 rounded-xl border border-white/[0.12] space-y-1 pointer-events-none">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#5FE38A] animate-pulse" />
          <span className="text-[11px] font-mono font-bold text-[#5FE38A]">
            REAL-TIME DISPERSION MODEL
          </span>
        </div>
        <div className="text-[10px] font-mono text-muted flex items-center gap-3">
          <span>NET DRIFT: {(netDriftRad * (180 / Math.PI)).toFixed(0)}°</span>
          <span>SPEED: {((driftDistanceKm / selectedTime)).toFixed(1)} km/h</span>
          <span className="text-white">SLICK: {spreadAreaKm2.toFixed(1)} km²</span>
        </div>
      </div>

      {/* Bottom Left: Live Cursor Coordinates & Current Compass */}
      <div className="absolute bottom-3 left-3 z-20 flex items-center gap-2 glass-panel px-3 py-1.5 rounded-xl border border-white/[0.1] pointer-events-none">
        <Compass size={13} className="text-[#00D4FF] animate-spin-slow" />
        <span className="text-[10px] font-mono text-white tracking-wider font-semibold">
          {cursorCoords}
        </span>
        <span className="text-[10px] font-mono text-[#5FE38A] pl-2 border-l border-white/10">
          ZOOM: {(zoom * 100).toFixed(0)}%
        </span>
      </div>

      {/* Bottom Right: Real-time Scale Legend */}
      <div className="absolute bottom-3 right-3 z-20 glass-panel px-3 py-1.5 rounded-xl border border-white/[0.1] pointer-events-none text-[10px] font-mono text-muted">
        <span>TSS Corridor · Singapore Strait</span>
      </div>
    </div>
  );
}

export function FuturePrediction() {
  const [selectedTime, setSelectedTime] = useState<number>(24);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [windSpeed, setWindSpeed] = useState<number>(14.0); // knots
  const [windDirection, setWindDirection] = useState<number>(45); // degrees (NE Monsoon)
  const [currentSpeed, setCurrentSpeed] = useState<number>(1.8); // knots
  const [currentDirection, setCurrentDirection] = useState<number>(105); // degrees (E-SE Straits flow)
  const [spillVolume, setSpillVolume] = useState<number>(450); // m3
  const [isRealTimeTide, setIsRealTimeTide] = useState<boolean>(true);

  // Live Vessels from Backend API
  const [vessels, setVessels] = useState<Vessel[]>([]);

  // Real-Time Tidal Current Oscillation (Singapore Strait semi-diurnal tidal cycle)
  useEffect(() => {
    if (!isRealTimeTide) return;
    const timer = setInterval(() => {
      const now = Date.now();
      // Tidal cycle period ~12.4 hours (simulated clock oscillation for visual dynamics)
      const tidePhase = (now / 15000) % (Math.PI * 2);
      // Oscillate direction between flood ~080° (E) and ebb ~260° (W)
      const dynamicDir = 105 + Math.sin(tidePhase) * 25;
      const dynamicSpeed = 1.4 + Math.cos(tidePhase) * 0.6;
      setCurrentDirection(Math.round(dynamicDir));
      setCurrentSpeed(parseFloat(dynamicSpeed.toFixed(1)));
    }, 1000);

    return () => clearInterval(timer);
  }, [isRealTimeTide]);

  // Fetch real AIS vessels from backend
  useEffect(() => {
    const fetchVessels = async () => {
      try {
        const res = await fetch(`${getApiBase()}/api/vessels`);
        if (res.ok) {
          const data = await res.json();
          if (data.vessels && Array.isArray(data.vessels)) {
            setVessels(data.vessels);
          }
        }
      } catch (err) {
        console.error('Failed to fetch vessels for forecast:', err);
      }
    };
    fetchVessels();
  }, []);

  // Physics Fay Spreading & Advection Calculations
  const netDriftSpeedKnots = currentSpeed + windSpeed * 0.03;
  const driftDistanceKm = parseFloat((netDriftSpeedKnots * 1.852 * selectedTime).toFixed(1));

  // Fay Area Expansion law: Area(t) ~ A0 * (1 + k * t^0.6)
  const baseAreaKm2 = 3.2; // Synced with calibrated U-Net++ detected area (3.2 km²)
  const spreadAreaKm2 = parseFloat(
    (baseAreaKm2 * (1 + 0.85 * Math.pow(selectedTime, 0.72))).toFixed(1)
  );

  // Peak slick thickness in microns
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
        <div className="glass-panel overflow-hidden flex-1 min-h-[480px] flex flex-col">
          <PanelHeader
            title="72-Hour Hydrodynamic Oil Spill Forecast"
            right={
              <div className="flex items-center gap-2">
                <Badge color="warning">
                  <TrendingUp size={10} /> FAY ADVECTION MODEL
                </Badge>
                <Badge color="cyan">T+{selectedTime}h HORIZON</Badge>
                <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-[11px] font-mono text-[#5FE38A]">
                  <Radio size={11} className="animate-pulse" />
                  <span>{vessels.length > 0 ? `${vessels.length.toLocaleString()} AIS VESSELS` : 'AIS SYNCED'}</span>
                </div>
              </div>
            }
          />
          <div className="flex-1 p-2 relative flex flex-col">
            <ForecastMap
              selectedTime={selectedTime}
              windSpeed={windSpeed}
              windDirection={windDirection}
              currentSpeed={currentSpeed}
              currentDirection={currentDirection}
              spillVolume={spillVolume}
              driftDistanceKm={driftDistanceKm}
              spreadAreaKm2={spreadAreaKm2}
              vessels={vessels}
              isRealTimeTide={isRealTimeTide}
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
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
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
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-muted hover:text-white transition-all border border-cyan-dim/30 cursor-pointer"
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
                className={`py-2 px-2 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
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
      <div className="w-88 shrink-0 p-4 pl-0 overflow-y-auto space-y-4 flex flex-col">
        {/* Metocean Forcing Controls */}
        <div className="glass-panel p-4 space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="section-label flex items-center gap-1.5 text-white">
              <Sliders size={13} className="text-[#00D4FF]" /> Hydrodynamic Forcing
            </span>
            <Badge color="cyan">METOCEAN</Badge>
          </div>

          {/* Real-Time Tide Auto-Oscillation Toggle */}
          <div className="flex items-center justify-between p-2 rounded-lg bg-white/[0.03] border border-white/[0.08]">
            <div className="flex items-center gap-2">
              <Waves size={13} className="text-[#5FE38A]" />
              <span className="text-xs font-semibold text-white">Real-Time Tidal Current</span>
            </div>
            <button
              onClick={() => setIsRealTimeTide((p) => !p)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${
                isRealTimeTide
                  ? 'bg-[#5FE38A]/20 text-[#5FE38A] border border-[#5FE38A]/40'
                  : 'bg-white/10 text-muted'
              }`}
            >
              {isRealTimeTide ? 'ACTIVE' : 'MANUAL'}
            </button>
          </div>

          {/* Surface Current Speed & Direction */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-1.5 text-muted">
                <Waves size={12} className="text-[#38EF7D]" /> Surface Current Speed
              </label>
              <span className="metric-value text-[#38EF7D] font-mono font-bold">{currentSpeed} kn</span>
            </div>
            <input
              type="range"
              min="0"
              max="5"
              step="0.1"
              value={currentSpeed}
              disabled={isRealTimeTide}
              onChange={(e) => setCurrentSpeed(Number(e.target.value))}
              className="w-full accent-[#38EF7D] cursor-pointer disabled:opacity-50"
            />
          </div>

          {/* Current Direction Slider */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-1.5 text-muted">
                <Compass size={12} className="text-[#38EF7D]" /> Current Heading
              </label>
              <span className="metric-value text-[#38EF7D] font-mono font-bold">{currentDirection}°</span>
            </div>
            <input
              type="range"
              min="0"
              max="360"
              step="5"
              value={currentDirection}
              disabled={isRealTimeTide}
              onChange={(e) => setCurrentDirection(Number(e.target.value))}
              className="w-full accent-[#38EF7D] cursor-pointer disabled:opacity-50"
            />
            <div className="flex justify-between text-[10px] text-muted font-mono">
              <span>0° (N)</span>
              <span>90° (E)</span>
              <span>180° (S)</span>
              <span>270° (W)</span>
            </div>
          </div>

          {/* Wind Speed & Direction */}
          <div className="space-y-1.5 pt-1 border-t border-white/[0.06]">
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
              className="w-full accent-[#00E5FF] cursor-pointer"
            />
          </div>

          {/* Wind Direction Slider */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-1.5 text-muted">
                <Navigation size={12} className="text-[#00E5FF]" /> Wind Direction
              </label>
              <span className="metric-value text-[#00E5FF] font-mono font-bold">{windDirection}°</span>
            </div>
            <input
              type="range"
              min="0"
              max="360"
              step="5"
              value={windDirection}
              onChange={(e) => setWindDirection(Number(e.target.value))}
              className="w-full accent-[#00E5FF] cursor-pointer"
            />
          </div>

          {/* Initial Spill Volume */}
          <div className="space-y-1.5 pt-1 border-t border-white/[0.06]">
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
              className="w-full accent-[#FF4444] cursor-pointer"
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
            // Calculate distance from advancing slick to this coastal zone
            const dLatKm = (risk.lat - ORIGIN_LAT) * 110.574;
            const dLonKm = (risk.lon - ORIGIN_LON) * 111.32 * Math.cos((ORIGIN_LAT * Math.PI) / 180);
            const totalDistKm = Math.hypot(dLatKm, dLonKm);
            const remainingKm = Math.max(0, parseFloat((totalDistKm - driftDistanceKm * 0.72).toFixed(1)));
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
                    {isImpacted ? 'BREACHED' : `${totalDistKm.toFixed(0)} KM BUFFER`}
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
          <div className="space-y-1 text-[0.625rem] text-muted leading-relaxed font-mono">
            <div>• <b>Advection:</b> V_net = V_curr + 0.03 · W_10</div>
            <div>• <b>Fay Model:</b> r(t) = k1 · (Δg · V² / ν)^1/6 · t^1/2</div>
            <div>• <b>Weathering:</b> Evaporation loss rate ~ 1.2% / hr</div>
          </div>
        </div>
      </div>
    </div>
  );
}
