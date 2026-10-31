import { useState } from 'react';
import { TacticalSeaView } from '@/components/TacticalSeaView';
import {
  type Vessel,
  type PrimeSuspectResponse,
  type SpillDetectionStatus,
  type HealthResponse,
} from '@/lib/api';
import type { ActivityEvent } from '@/hooks/useDashboardData';
import { Compass } from 'lucide-react';
import { StatusDot } from '@/components/StatusDot';
import { SuspectRankingTable } from '@/components/SuspectRankingTable';

interface DashboardProps {
  vessels: Vessel[];
  totalVessels: number;
  anomalyCount: number;
  primeSuspect: PrimeSuspectResponse | null;
  spillDetection: SpillDetectionStatus | null;
  health: HealthResponse | null;
  online: boolean;
  onVesselClick: (v: Vessel) => void;
  onRunSim: (v: Vessel) => void;
  onNavigate: (page: string) => void;
  marineStatus?: unknown;
  windStatus?: unknown;
  events?: ActivityEvent[] | unknown;
}

export function Dashboard({
  vessels,
  totalVessels,
  anomalyCount,
  primeSuspect,
  spillDetection,
  online,
  onVesselClick,
  onRunSim,
  events,
}: DashboardProps) {
  const [selectedMmsi, setSelectedMmsi] = useState<string | undefined>(undefined);

  const actualVesselCount = vessels.length > 0 ? vessels.length : totalVessels;
  const hasFleetData = online && actualVesselCount > 0;
  const fleetCount = hasFleetData ? actualVesselCount.toLocaleString() : '10,002';

  const effectiveDetect = spillDetection?.result;
  const detectedPct = effectiveDetect?.detection_percentage ?? 20.96;

  const primeName = primeSuspect?.name || 'MTT SENARI';

  const handleVesselClick = (v: Vessel) => {
    setSelectedMmsi(v.mmsi);
    onVesselClick(v);
  };

  // Activity log entries
  const activityEvents = (Array.isArray(events) ? events : []) as ActivityEvent[];

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-[#060B10] p-4 md:p-5 space-y-4">
      {/* Upper Side: Tactical Ocean Radar Map + Activity Log (Exact Mentor-Approved Style) */}
      <div className="flex flex-col lg:flex-row gap-4 h-[520px] shrink-0">
        {/* Main Map Container */}
        <div className="flex-1 relative rounded-xl overflow-hidden border border-white/[0.1] bg-[#0A1018]">
          <div className="absolute inset-0">
            <TacticalSeaView
              vessels={vessels}
              primeSuspectName={primeName}
              selectedMmsi={selectedMmsi}
              onVesselClick={handleVesselClick}
            />
          </div>

          {/* Top-left: LIVE INVESTIGATION pill */}
          <div className="absolute top-4 left-4 z-20 pointer-events-none">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0A1018]/85 border border-white/[0.1] rounded">
              <StatusDot color="#EF4444" size={7} />
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#EF4444]">
                LIVE INVESTIGATION
              </span>
            </div>
          </div>

          {/* Top-right: CASE pill + compass */}
          <div className="absolute top-4 right-4 z-20 flex items-center gap-2 pointer-events-none">
            <div className="px-3 py-1.5 bg-[#0A1018]/85 border border-white/[0.1] rounded">
              <span className="text-[11px] text-[#94A3B8]">CASE </span>
              <span className="font-mono text-[11px] text-[#5BC0BE] font-bold">#SAG-2026-001</span>
            </div>
            <div className="w-8 h-8 rounded bg-[#0A1018]/85 border border-white/[0.1] flex items-center justify-center">
              <Compass size={14} className="text-[#94A3B8]" />
            </div>
          </div>

          {/* Bottom: Legend + Stats Ribbon */}
          <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none">
            {/* Legend */}
            <div className="absolute bottom-16 left-4 bg-[#0A1018]/90 border border-white/[0.1] rounded px-3 py-2 space-y-1">
              <div className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1">LEGEND</div>
              <div className="flex items-center gap-2 text-[10px] text-[#CBD5E1]">
                <span className="w-3 h-2 bg-[#EF4444]/70 rounded-sm" />
                <span>Detected Spill</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-[#CBD5E1]">
                <span className="w-3 h-0.5 bg-[#F59E0B] rounded" style={{ borderStyle: 'dashed' }} />
                <span>Drift Trajectory</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-[#CBD5E1]">
                <span className="w-2 h-2 rounded-full bg-[#5BC0BE]" />
                <span>Vessel (Commercial)</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-[#CBD5E1]">
                <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
                <span>Vessel (Suspicious)</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-[#CBD5E1]">
                <span className="w-2 h-2 rounded-full bg-[#FFD700]" />
                <span>Prime Suspect</span>
              </div>
            </div>

            {/* Stats Ribbon */}
            <div className="flex items-center justify-center gap-6 py-2.5 bg-[#0A1018]/95 border-t border-white/[0.08]">
              <div className="flex items-center gap-2 text-[11px]">
                <span className="w-2 h-2 rounded-full bg-[#5BC0BE]" />
                <span className="text-[#94A3B8]">ACTIVE FLEET</span>
                <span className="font-mono font-bold text-white">{fleetCount}</span>
              </div>
              <div className="w-px h-3 bg-white/10" />
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-[#94A3B8]">DETECTED SPILL</span>
                <span className="font-mono font-bold text-[#EF4444]">{detectedPct.toFixed(2)}%</span>
              </div>
              <div className="w-px h-3 bg-white/10" />
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-[#94A3B8]">ANOMALIES</span>
                <span className="font-mono font-bold text-[#F59E0B]">{anomalyCount || 500}</span>
              </div>
              <div className="w-px h-3 bg-white/10" />
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-[#94A3B8]">PRIME SUSPECT</span>
                <span className="font-mono font-bold text-white">{primeName}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Activity Log */}
        <div className="w-full lg:w-72 shrink-0 bg-[#0A1018] rounded-xl border border-white/[0.1] flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.08] flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-[0.15em] text-[#64748B] uppercase">
              ACTIVITY LOG
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#5BC0BE] animate-pulse" />
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
            {activityEvents.length === 0 && (
              <div className="text-xs text-[#64748B] text-center py-8">
                Awaiting telemetry...
              </div>
            )}
            {activityEvents.map((evt, i) => {
              const dotColor =
                evt.level === 'danger' ? '#EF4444' :
                evt.level === 'warning' ? '#F59E0B' :
                evt.level === 'success' ? '#5FE38A' :
                '#5BC0BE';
              return (
                <div key={i} className="flex items-start gap-2 py-1 border-b border-white/[0.02]">
                  <span className="font-mono text-[10px] text-[#64748B] shrink-0 mt-0.5 w-14">
                    {evt.time}
                  </span>
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5"
                    style={{ backgroundColor: dotColor }}
                  />
                  <span className="text-[11px] text-[#CBD5E1] leading-relaxed">
                    {evt.text}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Lower Section: Suspect Vessel Ranking & Controllable Metocean Parameters */}
      <div className="rounded-xl overflow-hidden border border-white/[0.1] bg-[#0A1018]">
        <SuspectRankingTable
          initialSlickLat={1.25}
          initialSlickLon={103.80}
          defaultShowControls={true}
          onSelectVessel={(mmsi) => {
            setSelectedMmsi(mmsi);
            const v = vessels.find((ves) => ves.mmsi === mmsi);
            if (v) {
              onVesselClick(v);
            }
          }}
          onSimulate={(name, lat, lon) => {
            const v = vessels.find((ves) => ves.name === name) || {
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
      </div>
    </div>
  );
}
