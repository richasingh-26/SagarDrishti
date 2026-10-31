import { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/Badge';
import { PanelHeader } from '@/components/Panel';
import {
  reconstructOrigin,
  type OriginReconstructionResponse,
} from '@/lib/api';
import {
  Crosshair,
  MapPin,
  Clock,
  Navigation,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Wind,
  Waves,
  Sliders,
} from 'lucide-react';

// ─── SVG map helpers (Singapore Strait bounds) ───────────────────────────────
const SVG_W = 600;
const SVG_H = 260;
const LAT_MIN = 0.8;
const LAT_MAX = 1.65;
const LON_MIN = 103.3;
const LON_MAX = 104.4;

const toSvgX = (lon: number) => ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * SVG_W;
const toSvgY = (lat: number) => SVG_H - ((lat - LAT_MIN) / (LAT_MAX - LAT_MIN)) * SVG_H;

// ─── Main Component ───────────────────────────────────────────────────────────

export function OriginReconstruction() {
  const [result, setResult] = useState<OriginReconstructionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showParams, setShowParams] = useState(false);

  // Controllable parameters
  const [windSpeed, setWindSpeed] = useState(12.0);
  const [windDir, setWindDir] = useState(220.0);
  const [currSpeed, setCurrSpeed] = useState(1.2);
  const [backtrackHrs, setBacktrackHrs] = useState(8);

  const runReconstruction = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await reconstructOrigin(
        1.25,     // slick_lat — Singapore Strait
        103.80,   // slick_lon
        backtrackHrs,
        windSpeed,
        windDir,
        currSpeed,
        135.0,    // current_direction_deg
        450.0     // spill_volume_m3
      );
      setResult(res);
    } catch (e: any) {
      setError(e?.message || 'Backend offline — cannot run origin reconstruction');
    } finally {
      setLoading(false);
    }
  }, [backtrackHrs, windSpeed, windDir, currSpeed]);

  useEffect(() => {
    runReconstruction();
  }, []);

  // Build dynamic steps from real result
  const steps = result
    ? [
        {
          label: 'Satellite Detection',
          time: 'T+0h',
          desc: `Oil slick at ${result.slick_lat?.toFixed(4) ?? '1.2500'}°N, ${result.slick_lon?.toFixed(4) ?? '103.8000'}°E — Sentinel-1 SAR`,
          color: '#FF4444',
          icon: MapPin,
        },
        {
          label: 'Drift Modeling',
          time: 'T-2h',
          desc: 'Reverse drift simulation using Copernicus NEMO ocean currents',
          color: '#FFA500',
          icon: Waves,
        },
        {
          label: 'Wind Correction',
          time: 'T-4h',
          desc: `ERA5 wind forcing applied — ${windSpeed} kn at ${windDir}°`,
          color: '#A855F7',
          icon: Wind,
        },
        {
          label: 'Origin Zone',
          time: `T-${result.backtrack_hours ?? backtrackHrs}h`,
          desc: `${result.origin_radius_km.toFixed(2)} km radius — ${result.candidate_vessels?.length ?? 0} vessels in proximity`,
          color: '#FFD700',
          icon: Crosshair,
        },
        {
          label: 'Vessel Matching',
          time: `T-${result.backtrack_hours ?? backtrackHrs}h`,
          desc: result.prime_suspect
            ? `Prime suspect: ${result.prime_suspect.name} — attribution ${result.prime_suspect.attribution_score?.toFixed(1) ?? '--'}/100`
            : 'Attribution model running across AIS fleet',
          color: '#00D4FF',
          icon: Navigation,
        },
      ]
    : [];

  // Map coordinates for SVG
  const spillX = result ? toSvgX(result.slick_lon ?? 103.80) : toSvgX(103.80);
  const spillY = result ? toSvgY(result.slick_lat ?? 1.25) : toSvgY(1.25);
  const originX = result ? toSvgX(result.origin_lon) : toSvgX(103.65);
  const originY = result ? toSvgY(result.origin_lat) : toSvgY(1.31);

  // Origin radius in SVG pixels (~0.01° ≈ 1.1 km; 1 km ≈ 0.009°)
  const radiusPx = result
    ? Math.max(15, Math.min(60, (result.origin_radius_km / (LON_MAX - LON_MIN)) * SVG_W * 0.5))
    : 30;

  const trajectory = result?.backtrack_trajectory ?? [];
  const candidateVessels = result?.candidate_vessels ?? [];

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Main panel */}
        <div className="glass-panel overflow-hidden">
          <PanelHeader
            title="Origin Reconstruction"
            right={
              <div className="flex items-center gap-2">
                {loading && <Loader2 size={12} className="animate-spin text-[#00D4FF]" />}
                <button
                  onClick={() => setShowParams((p) => !p)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-[#94A3B8] hover:text-white transition-all"
                >
                  <Sliders size={11} /> Parameters
                </button>
                <button
                  onClick={runReconstruction}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] bg-[#00D4FF]/10 hover:bg-[#00D4FF]/20 border border-[#00D4FF]/30 text-[#00D4FF] transition-all disabled:opacity-50"
                >
                  <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
                  Re-run
                </button>
                <Badge color="gold"><Crosshair size={10} /> BACKTRACKING</Badge>
              </div>
            }
          />

          {/* Parameter sliders */}
          {showParams && (
            <div className="px-6 py-4 border-b border-[rgba(0,212,255,0.1)] bg-[rgba(0,212,255,0.02)]">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: `Wind Speed: ${windSpeed} kn`, min: 0, max: 30, step: 0.5, val: windSpeed, set: setWindSpeed },
                  { label: `Wind Dir: ${windDir}°`, min: 0, max: 360, step: 5, val: windDir, set: setWindDir },
                  { label: `Current: ${currSpeed} kn`, min: 0, max: 5, step: 0.1, val: currSpeed, set: setCurrSpeed },
                  { label: `Backtrack: ${backtrackHrs}h`, min: 1, max: 24, step: 1, val: backtrackHrs, set: setBacktrackHrs },
                ].map(({ label, min, max, step, val, set }) => (
                  <div key={label}>
                    <div className="text-[10px] text-[#94A3B8] mb-1.5">{label}</div>
                    <input
                      type="range"
                      min={min}
                      max={max}
                      step={step}
                      value={val}
                      onChange={(e) => set(Number(e.target.value))}
                      className="w-full accent-[#00D4FF]"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="p-6">
            {/* SVG Map Visualization */}
            <div className="relative glass-panel rounded-lg overflow-hidden mb-6 h-64">
              {loading ? (
                <div className="flex items-center justify-center h-full gap-3 text-[#94A3B8]">
                  <Loader2 size={20} className="animate-spin text-[#00D4FF]" />
                  <span className="text-sm">Running backtrack simulation…</span>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <AlertTriangle size={24} className="text-[#F59E0B]" />
                  <span className="text-sm text-[#94A3B8] text-center max-w-xs">{error}</span>
                  <button
                    onClick={runReconstruction}
                    className="px-3 py-1.5 rounded bg-[#00D4FF]/10 border border-[#00D4FF]/30 text-[#00D4FF] text-xs hover:bg-[#00D4FF]/20"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <svg className="w-full h-full" viewBox={`0 0 ${SVG_W} ${SVG_H}`} preserveAspectRatio="xMidYMid meet">
                  {/* Grid */}
                  {Array.from({ length: 13 }).map((_, i) => (
                    <line key={`v${i}`} x1={i * 50} y1={0} x2={i * 50} y2={SVG_H} stroke="rgba(0,212,255,0.04)" />
                  ))}
                  {Array.from({ length: 7 }).map((_, i) => (
                    <line key={`h${i}`} x1={0} y1={i * 44} x2={SVG_W} y2={i * 44} stroke="rgba(0,212,255,0.04)" />
                  ))}

                  {/* Backtrack trajectory path from real waypoints */}
                  {trajectory.length >= 2 && (
                    <path
                      d={trajectory
                        .map((wp, i) => `${i === 0 ? 'M' : 'L'} ${toSvgX(wp.lon).toFixed(1)} ${toSvgY(wp.lat).toFixed(1)}`)
                        .join(' ')}
                      fill="none"
                      stroke="#FFD700"
                      strokeWidth="2"
                      strokeDasharray="6 4"
                    >
                      <animate attributeName="stroke-dashoffset" from="0" to="-20" dur="1s" repeatCount="indefinite" />
                    </path>
                  )}
                  {/* Fallback line if no trajectory waypoints */}
                  {trajectory.length < 2 && (
                    <line
                      x1={spillX}
                      y1={spillY}
                      x2={originX}
                      y2={originY}
                      stroke="#FFD700"
                      strokeWidth="2"
                      strokeDasharray="6 4"
                    >
                      <animate attributeName="stroke-dashoffset" from="0" to="-20" dur="1s" repeatCount="indefinite" />
                    </line>
                  )}

                  {/* Spill position */}
                  <circle cx={spillX} cy={spillY} r="6" fill="#FF4444" />
                  <circle cx={spillX} cy={spillY} r="14" fill="none" stroke="#FF4444" strokeWidth="1" opacity="0.4">
                    <animate attributeName="r" from="6" to="20" dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" from="0.6" to="0" dur="2s" repeatCount="indefinite" />
                  </circle>
                  <text x={spillX + 10} y={spillY - 8} fill="#FF4444" fontSize="9" fontWeight="600">
                    SPILL (T+0h)
                  </text>

                  {/* Origin zone */}
                  <circle
                    cx={originX}
                    cy={originY}
                    r={radiusPx}
                    fill="rgba(255,215,0,0.05)"
                    stroke="#FFD700"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                  />
                  <circle cx={originX} cy={originY} r="5" fill="#FFD700" />
                  <text x={originX + 10} y={originY + 4} fill="#FFD700" fontSize="9" fontWeight="600">
                    ORIGIN ZONE
                  </text>
                  {result && (
                    <text x={originX + 10} y={originY + 15} fill="rgba(255,215,0,0.6)" fontSize="7">
                      {result.origin_lat.toFixed(4)}°N {result.origin_lon.toFixed(4)}°E
                    </text>
                  )}

                  {/* Candidate vessels near origin */}
                  {candidateVessels.slice(0, 4).map((v, i) => {
                    const vx = toSvgX(v.lon);
                    const vy = toSvgY(v.lat);
                    const col = i === 0 ? '#FFD700' : '#FF4444';
                    return (
                      <g key={v.mmsi}>
                        <circle cx={vx} cy={vy} r="3.5" fill={col} opacity="0.9" />
                        <text x={vx + 6} y={vy + 3} fill={col} fontSize="7">
                          {v.name.slice(0, 10)}
                        </text>
                      </g>
                    );
                  })}

                  {/* Label */}
                  <text x={SVG_W / 2} y={18} fill="rgba(148,163,184,0.4)" fontSize="8" textAnchor="middle">
                    REVERSE DRIFT TRAJECTORY — SINGAPORE STRAIT
                  </text>
                </svg>
              )}
            </div>

            {/* Steps — dynamic from real data */}
            {!loading && !error && steps.length > 0 && (
              <div className="space-y-3">
                {steps.map((step, i) => {
                  const Icon = step.icon;
                  return (
                    <div key={i} className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center border shrink-0"
                          style={{ borderColor: step.color, backgroundColor: step.color + '15' }}
                        >
                          <Icon size={14} style={{ color: step.color }} />
                        </div>
                        {i < steps.length - 1 && <div className="w-px h-8 bg-cyan-dim mt-1" />}
                      </div>
                      <div className="pb-4 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-white">{step.label}</span>
                          <span className="metric-value text-[0.625rem] text-muted font-mono">{step.time}</span>
                        </div>
                        <div className="text-xs text-muted mt-0.5">{step.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Candidate vessel table */}
        {!loading && !error && candidateVessels.length > 0 && (
          <div className="glass-panel overflow-hidden">
            <PanelHeader title="Vessels in Origin Zone" right={<Badge color="danger">REAL AIS DATA</Badge>} />
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[rgba(0,212,255,0.1)]">
                    {['Vessel', 'MMSI', 'Type', 'Speed', 'Heading', 'Flag'].map((h) => (
                      <th key={h} className="px-4 py-2 text-left text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {candidateVessels.slice(0, 6).map((v, i) => (
                    <tr
                      key={v.mmsi}
                      className={`border-b border-[rgba(0,212,255,0.06)] hover:bg-white/[0.02] transition-colors ${i === 0 ? 'bg-[rgba(255,215,0,0.03)]' : ''}`}
                    >
                      <td className="px-4 py-2.5 font-semibold" style={{ color: i === 0 ? '#FFD700' : 'white' }}>
                        {i === 0 && <span className="mr-1">★</span>}{v.name}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[#00D4FF]">{v.mmsi}</td>
                      <td className="px-4 py-2.5 text-[#94A3B8]">{v.type}</td>
                      <td className="px-4 py-2.5 text-white font-mono">{v.speed} kn</td>
                      <td className="px-4 py-2.5 text-white font-mono">{v.heading}°</td>
                      <td className="px-4 py-2.5 text-[#94A3B8]">{v.flag || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Right sidebar — stats */}
      <div className="w-72 shrink-0 p-4 pl-0 space-y-3 overflow-y-auto">
        <div className="glass-panel p-4 space-y-2">
          <span className="section-label">Origin Coordinates</span>
          {loading ? (
            <div className="h-5 w-40 bg-white/5 rounded animate-pulse" />
          ) : result ? (
            <>
              <div className="metric-value text-sm text-[#FFD700] font-mono">
                {result.origin_lat.toFixed(4)}°N, {result.origin_lon.toFixed(4)}°E
              </div>
              <div className="text-xs text-muted">Singapore Strait — computed from AIS backtrack</div>
            </>
          ) : (
            <div className="text-xs text-[#F59E0B]">Unavailable</div>
          )}
        </div>

        <div className="glass-panel p-4 space-y-2">
          <span className="section-label">Backtrack Duration</span>
          {loading ? (
            <div className="h-8 w-20 bg-white/5 rounded animate-pulse" />
          ) : result ? (
            <>
              <div className="metric-value text-2xl text-white">{result.backtrack_hours ?? backtrackHrs}h</div>
              <div className="text-xs text-muted">From detection to estimated origin</div>
            </>
          ) : (
            <div className="text-xs text-[#F59E0B]">Unavailable</div>
          )}
        </div>

        <div className="glass-panel p-4 space-y-2">
          <span className="section-label">Vessels in Zone</span>
          {loading ? (
            <div className="h-8 w-10 bg-white/5 rounded animate-pulse" />
          ) : result ? (
            <>
              <div className="metric-value text-2xl text-[#FF4444]">
                {result.candidate_vessels?.length ?? 0}
              </div>
              <div className="text-xs text-muted">
                Within {result.origin_radius_km.toFixed(2)} km radius at origin time
              </div>
            </>
          ) : (
            <div className="text-xs text-[#F59E0B]">Unavailable</div>
          )}
        </div>

        <div className="glass-panel p-4 space-y-2">
          <span className="section-label">Model Confidence</span>
          {loading ? (
            <div className="h-6 w-full bg-white/5 rounded animate-pulse" />
          ) : result ? (
            <>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-[rgba(0,212,255,0.08)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#FFA500] to-[#FFD700] rounded-full transition-all duration-700"
                    style={{ width: `${result.confidence_pct ?? 80}%` }}
                  />
                </div>
                <span className="metric-value text-sm text-[#FFD700]">
                  {(result.confidence_pct ?? 80).toFixed(1)}%
                </span>
              </div>
            </>
          ) : (
            <div className="text-xs text-[#F59E0B]">Unavailable</div>
          )}
        </div>

        {/* Prime suspect card */}
        {!loading && result?.prime_suspect && (
          <div className="glass-panel p-4 space-y-2 border-t-2 border-t-[#FFD700]">
            <span className="section-label">Prime Suspect</span>
            <div className="text-sm font-bold text-[#FFD700]">{result.prime_suspect.name}</div>
            <div className="text-xs text-muted font-mono">{result.prime_suspect.mmsi}</div>
            <div className="text-xs text-[#94A3B8]">{result.prime_suspect.type || 'Unknown type'}</div>
            {result.prime_suspect.attribution_score != null && (
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1 h-1.5 bg-[rgba(0,212,255,0.08)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#F59E0B] to-[#EF4444] rounded-full"
                    style={{ width: `${result.prime_suspect.attribution_score}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-[#EF4444] font-bold">
                  {result.prime_suspect.attribution_score.toFixed(1)}/100
                </span>
              </div>
            )}
            {result.prime_suspect.reason && (
              <div className="text-[10px] text-muted leading-relaxed mt-1">
                {result.prime_suspect.reason}
              </div>
            )}
          </div>
        )}

        {/* Discharge window */}
        {!loading && result?.discharge_window && (
          <div className="glass-panel p-4 space-y-1">
            <span className="section-label">Discharge Window</span>
            <div className="text-xs text-[#00D4FF] font-mono">{result.discharge_window}</div>
          </div>
        )}
      </div>
    </div>
  );
}
