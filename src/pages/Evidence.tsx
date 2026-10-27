import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/Badge';
import { Panel, PanelHeader } from '@/components/Panel';
import { Scale, Info } from 'lucide-react';

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

const NODES: GraphNode[] = [
  { id: 'sat', label: 'Satellite Detection', type: 'satellite', x: 0.5, y: 0.15, vx: 0, vy: 0, color: '#FF4444' },
  { id: 'origin', label: 'Origin Zone', type: 'origin', x: 0.3, y: 0.45, vx: 0, vy: 0, color: '#FFD700' },
  { id: 'sim', label: 'Virtual Simulation', type: 'simulation', x: 0.7, y: 0.45, vx: 0, vy: 0, color: '#A855F7' },
  { id: 'v1', label: 'Suspect #1', type: 'vessel', x: 0.2, y: 0.8, vx: 0, vy: 0, color: '#FFD700' },
  { id: 'v2', label: 'Suspect #2', type: 'vessel', x: 0.4, y: 0.85, vx: 0, vy: 0, color: '#FF4444' },
  { id: 'v3', label: 'Suspect #3', type: 'vessel', x: 0.6, y: 0.85, vx: 0, vy: 0, color: '#FF4444' },
  { id: 'v4', label: 'OCEAN TRADER', type: 'vessel', x: 0.8, y: 0.8, vx: 0, vy: 0, color: '#00D4FF' },
];

const EDGES: GraphEdge[] = [
  { source: 'sat', target: 'origin', strength: 0.9 },
  { source: 'sat', target: 'sim', strength: 0.7 },
  { source: 'origin', target: 'v1', strength: 0.95 },
  { source: 'origin', target: 'v2', strength: 0.6 },
  { source: 'origin', target: 'v3', strength: 0.5 },
  { source: 'origin', target: 'v4', strength: 0.3 },
  { source: 'sim', target: 'v1', strength: 0.85 },
  { source: 'sim', target: 'v2', strength: 0.55 },
  { source: 'sim', target: 'v3', strength: 0.4 },
];

const XAI_SCORES = [
  { label: 'Location Match', score: 24, max: 25, color: '#00FF88' },
  { label: 'Time Window', score: 20, max: 20, color: '#00FF88' },
  { label: 'Route Match', score: 17, max: 20, color: '#00D4FF' },
  { label: 'Virtual Sim', score: 19, max: 20, color: '#00FF88' },
  { label: 'Behaviour', score: 7, max: 10, color: '#FFA500' },
];

function EvidenceGraph() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<GraphNode[]>(NODES.map((n) => ({ ...n })));
  const animRef = useRef<number>(0);

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

      // Simple force simulation
      nodes.forEach((n) => {
        if (n.type === 'satellite' || n.type === 'origin' || n.type === 'simulation') return;
        // Gentle drift
        n.vx += (Math.random() - 0.5) * 0.0002;
        n.vy += (Math.random() - 0.5) * 0.0002;
        n.vx *= 0.95;
        n.vy *= 0.95;
        n.x += n.vx;
        n.y += n.vy;
        // Keep in bounds
        n.x = Math.max(0.1, Math.min(0.9, n.x));
        n.y = Math.max(0.6, Math.min(0.95, n.y));
      });

      // Draw edges
      EDGES.forEach((edge) => {
        const s = nodeMap.get(edge.source);
        const t = nodeMap.get(edge.target);
        if (!s || !t) return;

        const sx = s.x * w;
        const sy = s.y * h;
        const tx = t.x * w;
        const ty = t.y * h;

        // Animated flow
        const flowOffset = (frame * 0.01) % 1;
        ctx.strokeStyle = `rgba(0, 212, 255, ${edge.strength * 0.3})`;
        ctx.lineWidth = 1 + edge.strength;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(tx, ty);
        ctx.stroke();

        // Flowing particles
        const px = sx + (tx - sx) * flowOffset;
        const py = sy + (ty - sy) * flowOffset;
        ctx.fillStyle = `rgba(0, 212, 255, ${edge.strength * 0.8})`;
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw nodes
      nodes.forEach((n) => {
        const x = n.x * w;
        const y = n.y * h;
        const r = n.type === 'vessel' ? 16 : 22;

        // Glow
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r * 1.5);
        grad.addColorStop(0, n.color + '40');
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r * 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Node circle
        ctx.fillStyle = n.color + '20';
        ctx.strokeStyle = n.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Label
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(n.label, x, y + r + 12);
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
  }, []);

  return <canvas ref={canvasRef} className="w-full h-full" />;
}

export function Evidence() {
  const [timeline, setTimeline] = useState(50);

  const totalScore = XAI_SCORES.reduce((s, x) => s + x.score, 0);
  const totalMax = XAI_SCORES.reduce((s, x) => s + x.max, 0);

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Evidence Graph */}
        <div className="glass-panel overflow-hidden h-[380px]">
          <PanelHeader
            title="Forensic Evidence Graph"
            right={<Badge color="cyan">FORCE-DIRECTED</Badge>}
          />
          <div className="h-[calc(100%-44px)] p-2">
            <EvidenceGraph />
          </div>
        </div>

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
            Evidence scores are based on probabilistic models and should be corroborated with
            additional evidence before legal action. SagarDrishti is not liable for actions
            taken based on these results.
          </p>
        </div>
      </div>

      {/* Explainable AI Panel */}
      <div className="w-80 shrink-0 p-4 pl-0 overflow-y-auto space-y-4">
        <div className="glass-panel p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Scale size={16} className="text-[#00D4FF]" />
            <span className="section-label">Explainable AI</span>
          </div>

          <div className="text-center py-2">
            <div className="metric-value text-3xl font-semibold text-[#00D4FF]">
              {totalScore}/{totalMax}
            </div>
            <div className="text-xs text-muted mt-1">Total Attribution Score</div>
          </div>

          <div className="space-y-3">
            {XAI_SCORES.map((s) => (
              <div key={s.label} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white">{s.label}</span>
                  <span className="metric-value text-xs" style={{ color: s.color }}>
                    {s.score}/{s.max}
                  </span>
                </div>
                <div className="h-1.5 bg-[rgba(0,212,255,0.06)] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{
                      width: `${(s.score / s.max) * 100}%`,
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
              {[
                { label: 'Satellite Detection', value: 'Sentinel-1 SAR confirmed oil slick', color: '#FF4444' },
                { label: 'Origin Zone', value: '0.07° radius — 3 vessels in proximity', color: '#FFD700' },
                { label: 'Virtual Sim Match', value: 'IoU overlap with prime suspect', color: '#A855F7' },
                { label: 'AIS Gap', value: '14-minute silence — intentional disablement', color: '#FFA500' },
              ].map((e) => (
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
