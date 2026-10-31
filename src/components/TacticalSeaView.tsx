import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { getApiBase, type Vessel } from '@/lib/api';
import { ZoomIn, ZoomOut, RotateCcw, Waves, Play, Pause, Compass } from 'lucide-react';

interface TacticalSeaViewProps {
  vessels: Vessel[];
  primeSuspectName?: string;
  selectedMmsi?: string;
  onVesselClick?: (v: Vessel) => void;
}

const WIDTH = 1000;
const HEIGHT = 500;
const LAT_MIN = 0.5;
const LAT_MAX = 2.5;
const LON_MIN = 103.0;
const LON_MAX = 105.0;

const lonToX = (lon: number) => ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * WIDTH;
const latToY = (lat: number) => HEIGHT - ((lat - LAT_MIN) / (LAT_MAX - LAT_MIN)) * HEIGHT;

interface HoverState {
  vessel: Vessel;
  x: number;
  y: number;
}

// Generate organic wave SVG path
function generateWavePath(baseY: number, amplitude: number, frequency: number, phase: number, width: number): string {
  const points: string[] = [`M 0 ${baseY}`];
  const step = 25;
  for (let x = 0; x <= width; x += step) {
    const y = baseY + Math.sin(x * frequency + phase) * amplitude + Math.cos(x * frequency * 0.5 + phase * 0.8) * (amplitude * 0.4);
    points.push(`L ${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return points.join(' ');
}

export function TacticalSeaView({ vessels: propVessels, primeSuspectName, selectedMmsi, onVesselClick }: TacticalSeaViewProps) {
  const [fetchedVessels, setFetchedVessels] = useState<Vessel[]>([]);
  const [hovered, setHovered] = useState<HoverState | null>(null);
  
  // Real-time animation time state
  const [animTime, setAnimTime] = useState(0);

  // Pan & Zoom interactive controls
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [autoDrift, setAutoDrift] = useState(true);
  const [showLegend, setShowLegend] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, startPanX: 0, startPanY: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const fetchedRef = useRef(false);

  // Fetch vessels from API, fall back to local array
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const controller = new AbortController();
    const doFetch = async () => {
      try {
        const res = await fetch(`${getApiBase()}/api/vessels`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.vessels && Array.isArray(data.vessels)) {
          setFetchedVessels(data.vessels);
        } else {
          setFetchedVessels([]);
        }
      } catch (err) {
        console.error('Vessel fetch failed:', err);
        setFetchedVessels([]);
      }
    };
    doFetch();

    return () => controller.abort();
  }, []);

  // 60FPS fluid physics & ocean animation loop
  useEffect(() => {
    let raf: number;
    let lastT = performance.now();

    const loop = (t: number) => {
      const dt = (t - lastT) / 1000;
      lastT = t;
      setAnimTime((prev) => prev + dt);
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const vessels = fetchedVessels.length > 0 ? fetchedVessels : propVessels;
  const effectivePrimeName = primeSuspectName || '';

  const isPrime = useCallback(
    (v: Vessel) => Boolean(v.is_prime_suspect || (effectivePrimeName && v.name === effectivePrimeName)),
    [effectivePrimeName]
  );
  const isAnomaly = useCallback(
    (v: Vessel) =>
      !isPrime(v) &&
      Boolean(
        v.is_anomaly ||
          (v as any).anomaly === -1 ||
          (v.anomaly_score !== undefined && v.anomaly_score < 0)
      ),
    [isPrime]
  );

  const { primeList, anomList, normalList } = useMemo(() => {
    const primes: Vessel[] = [];
    const anoms: Vessel[] = [];
    const rawNormals: Vessel[] = [];

    for (const v of vessels) {
      if (typeof v.lat !== 'number' || typeof v.lon !== 'number' || !isFinite(v.lat) || !isFinite(v.lon)) {
        continue;
      }
      const inBounds = v.lat >= 0.6 && v.lat <= 2.2 && v.lon >= 103.1 && v.lon <= 104.8;
      if (!inBounds) continue;

      if (isPrime(v)) {
        primes.push(v);
      } else if (isAnomaly(v)) {
        anoms.push(v);
      } else {
        rawNormals.push(v);
      }
    }

    // Realistic maritime distance calculation (Haversine formula in km)
    const haversineDistKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371.0;
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      return 2 * R * Math.asin(Math.sqrt(a));
    };

    // Sort normals by activity/speed to pick real active ships
    const sortedNormals = [...rawNormals].sort((a, b) => (b.speed ?? 0) - (a.speed ?? 0));

    // Spatial de-cluttering: enforce realistic ~1.8 km separation in TSS
    // This prevents hundreds of vessels clumping together as an unrealistic blob
    const declutteredNormals: Vessel[] = [];
    const MIN_SEP_KM = 1.8;

    for (const v of sortedNormals) {
      const nearPrime = primes.some((p) => haversineDistKm(v.lat, v.lon, p.lat, p.lon) < 1.4);
      const nearAnom = anoms.some((a) => haversineDistKm(v.lat, v.lon, a.lat, a.lon) < 1.4);
      const nearNormal = declutteredNormals.some(
        (n) => haversineDistKm(v.lat, v.lon, n.lat, n.lon) < MIN_SEP_KM
      );

      if (!nearPrime && !nearAnom && !nearNormal) {
        declutteredNormals.push(v);
      }
      if (declutteredNormals.length >= 35) break;
    }

    return { primeList: primes, anomList: anoms, normalList: declutteredNormals };
  }, [vessels, isPrime, isAnomaly]);

  // Spill center ~55% x, 50% y with gentle hydrodynamic drift
  const spillBaseCx = WIDTH * 0.55;
  const spillBaseCy = HEIGHT * 0.50;
  
  // Real-time oil slick drifting in ocean current (~1.8 kn E-SE vector)
  const currentDriftX = Math.sin(animTime * 0.3) * 6;
  const currentDriftY = Math.cos(animTime * 0.25) * 4;
  const spillCx = spillBaseCx + currentDriftX;
  const spillCy = spillBaseCy + currentDriftY;

  // Fluid viscous oil slick polygon with organic undulating boundaries
  const spillPoints = useMemo(() => {
    const numPoints = 12;
    const points: [number, number][] = [];
    const baseRadii = [34, 30, 26, 38, 42, 36, 28, 35, 39, 44, 32, 29];
    
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;
      // Morphing surface tension waves
      const waveOffset = Math.sin(animTime * 1.8 + angle * 3) * 3.5 + Math.cos(animTime * 1.2 - angle * 2) * 2.2;
      const r = baseRadii[i] + waveOffset;
      const px = spillCx + Math.cos(angle) * r * 1.2;
      const py = spillCy + Math.sin(angle) * r * 0.75;
      points.push([px, py]);
    }
    return points;
  }, [animTime, spillCx, spillCy]);

  // Origin point (above and left of spill)
  const originX = spillBaseCx - 90;
  const originY = spillBaseCy - 60;

  // Real-time trajectory particles drifting along current vector
  const driftParticles = useMemo(() => {
    const count = 10;
    const particles = [];
    for (let i = 0; i < count; i++) {
      const progress = ((animTime * 0.18 + i / count) % 1);
      const px = originX + (spillCx - 5 - originX) * progress + Math.sin(animTime * 2 + i) * 3;
      const py = originY + (spillCy - 10 - originY) * progress + Math.cos(animTime * 2 + i) * 2;
      const opacity = Math.sin(progress * Math.PI) * 0.85;
      particles.push({ id: i, x: px, y: py, opacity, progress });
    }
    return particles;
  }, [animTime, originX, originY, spillCx, spillCy]);

  // Ocean swell camera auto-patrol sway
  const autoSwayX = autoDrift ? Math.sin(animTime * 0.25) * 30 : 0;
  const autoSwayY = autoDrift ? Math.cos(animTime * 0.2) * 16 : 0;

  // Calculate dynamic SVG viewBox with pan, zoom, and auto-ocean patrol
  const viewWidth = WIDTH / zoom;
  const viewHeight = HEIGHT / zoom;
  const centerCenterX = WIDTH / 2 + pan.x + autoSwayX;
  const centerCenterY = HEIGHT / 2 + pan.y + autoSwayY;
  const viewX = centerCenterX - viewWidth / 2;
  const viewY = centerCenterY - viewHeight / 2;

  // Pan interaction handlers (drag sea)
  const handleMouseDown = (e: React.MouseEvent) => {
    // Left mouse button only
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
    if (!isDragging) return;
    const dx = (e.clientX - dragStartRef.current.x) / zoom;
    const dy = (e.clientY - dragStartRef.current.y) / zoom;
    setPan({
      x: dragStartRef.current.startPanX - dx,
      y: dragStartRef.current.startPanY - dy,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
    setZoom((curr) => Math.min(Math.max(curr * zoomFactor, 0.75), 3.2));
  };

  const handleResetView = () => {
    setPan({ x: 0, y: 0 });
    setZoom(1.0);
    setAutoDrift(true);
  };

  const handleVesselHover = (v: Vessel, e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHovered({
      vessel: v,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden rounded-2xl select-none ${
        isDragging ? 'cursor-grabbing' : 'cursor-grab'
      }`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        setIsDragging(false);
        setHovered(null);
      }}
      onWheel={handleWheel}
    >
      <svg
        viewBox={`${viewX} ${viewY} ${viewWidth} ${viewHeight}`}
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 w-full h-full transition-transform duration-75"
      >
        <defs>
          {/* Deep oceanic dynamic gradient */}
          <linearGradient id="liveOceanGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#06101E" />
            <stop offset="45%" stopColor="#0B1B32" />
            <stop offset="85%" stopColor="#102544" />
            <stop offset="100%" stopColor="#081426" />
          </linearGradient>

          {/* Current streamline gradient */}
          <linearGradient id="streamlineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00D4FF" stopOpacity="0.0" />
            <stop offset="40%" stopColor="#5BC0BE" stopOpacity="0.45" />
            <stop offset="70%" stopColor="#5FE38A" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#00D4FF" stopOpacity="0.0" />
          </linearGradient>

          <filter id="spillGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="10" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id="primeGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="7" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="8"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#FFA500" />
          </marker>
        </defs>

        {/* Ocean base depth */}
        <rect x={-500} y={-500} width={WIDTH + 1000} height={HEIGHT + 1000} fill="url(#liveOceanGradient)" />

        {/* Dynamic Ocean Current Wave Swells (Undulating sinusoidal water layers) */}
        {[60, 120, 180, 240, 300, 360, 420, 480].map((baseY, idx) => {
          const speedMultiplier = 1.2 + (idx % 3) * 0.4;
          const phase = animTime * speedMultiplier + idx * 0.7;
          const amp = 5 + (idx % 2) * 3;
          const freq = 0.012 + (idx % 4) * 0.003;
          const waveD = generateWavePath(baseY, amp, freq, phase, WIDTH + 200);
          return (
            <path
              key={`live-wave-${idx}`}
              d={waveD}
              fill="none"
              stroke="#5BC0BE"
              strokeWidth={idx % 2 === 0 ? "1.4" : "0.9"}
              strokeOpacity={0.07 + (idx % 3) * 0.03}
              strokeDasharray={idx % 2 === 0 ? "16 12" : "24 16"}
              style={{
                strokeDashoffset: -(animTime * 35 * (1 + idx * 0.15)),
              }}
            />
          );
        })}

        {/* Moving Ocean Current Streamlines across TSS Channel */}
        {[160, 220, 280, 340].map((laneY, i) => (
          <path
            key={`streamline-${i}`}
            d={`M -50 ${laneY} Q 250 ${laneY - 25} 550 ${laneY + 15} T 1050 ${laneY - 10}`}
            fill="none"
            stroke="url(#streamlineGrad)"
            strokeWidth="2.2"
            strokeDasharray="18 22"
            style={{
              strokeDashoffset: -(animTime * 48 * (1 + i * 0.1)),
            }}
          />
        ))}

        {/* Lat/Lon navigation grid */}
        {Array.from({ length: 9 }, (_, i) => {
          const lon = LON_MIN + i * 0.25;
          const x = lonToX(lon);
          return (
            <g key={`vgrid-${i}`}>
              <line x1={x} y1="-200" x2={x} y2={HEIGHT + 200} stroke="#ffffff" strokeWidth="0.5" opacity="0.05" />
              <text x={x + 4} y={HEIGHT - 6} fill="#4a6a8a" fontSize="9" fontFamily="monospace" opacity="0.7">
                {lon.toFixed(2)}°E
              </text>
            </g>
          );
        })}
        {Array.from({ length: 9 }, (_, i) => {
          const lat = LAT_MIN + i * 0.25;
          const y = latToY(lat);
          return (
            <g key={`hgrid-${i}`}>
              <line x1="-200" y1={y} x2={WIDTH + 200} y2={y} stroke="#ffffff" strokeWidth="0.5" opacity="0.05" />
              <text x="6" y={y - 3} fill="#4a6a8a" fontSize="9" fontFamily="monospace" opacity="0.7">
                {lat.toFixed(2)}°N
              </text>
            </g>
          );
        })}

        {/* Living Oil Spill: Outer viscous dispersion haze */}
        <polygon
          points={spillPoints.map((p) => p.join(',')).join(' ')}
          fill="#FF3333"
          opacity="0.18"
          filter="url(#spillGlow)"
        />

        {/* Living Oil Spill: Dense crude core with animated wave contours */}
        <polygon
          points={spillPoints.map((p) => p.join(',')).join(' ')}
          fill="#CC2222"
          fillOpacity="0.45"
          stroke="#FF4444"
          strokeWidth="2.5"
          className="transition-all"
        />

        {/* Spill interior fluid ripple contour */}
        <polygon
          points={spillPoints.map(([px, py]) => [
            (px - spillCx) * 0.6 + spillCx,
            (py - spillCy) * 0.6 + spillCy
          ].join(',')).join(' ')}
          fill="#881111"
          fillOpacity="0.5"
          stroke="#FFAA44"
          strokeWidth="1.2"
          strokeDasharray="6 4"
        />

        <text
          x={spillCx}
          y={spillCy - 40}
          fill="#FF7777"
          fontSize="10"
          fontFamily="monospace"
          textAnchor="middle"
          fontWeight="700"
          className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
        >
          DETECTED SPILL 3.2 km²
        </text>

        {/* Drift trajectory arrow with animated flow dashes */}
        <line
          x1={originX}
          y1={originY}
          x2={spillCx - 8}
          y2={spillCy - 12}
          stroke="#FFA500"
          strokeWidth="2.5"
          strokeDasharray="7 5"
          style={{ strokeDashoffset: -(animTime * 25) }}
          markerEnd="url(#arrowhead)"
        />

        {/* Real-time drifting oil droplet particles flowing down-drift */}
        {driftParticles.map((part) => (
          <circle
            key={`droplet-${part.id}`}
            cx={part.x}
            cy={part.y}
            r={2.5 + (1 - part.progress) * 1.5}
            fill="#FFB020"
            opacity={part.opacity}
            filter="url(#spillGlow)"
          />
        ))}

        {/* Probable Origin Zone with dynamic expanding acoustic sonar waves */}
        <circle
          cx={originX}
          cy={originY}
          r={50}
          fill="#FFD700"
          fillOpacity="0.04"
          stroke="#FFD700"
          strokeWidth="1.8"
          strokeDasharray="5 4"
        />

        {/* Expanding sonar radar wave rings from origin */}
        {[0, 0.33, 0.66].map((offset, idx) => {
          const wavePhase = (animTime * 0.4 + offset) % 1;
          const waveR = 20 + wavePhase * 55;
          const waveO = (1 - wavePhase) * 0.55;
          return (
            <circle
              key={`sonar-${idx}`}
              cx={originX}
              cy={originY}
              r={waveR}
              fill="none"
              stroke="#FFD700"
              strokeWidth="1.2"
              opacity={waveO}
            />
          );
        })}

        <text
          x={originX}
          y={originY - 58}
          fill="#FFD700"
          fontSize="9"
          fontFamily="monospace"
          textAnchor="middle"
          fontWeight="700"
        >
          PROBABLE ORIGIN ZONE
        </text>

        {/* Dynamic AIS Commercial Fleet: Normal Vessels with real-time GPS coordinates & gentle surface drift */}
        {normalList.map((v, idx) => {
          const isSelected = Boolean(selectedMmsi && (selectedMmsi === v.mmsi || selectedMmsi === v.name));
          // Gentle realistic ocean water movement (< 1 px), preserving actual real-time coordinates
          const x = lonToX(v.lon) + Math.sin(animTime * 0.8 + idx) * 0.6;
          const y = latToY(v.lat) + Math.cos(animTime * 0.8 + idx) * 0.6;

          if (x < -20 || x > WIDTH + 20 || y < -20 || y > HEIGHT + 20) return null;

          return (
            <g key={`norm-${v.mmsi || v.name}`} className="cursor-pointer">
              {/* Hydrodynamic stern wake trail */}
              <line
                x1={x - 7}
                y1={y}
                x2={x - 2}
                y2={y}
                stroke="#00D4FF"
                strokeWidth="1"
                strokeOpacity="0.4"
                strokeDasharray="3 2"
              />
              {/* Selected highlight ring if chosen from suspect table */}
              {isSelected && (
                <circle
                  cx={x}
                  cy={y}
                  r={10}
                  fill="none"
                  stroke="#00D4FF"
                  strokeWidth="1.5"
                  className="animate-ping"
                />
              )}
              <circle
                cx={x}
                cy={y}
                r={isSelected ? 4.8 : 3.6}
                fill={isSelected ? '#FFFFFF' : '#00D4FF'}
                stroke="#ffffff"
                strokeWidth={isSelected ? 1.5 : 0.8}
                opacity={isSelected ? 1 : 0.85}
                className="hover:opacity-100 hover:scale-125 transition-all"
                onMouseEnter={(e) => handleVesselHover(v, e)}
                onClick={() => onVesselClick?.(v)}
              />
            </g>
          );
        })}

        {/* Dynamic AIS Anomalous Vessels with pulsing beacon and wake */}
        {anomList.map((v, idx) => {
          const x = lonToX(v.lon) + Math.sin(animTime * 0.7 + idx) * 0.7;
          const y = latToY(v.lat) + Math.cos(animTime * 0.7 + idx) * 0.7;

          if (x < -20 || x > WIDTH + 20 || y < -20 || y > HEIGHT + 20) return null;

          const pulseR = 9 + Math.sin(animTime * 4 + idx) * 3.5;
          const pulseO = 0.28 + Math.sin(animTime * 4 + idx) * 0.15;

          return (
            <g
              key={`anom-${v.mmsi || v.name}`}
              className="cursor-pointer"
              onMouseEnter={(e) => handleVesselHover(v, e)}
              onMouseMove={(e) => handleVesselHover(v, e)}
              onClick={() => onVesselClick?.(v)}
            >
              {/* Wake line */}
              <line
                x1={x - 12}
                y1={y}
                x2={x - 4}
                y2={y}
                stroke="#FFA500"
                strokeWidth="1.5"
                strokeOpacity="0.5"
              />
              <circle cx={x} cy={y} r={pulseR} fill="#FFA500" opacity={pulseO} />
              <circle cx={x} cy={y} r={6.5} fill="#FFA500" stroke="#ffffff" strokeWidth="1.5" />
            </g>
          );
        })}

        {/* Dynamic Prime Suspect (MTT SENARI) with active radar beacon & telemetry halo */}
        {primeList.map((v) => {
          const speed = typeof v.speed === 'number' && v.speed > 0 ? v.speed : 14;
          const vesselMove = (animTime * speed * 0.08) % 30;
          const x = lonToX(v.lon) + vesselMove;
          const y = latToY(v.lat) + Math.sin(animTime * 0.4) * 1.5;

          if (x < -20 || x > WIDTH + 20 || y < -20 || y > HEIGHT + 20) return null;

          const pulseR1 = 15 + Math.sin(animTime * 3) * 6;
          const pulseR2 = 24 + Math.sin(animTime * 3 + 1) * 8;
          const pulseO = 0.35 + Math.sin(animTime * 3) * 0.18;

          return (
            <g
              key={`prime-${v.mmsi || v.name}`}
              className="cursor-pointer"
              onMouseEnter={(e) => handleVesselHover(v, e)}
              onMouseMove={(e) => handleVesselHover(v, e)}
              onClick={() => onVesselClick?.(v)}
            >
              {/* Stern wake disturbance */}
              <path
                d={`M ${x - 16} ${y - 4} L ${x - 4} ${y} L ${x - 16} ${y + 4}`}
                fill="none"
                stroke="#FFD700"
                strokeWidth="1.2"
                strokeOpacity="0.6"
              />
              {/* Double radar ring halo */}
              <circle cx={x} cy={y} r={pulseR1} fill="none" stroke="#FFD700" strokeWidth="1.5" opacity={pulseO} />
              <circle cx={x} cy={y} r={pulseR2} fill="none" stroke="#FFA500" strokeWidth="1" strokeDasharray="4 3" opacity={pulseO * 0.6} />
              <circle cx={x} cy={y} r={11} fill="#FFD700" stroke="#ffffff" strokeWidth="2.5" filter="url(#primeGlow)" />
              <text
                x={x}
                y={y - 18}
                fill="#FFD700"
                fontSize="8.5"
                fontFamily="monospace"
                textAnchor="middle"
                fontWeight="800"
                className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]"
              >
                ★ {v.name}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Floating Interactive Map Controls (Zoom, Pan, Auto-Drift) */}
      <div className="absolute top-14 right-4 z-30 flex items-center gap-1.5 glass-panel p-1 border border-white/[0.12] rounded-xl shadow-lg">
        <button
          onClick={() => setAutoDrift((prev) => !prev)}
          className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
            autoDrift
              ? 'bg-[#5FE38A]/20 text-[#5FE38A] border border-[#5FE38A]/40'
              : 'text-[#94A3B8] hover:text-white hover:bg-white/[0.05]'
          }`}
          title="Toggle Automated Oceanic Wave & Camera Drift"
        >
          <Waves size={12} className={autoDrift ? 'animate-pulse' : ''} />
          <span>{autoDrift ? 'OCEAN DRIFT: ON' : 'DRIFT: OFF'}</span>
        </button>

        <div className="w-px h-3.5 bg-white/10 mx-0.5" />

        <button
          onClick={() => setZoom((z) => Math.min(z * 1.25, 3.2))}
          className="p-1.5 rounded-lg text-[#CBD5E1] hover:text-white hover:bg-white/[0.08] transition-all cursor-pointer"
          title="Zoom In"
        >
          <ZoomIn size={13} />
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(z / 1.25, 0.75))}
          className="p-1.5 rounded-lg text-[#CBD5E1] hover:text-white hover:bg-white/[0.08] transition-all cursor-pointer"
          title="Zoom Out"
        >
          <ZoomOut size={13} />
        </button>
        <button
          onClick={handleResetView}
          className="p-1.5 rounded-lg text-[#CBD5E1] hover:text-white hover:bg-white/[0.08] transition-all cursor-pointer"
          title="Reset Ocean View & Recenter"
        >
          <RotateCcw size={13} />
        </button>
      </div>



      {/* Legend (Bottom-Left exact match) */}
      <div className="absolute bottom-3 left-3 bg-[#071322]/95 border border-[#162C46] px-3.5 py-2.5 rounded-lg z-20 space-y-1.5 pointer-events-none shadow-lg">
        <div className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">LEGEND</div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#EF4444]" />
          <span className="text-[11px] text-white/90">Detected Spill</span>
        </div>
        <div className="flex items-center gap-2">
          <svg width="14" height="3" className="shrink-0">
            <line x1="0" y1="1.5" x2="14" y2="1.5" stroke="#FFA500" strokeWidth="2" strokeDasharray="3 2" />
          </svg>
          <span className="text-[11px] text-white/90">Drift Trajectory</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#00D4FF]" />
          <span className="text-[11px] text-white/90">Vessel (Normal)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#FFA500]" />
          <span className="text-[11px] text-white/90">Vessel (Suspicious)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#FFD700]" />
          <span className="text-[11px] text-white/90">Prime Suspect</span>
        </div>
      </div>

      {/* Scale bar (Bottom-Right exact match) */}
      <div className="absolute bottom-3 right-3 z-20 bg-[#071322]/95 border border-[#162C46] px-3 py-1.5 rounded-lg pointer-events-none shadow-lg">
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-center">
            <div className="w-16 h-0.5 bg-white/60" />
            <div className="flex justify-between w-16">
              <div className="w-px h-1.5 bg-white/60" />
              <div className="w-px h-1.5 bg-white/60" />
            </div>
          </div>
          <span className="font-mono text-[10px] text-white/90">100 km</span>
        </div>
      </div>



      {/* Hover vessel telemetry card */}
      {hovered && (
        <div
          className="absolute pointer-events-none glass-panel px-3 py-2 text-xs z-30 shadow-2xl border border-white/[0.2] rounded-xl backdrop-blur-2xl"
          style={{
            left: Math.min(hovered.x + 14, (containerRef.current?.clientWidth ?? 300) - 180),
            top: Math.max(hovered.y - 60, 12),
          }}
        >
          <div className="font-bold text-white flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#5FE38A]" />
            {hovered.vessel.name}
          </div>
          <div className="text-muted text-[11px] font-mono mt-0.5">
            MMSI {hovered.vessel.mmsi} · {hovered.vessel.speed || 12} kn
          </div>
          <div
            className="text-[10px] font-bold font-mono mt-1 uppercase"
            style={{
              color: isPrime(hovered.vessel)
                ? '#FFD700'
                : isAnomaly(hovered.vessel)
                ? '#FFA500'
                : '#00D4FF',
            }}
          >
            {isPrime(hovered.vessel)
              ? '★ PRIME SUSPECT ATTRIBUTED'
              : isAnomaly(hovered.vessel)
              ? '⚠ KINEMATIC ANOMALY FLAGGED'
              : '✔ NORMAL TRANSIT FLEET'}
          </div>
        </div>
      )}
    </div>
  );
}
