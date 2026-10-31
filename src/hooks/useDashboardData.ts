import { useEffect, useRef, useState, useCallback } from 'react';
import {
  getHealth,
  getVessels,
  getPrimeSuspect,
  getSpillDetection,
  getMarineStatus,
  getWindStatus,
  type Vessel,
  type HealthResponse,
  type PrimeSuspectResponse,
  type SpillDetectionStatus,
  type SourceStatus,
} from '@/lib/api';

export interface ActivityEvent {
  time: string;
  text: string;
  level: 'info' | 'warning' | 'danger' | 'success';
}

interface DashboardData {
  health: HealthResponse | null;
  online: boolean;
  vessels: Vessel[];
  totalVessels: number;
  anomalyCount: number;
  primeSuspect: PrimeSuspectResponse | null;
  spillDetection: SpillDetectionStatus | null;
  marineStatus: SourceStatus | null;
  windStatus: SourceStatus | null;
  loading: boolean;
  events: ActivityEvent[];
  refresh: () => void;
}

export function useDashboardData(): DashboardData {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [online, setOnline] = useState(false);
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [totalVessels, setTotalVessels] = useState(0);
  const [anomalyCount, setAnomalyCount] = useState(0);
  const [primeSuspect, setPrimeSuspect] = useState<PrimeSuspectResponse | null>(null);
  const [spillDetection, setSpillDetection] = useState<SpillDetectionStatus | null>(null);
  const [marineStatus, setMarineStatus] = useState<SourceStatus | null>(null);
  const [windStatus, setWindStatus] = useState<SourceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const eventsRef = useRef<ActivityEvent[]>([]);

  const addEvent = useCallback((text: string, level: ActivityEvent['level'] = 'info') => {
    const now = new Date();
    const time = now.toISOString().slice(11, 19);
    const evt: ActivityEvent = { time, text, level };
    eventsRef.current = [evt, ...eventsRef.current].slice(0, 40);
    setEvents([...eventsRef.current]);
  }, []);

  const fetchAll = useCallback(async () => {
    // Health check
    try {
      const h = await getHealth();
      setHealth(h);
      setOnline(true);
      if (h.sar_available) {
        addEvent(`SAR file ready: ${h.sar_file || 'sentinel1_sar.tiff'}`, 'success');
      }
    } catch {
      setOnline(false);
      setHealth(null);
    }

    // Vessel AIS data
    try {
      const v = await getVessels();
      setVessels(v.vessels || []);
      setTotalVessels(v.total || 0);
      setAnomalyCount(v.anomalies || 0);
      addEvent(
        `AIS feed live — ${(v.total || 0).toLocaleString()} vessels tracked, ${v.anomalies || 0} anomalies flagged`,
        'success'
      );
    } catch {
      addEvent('AIS feed fetch failed — backend may be offline', 'warning');
    }

    // Prime suspect
    try {
      const ps = await getPrimeSuspect();
      setPrimeSuspect(ps);
      if (ps.attribution_score != null) {
        addEvent(
          `Prime suspect: ${ps.name} — attribution ${ps.attribution_score.toFixed(1)}/100 [${ps.risk_level || 'HIGH'}]`,
          'danger'
        );
      }
    } catch {
      // silent — not all backends return this
    }

    // Parallel: spill, marine, wind
    const [spill, marine, wind] = await Promise.allSettled([
      getSpillDetection(),
      getMarineStatus(),
      getWindStatus(),
    ]);
    if (spill.status === 'fulfilled') {
      setSpillDetection(spill.value);
      if (spill.value.sar_loaded) {
        addEvent(`SAR spill detection ready — file: ${spill.value.file || 'sentinel1_sar.tiff'}`, 'info');
      }
    }
    if (marine.status === 'fulfilled') setMarineStatus(marine.value);
    if (wind.status === 'fulfilled') setWindStatus(wind.value);

    setLoading(false);
  }, [addEvent]);

  useEffect(() => {
    fetchAll();
    // Retry once after 3s to handle slow backend startup
    const initRetry = setTimeout(fetchAll, 3000);

    // Lightweight health ping every 8s
    const healthInterval = setInterval(async () => {
      try {
        const h = await getHealth();
        setHealth(h);
        setOnline(true);
      } catch {
        setOnline(false);
        setHealth(null);
        addEvent('Backend connection lost — retrying', 'warning');
      }
    }, 8000);

    // Full data refresh every 60s
    const dataInterval = setInterval(() => {
      fetchAll();
    }, 60000);

    return () => {
      clearTimeout(initRetry);
      clearInterval(healthInterval);
      clearInterval(dataInterval);
    };
  }, [fetchAll, addEvent]);

  return {
    health,
    online,
    vessels,
    totalVessels,
    anomalyCount,
    primeSuspect,
    spillDetection,
    marineStatus,
    windStatus,
    loading,
    events,
    refresh: fetchAll,
  };
}
