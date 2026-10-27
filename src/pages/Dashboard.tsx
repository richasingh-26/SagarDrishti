import { useState } from 'react';
import { PanelHeader } from '@/components/Panel';
import { Badge } from '@/components/Badge';
import { StatusDot } from '@/components/StatusDot';
import { TacticalSeaView } from '@/components/TacticalSeaView';
import {
  type Vessel,
  type PrimeSuspectResponse,
  type SpillDetectionStatus,
  type SourceStatus,
  type HealthResponse,
  type DetectResponse,
  detectSpill,
} from '@/lib/api';
import type { ActivityEvent } from '@/hooks/useDashboardData';
import { Waves, Wind, Satellite, Radio, Database, ScanEye, Loader2, Play, Target } from 'lucide-react';
import { SuspectRankingTable } from '@/components/SuspectRankingTable';


interface DashboardProps {
  vessels: Vessel[];
  totalVessels: number;
  anomalyCount: number;
  primeSuspect: PrimeSuspectResponse | null;
  spillDetection: SpillDetectionStatus | null;
  marineStatus: SourceStatus | null;
  windStatus: SourceStatus | null;
  health: HealthResponse | null;
  events: ActivityEvent[];
  online: boolean;
  onVesselClick: (v: Vessel) => void;
  onRunSim: (v: Vessel) => void;
  onNavigate: (page: string) => void;
}

function MetricPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="glass-panel px-3 py-2 flex items-center gap-2">
      <span className="section-label whitespace-nowrap">{label}</span>
      <span className="metric-value text-sm font-semibold" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

function MetricCard({
  label,
  value,
  subtitle,
  status,
  statusColor,
  children,
  accent,
}: {
  label: string;
  value: string;
  subtitle: string;
  status: string;
  statusColor: string;
  children?: React.ReactNode;
  accent?: 'cyan' | 'gold' | 'danger' | 'purple';
}) {
  const borderClass =
    accent === 'gold'
      ? 'border-r-2 border-r-[#FFD700]'
      : accent === 'danger'
        ? 'border-r-2 border-r-[#FF4444]'
        : accent === 'purple'
          ? 'border-r-2 border-r-[#A855F7]'
          : '';

  return (
    <div className={`glass-panel glass-panel-hover p-4 ${borderClass}`}>
      <div className="flex items-start justify-between mb-2">
        <span className="section-label">{label}</span>
        <div className="flex items-center gap-1.5">
          <StatusDot color={statusColor} />
          <span className="text-[0.625rem] font-medium uppercase" style={{ color: statusColor }}>
            {status}
          </span>
        </div>
      </div>
      <div className="metric-value text-2xl font-semibold text-white mb-1">{value}</div>
      <div className="text-xs text-muted mb-3">{subtitle}</div>
      {children}
    </div>
  );
}

function ActivityLog({ events }: { events: ActivityEvent[] }) {
  const colorMap: Record<string, string> = {
    info: '#00D4FF',
    warning: '#FFA500',
    danger: '#FF4444',
    success: '#00FF88',
  };

  return (
    <div className="flex flex-col h-full">
      <PanelHeader title="Activity Log" />
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {events.length === 0 && (
          <div className="text-xs text-muted text-center py-4">No events yet</div>
        )}
        {events.map((evt, i) => (
          <div
            key={i}
            className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-[rgba(0,212,255,0.04)] transition-colors"
          >
            <span className="metric-value text-[0.625rem] text-muted shrink-0 mt-0.5">
              {evt.time}
            </span>
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5"
              style={{ backgroundColor: colorMap[evt.level] }}
            />
            <span className="text-xs text-white/80 leading-relaxed">{evt.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Dashboard({
  vessels,
  totalVessels,
  anomalyCount,
  primeSuspect,
  spillDetection,
  marineStatus,
  windStatus,
  health,
  events,
  online,
  onVesselClick,
  onRunSim,
  onNavigate,
}: DashboardProps) {
  const [selectedVessel, setSelectedVessel] = useState<Vessel | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [customDetect, setCustomDetect] = useState<DetectResponse | null>(null);
  const [detectError, setDetectError] = useState<string | null>(null);

  const actualVesselCount = health?.vessel_count ?? totalVessels;
  const hasFleetData = online && actualVesselCount !== undefined && actualVesselCount > 0;
  const fleetCount = hasFleetData ? actualVesselCount.toLocaleString() : 'N/A';

  const effectiveDetect = customDetect || spillDetection?.result;
  const hasSar = Boolean(spillDetection?.sar_loaded || health?.sar_available);
  const detectedPct = effectiveDetect?.detection_percentage;

  const primeName = primeSuspect?.name || 'N/A';
  const primeMmsi = primeSuspect?.mmsi || 'N/A';
  const primeScore = primeSuspect?.attribution_score;

  const handleVesselClick = (v: Vessel) => {
    setSelectedVessel(v);
    onVesselClick(v);
  };

  const handleRunInference = async () => {
    setDetecting(true);
    setDetectError(null);
    try {
      const res = await detectSpill();
      setCustomDetect(res);
    } catch (err: unknown) {
      const detail =
        typeof err === 'object' && err !== null && 'response' in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined;
      setDetectError(detail || 'Inference failed — check SAR image & model file');
    } finally {
      setDetecting(false);
    }
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* SECTION A: Full-width Tactical Map */}
        <div className="relative h-[550px] glass-panel overflow-hidden">
          <TacticalSeaView
            vessels={vessels}
            primeSuspectName={primeName}
            onVesselClick={handleVesselClick}
          />

          {/* Overlay: top-left badge */}
          <div className="absolute top-3 left-3 flex items-center gap-2 glass-panel px-3 py-1.5 z-20 pointer-events-none">
            <StatusDot color="#FF4444" />
            <span className="text-xs font-semibold uppercase tracking-wider text-[#FF4444]">
              Live Investigation
            </span>
          </div>

          {/* Overlay: top-right case ID */}
          <div className="absolute top-3 right-16 glass-panel px-3 py-1.5 z-20 pointer-events-none">
            <span className="section-label">Case</span>
            <span className="metric-value text-xs text-[#00D4FF] ml-1.5">#SAG-2026-001</span>
          </div>

          {/* Overlay: bottom metric pills */}
          <div className="absolute bottom-14 left-3 right-3 flex flex-wrap gap-2 justify-center z-20 pointer-events-none">
            <MetricPill label="Active Fleet" value={fleetCount} color="#00D4FF" />
            <MetricPill
              label="Detected Spill"
              value={!hasSar ? 'Awaiting SAR input' : detectedPct === undefined ? 'Pending Inference' : `${detectedPct.toFixed(2)}%`}
              color="#FFA500"
            />
            <MetricPill label="Anomalies" value={online ? `${anomalyCount}` : 'N/A'} color="#FF4444" />
            <MetricPill label="Prime Suspect" value={primeName} color="#FFD700" />
          </div>
        </div>

        {/* SECTION B: Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Active Fleet"
            value={fleetCount}
            subtitle="Singapore Strait"
            status={hasFleetData ? 'Loaded' : 'Not available'}
            statusColor={hasFleetData ? '#00FF88' : '#FFA500'}
          />

          <MetricCard
            label="Detected Spill"
            value={!hasSar ? 'Awaiting SAR input' : detectedPct === undefined ? 'Pending Inference' : `${detectedPct.toFixed(2)}%`}
            subtitle={spillDetection?.file || 'sentinel1_sar.tiff'}
            status={hasSar ? (effectiveDetect ? 'Analysed' : 'SAR Ready') : 'No SAR Image'}
            statusColor={hasSar ? '#00FF88' : '#FFA500'}
          >
            <div className="text-[0.625rem] text-muted leading-relaxed">
              {!hasSar
                ? 'No SAR image loaded'
                : detectedPct === undefined
                  ? 'Ready for U-Net++ inference pass'
                  : `Model calculated ${detectedPct.toFixed(2)}% surface coverage`}
            </div>
          </MetricCard>

          <MetricCard
            label="Prime Suspect"
            value={primeName}
            subtitle={`MMSI ${primeMmsi}`}
            status={primeScore == null ? 'N/A' : `Attribution ${primeScore.toFixed(2)}/100`}
            statusColor="#FFD700"
            accent="danger"
          >
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-[rgba(255,215,0,0.1)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#FFA500] to-[#FFD700] rounded-full"
                  style={{ width: `${primeScore || 0}%`, transition: 'width 1s ease-out' }}
                />
              </div>
              <Badge color="gold">{primeScore == null ? 'N/A' : `${primeScore.toFixed(2)}/100`}</Badge>
            </div>
          </MetricCard>

          <MetricCard
            label="U-Net++ Engine"
            value={health?.unet ? 'ONLINE' : 'OFFLINE'}
            subtitle="Deep Learning Segmentation"
            status={health?.unet ? 'Weights Loaded' : 'Weights Missing'}
            statusColor={health?.unet ? '#00FF88' : '#FFA500'}
            accent="purple"
          >
            <div className="text-[0.625rem] text-muted leading-relaxed">
              ResNet-34 encoder with nested dense skip connections
            </div>
          </MetricCard>
        </div>

        {/* SECTION C: Neural SAR Oil Spill Detection Analysis */}
        <div className="glass-panel p-0 overflow-hidden flex flex-col">
          <PanelHeader
            title="U-Net++ Neural Spill Detection Engine"
            right={
              <Badge color={effectiveDetect ? (effectiveDetect.spill_detected ? 'danger' : 'success') : hasSar ? 'cyan' : 'warning'}>
                {effectiveDetect ? (effectiveDetect.spill_detected ? 'SPILL DETECTED' : 'CLEAR SEA SURFACE') : hasSar ? 'SAR READY' : 'NO SAR LOADED'}
              </Badge>
            }
          />
          <div className="p-4 space-y-3">
            {!hasSar ? (
              <div className="rounded-md bg-[rgba(255,165,0,0.06)] border border-[rgba(255,165,0,0.2)] p-4 text-center my-auto">
                <div className="text-sm font-semibold text-[#FFA500]">No SAR image loaded</div>
                <div className="text-xs text-muted mt-1">
                  Place <code>sentinel1_sar.tiff</code> in <code>data/sentinel1/</code> to run inference.
                </div>
              </div>
            ) : effectiveDetect ? (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="bg-[rgba(0,212,255,0.04)] rounded-lg p-3 border border-cyan-dim/40">
                  <div className="section-label text-[0.5625rem]">Detection Rate</div>
                  <div className="metric-value text-xl font-bold text-[#FFA500] mt-1">
                    {effectiveDetect.detection_percentage.toFixed(4)}%
                  </div>
                </div>
                <div className="bg-[rgba(0,212,255,0.04)] rounded-lg p-3 border border-cyan-dim/40">
                  <div className="section-label text-[0.5625rem]">Model Confidence</div>
                  <div className="metric-value text-xl font-bold text-[#00FF88] mt-1">
                    {(effectiveDetect.confidence * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="bg-[rgba(0,212,255,0.04)] rounded-lg p-3 border border-cyan-dim/40">
                  <div className="section-label text-[0.5625rem]">SAR Scene File</div>
                  <div className="text-sm font-mono font-semibold text-white mt-1 truncate">
                    {spillDetection?.file || 'sentinel1_sar.tiff'}
                  </div>
                </div>
                <div className="bg-[rgba(0,212,255,0.04)] rounded-lg p-3 border border-cyan-dim/40 flex flex-col justify-between">
                  <div className="section-label text-[0.5625rem]">Verification Verdict</div>
                  <div className={`text-sm font-bold uppercase ${effectiveDetect.spill_detected ? 'text-[#FF4444]' : 'text-[#00FF88]'}`}>
                    {effectiveDetect.spill_detected ? '⚠️ Spill Confirmed' : '✅ Clear Sea Surface'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-muted text-center py-3">
                Sentinel-1 SAR C-Band radar scene loaded and calibrated. Execute live deep learning inference below.
              </div>
            )}

            {detectError && (
              <div className="text-xs text-[#FF4444] bg-[rgba(255,68,68,0.08)] border border-[rgba(255,68,68,0.2)] rounded px-2.5 py-1.5">
                {detectError}
              </div>
            )}

            <button
              onClick={handleRunInference}
              disabled={detecting || !hasSar}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-[rgba(0,212,255,0.12)] hover:bg-[rgba(0,212,255,0.2)] border border-cyan-dim text-[#00D4FF] text-xs font-semibold uppercase tracking-wider transition-all disabled:opacity-50"
            >
              {detecting ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Running U-Net++ ResNet-34 Inference…
                </>
              ) : (
                <>
                  <ScanEye size={14} /> Execute Live U-Net++ SAR Inference
                </>
              )}
            </button>
          </div>
        </div>


        {/* SECTION: Top 10 Suspect Vessel Ranking Leaderboard */}
        <SuspectRankingTable
          initialSlickLat={1.25}
          initialSlickLon={103.80}
          onSelectVessel={(mmsi, lat, lon) => {
            const v = vessels.find((v) => v.mmsi === mmsi);
            if (v) {
              onVesselClick(v);
            }
          }}
          onSimulate={(name, lat, lon) => {
            const v = vessels.find((v) => v.name === name) || {
              name,
              mmsi: '0',
              lat,
              lon,
              speed: 12.0,
              heading: 0,
              type: 'Tanker',
              status: 'Underway',
              anomaly_score: -0.2,
            };
            onRunSim(v);
          }}
        />

        {/* SECTION D: Data Sources */}
        <div className="glass-panel p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="section-label">Data Sources</span>

            <Badge color="cyan">SOURCE STATUS</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2">
            {[
              {
                name: 'Sentinel-1 SAR',
                sub: spillDetection?.file || (health?.sar_available ? 'sentinel1_sar.tiff' : 'Not available'),
                status: hasSar ? 'CONNECTED' : 'NOT CONNECTED',
                color: hasSar ? '#00FF88' : '#FFA500',
                icon: Satellite,
              },
              {
                name: 'Copernicus Marine',
                sub: marineStatus?.connected ? `${marineStatus.files || 0} local NetCDF files` : 'Not available',
                status: marineStatus?.status || 'Not connected',
                color: marineStatus?.connected ? '#00FF88' : '#FFA500',
                icon: Waves,
              },
              {
                name: 'ERA5 Wind',
                sub: windStatus?.connected ? `${windStatus.files || 0} local NetCDF files` : 'Not available',
                status: windStatus?.status || 'Not connected',
                color: windStatus?.connected ? '#00FF88' : '#FFA500',
                icon: Wind,
              },
              {
                name: 'U-Net++ model',
                sub: health?.unet ? 'Weights loaded' : 'Weights not found',
                status: health?.unet ? 'LOADED' : 'NOT LOADED',
                color: health?.unet ? '#00FF88' : '#FFA500',
                icon: Database,
              },
              {
                name: 'AIS Dataset',
                sub: hasFleetData ? `${fleetCount} vessels from loaded dataset` : 'Not available',
                status: hasFleetData ? 'LOADED' : 'NOT CONNECTED',
                color: hasFleetData ? '#00D4FF' : '#FFA500',
                icon: Radio,
              },
            ].map((src) => {
              const Icon = src.icon;
              return (
                <div
                  key={src.name}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-md bg-[rgba(0,212,255,0.03)] hover:bg-[rgba(0,212,255,0.06)] transition-colors"
                >
                  <Icon size={14} className="text-muted shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-white truncate">{src.name}</div>
                    <div className="text-[0.625rem] text-muted">{src.sub}</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <StatusDot color={src.color} />
                    <span className="text-[0.625rem] font-medium" style={{ color: src.color }}>
                      {src.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-1.5 pt-1 text-[0.625rem] text-muted">
            <Database size={10} />
            Source status is read from the backend on every refresh
          </div>
        </div>
      </div>

      {/* SECTION E: Activity Log */}
      <div className="w-72 shrink-0 p-4 pl-0 hidden xl:block">
        <div className="glass-panel h-full overflow-hidden">
          <ActivityLog events={events} />
        </div>
      </div>
    </div>
  );
}
