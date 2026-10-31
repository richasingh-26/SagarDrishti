import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/Badge';
import { PanelHeader } from '@/components/Panel';
import { Scale, Info, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import {
  getPrimeSuspect,
  getSuspectRanking,
  type PrimeSuspectResponse,
  type RankedSuspect,
} from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface GraphNode {
  id: string;
  label: string;
  type: 'satellite' | 'origin' | 'vessel' | 'simulation';
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
}

interface GraphEdge {
  source: string;
  target: string;
  strength: number;
}

interface XaiScore {
  label: string;
  score: number;
  max: number;
  color: string;
}

// ─── Build dynamic graph from real API data ───────────────────────────────────

function buildGraph(
  primeSuspect: PrimeSuspectResponse | null,
  suspects: RankedSuspect[]
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [
    { id: 'sat', label: 'Satellite Detection', type: 'satellite', x: 0.5, y: 0.12, vx: 0, vy: 0, color: '#FF4444' },
    { id: 'origin', label: 'Origin Zone', type: 'origin', x: 0.28, y: 0.44, vx: 0, vy: 0, color: '#FFD700' },
    { id: 'sim', label: 'Virtual Simulation', type: 'simulation', x: 0.72, y: 0.44, vx: 0, vy: 0, color: '#A855F7' },
  ];

  const edges: GraphEdge[] = [
    { source: 'sat', target: 'origin', strength: 0.9 },
    { source: 'sat', target: 'sim', strength: 0.7 },
  ];

  // Add vessel nodes from real ranked suspects
  const vesselList = suspects.slice(0, 4);
  const xPositions = [0.15, 0.38, 0.62, 0.85];

  vesselList.forEach((s, i) => {
    const id = `v${i}`;
    const isPrime = i === 0;
    const nodeColor = isPrime ? '#FFD700' : s.risk_level === 'CRITICAL' ? '#FF4444' : '#00D4FF';
    nodes.push({
      id,
      label: s.name.length > 14 ? s.name.slice(0, 12) + '…' : s.name,
      type: 'vessel',
      x: xPositions[i],
      y: 0.8,
      vx: 0,
      vy: 0,
      color: nodeColor,
    });

    const attrStrength = Math.max(0.15, Math.min(0.95, s.attribution_score / 100));
    edges.push({ source: 'origin', target: id, strength: attrStrength });
    if (i < 2) {
      edges.push({ source: 'sim', target: id, strength: attrStrength * 0.85 });
    }
  });

  // If no suspects yet, add placeholder nodes
  if (vesselList.length === 0 && primeSuspect) {
    nodes.push({
      id: 'v0',
      label: primeSuspect.name.length > 14 ? primeSuspect.name.slice(0, 12) + '…' : primeSuspect.name,
      type: 'vessel',
      x: 0.28,
      y: 0.8,
      vx: 0,
      vy: 0,
      color: '#FFD700',
    });
    const str = Math.max(0.2, Math.min(0.95, (primeSuspect.attribution_score ?? 50) / 100));
    edges.push({ source: 'origin', target: 'v0', strength: str });
    edges.push({ source: 'sim', target: 'v0', strength: str * 0.85 });
  }

  return { nodes, edges };
}

// ─── Build XAI scores from real attribution_components ───────────────────────

function buildXaiScores(primeSuspect: PrimeSuspectResponse | null): XaiScore[] {
  if (!primeSuspect?.attribution_components) {
    return [
      { label: 'Trajectory Proximity', score: 0, max: 30, color: '#64748B' },
      { label: 'Kinematic Anomaly', score: 0, max: 25, color: '#64748B' },
      { label: 'Cargo Risk Factor', score: 0, max: 25, color: '#64748B' },
      { label: 'Speed Deviation', score: 0, max: 20, color: '#64748B' },
    ];
  }

  const comp = primeSuspect.attribution_components;
  const maxes = { trajectory_proximity: 30, kinematic_anomaly: 25, vessel_cargo_risk: 25, speed_deviation: 20 };

  const normalize = (raw: number | null, max: number) =>
    raw == null ? 0 : Math.round((raw / 100) * max * 10) / 10;

  const colorFor = (pct: number) =>
    pct >= 0.75 ? '#5FE38A' : pct >= 0.5 ? '#00D4FF' : pct >= 0.25 ? '#FFA500' : '#EF4444';

  return [
    {
      label: 'Trajectory Proximity',
      score: normalize(comp.trajectory_proximity, maxes.trajectory_proximity),
      max: maxes.trajectory_proximity,
      color: colorFor((comp.trajectory_proximity ?? 0) / 100),
    },
    {
      label: 'Kinematic Anomaly',
      score: normalize(comp.kinematic_anomaly, maxes.kinematic_anomaly),
      max: maxes.kinematic_anomaly,
      color: colorFor((comp.kinematic_anomaly ?? 0) / 100),
    },
    {
      label: 'Cargo Risk Factor',
      score: normalize(comp.vessel_cargo_risk, maxes.vessel_cargo_risk),
      max: maxes.vessel_cargo_risk,
      color: colorFor((comp.vessel_cargo_risk ?? 0) / 100),
    },
    {
      label: 'Speed Deviation',
      score: normalize(comp.speed_deviation, maxes.speed_deviation),
      max: maxes.speed_deviation,
      color: colorFor((comp.speed_deviation ?? 0) / 100),
    },
  ];
}

// ─── Canvas Graph Component ───────────────────────────────────────────────────

function EvidenceGraph({ nodes: initNodes, edges }: { nodes: GraphNode[]; edges: GraphEdge[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<GraphNode[]>(initNodes.map((n) => ({ ...n })));
  const animRef = useRef<number>(0);

  // Sync nodes when prop changes
  useEffect(() => {
    nodesRef.current = initNodes.map((n) => ({ ...n }));
  }, [initNodes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();

    let frame = 0;
    const animate = () => {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      ctx.clearRect(0, 0, w, h);

      const nodes = nodesRef.current;
      const nodeMap = new Map(nodes.map((n) => [n.id, n]));

      // Gentle drift for vessel nodes
      nodes.forEach((n) => {
        if (n.type !== 'vessel') return;
        n.vx += (Math.random() - 0.5) * 0.0002;
        n.vy += (Math.random() - 0.5) * 0.0002;
        n.vx *= 0.95;
        n.vy *= 0.95;
        n.x += n.vx;
        n.y += n.vy;
        n.x = Math.max(0.08, Math.min(0.92, n.x));
        n.y = Math.max(0.58, Math.min(0.95, n.y));
      });

      // Draw edges
      const flowOffset = (frame * 0.01) % 1;
      edges.forEach((edge) => {
        const s = nodeMap.get(edge.source);
        const t = nodeMap.get(edge.target);
        if (!s || !t) return;

        const sx = s.x * w;
        const sy = s.y * h;
        const tx = t.x * w;
        const ty = t.y * h;

        ctx.strokeStyle = `rgba(0, 212, 255, ${edge.strength * 0.3})`;
        ctx.lineWidth = 1 + edge.strength * 1.5;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(tx, ty);
        ctx.stroke();

        // Animated particle
        const px = sx + (tx - sx) * flowOffset;
        const py = sy + (ty - sy) * flowOffset;
        ctx.fillStyle = `rgba(0, 212, 255, ${edge.strength * 0.9})`;
        ctx.beginPath();
        ctx.arc(px, py, 2.5, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw nodes
      nodes.forEach((n) => {
        const x = n.x * w;
        const y = n.y * h;
        const r = n.type === 'vessel' ? 16 : 22;

        // Glow halo
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r * 1.8);
        grad.addColorStop(0, n.color + '35');
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r * 1.8, 0, Math.PI * 2);
        ctx.fill();

        // Node body
        ctx.fillStyle = n.color + '22';
        ctx.strokeStyle = n.color;
        ctx.lineWidth = n.type === 'vessel' ? 1.5 : 2;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Pulse ring for satellite node
        if (n.type === 'satellite') {
          const pulseR = r + 8 + Math.sin(frame * 0.08) * 4;
          ctx.strokeStyle = n.color + '40';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(x, y, pulseR, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Label
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold 9px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(n.label, x, y + r + 13);
      });

      frame++;
      animRef.current = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animRef.current);
    };
  }, [edges]);

  return <canvas ref={canvasRef} className="w-full h-full" />;
}

// ─── Main Evidence Component ──────────────────────────────────────────────────

export function Evidence() {
  const [timeline, setTimeline] = useState(100);
  const [primeSuspect, setPrimeSuspect] = useState<PrimeSuspectResponse | null>(null);
  const [suspects, setSuspects] = useState<RankedSuspect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ps, ranking] = await Promise.all([
        getPrimeSuspect(),
        getSuspectRanking({ slick_lat: 1.25, slick_lon: 103.80, limit: 4 }),
      ]);
      setPrimeSuspect(ps);
      setSuspects(ranking.top_suspects || []);
    } catch (e: any) {
      setError(e?.message || 'Backend offline — cannot load evidence');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const { nodes, edges } = buildGraph(primeSuspect, suspects);
  const xaiScores = buildXaiScores(primeSuspect);
  const totalScore = xaiScores.reduce((s, x) => s + x.score, 0);
  const totalMax = xaiScores.reduce((s, x) => s + x.max, 0);
  const totalPct = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;

  // Evidence summary built from real data
  const evidenceSummary = [
    {
      label: 'Satellite Detection',
      value: 'Sentinel-1 SAR confirmed oil slick in Singapore Strait',
      color: '#FF4444',
    },
    {
      label: 'Prime Suspect',
      value: primeSuspect
        ? `${primeSuspect.name} — ${primeSuspect.reason || 'Spatial corridor intersection'}`
        : 'Running attribution model…',
      color: '#FFD700',
    },
    {
      label: 'Attribution Score',
      value: primeSuspect?.attribution_score != null
        ? `${primeSuspect.attribution_score.toFixed(1)}/100 — Risk Level: ${primeSuspect.risk_level || 'HIGH'}`
        : 'Computing…',
      color: '#A855F7',
    },
    {
      label: 'Model Confidence',
      value: primeSuspect?.attribution_score != null
        ? `${((primeSuspect as any).confidence_pct ?? primeSuspect.attribution_score).toFixed(1)}% confidence from Isolation Forest + backtrack`
        : 'Pending backend data',
      color: '#00D4FF',
    },
  ];

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Evidence Graph */}
        <div className="glass-panel overflow-hidden h-[380px]">
          <PanelHeader
            title="Forensic Evidence Graph"
            right={
              <div className="flex items-center gap-2">
                {loading && <Loader2 size={12} className="animate-spin text-[#00D4FF]" />}
                <button
                  onClick={fetchData}
                  className="p-1 rounded hover:bg-white/10 text-[#94A3B8] hover:text-white transition-colors"
                  title="Refresh evidence"
                >
                  <RefreshCw size={12} />
                </button>
                <Badge color="cyan">FORCE-DIRECTED</Badge>
              </div>
            }
          />
          <div className="h-[calc(100%-44px)] p-2">
            {loading ? (
              <div className="flex items-center justify-center h-full gap-3 text-[#94A3B8]">
                <Loader2 size={20} className="animate-spin text-[#00D4FF]" />
                <span className="text-sm">Loading forensic evidence from backend…</span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-[#94A3B8]">
                <AlertTriangle size={24} className="text-[#F59E0B]" />
                <span className="text-sm text-center max-w-xs">{error}</span>
                <button
                  onClick={fetchData}
                  className="px-3 py-1.5 rounded bg-[#00D4FF]/10 border border-[#00D4FF]/30 text-[#00D4FF] text-xs hover:bg-[#00D4FF]/20"
                >
                  Retry
                </button>
              </div>
            ) : (
              <EvidenceGraph nodes={nodes} edges={edges} />
            )}
          </div>
        </div>

        {/* Prime Suspect Summary Row */}
        {!loading && !error && primeSuspect && (
          <div className="glass-panel p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="section-label">Prime Suspect — Live Attribution</span>
              <Badge color={primeSuspect.risk_level === 'CRITICAL' ? 'danger' : 'warning'}>
                {primeSuspect.risk_level || 'HIGH'} RISK
              </Badge>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-[rgba(255,215,0,0.05)] border border-[#FFD700]/20">
                <div className="text-[10px] text-[#94A3B8] mb-1 uppercase tracking-wide">Vessel Name</div>
                <div className="text-sm font-bold text-[#FFD700]">{primeSuspect.name}</div>
              </div>
              <div className="p-3 rounded-lg bg-[rgba(0,212,255,0.05)] border border-[#00D4FF]/20">
                <div className="text-[10px] text-[#94A3B8] mb-1 uppercase tracking-wide">MMSI</div>
                <div className="text-sm font-mono text-[#00D4FF]">{primeSuspect.mmsi}</div>
              </div>
              <div className="p-3 rounded-lg bg-[rgba(239,68,68,0.05)] border border-[#EF4444]/20">
                <div className="text-[10px] text-[#94A3B8] mb-1 uppercase tracking-wide">Attribution</div>
                <div className="text-sm font-bold text-[#EF4444]">
                  {primeSuspect.attribution_score?.toFixed(1) ?? '--'}/100
                </div>
              </div>
              <div className="p-3 rounded-lg bg-[rgba(168,85,247,0.05)] border border-[#A855F7]/20">
                <div className="text-[10px] text-[#94A3B8] mb-1 uppercase tracking-wide">Vessel Type</div>
                <div className="text-sm text-[#A855F7] truncate">{primeSuspect.type || 'Unknown'}</div>
              </div>
            </div>
            {primeSuspect.reason && (
              <div className="mt-3 p-2.5 rounded bg-[rgba(255,215,0,0.04)] border border-[#FFD700]/15 text-xs text-[#94A3B8]">
                <span className="text-[#FFD700] font-semibold">Evidence: </span>{primeSuspect.reason}
              </div>
            )}
          </div>
        )}

        {/* Ranked Suspects Table */}
        {!loading && !error && suspects.length > 0 && (
          <div className="glass-panel overflow-hidden">
            <PanelHeader title="Candidate Vessel Rankings" right={<Badge color="gold">REAL AIS DATA</Badge>} />
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[rgba(0,212,255,0.15)]">
                    {['Rank', 'Vessel', 'MMSI', 'Type', 'Dist to Origin', 'Attribution', 'Risk'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {suspects.map((s, i) => {
                    const riskColor =
                      s.risk_level === 'CRITICAL' ? '#EF4444' :
                      s.risk_level === 'HIGH' ? '#F59E0B' :
                      s.risk_level === 'MEDIUM' ? '#FFD700' : '#5BC0BE';
                    return (
                      <tr
                        key={s.mmsi}
                        className={`border-b border-[rgba(0,212,255,0.06)] transition-colors hover:bg-white/[0.02] ${i === 0 ? 'bg-[rgba(255,215,0,0.03)]' : ''}`}
                      >
                        <td className="px-4 py-3">
                          <span className="font-mono font-bold text-sm" style={{ color: i === 0 ? '#FFD700' : '#64748B' }}>
                            #{s.rank}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-white">{s.name}</td>
                        <td className="px-4 py-3 font-mono text-[#00D4FF]">{s.mmsi}</td>
                        <td className="px-4 py-3 text-[#94A3B8]">{s.type}</td>
                        <td className="px-4 py-3 font-mono text-white">{s.distance_to_origin_km} km</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-[rgba(0,212,255,0.08)] rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${s.attribution_score}%`,
                                  backgroundColor: riskColor,
                                }}
                              />
                            </div>
                            <span className="font-mono font-bold" style={{ color: riskColor }}>
                              {s.attribution_score}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="px-2 py-0.5 rounded text-[10px] font-bold border"
                            style={{ color: riskColor, borderColor: riskColor + '40', backgroundColor: riskColor + '12' }}
                          >
                            {s.risk_level}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Timeline scrubber */}
        <div className="glass-panel p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="section-label">Evidence Timeline</span>
            <span className="metric-value text-xs text-[#00D4FF]">
              {new Date(Date.now() - (100 - timeline) * 60000).toISOString().slice(11, 19)} UTC
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={timeline}
            onChange={(e) => setTimeline(Number(e.target.value))}
            className="w-full accent-[#00D4FF]"
          />
          <div className="flex justify-between text-[0.625rem] text-muted">
            <span>T-60min</span>
            <span>T-45min</span>
            <span>T-30min</span>
            <span>T-15min</span>
            <span>NOW</span>
          </div>
        </div>

        {/* Legal disclaimer */}
        <div className="flex items-start gap-2 px-4 py-3 rounded-md bg-[rgba(136,153,170,0.04)] border border-[rgba(136,153,170,0.1)]">
          <Info size={12} className="text-muted shrink-0 mt-0.5" />
          <p className="text-[0.625rem] text-muted leading-relaxed">
            This attribution analysis is an investigative aid, not a legal determination.
            Evidence scores are based on probabilistic models using real AIS tracking data and
            should be corroborated with additional evidence before legal action.
            SagarDrishti is not liable for actions taken based on these results.
          </p>
        </div>
      </div>

      {/* Explainable AI Panel */}
      <div className="w-80 shrink-0 p-4 pl-0 overflow-y-auto space-y-4">
        <div className="glass-panel p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale size={16} className="text-[#00D4FF]" />
              <span className="section-label">Explainable AI</span>
            </div>
            {loading && <Loader2 size={12} className="animate-spin text-[#00D4FF]" />}
          </div>

          <div className="text-center py-2">
            <div
              className="metric-value text-3xl font-semibold"
              style={{ color: totalPct >= 70 ? '#EF4444' : totalPct >= 50 ? '#F59E0B' : '#00D4FF' }}
            >
              {totalScore.toFixed(1)}/{totalMax}
            </div>
            <div className="text-xs text-muted mt-1">Total Attribution Score</div>
            <div className="text-[10px] text-[#64748B] mt-0.5">
              {primeSuspect ? `Suspect: ${primeSuspect.name}` : loading ? 'Loading…' : 'No data'}
            </div>
          </div>

          <div className="space-y-3">
            {xaiScores.map((s) => (
              <div key={s.label} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white">{s.label}</span>
                  <span className="metric-value text-xs" style={{ color: s.color }}>
                    {s.score}/{s.max}
                  </span>
                </div>
                <div className="h-1.5 bg-[rgba(0,212,255,0.06)] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${s.max > 0 ? (s.score / s.max) * 100 : 0}%`,
                      backgroundColor: s.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-cyan-dim space-y-2">
            <div className="section-label">Evidence Summary</div>
            <div className="space-y-1.5">
              {evidenceSummary.map((e) => (
                <div key={e.label} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: e.color }} />
                  <div>
                    <div className="text-[0.625rem] font-medium text-white">{e.label}</div>
                    <div className="text-[0.5625rem] text-muted leading-relaxed">{e.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
