import { useState, useEffect } from 'react';
import {
  type RankedSuspect,
  type SuspectRankingResponse,
  getSuspectRanking,
} from '@/lib/api';
import { Badge } from '@/components/Badge';
import {
  Target,
  Compass,
  AlertTriangle,
  RefreshCw,
  Sliders,
  Search,
  Award,
} from 'lucide-react';


interface SuspectRankingTableProps {
  initialSlickLat?: number;
  initialSlickLon?: number;
  defaultShowControls?: boolean;
  onSelectVessel?: (mmsi: string, lat: number, lon: number) => void;
  onSimulate?: (name: string, lat: number, lon: number) => void;
}

export function SuspectRankingTable({
  initialSlickLat = 1.25,
  initialSlickLon = 103.80,
  defaultShowControls = true,
  onSelectVessel,
  onSimulate,
}: SuspectRankingTableProps) {
  const [data, setData] = useState<SuspectRankingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Controls state - default open so parameters are immediately accessible & editable
  const [showControls, setShowControls] = useState(defaultShowControls);
  const [slickLat, setSlickLat] = useState(initialSlickLat);
  const [slickLon, setSlickLon] = useState(initialSlickLon);
  const [backtrackHours, setBacktrackHours] = useState(8);
  const [windSpeed, setWindSpeed] = useState(12.0);
  const [windDir, setWindDir] = useState(220.0);
  const [currSpeed, setCurrSpeed] = useState(1.2);
  const [currDir, setCurrDir] = useState(135.0);

  // Filter state
  const [filterRisk, setFilterRisk] = useState<'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchRanking = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getSuspectRanking({
        slick_lat: slickLat,
        slick_lon: slickLon,
        backtrack_hours: backtrackHours,
        wind_speed_knots: windSpeed,
        wind_direction_deg: windDir,
        current_speed_knots: currSpeed,
        current_direction_deg: currDir,
        limit: 10,
      });
      setData(res);
    } catch (err: unknown) {
      const detail =
        typeof err === 'object' && err !== null && 'message' in err
          ? (err as { message: string }).message
          : 'Failed to compute top suspect ranking';
      setError(detail);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRanking();
    }, 250);

    return () => clearTimeout(timer);
  }, [slickLat, slickLon, backtrackHours, windSpeed, windDir, currSpeed, currDir]);

  const filteredSuspects = (data?.top_suspects || []).filter((s) => {

    if (filterRisk !== 'ALL' && s.risk_level !== filterRisk) return false;
    if (
      searchQuery &&
      !s.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !s.mmsi.includes(searchQuery) &&
      !s.type.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const getRankBadgeStyle = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-r from-[#FFD700] to-[#FF8800] text-black font-extrabold shadow-[0_0_12px_rgba(255,215,0,0.5)] border-amber-300';
      case 2:
        return 'bg-gradient-to-r from-[#E2E8F0] to-[#94A3B8] text-black font-bold shadow-[0_0_8px_rgba(226,232,240,0.3)] border-slate-300';
      case 3:
        return 'bg-gradient-to-r from-[#CD7F32] to-[#B45309] text-white font-bold shadow-[0_0_8px_rgba(205,127,50,0.3)] border-amber-600';
      default:
        return 'bg-[rgba(15,23,42,0.8)] text-[#00D4FF] border-cyan-500/30';
    }
  };

  const getRiskBadge = (level: string) => {
    switch (level) {
      case 'CRITICAL':
        return <Badge color="danger">⚠️ CRITICAL SUSPECT</Badge>;
      case 'HIGH':
        return <Badge color="warning">⚡ HIGH PROBABILITY</Badge>;
      case 'MEDIUM':
        return <Badge color="gold">👁️ MEDIUM SUSPICION</Badge>;
      default:
        return <Badge color="cyan">LOW RISK</Badge>;
    }
  };

  return (
    <div className="glass-panel overflow-hidden border border-[rgba(0,212,255,0.25)] shadow-[0_0_30px_rgba(0,0,0,0.5)]">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-cyan-dim bg-[rgba(10,25,50,0.6)] flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Target className="text-[#FF4444] animate-pulse" size={20} />
            <h2 className="text-base sm:text-lg font-bold text-white tracking-wide flex items-center gap-2">
              Top 10 Suspect Vessel Ranking
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-[rgba(255,68,68,0.15)] text-[#FF4444] border border-[rgba(255,68,68,0.3)]">
                MARPOL Annex I Forensic Rank
              </span>
            </h2>
          </div>
          <p className="text-xs text-muted">
            Physics-calibrated reverse drift trajectory & AIS kinematic Isolation Forest anomaly scoring across all 10,001 vessels.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowControls(!showControls)}
            className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors flex items-center gap-1.5 ${
              showControls
                ? 'bg-[#00D4FF]/20 border-[#00D4FF] text-white'
                : 'bg-[rgba(15,23,42,0.6)] border-cyan-dim text-muted hover:text-white'
            }`}
          >
            <Sliders size={13} />
            Parameters
          </button>
          <button
            onClick={fetchRanking}
            disabled={loading}
            className="px-3 py-1.5 rounded text-xs font-medium bg-[rgba(0,212,255,0.15)] hover:bg-[rgba(0,212,255,0.25)] border border-[#00D4FF]/40 text-[#00D4FF] flex items-center gap-1.5 transition-all shadow-[0_0_10px_rgba(0,212,255,0.2)] disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Evaluating 10,001 Ships...' : 'Recalculate'}
          </button>
        </div>
      </div>

      {/* Metocean & Simulation Parameters Bar (Collapsible) */}
      {showControls && (
        <div className="p-4 bg-[rgba(5,15,30,0.8)] border-b border-cyan-dim grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs animate-fadeIn">
          <div>
            <label className="text-muted block mb-1">Spill Coordinates (Lat / Lon)</label>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.001"
                value={slickLat}
                onChange={(e) => setSlickLat(parseFloat(e.target.value) || 1.25)}
                className="w-full bg-[rgba(15,23,42,0.8)] border border-cyan-dim rounded px-2 py-1 text-white font-mono"
              />
              <input
                type="number"
                step="0.001"
                value={slickLon}
                onChange={(e) => setSlickLon(parseFloat(e.target.value) || 103.80)}
                className="w-full bg-[rgba(15,23,42,0.8)] border border-cyan-dim rounded px-2 py-1 text-white font-mono"
              />
            </div>
          </div>

          <div>
            <label className="text-muted block mb-1">Wind ({windSpeed} kn @ {windDir}°)</label>
            <div className="flex gap-2 items-center">
              <input
                type="range"
                min="0"
                max="40"
                step="1"
                value={windSpeed}
                onChange={(e) => setWindSpeed(parseFloat(e.target.value))}
                className="w-full accent-[#00D4FF]"
              />
              <input
                type="range"
                min="0"
                max="360"
                step="5"
                value={windDir}
                onChange={(e) => setWindDir(parseFloat(e.target.value))}
                className="w-full accent-[#00D4FF]"
              />
            </div>
          </div>

          <div>
            <label className="text-muted block mb-1">Surface Current ({currSpeed} kn @ {currDir}°)</label>
            <div className="flex gap-2 items-center">
              <input
                type="range"
                min="0"
                max="4"
                step="0.1"
                value={currSpeed}
                onChange={(e) => setCurrSpeed(parseFloat(e.target.value))}
                className="w-full accent-[#00FF88]"
              />
              <input
                type="range"
                min="0"
                max="360"
                step="5"
                value={currDir}
                onChange={(e) => setCurrDir(parseFloat(e.target.value))}
                className="w-full accent-[#00FF88]"
              />
            </div>
          </div>

          <div>
            <label className="text-muted block mb-1">Backtrack Window ({backtrackHours} hours)</label>
            <input
              type="range"
              min="2"
              max="24"
              step="2"
              value={backtrackHours}
              onChange={(e) => setBacktrackHours(parseInt(e.target.value))}
              className="w-full accent-[#FFD700]"
            />
          </div>
        </div>
      )}

      {/* Filter / Quick Search Bar */}
      <div className="px-4 py-2.5 bg-[rgba(10,20,40,0.4)] border-b border-cyan-dim flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <span className="text-[0.6875rem] font-mono uppercase text-muted mr-1">Risk Filter:</span>
          {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setFilterRisk(r)}
              className={`px-2 py-0.5 rounded text-[0.6875rem] font-medium transition-colors ${
                filterRisk === r
                  ? 'bg-[#00D4FF] text-black font-bold'
                  : 'bg-[rgba(15,23,42,0.6)] text-muted hover:text-white'
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-48">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search by ship / MMSI..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[rgba(15,23,42,0.6)] border border-cyan-dim rounded pl-7 pr-2 py-1 text-xs text-white placeholder-muted focus:outline-none focus:border-[#00D4FF]"
            />
          </div>
          {data && (
            <div className="text-[0.6875rem] font-mono text-muted shrink-0">
              Evaluated: <span className="text-[#00D4FF] font-semibold">{data.total_evaluated_vessels.toLocaleString()}</span> vessels
            </div>
          )}
        </div>
      </div>

      {/* Table Content */}
      {loading && !data ? (
        <div className="p-12 text-center text-muted flex flex-col items-center justify-center gap-3">
          <RefreshCw className="animate-spin text-[#00D4FF]" size={28} />
          <div className="text-sm font-medium text-white">Analyzing AIS Spatiotemporal Corridors...</div>
          <div className="text-xs text-muted max-w-sm">
            Evaluating 10,001 vessel tracks against Lagrangian reverse drift vectors and Isolation Forest anomaly metrics.
          </div>
        </div>
      ) : error ? (
        <div className="p-6 text-center text-[#FF4444] bg-[rgba(255,68,68,0.05)] flex items-center justify-center gap-2">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      ) : (
        <div className="divide-y divide-cyan-dim/40">
          {filteredSuspects.length === 0 ? (
            <div className="p-8 text-center text-muted text-xs">
              No suspect ships match the selected filters.
            </div>
          ) : (
            filteredSuspects.map((suspect) => {
              const isTop1 = suspect.rank === 1;

              return (

                <div
                  key={suspect.mmsi}
                  className={`transition-colors ${
                    isTop1
                      ? 'bg-[rgba(255,215,0,0.03)] hover:bg-[rgba(255,215,0,0.06)]'
                      : 'hover:bg-[rgba(0,212,255,0.02)]'
                  }`}
                >
                  {/* Row Summary */}
                  <div
                    className="p-3 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 select-none"
                  >
                    {/* Rank & Vessel Info */}
                    <div className="flex items-center gap-3 min-w-[280px]">
                      <div
                        className={`w-8 h-8 rounded-md flex items-center justify-center text-xs font-mono border shrink-0 ${getRankBadgeStyle(
                          suspect.rank
                        )}`}
                      >
                        #{suspect.rank}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white tracking-wide">
                            {suspect.name}
                          </span>
                          {isTop1 && (
                            <span className="px-1.5 py-0.5 rounded text-[0.5625rem] font-extrabold bg-[#FFD700]/20 text-[#FFD700] border border-[#FFD700]/40 uppercase tracking-wider flex items-center gap-1">
                              <Award size={10} /> Prime Suspect
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="font-mono text-[0.6875rem] text-[#00D4FF]">MMSI: {suspect.mmsi}</span>
                          <span>•</span>
                          <span className="text-white/80">{suspect.type}</span>
                          <span>•</span>
                          <span className="text-amber-300/80 text-[0.6875rem]">{suspect.cargo_type || 'Crude/Oil'}</span>
                          <span>•</span>
                          <span>{suspect.flag || 'Intl'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Attribution Score Bar */}
                    <div className="flex items-center gap-3 lg:min-w-[220px]">
                      <div className="w-full">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted text-[0.6875rem]">Suspect Attribution:</span>
                          <span
                            className={`font-mono font-bold ${
                              suspect.attribution_score >= 80
                                ? 'text-[#FF4444]'
                                : suspect.attribution_score >= 60
                                ? 'text-[#FFA500]'
                                : 'text-[#FFD700]'
                            }`}
                          >
                            {suspect.attribution_score}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-[rgba(15,23,42,0.8)] rounded-full overflow-hidden border border-cyan-dim/40">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              suspect.attribution_score >= 80
                                ? 'bg-gradient-to-r from-orange-500 to-red-500 shadow-[0_0_8px_rgba(255,68,68,0.6)]'
                                : suspect.attribution_score >= 60
                                ? 'bg-gradient-to-r from-yellow-500 to-orange-500'
                                : 'bg-gradient-to-r from-cyan-500 to-yellow-500'
                            }`}
                            style={{ width: `${suspect.attribution_score}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Distance & Telemetry */}
                    <div className="flex items-center gap-4 text-xs font-mono shrink-0">
                      <div className="text-right">
                        <div className="text-[0.625rem] text-muted uppercase">Dist to Origin</div>
                        <div className="text-white font-semibold">{suspect.distance_to_origin_km} km</div>
                      </div>

                      <div className="text-right">
                        <div className="text-[0.625rem] text-muted uppercase">Speed / Head</div>
                        <div className="text-[#00D4FF]">
                          {suspect.speed} kn / {suspect.heading}°
                        </div>
                      </div>

                      <div className="shrink-0">{getRiskBadge(suspect.risk_level)}</div>

                      {onSelectVessel && (
                        <button
                          onClick={() => onSelectVessel(suspect.mmsi, suspect.lat, suspect.lon)}
                          className="px-2.5 py-1 rounded text-xs bg-[rgba(0,212,255,0.15)] hover:bg-[rgba(0,212,255,0.3)] text-[#00D4FF] border border-[#00D4FF]/40 flex items-center gap-1 transition-colors"
                          title="Focus vessel on tactical map"
                        >
                          <Compass size={12} /> Focus
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}

        </div>
      )}

      {/* Footer Summary */}
      {data?.algorithm_info && (
        <div className="p-3 bg-[rgba(5,10,25,0.8)] border-t border-cyan-dim text-[0.6875rem] text-muted flex flex-col sm:flex-row sm:items-center justify-between gap-1 font-mono">
          <div>
            <span>Model: </span>
            <span className="text-white/80">{data.algorithm_info.method}</span>
          </div>
          <div>
            <span>Weights: </span>
            <span className="text-[#00D4FF]">{data.algorithm_info.weights}</span>
          </div>
        </div>
      )}
    </div>
  );
}
