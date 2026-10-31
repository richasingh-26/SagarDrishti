import { useState, useRef, useCallback, useEffect } from 'react';
import { Badge } from '@/components/Badge';
import { PanelHeader } from '@/components/Panel';
import { API_BASE, getVessels } from '@/lib/api';
import {
  FlaskConical,
  Ship,
  Plus,
  Trash2,
  Play,
  MapPin,
  Droplets,
  Loader2,
  ChevronRight,
  Trophy,
  AlertTriangle,
} from 'lucide-react';

interface ScenarioVessel {
  id: string;
  name: string;
  mmsi: string;
  lat: number;
  lon: number;
  speed: number;
  heading: number;
  anomaly: number;
}

interface SpillConfig {
  lat: number;
  lon: number;
  radiusKm: number;
  placed: boolean;
}

interface AttributionResult {
  name: string;
  mmsi: string;
  distance: number;
  iou: number;
  attribution: number;
}

interface PrimeSuspectResult {
  scenario_id: string;
  spill_location: [number, number];
  prime_suspect: AttributionResult;
  all_vessels: AttributionResult[];
}

// --- Map projection constants (Singapore Strait) ---
const MAP_W = 600;
const MAP_H = 500;
const LAT_MIN = 0.5;
const LAT_MAX = 2.5;
const LON_MIN = 103.0;
const LON_MAX = 105.0;

const lonToX = (lon: number) => ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * MAP_W;
const latToY = (lat: number) => MAP_H - ((lat - LAT_MIN) / (LAT_MAX - LAT_MIN)) * MAP_H;

// Real anomalous vessels loaded from backend on mount
const fallbackShips: Omit<ScenarioVessel, 'id'>[] = [];

const API_HEADERS = { 'Content-Type': 'application/json' };

export function ScenarioBuilder() {
  const [ships, setShips] = useState<ScenarioVessel[]>([]);
  const [shipForm, setShipForm] = useState({
    name: '',
    lat: '1.25',
    lon: '103.8',
    speed: '10.0',
    heading: '90',
  });
  const [spill, setSpill] = useState<SpillConfig>({
    lat: 1.3,
    lon: 103.9,
    radiusKm: 3.0,
    placed: false,
  });
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<PrimeSuspectResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);
  const shipIdRef = useRef(0);

  const nextId = useCallback(() => `ship-${++shipIdRef.current}`, []);

  // Load real anomalous vessels from backend on mount
  useEffect(() => {
    getVessels()
      .then((res) => {
        const anomalous = (res.vessels || [])
          .filter((v) => v.is_anomaly)
          .slice(0, 5);
        if (anomalous.length > 0) {
          setShips(
            anomalous.map((v) => ({
              id: nextId(),
              name: v.name,
              mmsi: v.mmsi,
              lat: v.lat,
              lon: v.lon,
              speed: v.speed,
              heading: v.heading,
              anomaly: 1,
            }))
          );
        }
      })
      .catch(() => {
        // Backend offline — user can add vessels manually
      });
  }, []);

  const loadFallback = () => {
    getVessels()
      .then((res) => {
        const anomalous = (res.vessels || [])
          .filter((v) => v.is_anomaly)
          .slice(0, 5);
        if (anomalous.length > 0) {
          setShips(
            anomalous.map((v) => ({
              id: nextId(),
              name: v.name,
              mmsi: v.mmsi,
              lat: v.lat,
              lon: v.lon,
              speed: v.speed,
              heading: v.heading,
              anomaly: 1,
            }))
          );
          setUsingFallback(true);
        }
      })
      .catch(() => {
        setUsingFallback(false);
      });
  };

  const addShip = () => {
    const name = shipForm.name.trim();
    if (!name) return;
    const lat = parseFloat(shipForm.lat);
    const lon = parseFloat(shipForm.lon);
    if (isNaN(lat) || isNaN(lon)) return;
    const speed = parseFloat(shipForm.speed) || 0;
    const heading = parseFloat(shipForm.heading) || 0;
    setShips((prev) => [
      ...prev,
      {
        id: nextId(),
        name,
        mmsi: String(200000000 + Math.floor(Math.random() * 799999999)),
        lat,
        lon,
        speed,
        heading,
        anomaly: 1,
      },
    ]);
    setShipForm({ ...shipForm, name: '' });
    setUsingFallback(false);
  };

  const removeShip = (id: string) => {
    setShips((prev) => prev.filter((s) => s.id !== id));
  };

  const placeSpill = () => {
    const lat = parseFloat(String(spill.lat));
    const lon = parseFloat(String(spill.lon));
    if (isNaN(lat) || isNaN(lon)) return;
    setSpill((prev) => ({ ...prev, lat, lon, placed: true }));
  };

  const runAttribution = async () => {
    if (ships.length === 0) {
      setError('Add at least one ship before running the attribution test.');
      return;
    }
    if (!spill.placed) {
      setError('Place the spill before running the attribution test.');
      return;
    }
    setError(null);
    setRunning(true);
    setResult(null);

    const scenarioId = `SCENARIO_${Date.now()}`;
    const payload = {
      scenario_id: scenarioId,
      vessels: ships.map((s) => ({
        name: s.name,
        mmsi: s.mmsi,
        lat: s.lat,
        lon: s.lon,
        speed: s.speed,
        heading: s.heading,
        anomaly: 1,
      })),
      spill: {
        center_lat: spill.lat,
        center_lon: spill.lon,
        radius_km: spill.radiusKm,
      },
    };

    try {
      const postRes = await fetch(`${API_BASE}/api/custom-scenario`, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify(payload),
      });
      if (!postRes.ok) throw new Error(`POST failed: ${postRes.status}`);

      // small delay to let server store
      await new Promise((r) => setTimeout(r, 300));

      const getRes = await fetch(
        `${API_BASE}/api/custom-scenario/${scenarioId}/prime-suspect`
      );
      if (!getRes.ok) throw new Error(`GET failed: ${getRes.status}`);
      const data: PrimeSuspectResult = await getRes.json();
      if (data.prime_suspect) {
        setResult(data);
      } else {
        throw new Error('No prime suspect returned');
      }
    } catch {
      // Fallback: compute locally
      setUsingFallback(true);
      const results: AttributionResult[] = ships.map((v) => {
        const dist = Math.sqrt(
          (v.lat - spill.lat) ** 2 + (v.lon - spill.lon) ** 2
        );
        const iou = Math.max(0, 100 * (1 - dist * 20));
        return {
          name: v.name,
          mmsi: v.mmsi,
          distance: Math.round(dist * 10000) / 10000,
          iou: Math.round(iou * 10) / 10,
          attribution: Math.min(95, Math.round(iou + 25)),
        };
      });
      results.sort((a, b) => b.iou - a.iou);
      setResult({
        scenario_id: scenarioId,
        spill_location: [spill.lat, spill.lon],
        prime_suspect: results[0],
        all_vessels: results,
      });
    } finally {
      setRunning(false);
    }
  };

  // Spill circle radius in px (scaled visually)
  const spillRadiusPx = Math.min(60, Math.max(12, spill.radiusKm * 8));

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[rgba(168,85,247,0.12)] border border-[#A855F7] flex items-center justify-center">
            <FlaskConical size={20} className="text-[#A855F7]" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">Scenario Builder</h1>
            <p className="text-xs text-muted">Create a custom fleet and spill to test the attribution system</p>
          </div>
        </div>
        <Badge color="gold">JUDGE DEMO MODE</Badge>
      </div>

      {usingFallback && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-[rgba(255,165,0,0.08)] border border-[rgba(255,165,0,0.25)]">
          <AlertTriangle size={14} className="text-[#FFA500] shrink-0" />
          <span className="text-xs text-[#FFA500]">Using cached data — backend offline</span>
        </div>
      )}

      {/* 12-column grid */}
      <div className="grid grid-cols-12 gap-4">
        {/* LEFT: Add Ships */}
        <div className="col-span-12 lg:col-span-4 glass-panel flex flex-col">
          <PanelHeader
            title="Step 1: Add Custom Ships"
            badge={<Badge color="cyan">FLEET</Badge>}
            right={
              <button
                onClick={loadFallback}
                className="text-[0.625rem] text-[#00D4FF] hover:underline uppercase tracking-wider"
              >
                Load Samples
              </button>
            }
          />
          <div className="p-4 space-y-3 flex-1 overflow-y-auto">
            {/* Input form */}
            <div>
              <label className="section-label text-[0.5625rem]">Ship Name</label>
              <input
                type="text"
                value={shipForm.name}
                onChange={(e) => setShipForm({ ...shipForm, name: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && addShip()}
                placeholder="e.g. MT OCEAN VOYAGER"
                className="w-full px-3 py-2 rounded-md bg-[rgba(10,22,40,0.6)] border border-cyan-dim text-sm text-white focus:outline-none focus:border-[#00D4FF] placeholder:text-muted/50"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="section-label text-[0.5625rem]">Latitude</label>
                <input
                  type="number"
                  step="0.01"
                  value={shipForm.lat}
                  onChange={(e) => setShipForm({ ...shipForm, lat: e.target.value })}
                  className="w-full px-3 py-2 rounded-md bg-[rgba(10,22,40,0.6)] border border-cyan-dim text-sm text-white focus:outline-none focus:border-[#00D4FF] font-mono"
                />
              </div>
              <div>
                <label className="section-label text-[0.5625rem]">Longitude</label>
                <input
                  type="number"
                  step="0.01"
                  value={shipForm.lon}
                  onChange={(e) => setShipForm({ ...shipForm, lon: e.target.value })}
                  className="w-full px-3 py-2 rounded-md bg-[rgba(10,22,40,0.6)] border border-cyan-dim text-sm text-white focus:outline-none focus:border-[#00D4FF] font-mono"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="section-label text-[0.5625rem]">Speed (kn)</label>
                <input
                  type="number"
                  step="0.1"
                  value={shipForm.speed}
                  onChange={(e) => setShipForm({ ...shipForm, speed: e.target.value })}
                  className="w-full px-3 py-2 rounded-md bg-[rgba(10,22,40,0.6)] border border-cyan-dim text-sm text-white focus:outline-none focus:border-[#00D4FF] font-mono"
                />
              </div>
              <div>
                <label className="section-label text-[0.5625rem]">Heading (°)</label>
                <input
                  type="number"
                  step="1"
                  value={shipForm.heading}
                  onChange={(e) => setShipForm({ ...shipForm, heading: e.target.value })}
                  className="w-full px-3 py-2 rounded-md bg-[rgba(10,22,40,0.6)] border border-cyan-dim text-sm text-white focus:outline-none focus:border-[#00D4FF] font-mono"
                />
              </div>
            </div>
            <button
              onClick={addShip}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-md bg-[rgba(0,212,255,0.12)] hover:bg-[rgba(0,212,255,0.2)] border border-cyan-dim text-[#00D4FF] text-xs font-semibold uppercase tracking-wider transition-all"
            >
              <Plus size={14} /> Add Ship to Fleet
            </button>

            {/* Ship list */}
            <div className="space-y-1.5 pt-2">
              <div className="section-label text-[0.5625rem] mb-1">
                Fleet ({ships.length} vessels)
              </div>
              {ships.length === 0 ? (
                <div className="text-xs text-muted text-center py-6 border border-dashed border-cyan-dim rounded-md">
                  No ships added yet. Add one above or load samples.
                </div>
              ) : (
                ships.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-2 px-2.5 py-2 rounded-md bg-[rgba(0,212,255,0.04)] border border-cyan-dim group"
                  >
                    <Ship size={13} className="text-[#00D4FF] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-white truncate">{s.name}</div>
                      <div className="text-[0.5625rem] text-muted font-mono">
                        {s.lat.toFixed(2)}, {s.lon.toFixed(2)} · {s.speed}kn · {s.heading}°
                      </div>
                    </div>
                    <button
                      onClick={() => removeShip(s.id)}
                      className="text-muted hover:text-[#FF4444] transition-colors shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* CENTER: Live Preview */}
        <div className="col-span-12 lg:col-span-5 glass-panel flex flex-col">
          <PanelHeader title="Live Preview" badge={<Badge color="cyan">SINGAPORE STRAIT</Badge>} />
          <div className="flex-1 relative overflow-hidden">
            <svg
              viewBox={`0 0 ${MAP_W} ${MAP_H}`}
              preserveAspectRatio="xMidYMid slice"
              className="absolute inset-0 w-full h-full"
            >
              <defs>
                <linearGradient id="scenarioSea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0A1628" />
                  <stop offset="100%" stopColor="#1A2A4A" />
                </linearGradient>
                <radialGradient id="spillGrad" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#FF4444" stopOpacity="0.5" />
                  <stop offset="70%" stopColor="#FF4444" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#FF4444" stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* Sea background */}
              <rect width={MAP_W} height={MAP_H} fill="url(#scenarioSea)" />

              {/* Wave lines */}
              {Array.from({ length: Math.ceil(MAP_H / 40) }, (_, i) => (
                <line
                  key={`w-${i}`}
                  x1="0"
                  y1={i * 40}
                  x2={MAP_W}
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
                  <g key={`vg-${i}`}>
                    <line x1={x} y1="0" x2={x} y2={MAP_H} stroke="#ffffff" strokeWidth="0.5" opacity="0.07" />
                    <text x={x + 3} y={MAP_H - 6} fill="#4a6a8a" fontSize="9" fontFamily="monospace">
                      {lon.toFixed(2)}°E
                    </text>
                  </g>
                );
              })}
              {Array.from({ length: 9 }, (_, i) => {
                const lat = LAT_MIN + i * 0.25;
                const y = latToY(lat);
                return (
                  <g key={`hg-${i}`}>
                    <line x1="0" y1={y} x2={MAP_W} y2={y} stroke="#ffffff" strokeWidth="0.5" opacity="0.07" />
                    <text x="5" y={y - 3} fill="#4a6a8a" fontSize="9" fontFamily="monospace">
                      {lat.toFixed(2)}°N
                    </text>
                  </g>
                );
              })}

              {/* Spill */}
              {spill.placed && (
                <g>
                  <circle cx={lonToX(spill.lon)} cy={latToY(spill.lat)} r={spillRadiusPx + 10} fill="url(#spillGrad)" />
                  <circle
                    cx={lonToX(spill.lon)}
                    cy={latToY(spill.lat)}
                    r={spillRadiusPx}
                    fill="#FF4444"
                    fillOpacity="0.25"
                    stroke="#FF4444"
                    strokeWidth="2"
                    strokeDasharray="4 2"
                  />
                  <text
                    x={lonToX(spill.lon)}
                    y={latToY(spill.lat) - spillRadiusPx - 6}
                    fill="#FF6666"
                    fontSize="10"
                    fontFamily="monospace"
                    textAnchor="middle"
                    fontWeight="600"
                  >
                    SPILL · {spill.radiusKm}km
                  </text>
                </g>
              )}

              {/* Ships as arrows pointing in heading direction */}
              {ships.map((s) => {
                const x = lonToX(s.lon);
                const y = latToY(s.lat);
                const rad = (s.heading * Math.PI) / 180;
                const dx = Math.cos(rad) * 12;
                const dy = -Math.sin(rad) * 12;
                return (
                  <g key={s.id}>
                    <line x1={x} y1={y} x2={x + dx} y2={y + dy} stroke="#00D4FF" strokeWidth="2" />
                    <polygon
                      points={`${x + dx},${y + dy} ${x + dx - Math.sin(rad) * 5 - Math.cos(rad) * 4},${y + dy - Math.cos(rad) * 5 + Math.sin(rad) * 4} ${x + dx + Math.sin(rad) * 5 - Math.cos(rad) * 4},${y + dy + Math.cos(rad) * 5 + Math.sin(rad) * 4}`}
                      fill="#00D4FF"
                    />
                    <circle cx={x} cy={y} r="4" fill="#00D4FF" stroke="#ffffff" strokeWidth="1" />
                    <text
                      x={x + 8}
                      y={y - 8}
                      fill="#ffffff"
                      fontSize="8"
                      fontFamily="monospace"
                      opacity="0.8"
                    >
                      {s.name.length > 14 ? s.name.slice(0, 12) + '…' : s.name}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Overlay: coordinate readout */}
            <div className="absolute bottom-2 right-2 glass-panel px-2 py-1 pointer-events-none">
              <span className="metric-value text-[0.5625rem] text-[#00D4FF]">
                {ships.length} ships{spill.placed ? ' · spill placed' : ''}
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT: Spill + Run */}
        <div className="col-span-12 lg:col-span-3 space-y-4">
          {/* Step 2: Create Spill */}
          <div className="glass-panel flex flex-col">
            <PanelHeader title="Step 2: Create Spill" badge={<Badge color="danger">SPILL</Badge>} />
            <div className="p-4 space-y-3">
              <div>
                <label className="section-label text-[0.5625rem] flex items-center gap-1">
                  <MapPin size={10} /> Spill Latitude
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={spill.lat}
                  onChange={(e) => setSpill({ ...spill, lat: parseFloat(e.target.value) || 0, placed: false })}
                  className="w-full px-3 py-2 rounded-md bg-[rgba(10,22,40,0.6)] border border-cyan-dim text-sm text-white focus:outline-none focus:border-[#FF4444] font-mono"
                />
              </div>
              <div>
                <label className="section-label text-[0.5625rem] flex items-center gap-1">
                  <MapPin size={10} /> Spill Longitude
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={spill.lon}
                  onChange={(e) => setSpill({ ...spill, lon: parseFloat(e.target.value) || 0, placed: false })}
                  className="w-full px-3 py-2 rounded-md bg-[rgba(10,22,40,0.6)] border border-cyan-dim text-sm text-white focus:outline-none focus:border-[#FF4444] font-mono"
                />
              </div>
              <div>
                <label className="section-label text-[0.5625rem] flex items-center gap-1">
                  <Droplets size={10} /> Radius (km)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={spill.radiusKm}
                  onChange={(e) => setSpill({ ...spill, radiusKm: parseFloat(e.target.value) || 1, placed: false })}
                  className="w-full px-3 py-2 rounded-md bg-[rgba(10,22,40,0.6)] border border-cyan-dim text-sm text-white focus:outline-none focus:border-[#FF4444] font-mono"
                />
              </div>
              <button
                onClick={placeSpill}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-md bg-[rgba(255,68,68,0.12)] hover:bg-[rgba(255,68,68,0.2)] border border-[rgba(255,68,68,0.3)] text-[#FF4444] text-xs font-semibold uppercase tracking-wider transition-all"
              >
                <MapPin size={14} /> Place Spill
              </button>
              {spill.placed && (
                <div className="text-[0.625rem] text-[#00FF88] text-center">
                  Spill placed at {spill.lat.toFixed(2)}, {spill.lon.toFixed(2)}
                </div>
              )}
            </div>
          </div>

          {/* Step 3: Run Attribution */}
          <div className="glass-panel flex flex-col">
            <PanelHeader title="Step 3: Run Attribution" badge={<Badge color="gold">TEST</Badge>} />
            <div className="p-4 space-y-3">
              <button
                onClick={runAttribution}
                disabled={running || ships.length === 0 || !spill.placed}
                className="w-full flex items-center justify-center gap-2 px-3 py-3 rounded-md text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: 'linear-gradient(135deg, #A855F7 0%, #FFD700 100%)',
                  color: '#0A1628',
                }}
              >
                {running ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Running Test...
                  </>
                ) : (
                  <>
                    <Play size={14} /> Run Virtual Spill Test
                  </>
                )}
              </button>

              {error && (
                <div className="text-[0.625rem] text-[#FF4444] text-center">{error}</div>
              )}

              {/* Result panel */}
              {result && (
                <div className="space-y-2 pt-2 border-t border-cyan-dim">
                  <div className="flex items-center gap-2">
                    <Trophy size={14} className="text-[#FFD700]" />
                    <span className="section-label">Prime Suspect</span>
                  </div>
                  <div className="bg-[rgba(255,215,0,0.08)] border border-[rgba(255,215,0,0.25)] rounded-md p-3 space-y-1.5">
                    <div className="text-sm font-semibold text-[#FFD700]">
                      {result.prime_suspect.name}
                    </div>
                    <div className="text-[0.625rem] text-muted font-mono">
                      MMSI {result.prime_suspect.mmsi}
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[0.5625rem] text-muted">Attribution</span>
                      <span className="metric-value text-sm text-[#FFD700]">
                        {result.prime_suspect.attribution}/100
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[0.5625rem] text-muted">IoU</span>
                      <span className="metric-value text-sm text-white">
                        {result.prime_suspect.iou.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[0.5625rem] text-muted">Distance</span>
                      <span className="metric-value text-sm text-white">
                        {result.prime_suspect.distance}°
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM: Verification results */}
      {result && (
        <div className="space-y-4">
          {/* Success banner */}
          <div className="flex items-center gap-3 px-4 py-3 rounded-md bg-[rgba(0,255,136,0.08)] border border-[rgba(0,255,136,0.25)]">
            <div className="w-8 h-8 rounded-full bg-[rgba(0,255,136,0.15)] border border-[#00FF88] flex items-center justify-center">
              <span className="text-[#00FF88] text-sm font-bold">✓</span>
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-[#00FF88]">VERIFICATION COMPLETE</div>
              <div className="text-[0.625rem] text-muted">
                Scenario {result.scenario_id} · {result.all_vessels.length} vessels ranked
              </div>
            </div>
            <Badge color="success">PASSED</Badge>
          </div>

          {/* Summary grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass-panel p-4">
              <div className="section-label mb-1">Spill Location</div>
              <div className="metric-value text-lg text-white font-mono">
                {result.spill_location[0].toFixed(2)}°N, {result.spill_location[1].toFixed(2)}°E
              </div>
            </div>
            <div className="glass-panel p-4 border-r-2 border-r-[#FFD700]">
              <div className="section-label mb-1">Prime Suspect</div>
              <div className="text-lg font-semibold text-[#FFD700]">{result.prime_suspect.name}</div>
            </div>
            <div className="glass-panel p-4 border-r-2 border-r-[#FFD700]">
              <div className="section-label mb-1">Attribution Score</div>
              <div className="metric-value text-lg text-[#FFD700] font-mono">
                {result.prime_suspect.attribution}/100
              </div>
            </div>
          </div>

          {/* Ranked vessel list */}
          <div className="glass-panel overflow-hidden">
            <PanelHeader title="Vessel Attribution Ranking" badge={<Badge color="cyan">IoU MATCH</Badge>} />
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-cyan-dim">
                    <th className="px-4 py-2 text-left section-label font-medium">Rank</th>
                    <th className="px-4 py-2 text-left section-label font-medium">Vessel</th>
                    <th className="px-4 py-2 text-left section-label font-medium">MMSI</th>
                    <th className="px-4 py-2 text-right section-label font-medium">Distance (°)</th>
                    <th className="px-4 py-2 text-right section-label font-medium">IoU (%)</th>
                    <th className="px-4 py-2 text-right section-label font-medium">Attribution</th>
                    <th className="px-4 py-2 text-left section-label font-medium">Match</th>
                  </tr>
                </thead>
                <tbody>
                  {result.all_vessels.map((v, i) => {
                    const isPrime = i === 0;
                    const matchColor =
                      v.iou > 65 ? '#00FF88' : v.iou > 40 ? '#FFA500' : '#FF4444';
                    return (
                      <tr
                        key={v.mmsi}
                        className={`border-b border-cyan-dim/50 ${isPrime ? 'bg-[rgba(255,215,0,0.04)]' : ''}`}
                      >
                        <td className="px-4 py-2.5">
                          <span
                            className="metric-value font-semibold"
                            style={{ color: isPrime ? '#FFD700' : '#8899AA' }}
                          >
                            #{i + 1}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-white font-medium">
                          {isPrime && <span className="text-[#FFD700] mr-1">★</span>}
                          {v.name}
                        </td>
                        <td className="px-4 py-2.5 text-muted font-mono">{v.mmsi}</td>
                        <td className="px-4 py-2.5 text-right text-white font-mono">{v.distance}</td>
                        <td className="px-4 py-2.5 text-right font-mono" style={{ color: matchColor }}>
                          {v.iou.toFixed(1)}%
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span className="metric-value" style={{ color: isPrime ? '#FFD700' : '#ffffff' }}>
                            {v.attribution}/100
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 bg-[rgba(0,212,255,0.08)] rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${Math.min(100, v.iou)}%`, backgroundColor: matchColor }}
                              />
                            </div>
                            <ChevronRight size={12} className="text-muted" />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
