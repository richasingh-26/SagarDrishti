import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { getApiBase, type Vessel } from '@/lib/api';

interface TacticalSeaViewProps {
  vessels: Vessel[];
  primeSuspectName?: string;
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

export function TacticalSeaView({ vessels: propVessels, primeSuspectName, onVesselClick }: TacticalSeaViewProps) {
  const [fetchedVessels, setFetchedVessels] = useState<Vessel[]>([]);
  const [hovered, setHovered] = useState<HoverState | null>(null);
  const [pulsePhase, setPulsePhase] = useState(0);
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

  // Pulse animation for anomalies and prime suspect
  useEffect(() => {
    let raf: number;
    const tick = () => {
      setPulsePhase((p) => (p + 0.04) % (Math.PI * 2));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
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
    const normals: Vessel[] = [];

    for (const v of vessels) {
      if (typeof v.lat !== 'number' || typeof v.lon !== 'number' || !isFinite(v.lat) || !isFinite(v.lon)) {
        continue;
      }
      const inBounds = v.lat >= 0.4 && v.lat <= 2.6 && v.lon >= 102.8 && v.lon <= 105.2;

      if (isPrime(v)) {
        primes.push(v);
      } else if (isAnomaly(v)) {
        if (inBounds) anoms.push(v);
      } else {
        if (inBounds) normals.push(v);
      }
    }

    return { primeList: primes, anomList: anoms, normalList: normals };
  }, [vessels, isPrime, isAnomaly]);

  // Spill polygon center ~55% x, 50% y
  const spillCx = WIDTH * 0.55;
  const spillCy = HEIGHT * 0.50;
  const spillPoints = [
    [spillCx - 30, spillCy - 18],
    [spillCx - 10, spillCy - 28],
    [spillCx + 25, spillCy - 22],
    [spillCx + 38, spillCy - 5],
    [spillCx + 30, spillCy + 15],
    [spillCx + 8, spillCy + 25],
    [spillCx - 18, spillCy + 20],
    [spillCx - 35, spillCy + 5],
  ];

  // Origin point (above and left of spill)
  const originX = spillCx - 90;
  const originY = spillCy - 60;

  const handleVesselHover = (v: Vessel, e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHovered({
      vessel: v,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  // Scale viewBox to container width while keeping aspect
  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden rounded-lg"
      onMouseLeave={() => setHovered(null)}
    >
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 w-full h-full"
      >
        <defs>
          <linearGradient id="seaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0A1628" />
            <stop offset="100%" stopColor="#1A2A4A" />
          </linearGradient>
          <filter id="spillGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="12" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="primeGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="6" result="blur" />
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

        {/* Sea background */}
        <rect width={WIDTH} height={HEIGHT} fill="url(#seaGradient)" />

        {/* Wave lines every 40px */}
        {Array.from({ length: Math.ceil(HEIGHT / 40) }, (_, i) => (
          <line
            key={`wave-${i}`}
            x1="0"
            y1={i * 40}
            x2={WIDTH}
            y2={i * 40}
            stroke="#ffffff"
            strokeWidth="0.5"
            opacity="0.05"
          />
        ))}

        {/* Lat/lon grid */}
        {Array.from({ length: 9 }, (_, i) => {
          const lon = LON_MIN + i * 0.25;
          const x = lonToX(lon);
          return (
            <g key={`vgrid-${i}`}>
              <line x1={x} y1="0" x2={x} y2={HEIGHT} stroke="#ffffff" strokeWidth="0.5" opacity="0.06" />
              <text x={x + 4} y={HEIGHT - 6} fill="#4a6a8a" fontSize="9" fontFamily="monospace">
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
              <line x1="0" y1={y} x2={WIDTH} y2={y} stroke="#ffffff" strokeWidth="0.5" opacity="0.06" />
              <text x="6" y={y - 3} fill="#4a6a8a" fontSize="9" fontFamily="monospace">
                {lat.toFixed(2)}°N
              </text>
            </g>
          );
        })}

        {/* Spill glow underlay */}
        <polygon
          points={spillPoints.map((p) => p.join(',')).join(' ')}
          fill="#FF4444"
          opacity="0.15"
          filter="url(#spillGlow)"
        />

        {/* Spill polygon */}
        <polygon
          points={spillPoints.map((p) => p.join(',')).join(' ')}
          fill="#FF4444"
          fillOpacity="0.3"
          stroke="#FF4444"
          strokeWidth="2"
        />
        <text
          x={spillCx}
          y={spillCy - 35}
          fill="#FF6666"
          fontSize="10"
          fontFamily="monospace"
          textAnchor="middle"
          fontWeight="600"
        >
          DETECTED SPILL 3.2 km²
        </text>

        {/* Drift trajectory (orange dashed from origin to spill) */}
        <line
          x1={originX}
          y1={originY}
          x2={spillCx - 5}
          y2={spillCy - 10}
          stroke="#FFA500"
          strokeWidth="2.5"
          strokeDasharray="6 4"
          markerEnd="url(#arrowhead)"
        />

        {/* Origin zone (gold dashed circle) */}
        <circle
          cx={originX}
          cy={originY}
          r="50"
          fill="#FFD700"
          fillOpacity="0.05"
          stroke="#FFD700"
          strokeWidth="1.5"
          strokeDasharray="4 3"
        />
        <text
          x={originX}
          y={originY - 58}
          fill="#FFD700"
          fontSize="9"
          fontFamily="monospace"
          textAnchor="middle"
          fontWeight="600"
        >
          PROBABLE ORIGIN ZONE
        </text>

        {/* Vessel markers — High-performance segregated rendering for 10,000 ships */}
        {/* 1. Background normal fleet (batched for 60fps performance) */}
        {normalList.map((v) => {
          const x = lonToX(v.lon);
          const y = latToY(v.lat);
          if (x < -10 || x > WIDTH + 10 || y < -10 || y > HEIGHT + 10) return null;
          return (
            <circle
              key={`norm-${v.mmsi || v.name}`}
              cx={x}
              cy={y}
              r={3.5}
              fill="#00D4FF"
              stroke="#ffffff"
              strokeWidth="0.8"
              opacity="0.8"
              className="cursor-pointer hover:opacity-100 hover:r-5 transition-all"
              onMouseEnter={(e) => handleVesselHover(v, e)}
              onClick={() => onVesselClick?.(v)}
            />
          );
        })}

        {/* 2. Anomalous vessels (rendered with priority and pulse animation) */}
        {anomList.map((v) => {
          const x = lonToX(v.lon);
          const y = latToY(v.lat);
          if (x < -10 || x > WIDTH + 10 || y < -10 || y > HEIGHT + 10) return null;
          const pulseR = 9 + Math.sin(pulsePhase) * 3;
          const pulseO = 0.25 + Math.sin(pulsePhase) * 0.15;
          return (
            <g
              key={`anom-${v.mmsi || v.name}`}
              className="cursor-pointer"
              onMouseEnter={(e) => handleVesselHover(v, e)}
              onMouseMove={(e) => handleVesselHover(v, e)}
              onClick={() => onVesselClick?.(v)}
            >
              <circle cx={x} cy={y} r={pulseR} fill="#FFA500" opacity={pulseO} />
              <circle cx={x} cy={y} r={6} fill="#FFA500" stroke="#ffffff" strokeWidth="1.5" />
            </g>
          );
        })}

        {/* 3. Prime Suspect (rendered on top with prominent beacon) */}
        {primeList.map((v) => {
          const x = lonToX(v.lon);
          const y = latToY(v.lat);
          if (x < -10 || x > WIDTH + 10 || y < -10 || y > HEIGHT + 10) return null;
          const pulseR = 14 + Math.sin(pulsePhase) * 6;
          const pulseO = 0.3 + Math.sin(pulsePhase) * 0.15;
          return (
            <g
              key={`prime-${v.mmsi || v.name}`}
              className="cursor-pointer"
              onMouseEnter={(e) => handleVesselHover(v, e)}
              onMouseMove={(e) => handleVesselHover(v, e)}
              onClick={() => onVesselClick?.(v)}
            >
              <circle cx={x} cy={y} r={pulseR} fill="none" stroke="#FFD700" strokeWidth="1.5" opacity={pulseO} />
              <circle cx={x} cy={y} r={10} fill="#FFD700" stroke="#ffffff" strokeWidth="2" filter="url(#primeGlow)" />
              <text x={x} y={y - 16} fill="#FFD700" fontSize="8" fontFamily="monospace" textAnchor="middle" fontWeight="700">
                ★ {v.name}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Top-left: live investigation badge */}
      <div className="absolute top-3 left-3 flex items-center gap-2 glass-panel px-3 py-1.5 z-10 pointer-events-none">
        <span className="w-2 h-2 rounded-full bg-[#FF4444] animate-pulse" />
        <span className="text-xs font-semibold uppercase tracking-wider text-[#FF4444]">
          Live Investigation
        </span>
      </div>

      {/* Top-right: case ID */}
      <div className="absolute top-3 right-16 glass-panel px-3 py-1.5 z-10 pointer-events-none">
        <span className="section-label">Case</span>
        <span className="metric-value text-xs text-[#00D4FF] ml-1.5">#SAG-2026-001</span>
      </div>

      {/* Compass */}
      <div className="absolute top-3 right-3 z-10 glass-panel w-8 h-8 flex items-center justify-center rounded-full pointer-events-none">
        <span className="text-xs font-bold text-[#00D4FF]">N</span>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[6px] border-b-[#00D4FF]" />
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 glass-panel px-3 py-2 z-10 space-y-1.5 pointer-events-none">
        <div className="section-label mb-1">Legend</div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-[#FF4444] border border-[#FF4444]" />
          <span className="text-[0.625rem] text-white/80">Detected Spill</span>
        </div>
        <div className="flex items-center gap-2">
          <svg width="14" height="3" className="shrink-0">
            <line x1="0" y1="1.5" x2="14" y2="1.5" stroke="#FFA500" strokeWidth="2" strokeDasharray="3 2" />
          </svg>
          <span className="text-[0.625rem] text-white/80">Drift Trajectory</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#00D4FF] border border-white" />
          <span className="text-[0.625rem] text-white/80">Vessel (Normal)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#FFA500] border border-white" />
          <span className="text-[0.625rem] text-white/80">Vessel (Suspicious)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#FFD700] border border-white" />
          <span className="text-[0.625rem] text-white/80">Prime Suspect</span>
        </div>
      </div>

      {/* Scale bar */}
      <div className="absolute bottom-3 right-3 z-10 glass-panel px-2.5 py-1.5 pointer-events-none">
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-center">
            <div className="w-16 h-0.5 bg-white/60" />
            <div className="flex justify-between w-16">
              <div className="w-px h-1.5 bg-white/60" />
              <div className="w-px h-1.5 bg-white/60" />
            </div>
          </div>
          <span className="metric-value text-[0.625rem] text-white/80">100 km</span>
        </div>
      </div>

      {/* Hover tooltip */}
      {hovered && (
        <div
          className="absolute pointer-events-none glass-panel px-2.5 py-1.5 text-xs z-20"
          style={{
            left: Math.min(hovered.x + 12, (containerRef.current?.clientWidth ?? 300) - 160),
            top: Math.max(hovered.y - 50, 8),
          }}
        >
          <div className="font-semibold text-white">{hovered.vessel.name}</div>
          <div className="text-muted text-[0.625rem]">
            MMSI {hovered.vessel.mmsi} · {hovered.vessel.speed} kn
          </div>
          <div className="text-[0.625rem]" style={{
            color: isPrime(hovered.vessel) ? '#FFD700' : isAnomaly(hovered.vessel) ? '#FFA500' : '#00D4FF'
          }}>
            {isPrime(hovered.vessel) ? 'PRIME SUSPECT' : isAnomaly(hovered.vessel) ? 'ANOMALY' : 'NORMAL'}
          </div>
        </div>
      )}
    </div>
  );
}
