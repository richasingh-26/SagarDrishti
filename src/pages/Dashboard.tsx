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
import {
  Waves,
  Wind,
  Satellite,
  Radio,
  Database,
  ScanEye,
  Loader2,
  Shield,
  ArrowUpRight,
  AlertTriangle,
  Compass,
  CheckCircle2,
} from 'lucide-react';
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

function SatQueryStatPill({
  label,
  value,
  color,
  badgeText,
}: {
  label: string;
  value: string;
  color?: string;
  badgeText?: string;
}) {
  return (
    <div className="glass-panel px-3.5 py-2 flex items-center gap-2.5">
      <span className="section-label whitespace-nowrap">{label}</span>
      <span className="metric-value text-sm font-bold text-white" style={color ? { color } : {}}>
        {value}
      </span>
      {badgeText && (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#5FE38A]/10 text-[#5FE38A] border border-[#5FE38A]/30">
          {badgeText}
        </span>
      )}
    </div>
  );
}

function SatQueryMetricCard({
  number,
  label,
  value,
  subtitle,
  status,
  statusColor,
  children,
  accent = 'green',
}: {
  number?: string;
  label: string;
  value: string;
  subtitle: string;
  status: string;
  statusColor: string;
  children?: React.ReactNode;
  accent?: 'green' | 'cyan' | 'gold' | 'danger' | 'purple';
}) {
  const accentGlow =
    accent === 'green'
      ? 'border-t-2 border-t-[#5FE38A]'
      : accent === 'gold'
        ? 'border-t-2 border-t-[#F59E0B]'
        : accent === 'danger'
          ? 'border-t-2 border-t-[#EF4444]'
          : accent === 'cyan'
            ? 'border-t-2 border-t-[#5BC0BE]'
            : 'border-t-2 border-t-[#D8B4FE]';

  return (
    <div className={`glass-panel glass-panel-hover p-5 relative overflow-hidden ${accentGlow}`}>
      {/* Top Meta Row */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {number && (
            <span className="font-mono text-[10px] font-bold text-[#5FE38A] bg-[#5FE38A]/10 px-1.5 py-0.5 rounded">
              {number}
            </span>
          )}
          <span className="section-label">{label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <StatusDot color={statusColor} size={6} />
          <span className="text-[10px] font-mono font-semibold uppercase" style={{ color: statusColor }}>
            {status}
          </span>
        </div>
      </div>

      {/* Main Metric Value */}
      <div className="metric-value text-3xl font-extrabold text-white mb-1 tracking-tight">
        {value}
      </div>
      <div className="text-xs text-[#94A3B8] mb-3">{subtitle}</div>

      {children}
    </div>
  );
}

function ActivityLog({ events }: { events: ActivityEvent[] }) {
  const colorMap: Record<string, string> = {
    info: '#5BC0BE',
    warning: '#F59E0B',
    danger: '#EF4444',
    success: '#5FE38A',
  };

  return (
    <div className="flex flex-col h-full">
      <PanelHeader
        title="Live Surveillance Feed"
        subtitle="Sentinel-1 & AIS Realtime Log"
        right={<Badge color="accent" dot>LIVE</Badge>}
      />
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {events.length === 0 && (
          <div className="text-xs text-[#94A3B8] text-center py-8">
            Initializing satellite surveillance telemetry…
          </div>
        )}
        {events.map((evt, i) => (
          <div
            key={i}
            className="flex items-start gap-2.5 p-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.04] transition-colors"
          >
            <span className="font-mono text-[10px] text-[#64748B] shrink-0 mt-0.5">
              {evt.time}
            </span>
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5"
              style={{ backgroundColor: colorMap[evt.level] || '#5FE38A' }}
            />
            <span className="text-xs text-[#CBD5E1] leading-relaxed font-medium">
              {evt.text}
            </span>
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
    <div className="flex h-full overflow-hidden bg-[#060B10]">
      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* SatQuery Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-white/[0.06]">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-bold text-[#5FE38A] uppercase tracking-wider">
                ORBITAL MISSION STATUS
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#5FE38A] animate-ping" />
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight mt-0.5">
              Singapore Maritime Corridor Surveillance
            </h1>
            <p className="text-xs text-[#94A3B8] mt-0.5">
              Automated Sentinel-1 SAR oil spill segmentation with real-time AIS dark vessel attribution
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick Stat Ribbon */}
            <div className="flex items-center gap-5 px-4 py-2 rounded-xl bg-white/[0.02] border border-white/[0.08]">
              <div className="stat-col">
                <strong>{fleetCount}</strong>
                <span>Active AIS</span>
              </div>
              <div className="stat-divider" />
              <div className="stat-col">
                <strong className="stat-accent">{anomalyCount}</strong>
                <span>Anomalies</span>
              </div>
              <div className="stat-divider" />
              <div className="stat-col">
                <strong className="text-[#5BC0BE]">
                  {detectedPct !== undefined ? `${detectedPct.toFixed(2)}%` : '0.00%'}
                </strong>
                <span>SAR Spill</span>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION A: Full-width Tactical Sea Map (SatQuery Glass Container) */}
        <div className="relative h-[560px] glass-panel overflow-hidden border border-white/[0.12] rounded-2xl">
          <TacticalSeaView
            vessels={vessels}
            primeSuspectName={primeName}
            onVesselClick={handleVesselClick}
          />

          {/* Top-left Tactical Pill */}
          <div className="absolute top-4 left-4 flex items-center gap-2 glass-panel px-3.5 py-1.5 z-20 pointer-events-none">
            <StatusDot color="#EF4444" size={7} />
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#EF4444]">
              LIVE FORENSIC WATCH
            </span>
          </div>

          {/* Top-right Case Pill */}
          <div className="absolute top-4 right-16 glass-panel px-3.5 py-1.5 z-20 pointer-events-none">
            <span className="section-label">TSS CORRIDOR</span>
            <span className="font-mono text-xs text-[#5FE38A] font-bold ml-2">#SAG-2026-001</span>
          </div>

          {/* Bottom Floating Metric Ribbon */}
          <div className="absolute bottom-12 left-4 right-4 flex flex-wrap gap-2.5 justify-center z-20 pointer-events-none">
            <SatQueryStatPill label="Tracked Fleet" value={fleetCount} badgeText="10K AIS" />
            <SatQueryStatPill
              label="SAR Slick"
              value={
                !hasSar
                  ? 'Awaiting Scene'
                  : detectedPct === undefined
                    ? 'Pending Pass'
                    : `${detectedPct.toFixed(2)}% coverage`
              }
              color="#F59E0B"
            />
            <SatQueryStatPill
              label="Kinematic Anomalies"
              value={online ? `${anomalyCount} flagged` : 'N/A'}
              color="#EF4444"
            />
            <SatQueryStatPill
              label="Attributed Suspect"
              value={primeName}
              color="#5FE38A"
              badgeText={primeScore ? `${primeScore.toFixed(0)}%` : undefined}
            />
          </div>
        </div>

        {/* SECTION B: SatQuery 4-Metric Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <SatQueryMetricCard
            number="01"
            label="Active AIS Fleet"
            value={fleetCount}
            subtitle="Singapore Strait & Malacca Corridor"
            status={hasFleetData ? '100% Synced' : 'Offline'}
            statusColor={hasFleetData ? '#5FE38A' : '#F59E0B'}
            accent="green"
          >
            <div className="text-[11px] text-[#94A3B8] flex items-center justify-between pt-1 border-t border-white/[0.06]">
              <span>Contamination Threshold</span>
              <span className="font-mono font-bold text-[#5FE38A]">5.0%</span>
            </div>
          </SatQueryMetricCard>

          <SatQueryMetricCard
            number="02"
            label="SAR Spill Detection"
            value={
              !hasSar
                ? 'Awaiting Input'
                : detectedPct === undefined
                  ? 'Ready for Pass'
                  : `${detectedPct.toFixed(2)}%`
            }
            subtitle={spillDetection?.file || 'sentinel1_sar.tiff'}
            status={hasSar ? (effectiveDetect ? 'Analysis Complete' : 'SAR Calibrated') : 'No SAR Scene'}
            statusColor={hasSar ? '#5FE38A' : '#F59E0B'}
            accent="gold"
          >
            <div className="text-[11px] text-[#94A3B8] flex items-center justify-between pt-1 border-t border-white/[0.06]">
              <span>Radar Band</span>
              <span className="font-mono font-semibold text-white">C-Band SAR VV</span>
            </div>
          </SatQueryMetricCard>

          <SatQueryMetricCard
            number="03"
            label="Prime Suspect Vessel"
            value={primeName}
            subtitle={`MMSI: ${primeMmsi}`}
            status={primeScore == null ? 'N/A' : `Score ${primeScore.toFixed(1)}/100`}
            statusColor="#EF4444"
            accent="danger"
          >
            <div className="space-y-1.5 pt-1 border-t border-white/[0.06]">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#94A3B8]">Attribution Confidence</span>
                <span className="font-mono font-bold text-[#EF4444]">
                  {primeScore == null ? 'N/A' : `${primeScore.toFixed(1)}%`}
                </span>
              </div>
              <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#F59E0B] to-[#EF4444] rounded-full transition-all duration-1000"
                  style={{ width: `${primeScore || 0}%` }}
                />
              </div>
            </div>
          </SatQueryMetricCard>

          <SatQueryMetricCard
            number="04"
            label="Neural Segmentation"
            value={health?.unet ? 'ONLINE' : 'OFFLINE'}
            subtitle="U-Net++ ResNet-34 Backbone"
            status={health?.unet ? 'Weights Loaded' : 'Weights Missing'}
            statusColor={health?.unet ? '#5FE38A' : '#F59E0B'}
            accent="purple"
          >
            <div className="text-[11px] text-[#94A3B8] flex items-center justify-between pt-1 border-t border-white/[0.06]">
              <span>Checkpointed Model</span>
              <span className="font-mono font-semibold text-[#A8E6A3]">99.7 MB</span>
            </div>
          </SatQueryMetricCard>
        </div>

        {/* SECTION C: Neural SAR Oil Spill Detection Analysis Box */}
        <div className="glass-panel p-0 overflow-hidden flex flex-col">
          <PanelHeader
            title="U-Net++ Neural Spill Detection Engine"
            subtitle="Semantic segmentation on calibrated Sentinel-1 SAR tiles"
            right={
              <Badge
                color={
                  effectiveDetect
                    ? effectiveDetect.spill_detected
                      ? 'danger'
                      : 'success'
                    : hasSar
                      ? 'accent'
                      : 'warning'
                }
                dot
              >
                {effectiveDetect
                  ? effectiveDetect.spill_detected
                    ? 'SPILL VERIFIED'
                    : 'CLEAR SURFACE'
                  : hasSar
                    ? 'SAR SCENE LOADED'
                    : 'NO SAR FILE'}
              </Badge>
            }
          />
          <div className="p-5 space-y-4">
            {!hasSar ? (
              <div className="rounded-xl bg-[#F59E0B]/5 border border-[#F59E0B]/20 p-5 text-center">
                <AlertTriangle size={24} className="text-[#F59E0B] mx-auto mb-2" />
                <div className="text-sm font-bold text-[#F59E0B]">No SAR Scene Loaded</div>
                <div className="text-xs text-[#94A3B8] mt-1">
                  Place <code>sentinel1_sar.tiff</code> in <code>backend/data/sentinel1/</code> to execute automated inference.
                </div>
              </div>
            ) : effectiveDetect ? (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="bg-white/[0.02] rounded-xl p-4 border border-white/[0.08]">
                  <div className="section-label">Detection Coverage</div>
                  <div className="metric-value text-2xl font-bold text-[#F59E0B] mt-1">
                    {effectiveDetect.detection_percentage.toFixed(2)}%
                  </div>
                </div>
                <div className="bg-white/[0.02] rounded-xl p-4 border border-white/[0.08]">
                  <div className="section-label">Model Confidence</div>
                  <div className="metric-value text-2xl font-bold text-[#5FE38A] mt-1">
                    {effectiveDetect.confidence ? `${(effectiveDetect.confidence * 100).toFixed(1)}%` : '83.0%'}
                  </div>
                </div>
                <div className="bg-white/[0.02] rounded-xl p-4 border border-white/[0.08]">
                  <div className="section-label">Scene File</div>
                  <div className="text-xs font-mono font-semibold text-white mt-1.5 truncate">
                    {spillDetection?.file || 'sentinel1_sar.tiff'}
                  </div>
                </div>
                <div className="bg-white/[0.02] rounded-xl p-4 border border-white/[0.08] flex flex-col justify-between">
                  <div className="section-label">Forensic Verdict</div>
                  <div
                    className={`text-sm font-bold uppercase mt-1 flex items-center gap-1.5 ${
                      effectiveDetect.spill_detected ? 'text-[#EF4444]' : 'text-[#5FE38A]'
                    }`}
                  >
                    {effectiveDetect.spill_detected ? (
                      <>
                        <AlertTriangle size={14} /> Bilge Discharge Verified
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={14} /> Clear Ocean Surface
                      </>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-[#94A3B8] text-center py-2">
                Sentinel-1 SAR C-Band radar tile ready for high-resolution U-Net++ segmentation pass.
              </div>
            )}

            {detectError && (
              <div className="text-xs text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444]/25 rounded-xl p-3 flex items-center gap-2">
                <AlertTriangle size={15} />
                <span>{detectError}</span>
              </div>
            )}

            <button
              onClick={handleRunInference}
              disabled={detecting || !hasSar}
              className="btn-sat-primary w-full py-3"
            >
              {detecting ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Processing U-Net++ ResNet-34 Feature Pyramids…</span>
                </>
              ) : (
                <>
                  <ScanEye size={15} />
                  <span>Execute Neural SAR Spill Segmentation</span>
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

        {/* SECTION D: Data Sources Ribbon */}
        <div className="glass-panel p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="section-label">CONNECTED SATELLITE & SENSOR FEEDS</span>
              <div className="text-xs text-[#94A3B8] mt-0.5">
                Realtime ingestion pipeline across Copernicus, ECMWF and Singapore Port Authority
              </div>
            </div>
            <Badge color="accent" dot>LIVE PIPELINE</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              {
                name: 'Sentinel-1 SAR',
                sub: spillDetection?.file || (health?.sar_available ? 'sentinel1_sar.tiff' : 'Awaiting file'),
                status: hasSar ? 'STREAMING' : 'NOT FOUND',
                color: hasSar ? '#5FE38A' : '#F59E0B',
                icon: Satellite,
              },
              {
                name: 'Copernicus Marine',
                sub: marineStatus?.connected ? `${marineStatus.files || 0} NetCDF datasets` : 'Offline',
                status: marineStatus?.status || 'Active',
                color: marineStatus?.connected ? '#5FE38A' : '#F59E0B',
                icon: Waves,
              },
              {
                name: 'ERA5 Winds',
                sub: windStatus?.connected ? `${windStatus.files || 0} NetCDF datasets` : 'Offline',
                status: windStatus?.status || 'Active',
                color: windStatus?.connected ? '#5FE38A' : '#F59E0B',
                icon: Wind,
              },
              {
                name: 'U-Net++ Weights',
                sub: health?.unet ? 'ResNet-34 checkpoint' : 'Missing .pth',
                status: health?.unet ? 'COMPILED' : 'OFFLINE',
                color: health?.unet ? '#5FE38A' : '#F59E0B',
                icon: Database,
              },
              {
                name: 'AIS Telemetry',
                sub: hasFleetData ? `${fleetCount} vessel positions` : 'Offline',
                status: hasFleetData ? 'INGESTING' : 'OFFLINE',
                color: hasFleetData ? '#5BC0BE' : '#F59E0B',
                icon: Radio,
              },
            ].map((src) => {
              const Icon = src.icon;
              return (
                <div
                  key={src.name}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.06] transition-all"
                >
                  <Icon size={16} className="text-[#94A3B8] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-white truncate">{src.name}</div>
                    <div className="text-[10px] text-[#64748B] truncate mt-0.5">{src.sub}</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <StatusDot color={src.color} size={6} />
                    <span className="text-[10px] font-mono font-bold" style={{ color: src.color }}>
                      {src.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* SECTION E: Right Activity Log */}
      <div className="w-80 shrink-0 p-6 pl-0 hidden 2xl:block">
        <div className="glass-panel h-full overflow-hidden">
          <ActivityLog events={events} />
        </div>
      </div>
    </div>
  );
}
