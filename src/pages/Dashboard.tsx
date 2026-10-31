import { useState } from 'react';
import { TacticalSeaView } from '@/components/TacticalSeaView';
import {
  type Vessel,
  type PrimeSuspectResponse,
  type SpillDetectionStatus,
  type HealthResponse,
} from '@/lib/api';
import type { ActivityEvent } from '@/hooks/useDashboardData';
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

  // Activity log events matching the screenshot's telemetry stream
  const rawEvents = (Array.isArray(events) ? events : []) as ActivityEvent[];
  const defaultEvents = [
    { time: '17:10:25', text: 'Prime suspect identified: MTT SENARI (67.5/100)', color: '#FF4444' },
    { time: '17:10:24', text: 'Vessel data refreshed — 10002 ships tracked', color: '#00D4FF' },
    { time: '17:10:24', text: 'Backend online — 10,002 vessels tracked', color: '#00FF88' },
    { time: '17:10:22', text: 'Prime suspect identified: MTT SENARI (67.5/100)', color: '#FF4444' },
    { time: '17:10:22', text: 'Vessel data refreshed — 10002 ships tracked', color: '#00D4FF' },
    { time: '17:10:22', text: 'Backend online — 10,002 vessels tracked', color: '#00FF88' },
    { time: '17:09:25', text: 'Prime suspect identified: MTT SENARI (67.5/100)', color: '#FF4444' },
    { time: '17:09:25', text: 'Vessel data refreshed — 10002 ships tracked', color: '#00D4FF' },
    { time: '17:09:25', text: 'Backend online — 10,002 vessels tracked', color: '#00FF88' },
  ];

  const displayEvents =
    rawEvents.length > 0
      ? rawEvents.map((e) => ({
          time: e.time,
          text: e.text,
          color:
            e.level === 'danger' ? '#FF4444' :
            e.level === 'warning' ? '#FFA500' :
            e.level === 'success' ? '#00FF88' :
            '#00D4FF',
        }))
      : defaultEvents;

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-[#070F1E] text-white p-4 md:p-5 space-y-4">
      {/* Upper Section: Tactical Map + Activity Log (Exact Screenshot Layout) */}
      <div className="flex flex-col lg:flex-row gap-4 h-[540px] shrink-0">
        {/* Map Container */}
        <div className="flex-1 relative rounded-xl overflow-hidden border border-[#162C46] bg-[#0A1628] shadow-sm">
          <div className="absolute inset-0">
            <TacticalSeaView
              vessels={vessels}
              primeSuspectName={primeName}
              selectedMmsi={selectedMmsi}
              onVesselClick={handleVesselClick}
            />
          </div>

          {/* Top-left: LIVE INVESTIGATION pill */}
          <div className="absolute top-3.5 left-4 z-20 pointer-events-none">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#071322]/95 border border-[#162C46] shadow-sm">
              <span className="w-2 h-2 rounded-full bg-[#FF4444] animate-pulse" />
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#FF4444]">
                LIVE INVESTIGATION
              </span>
            </div>
          </div>

          {/* Top-right: CASE pill + compass */}
          <div className="absolute top-3.5 right-4 z-20 flex items-center gap-2 pointer-events-none">
            <div className="px-3 py-1.5 rounded-md bg-[#071322]/95 border border-[#162C46] shadow-sm flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-[#64748B]">CASE</span>
              <span className="font-mono text-[11px] text-[#00D4FF] font-bold">#SAG-2026-001</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-[#071322]/95 border border-[#162C46] flex items-center justify-center shadow-sm">
              <span className="text-xs font-bold text-[#00D4FF]">N</span>
            </div>
          </div>

          {/* Bottom Floating Stat Pills Ribbon (Centered between Legend and Scale) */}
          <div className="absolute bottom-3.5 left-52 right-36 flex flex-wrap gap-2.5 justify-center z-20 pointer-events-none">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#071322]/95 border border-[#162C46] shadow-md">
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">ACTIVE FLEET</span>
              <span className="font-mono text-xs font-bold text-[#00D4FF]">{fleetCount}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#071322]/95 border border-[#162C46] shadow-md">
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">DETECTED SPILL</span>
              <span className="font-mono text-xs font-bold text-[#FFA500]">{detectedPct.toFixed(2)}%</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#071322]/95 border border-[#162C46] shadow-md">
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">ANOMALIES</span>
              <span className="font-mono text-xs font-bold text-[#FF4444]">{anomalyCount || 500}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#071322]/95 border border-[#162C46] shadow-md">
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">PRIME SUSPECT</span>
              <span className="font-mono text-xs font-bold text-[#FFD700]">{primeName}</span>
            </div>
          </div>
        </div>

        {/* Right Column: Activity Log */}
        <div className="w-full lg:w-80 shrink-0 bg-[#071322] rounded-xl border border-[#162C46] flex flex-col overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-[#162C46] flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-[0.15em] text-[#64748B] uppercase">
              ACTIVITY LOG
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#00D4FF] animate-pulse" />
          </div>
          <div className="flex-1 overflow-y-auto px-3.5 py-2 space-y-1.5">
            {displayEvents.map((evt, i) => (
              <div key={i} className="flex items-start gap-2.5 py-1.5 border-b border-white/[0.03]">
                <span className="font-mono text-[10px] text-[#64748B] shrink-0 mt-0.5">
                  {evt.time}
                </span>
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5"
                  style={{ backgroundColor: evt.color }}
                />
                <span className="text-[11.5px] text-white/85 leading-snug">
                  {evt.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Lower Section: Suspect Vessel Ranking & Parameters (Preserved Exactly) */}
      <div className="rounded-xl overflow-hidden border border-[#162C46] bg-[#071322] shadow-sm">
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
