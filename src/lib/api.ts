import axios from 'axios';

export const DEFAULT_API_BASE = 'http://127.0.0.1:8001';
export const API_BASE = DEFAULT_API_BASE;

let activeBaseUrl: string | null = null;

export function getApiBase(): string {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem('SAGAR_API_BASE');
    if (custom && custom.trim() && !custom.includes('8000') && !custom.includes('8001')) {
      return custom.trim().replace(/\/$/, '');
    }
    if (activeBaseUrl !== null) {
      return activeBaseUrl;
    }
    // Default to relative '' so Vite's dev server proxy handles /api calls without CORS/PNA issues
    return '';
  }
  return DEFAULT_API_BASE;
}

export function setApiBase(url: string) {
  if (typeof window !== 'undefined') {
    const trimmed = url.trim();
    localStorage.setItem('SAGAR_API_BASE', trimmed);
    activeBaseUrl = trimmed;
  }
}

const headers = {};

export interface Waypoint {
  lat: number;
  lon: number;
  timestamp?: string;
  speed?: number;
  heading?: number;
}

export interface Vessel {
  name: string;
  mmsi: string;
  imo?: string;
  callsign?: string;
  flag?: string;
  type: string;
  lat: number;
  lon: number;
  speed: number;
  heading: number;
  length?: number;
  width?: number;
  draught?: number;
  destination?: string;
  eta?: string;
  cargo_type?: string;
  status: string;
  anomaly_score: number;
  is_anomaly?: boolean;
  is_prime_suspect?: boolean;
  attribution_score?: number;
  route?: Waypoint[];
}

export interface VesselsResponse {
  total: number;
  anomalies: number;
  vessels: Vessel[];
}

export interface HealthResponse {
  status: string;
  unet: boolean;
  iso_forest: boolean;
  vessel_count?: number;
  sar_available?: boolean;
  sar_file?: string | null;
}

export interface PrimeSuspectResponse {
  name: string;
  mmsi: string;
  attribution_score: number | null;
  type?: string;
  reason?: string;
  lat?: number;
  lon?: number;
  attribution_components?: Record<string, number | null>;
}

export interface DetectResponse {
  spill_detected: boolean;
  detection_percentage: number;
  confidence: number;
  area_km2?: number | null;
  classification?: string;
  recommendation?: string;
  pixel_count?: {
    spill: number;
    clean: number;
    total: number;
  };
  original_base64?: string;
  mask_base64?: string;
  heatmap_base64?: string;
  overlay_base64?: string;
  coordinates?: number[][];
}

export interface SimulateResponse {
  footprint_size: number;
  peak_intensity: number;
  trajectory?: Waypoint[];
  impact_zones?: string[];
  iou_score_pct?: number | null;
  sar_available?: boolean;
}

export interface SpillDetectionStatus {
  sar_loaded: boolean;
  file?: string;
  message?: string;
  result: DetectResponse | null;
}

export interface SourceStatus {
  connected: boolean;
  status: string;
  files?: number;
}

export interface OriginReconstructionResponse {
  slick_lat?: number;
  slick_lon?: number;
  origin_lat: number;
  origin_lon: number;
  origin_radius_km: number;
  backtrack_hours?: number;
  estimated_time: string;
  discharge_window?: string;
  confidence_pct?: number;
  iou_score_pct?: number;
  backtrack_trajectory?: Waypoint[];
  prime_suspect?: PrimeSuspectResponse;
  candidate_vessels?: Vessel[];
}

export interface RankedSuspect {
  rank: number;
  name: string;
  mmsi: string;
  type: string;
  cargo_type?: string;
  flag?: string;
  destination?: string;
  lat: number;
  lon: number;
  speed: number;
  heading: number;
  anomaly_score: number;
  attribution_score: number;
  confidence_pct: number;
  distance_to_spill_km: number;
  distance_to_origin_km: number;
  temporal_proximity_hrs: number;
  risk_level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  score_breakdown: {
    trajectory_proximity: number;
    kinematic_anomaly: number;
    vessel_cargo_risk: number;
    speed_deviation: number;
  };
  suspect_evidence: string[];
  recommended_action: string;
}

export interface SuspectRankingRequest {
  slick_lat?: number;
  slick_lon?: number;
  wind_speed_knots?: number;
  wind_direction_deg?: number;
  current_speed_knots?: number;
  current_direction_deg?: number;
  backtrack_hours?: number;
  limit?: number;
}

export interface SuspectRankingResponse {
  slick_lat: number;
  slick_lon: number;
  origin_lat: number;
  origin_lon: number;
  backtrack_hours: number;
  total_evaluated_vessels: number;
  top_suspects: RankedSuspect[];
  algorithm_info?: {
    method?: string;
    weights?: string;
    accuracy_standard?: string;
  };
}


function createApiClient() {
  const instance = axios.create({
    baseURL: getApiBase(),
    headers,
    timeout: 30000,
  });

  // Automatic resilience fallback: if relative proxy or direct fails with network error, try the alternate
  instance.interceptors.response.use(
    (response) => {
      // Remember successful base URL
      if (typeof window !== 'undefined' && !localStorage.getItem('SAGAR_API_BASE')) {
        activeBaseUrl = instance.defaults.baseURL || '';
      }
      return response;
    },
    async (error) => {
      const config = error.config;
      if (!config || (config as any).__isRetry) {
        return Promise.reject(error);
      }

      const isNetworkError = !error.response || error.code === 'ERR_NETWORK' || error.message?.includes('Network Error');
      if (isNetworkError) {
        (config as any).__isRetry = true;
        const currentBase = config.baseURL ?? '';
        // If relative ('') failed, fallback to direct DEFAULT_API_BASE ('http://127.0.0.1:8000')
        // If DEFAULT_API_BASE failed, fallback to relative ('')
        const fallbackBase = currentBase === '' ? DEFAULT_API_BASE : '';
        activeBaseUrl = fallbackBase;
        config.baseURL = fallbackBase;
        return axios(config);
      }
      return Promise.reject(error);
    }
  );

  return instance;
}

export async function getHealth(): Promise<HealthResponse> {
  const api = createApiClient();
  const r = await api.get('/api/health');
  return r.data;
}

export async function getVessels(): Promise<VesselsResponse> {
  const api = createApiClient();
  const r = await api.get('/api/vessels');
  return r.data;
}

export async function getSpillDetection(): Promise<SpillDetectionStatus> {
  const api = createApiClient();
  const r = await api.get('/api/spill-detection');
  return r.data;
}

export async function getMarineStatus(): Promise<SourceStatus> {
  const api = createApiClient();
  const r = await api.get('/api/marine-status');
  return r.data;
}

export async function getWindStatus(): Promise<SourceStatus> {
  const api = createApiClient();
  const r = await api.get('/api/wind-status');
  return r.data;
}

export async function uploadVesselsDataset(file: File): Promise<VesselsResponse> {
  const api = createApiClient();
  const formData = new FormData();
  formData.append('file', file);
  const r = await api.post('/api/vessels/upload', formData, {
    headers: { ...headers, 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  });
  return r.data;
}

export async function addVessel(vessel: Partial<Vessel>): Promise<Vessel> {
  const api = createApiClient();
  const r = await api.post('/api/vessels/add', vessel);
  return r.data;
}

export async function deleteVessel(mmsi: string): Promise<any> {
  const api = createApiClient();
  const r = await api.delete(`/api/vessels/${mmsi}`);
  return r.data;
}

export async function resetVesselData(): Promise<any> {
  const api = createApiClient();
  const r = await api.post('/api/reset-data');
  return r.data;
}

export async function getPrimeSuspect(): Promise<PrimeSuspectResponse> {
  const api = createApiClient();
  const r = await api.get('/api/prime-suspect');
  return r.data;
}

export async function detectSpill(): Promise<DetectResponse> {
  const api = createApiClient();
  const r = await api.get('/api/detect', { timeout: 120000 });
  return r.data;
}

export async function detectSpillUpload(file: File): Promise<DetectResponse> {
  const api = createApiClient();
  const formData = new FormData();
  formData.append('file', file);
  const r = await api.post('/api/detect', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  });
  return r.data;
}

export async function simulateSpill(
  vessel_name: string,
  lat: number,
  lon: number,
  hours = 24,
  wind_speed_knots = 12.0,
  wind_direction_deg = 220.0,
  current_speed_knots = 1.2,
  current_direction_deg = 135.0
): Promise<SimulateResponse> {
  const api = createApiClient();
  const r = await api.post('/api/simulate', {
    vessel_name,
    lat,
    lon,
    hours,
    wind_speed_knots,
    wind_direction_deg,
    current_speed_knots,
    current_direction_deg,
  });
  return r.data;
}

export async function reconstructOrigin(
  slick_lat: number,
  slick_lon: number,
  backtrack_hours = 8,
  wind_speed_knots = 12.0,
  wind_direction_deg = 220.0,
  current_speed_knots = 1.2,
  current_direction_deg = 135.0,
  spill_volume_m3 = 450.0
): Promise<OriginReconstructionResponse> {
  const api = createApiClient();
  const r = await api.post('/api/origin-reconstruction', {
    slick_lat,
    slick_lon,
    backtrack_hours,
    wind_speed_knots,
    wind_direction_deg,
    current_speed_knots,
    current_direction_deg,
    spill_volume_m3,
  });
  return r.data;
}

export async function getSuspectRanking(
  params?: SuspectRankingRequest
): Promise<SuspectRankingResponse> {
  const api = createApiClient();
  if (params) {
    const r = await api.post('/api/suspect-ranking', params);
    return r.data;
  }
  const r = await api.get('/api/suspect-ranking');
  return r.data;
}

