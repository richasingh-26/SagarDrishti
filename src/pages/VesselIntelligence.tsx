import { useMemo, useState, useRef } from 'react';
import {
  Search,
  Download,
  Upload,
  Plus,
  RotateCcw,
  ChevronUp,
  ChevronDown,
  X,
  Navigation,
  Anchor,
  FileSpreadsheet,
  Layers,
} from 'lucide-react';
import { Badge } from '@/components/Badge';
import { StatusDot } from '@/components/StatusDot';
import { Donut } from '@/components/Donut';
import {
  type Vessel,
  type PrimeSuspectResponse,
  uploadVesselsDataset,
  addVessel,
  resetVesselData,
} from '@/lib/api';

interface VesselIntelligenceProps {
  vessels: Vessel[];
  primeSuspect: PrimeSuspectResponse | null;
  onRefresh?: () => void;
}

type SortKey = keyof Vessel;
type FilterMode = 'all' | 'anomalies' | 'prime' | 'tankers';

const PAGE_SIZE = 25;

export function VesselIntelligence({
  vessels,
  primeSuspect,
  onRefresh,
}: VesselIntelligenceProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterMode>('all');
  const [sortKey, setSortKey] = useState<SortKey>('anomaly_score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Vessel | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Add Vessel Form state
  const [newVessel, setNewVessel] = useState({
    name: '',
    mmsi: '',
    imo: '',
    flag: 'India',
    type: 'Crude Oil Tanker',
    lat: 1.25,
    lon: 103.8,
    speed: 12.0,
    heading: 90.0,
    length: 220,
    width: 32,
    draught: 11.5,
    destination: 'Mumbai Port',
    cargo_type: 'Crude Oil',
    status: 'Underway',
    waypointsText: '1.30, 103.65\n1.28, 103.72\n1.25, 103.80',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadMsg(null);
    try {
      const res = await uploadVesselsDataset(file);
      setUploadMsg(`Successfully loaded ${res.total} vessels from dataset!`);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setUploadMsg(`Upload failed: ${err.message || 'Check dataset format'}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVessel.name || !newVessel.mmsi) return;

    // Parse waypoints from textarea
    const route = newVessel.waypointsText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        const parts = line.split(',').map((p) => parseFloat(p.trim()));
        return {
          lat: parts[0] || newVessel.lat,
          lon: parts[1] || newVessel.lon,
        };
      });

    try {
      await addVessel({
        ...newVessel,
        route,
      });
      setShowAddModal(false);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(`Failed to add vessel: ${err.message}`);
    }
  };

  const handleReset = async () => {
    if (confirm('Reset to default benchmark AIS dataset?')) {
      try {
        await resetVesselData();
        if (onRefresh) onRefresh();
      } catch (err: any) {
        alert(`Reset failed: ${err.message}`);
      }
    }
  };

  const downloadSampleCsv = () => {
    const csvContent =
      'MMSI,VesselName,VesselType,BaseDateTime,LAT,LON,SOG,COG,Length,Width,Draught,Destination,Flag,Cargo\n' +
      '563098230,MT PACIFIC STAR,Crude Oil Tanker,2026-06-01T06:00:00Z,1.3400,103.6800,14.2,115.0,245,42,14.2,Jurong Port,Singapore,Crude Oil\n' +
      '563098230,MT PACIFIC STAR,Crude Oil Tanker,2026-06-01T08:45:00Z,1.3050,103.7250,3.2,130.0,245,42,14.2,Jurong Port,Singapore,Crude Oil\n' +
      '563098230,MT PACIFIC STAR,Crude Oil Tanker,2026-06-01T10:15:00Z,1.2850,103.7420,2.8,114.0,245,42,14.2,Jurong Port,Singapore,Crude Oil\n' +
      '353136000,EVER GIVEN VII,Container Ship,2026-06-01T08:00:00Z,1.2100,103.9500,18.2,240.0,400,59,16.0,Rotterdam,Panama,Containers\n' +
      '413204900,YANGTZE DIAMOND,Crude Oil Tanker,2026-06-01T07:00:00Z,1.2700,103.7600,11.5,130.0,333,60,21.5,Zhoushan,China,Crude Oil\n';

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_ais_dataset.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = useMemo(() => {
    let result = [...vessels];

    if (filter === 'anomalies') {
      result = result.filter((v) => Boolean(v.is_anomaly || (v as any).anomaly === -1 || (v.anomaly_score !== undefined && v.anomaly_score < 0)));
    } else if (filter === 'prime') {
      result = result.filter(
        (v) => v.is_prime_suspect || v.name === primeSuspect?.name
      );
    } else if (filter === 'tankers') {
      result = result.filter(
        (v) =>
          v.type?.toLowerCase().includes('tanker') ||
          v.cargo_type?.toLowerCase().includes('oil')
      );
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          v.mmsi.toLowerCase().includes(q) ||
          (v.flag && v.flag.toLowerCase().includes(q)) ||
          (v.destination && v.destination.toLowerCase().includes(q)) ||
          v.type.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      const as = String(av ?? '');
      const bs = String(bv ?? '');
      return sortDir === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as);
    });

    return result;
  }, [vessels, filter, search, sortKey, sortDir, primeSuspect]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const exportCsv = () => {
    const headers = [
      'Name',
      'MMSI',
      'IMO',
      'Flag',
      'Type',
      'Speed (kn)',
      'Heading',
      'Lat',
      'Lon',
      'Destination',
      'Cargo',
      'Anomaly Score',
      'Status',
    ];
    const rows = filtered.map((v) => [
      v.name,
      v.mmsi,
      v.imo || '',
      v.flag || '',
      v.type,
      v.speed,
      v.heading,
      v.lat,
      v.lon,
      v.destination || '',
      v.cargo_type || '',
      v.anomaly_score,
      v.status,
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${c}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vessel-intelligence.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const columns: { key: SortKey; label: string; sortable: boolean }[] = [
    { key: 'name', label: 'Vessel Name', sortable: true },
    { key: 'mmsi', label: 'MMSI / ID', sortable: true },
    { key: 'flag', label: 'Flag', sortable: true },
    { key: 'type', label: 'Type', sortable: true },
    { key: 'destination', label: 'Destination', sortable: true },
    { key: 'speed', label: 'Speed', sortable: true },
    { key: 'lat', label: 'Lat/Lon', sortable: true },
    { key: 'anomaly_score', label: 'Anomaly Risk', sortable: true },
    { key: 'status', label: 'Status', sortable: true },
  ];

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main table area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {uploadMsg && (
          <div className="glass-panel px-4 py-2 text-xs flex items-center justify-between text-[#00D4FF] border border-cyan-dim">
            <span>{uploadMsg}</span>
            <button onClick={() => setUploadMsg(null)} className="text-white hover:opacity-75">
              <X size={14} />
            </button>
          </div>
        )}

        <div className="glass-panel overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-cyan-dim flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Navigation size={18} className="text-[#00D4FF]" />
                <span className="section-label text-sm">Vessel Intelligence & AIS Stream</span>
              </div>
              <Badge color="cyan">{filtered.length} vessels</Badge>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Search */}
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                  type="text"
                  placeholder="Search name, MMSI, flag..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(0);
                  }}
                  className="pl-8 pr-3 py-1.5 rounded-md bg-[rgba(10,22,40,0.6)] border border-cyan-dim text-xs text-white placeholder-muted focus:outline-none focus:border-[#00D4FF] w-48"
                />
              </div>

              {/* Filters */}
              <div className="flex items-center gap-1 bg-[rgba(10,22,40,0.4)] p-0.5 rounded-md border border-cyan-dim/40">
                {(['all', 'anomalies', 'prime', 'tankers'] as FilterMode[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => {
                      setFilter(f);
                      setPage(0);
                    }}
                    className={`px-2 py-1 rounded text-[0.625rem] font-semibold uppercase tracking-wider transition-all ${
                      filter === f
                        ? 'bg-[rgba(0,212,255,0.18)] text-[#00D4FF] shadow-sm'
                        : 'text-muted hover:text-white'
                    }`}
                  >
                    {f === 'prime' ? 'Prime Suspect' : f}
                  </button>
                ))}
              </div>

              {/* Actions */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.json"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                title="Upload real AIS CSV or JSON dataset"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[rgba(0,212,255,0.12)] hover:bg-[rgba(0,212,255,0.22)] border border-cyan-dim text-[#00D4FF] text-[0.625rem] font-semibold uppercase tracking-wider transition-all"
              >
                <Upload size={12} /> {isUploading ? 'Uploading...' : 'Import Dataset'}
              </button>

              <button
                onClick={() => setShowAddModal(true)}
                title="Add a custom vessel and route waypoints"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-[#00D4FF]/20 hover:bg-[#00D4FF]/30 border border-[#00D4FF]/50 text-white text-[0.625rem] font-semibold uppercase tracking-wider transition-all"
              >
                <Plus size={12} /> Add Vessel
              </button>

              <button
                onClick={downloadSampleCsv}
                title="Download sample AIS CSV dataset template"
                className="flex items-center gap-1 px-2 py-1.5 rounded-md bg-[rgba(10,22,40,0.6)] hover:bg-[rgba(0,212,255,0.1)] border border-cyan-dim/40 text-muted hover:text-white text-[0.625rem] transition-all"
              >
                <FileSpreadsheet size={12} /> Template
              </button>

              <button
                onClick={handleReset}
                title="Reset to default dataset"
                className="p-1.5 rounded-md text-muted hover:text-white border border-cyan-dim/40 hover:border-cyan-dim transition-all"
              >
                <RotateCcw size={12} />
              </button>

              <button
                onClick={exportCsv}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[rgba(0,212,255,0.08)] hover:bg-[rgba(0,212,255,0.15)] border border-cyan-dim text-[#00D4FF] text-[0.625rem] font-semibold uppercase tracking-wider transition-all"
              >
                <Download size={12} /> Export
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-cyan-dim bg-[rgba(10,22,40,0.5)]">
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => col.sortable && handleSort(col.key)}
                      className={`px-3 py-2.5 text-left section-label whitespace-nowrap ${
                        col.sortable ? 'cursor-pointer hover:text-white' : ''
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        {col.label}
                        {sortKey === col.key && (
                          <span className="text-[#00D4FF]">
                            {sortDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageItems.length === 0 && (
                  <tr>
                    <td colSpan={columns.length} className="text-center py-8 text-muted">
                      No vessels found matching filter criteria
                    </td>
                  </tr>
                )}
                {pageItems.map((v, i) => {
                  const isPrime = v.is_prime_suspect || v.name === primeSuspect?.name;
                  const isAnomaly = Boolean(v.is_anomaly || (v as any).anomaly === -1 || (v.anomaly_score !== undefined && v.anomaly_score < 0));
                  const isSelected = selected?.mmsi === v.mmsi;
                  const rowClass = isSelected
                    ? 'bg-[rgba(0,212,255,0.15)] border-l-2 border-l-[#00D4FF]'
                    : isPrime
                    ? 'bg-[rgba(255,215,0,0.06)] border-l-2 border-l-[#FFD700]'
                    : isAnomaly
                    ? 'bg-[rgba(255,68,68,0.04)] border-l-2 border-l-[#FF4444]/40'
                    : 'border-l-2 border-l-transparent hover:bg-[rgba(0,212,255,0.03)]';

                  return (
                    <tr
                      key={`${v.mmsi}-${i}`}
                      onClick={() => setSelected(v)}
                      className={`${rowClass} cursor-pointer transition-colors border-b border-cyan-dim/30`}
                    >
                      <td className="px-3 py-2.5 font-medium text-white whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {isPrime && <span className="text-[#FFD700]" title="Prime Suspect">★</span>}
                          <span>{v.name}</span>
                          {v.route && v.route.length > 1 && (
                            <span
                              className="text-[0.5625rem] px-1 bg-cyan-dim/40 text-[#00D4FF] rounded"
                              title={`${v.route.length} route waypoints tracked`}
                            >
                              {v.route.length} pts
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 metric-value text-muted">{v.mmsi}</td>
                      <td className="px-3 py-2.5 text-muted">{v.flag || '—'}</td>
                      <td className="px-3 py-2.5 text-muted">{v.type || 'N/A'}</td>
                      <td className="px-3 py-2.5 text-muted">{v.destination || '—'}</td>
                      <td className="px-3 py-2.5 metric-value text-white">{v.speed ?? '—'} kn</td>
                      <td className="px-3 py-2.5 metric-value text-muted whitespace-nowrap">
                        {v.lat.toFixed(4)}, {v.lon.toFixed(4)}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-[rgba(0,212,255,0.08)] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${(v.anomaly_score || 0) * 100}%`,
                                backgroundColor:
                                  v.anomaly_score > 0.7 ? '#FF4444' : v.anomaly_score > 0.4 ? '#FFA500' : '#00D4FF',
                              }}
                            />
                          </div>
                          <span
                            className="metric-value text-[0.625rem]"
                            style={{
                              color:
                                v.anomaly_score > 0.7 ? '#FF4444' : v.anomaly_score > 0.4 ? '#FFA500' : '#00D4FF',
                            }}
                          >
                            {((v.anomaly_score || 0) * 100).toFixed(0)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        {isPrime ? (
                          <Badge color="gold">PRIME SUSPECT</Badge>
                        ) : isAnomaly ? (
                          <Badge color="danger">ANOMALOUS</Badge>
                        ) : (
                          <span className="flex items-center gap-1 text-[#00FF88]">
                            <StatusDot color="#00FF88" size={6} pulse={false} />
                            <span className="text-[0.625rem]">NORMAL</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-cyan-dim">
            <div className="text-xs text-muted">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of{' '}
              {filtered.length} vessels
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-2.5 py-1 rounded-md text-xs font-medium border border-cyan-dim text-muted hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                Prev
              </button>
              <span className="metric-value text-xs text-white px-2">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-2.5 py-1 rounded-md text-xs font-medium border border-cyan-dim text-muted hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Detail Panel */}
      {selected && (
        <div className="w-96 shrink-0 p-4 pl-0">
          <div className="glass-panel h-full overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-cyan-dim">
              <span className="section-label">Vessel Intelligence Profile</span>
              <button onClick={() => setSelected(null)} className="text-muted hover:text-white">
                <X size={14} />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {/* Title / Avatar */}
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-lg flex items-center justify-center border shrink-0 ${
                    selected.is_prime_suspect || selected.name === primeSuspect?.name
                      ? 'bg-[rgba(255,215,0,0.12)] border-[#FFD700]'
                      : selected.is_anomaly
                      ? 'bg-[rgba(255,68,68,0.08)] border-[#FF4444]/40'
                      : 'bg-[rgba(0,212,255,0.08)] border-cyan-dim'
                  }`}
                >
                  <Anchor
                    size={22}
                    className={
                      selected.is_prime_suspect ? 'text-[#FFD700]' : 'text-[#00D4FF]'
                    }
                  />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">{selected.name}</div>
                  <div className="text-xs text-muted flex items-center gap-2">
                    <span>MMSI {selected.mmsi}</span>
                    {selected.flag && <span>• {selected.flag}</span>}
                  </div>
                </div>
              </div>

              {/* Grid attributes */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Type', value: selected.type || 'N/A' },
                  { label: 'Cargo', value: selected.cargo_type || 'N/A' },
                  { label: 'Speed', value: `${selected.speed ?? '—'} kn` },
                  { label: 'Heading', value: `${selected.heading ?? '—'}°` },
                  { label: 'Destination', value: selected.destination || 'N/A' },
                  { label: 'Status', value: selected.status || 'Underway' },
                  { label: 'Draught', value: selected.draught ? `${selected.draught} m` : '—' },
                  {
                    label: 'Dimensions',
                    value: selected.length ? `${selected.length}m × ${selected.width}m` : '—',
                  },
                  { label: 'Latitude', value: selected.lat.toFixed(4) },
                  { label: 'Longitude', value: selected.lon.toFixed(4) },
                ].map((item) => (
                  <div key={item.label} className="bg-[rgba(0,212,255,0.04)] rounded-md px-2.5 py-1.5">
                    <div className="section-label text-[0.5625rem]">{item.label}</div>
                    <div className="metric-value text-xs text-white truncate">{item.value}</div>
                  </div>
                ))}
              </div>

              {/* Anomaly gauge */}
              <div className="flex items-center gap-3 pt-2">
                <Donut
                  value={(selected.anomaly_score || 0) * 100}
                  size={72}
                  thickness={7}
                  color={selected.anomaly_score > 0.5 ? '#FF4444' : '#00D4FF'}
                  label={`${((selected.anomaly_score || 0) * 100).toFixed(0)}%`}
                  sublabel="Anomaly Risk"
                />
                <div className="flex-1 space-y-1">
                  <div className="section-label">Kinematic & ML Analysis</div>
                  <div className="text-[0.6875rem] text-muted leading-relaxed">
                    {selected.is_anomaly ? (
                      <span className="text-[#FF4444]">
                        Flagged by Isolation Forest: abnormal speed-to-heading ratio or slow drift in sea lane.
                      </span>
                    ) : (
                      'Normal navigational behavior conforming to traffic separation scheme.'
                    )}
                  </div>
                </div>
              </div>

              {/* Chronological Route Waypoints */}
              <div className="space-y-1.5 pt-2">
                <div className="flex items-center justify-between">
                  <span className="section-label flex items-center gap-1">
                    <Layers size={12} /> Trajectory Waypoints
                  </span>
                  <span className="text-[0.625rem] text-muted">
                    {selected.route?.length || 1} points
                  </span>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1 bg-[rgba(10,22,40,0.6)] p-2 rounded-md border border-cyan-dim">
                  {selected.route && selected.route.length > 0 ? (
                    <>
                      {selected.route.length > 150 && (
                        <div className="px-2 py-1 mb-1 rounded bg-[#FFD700]/10 border border-[#FFD700]/30 text-[0.625rem] text-[#FFD700] flex items-center justify-between">
                          <span>High-Density Telemetry Stream</span>
                          <span className="font-mono font-bold">{selected.route.length.toLocaleString()} total points</span>
                        </div>
                      )}
                      {(selected.route.length > 150 ? selected.route.slice(-150) : selected.route).map((w, idx) => {
                        const actualIdx = selected.route && selected.route.length > 150 ? selected.route.length - 150 + idx : idx;
                        return (
                          <div
                            key={actualIdx}
                            className="flex items-center justify-between text-[0.6875rem] py-0.5 border-b border-cyan-dim/20 last:border-0"
                          >
                            <span className="text-muted">
                              #{actualIdx + 1} {w.timestamp ? `(${w.timestamp})` : ''}
                            </span>
                            <span className="metric-value text-white">
                              {w.lat.toFixed(4)}, {w.lon.toFixed(4)}
                            </span>
                            {w.speed !== undefined && (
                              <span className="text-[#00D4FF] text-[0.625rem]">{w.speed} kn</span>
                            )}
                          </div>
                        );
                      })}
                    </>
                  ) : (
                    <div className="text-[0.6875rem] text-muted py-2 text-center">
                      Single GPS coordinate: {selected.lat.toFixed(4)}, {selected.lon.toFixed(4)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Vessel Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg overflow-hidden border border-[#00D4FF]/40 shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-cyan-dim bg-[rgba(10,22,40,0.7)]">
              <span className="section-label text-white text-xs font-semibold">
                Register New Vessel & Route
              </span>
              <button onClick={() => setShowAddModal(false)} className="text-muted hover:text-white">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="section-label text-[0.625rem] block mb-1">Vessel Name *</label>
                  <input
                    type="text"
                    required
                    value={newVessel.name}
                    onChange={(e) => setNewVessel({ ...newVessel, name: e.target.value })}
                    placeholder="e.g. MT OCEAN VOYAGER"
                    className="w-full px-2.5 py-1.5 rounded bg-[rgba(10,22,40,0.8)] border border-cyan-dim text-white focus:border-[#00D4FF] outline-none"
                  />
                </div>
                <div>
                  <label className="section-label text-[0.625rem] block mb-1">MMSI / IMO *</label>
                  <input
                    type="text"
                    required
                    value={newVessel.mmsi}
                    onChange={(e) => setNewVessel({ ...newVessel, mmsi: e.target.value })}
                    placeholder="e.g. 563098230"
                    className="w-full px-2.5 py-1.5 rounded bg-[rgba(10,22,40,0.8)] border border-cyan-dim text-white focus:border-[#00D4FF] outline-none"
                  />
                </div>

                <div>
                  <label className="section-label text-[0.625rem] block mb-1">Vessel Type</label>
                  <select
                    value={newVessel.type}
                    onChange={(e) => setNewVessel({ ...newVessel, type: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded bg-[rgba(10,22,40,0.8)] border border-cyan-dim text-white focus:border-[#00D4FF] outline-none"
                  >
                    <option value="Crude Oil Tanker">Crude Oil Tanker</option>
                    <option value="Chemical Tanker">Chemical Tanker</option>
                    <option value="Container Ship">Container Ship</option>
                    <option value="Bulk Carrier">Bulk Carrier</option>
                    <option value="Patrol Vessel">Patrol Vessel</option>
                    <option value="Fishing Vessel">Fishing Vessel</option>
                  </select>
                </div>

                <div>
                  <label className="section-label text-[0.625rem] block mb-1">Flag</label>
                  <input
                    type="text"
                    value={newVessel.flag}
                    onChange={(e) => setNewVessel({ ...newVessel, flag: e.target.value })}
                    placeholder="e.g. India, Singapore"
                    className="w-full px-2.5 py-1.5 rounded bg-[rgba(10,22,40,0.8)] border border-cyan-dim text-white focus:border-[#00D4FF] outline-none"
                  />
                </div>

                <div>
                  <label className="section-label text-[0.625rem] block mb-1">Current Latitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={newVessel.lat}
                    onChange={(e) => setNewVessel({ ...newVessel, lat: parseFloat(e.target.value) })}
                    className="w-full px-2.5 py-1.5 rounded bg-[rgba(10,22,40,0.8)] border border-cyan-dim text-white focus:border-[#00D4FF] outline-none"
                  />
                </div>

                <div>
                  <label className="section-label text-[0.625rem] block mb-1">Current Longitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={newVessel.lon}
                    onChange={(e) => setNewVessel({ ...newVessel, lon: parseFloat(e.target.value) })}
                    className="w-full px-2.5 py-1.5 rounded bg-[rgba(10,22,40,0.8)] border border-cyan-dim text-white focus:border-[#00D4FF] outline-none"
                  />
                </div>

                <div>
                  <label className="section-label text-[0.625rem] block mb-1">Speed (knots)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newVessel.speed}
                    onChange={(e) => setNewVessel({ ...newVessel, speed: parseFloat(e.target.value) })}
                    className="w-full px-2.5 py-1.5 rounded bg-[rgba(10,22,40,0.8)] border border-cyan-dim text-white focus:border-[#00D4FF] outline-none"
                  />
                </div>

                <div>
                  <label className="section-label text-[0.625rem] block mb-1">Destination</label>
                  <input
                    type="text"
                    value={newVessel.destination}
                    onChange={(e) => setNewVessel({ ...newVessel, destination: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded bg-[rgba(10,22,40,0.8)] border border-cyan-dim text-white focus:border-[#00D4FF] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="section-label text-[0.625rem] block mb-1">
                  Route Trajectory (Lat, Lon per line)
                </label>
                <textarea
                  rows={3}
                  value={newVessel.waypointsText}
                  onChange={(e) => setNewVessel({ ...newVessel, waypointsText: e.target.value })}
                  placeholder="1.30, 103.65&#10;1.28, 103.72&#10;1.25, 103.80"
                  className="w-full px-2.5 py-1.5 rounded bg-[rgba(10,22,40,0.8)] border border-cyan-dim text-white focus:border-[#00D4FF] outline-none font-mono text-[0.6875rem]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-cyan-dim/40">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded bg-transparent border border-cyan-dim text-muted hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-[#00D4FF] text-black font-semibold hover:bg-[#00D4FF]/90"
                >
                  Save Vessel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
