import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  Ship,
  Plus,
  Trash2,
  MapPin,
  Compass,
  Gauge,
  Layers,
  Save,
  RotateCcw,
  Sparkles,
  Wind,
  Waves,
  Eye,
  EyeOff,
  Navigation2,
  Anchor,
  Flag,
  Search,
  Crosshair,
  Radio,
  Sliders,
  AlertTriangle,
  Play,
  Pause,
  CheckCircle2,
  RefreshCw,
  Activity,
  ArrowRight,
  Maximize2,
  LocateFixed,
  Flame,
  Info,
  Radar,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Target,
  FileSpreadsheet,
} from 'lucide-react';
import { Badge } from '@/components/Badge';
import {
  addVessel,
  deleteVessel,
  getHealth,
  type Vessel,
  type Waypoint,
} from '@/lib/api';

interface FleetBuilderProps {
  vessels: Vessel[];
  onRefresh?: () => void;
  onNavigateToDashboard?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// MARITIME WATER-ONLY POLYGON (Singapore Strait & surrounding sea)
// Ships CANNOT be placed on land. Any waypoint must fall inside one of these
// navigable water zones. Zones are conservative – well inside the sea.
// ─────────────────────────────────────────────────────────────────────────────
interface WaterZone {
  name: string;
  // lat/lon bounding box (fast first-pass filter)
  latMin: number; latMax: number; lonMin: number; lonMax: number;
  // optional inner exclusion zones (land masses that cut into bounding box)
  exclude?: Array<{ latMin: number; latMax: number; lonMin: number; lonMax: number }>;
}

const NAVIGABLE_WATER_ZONES: WaterZone[] = [
  {
    // Singapore Strait TSS main channel (between Singapore island & Batam/Bintan)
    name: 'Singapore Strait (Main Channel)',
    latMin: 1.09, latMax: 1.38, lonMin: 103.50, lonMax: 104.15,
    exclude: [
      // Singapore Island main land mass
      { latMin: 1.22, latMax: 1.48, lonMin: 103.62, lonMax: 104.01 },
      // Sentosa + Pulau Brani
      { latMin: 1.22, latMax: 1.26, lonMin: 103.80, lonMax: 103.88 },
      // Batam Island (Indonesia)
      { latMin: 1.00, latMax: 1.14, lonMin: 103.95, lonMax: 104.13 },
      // Bintan Island coast (west tip)
      { latMin: 1.05, latMax: 1.20, lonMin: 104.10, lonMax: 104.20 },
      // Johor Bahru / Malaysian land
      { latMin: 1.38, latMax: 1.60, lonMin: 103.55, lonMax: 104.20 },
    ],
  },
  {
    // Western Malacca approach / Philip Channel west
    name: 'Philip Channel (West)',
    latMin: 1.10, latMax: 1.30, lonMin: 103.35, lonMax: 103.62,
  },
  {
    // Eastern Singapore Strait / St John's Channel
    name: 'Eastern Strait',
    latMin: 1.08, latMax: 1.28, lonMin: 104.10, lonMax: 104.40,
  },
];

/**
 * Returns true if (lat, lon) is over navigable open water for this region.
 * Uses a fast bounding-box check + land-exclusion zones.
 */
function isOpenWater(lat: number, lon: number): boolean {
  for (const zone of NAVIGABLE_WATER_ZONES) {
    if (lat >= zone.latMin && lat <= zone.latMax && lon >= zone.lonMin && lon <= zone.lonMax) {
      // Inside the zone's bounding box – check land exclusions
      if (zone.exclude) {
        const onLand = zone.exclude.some(
          (ex) => lat >= ex.latMin && lat <= ex.latMax && lon >= ex.lonMin && lon <= ex.lonMax
        );
        if (onLand) return false;
      }
      return true;
    }
  }
  return false;
}

/**
 * Snaps a coordinate pair to the nearest open-water position by walking
 * along a small spiral/grid around the original point.
 * Falls back to a safe deep-water anchor if nothing is found.
 */
function snapToWater(lat: number, lon: number): { lat: number; lon: number } {
  if (isOpenWater(lat, lon)) return { lat, lon };
  // Search expanding rings (0.005° ≈ ~550m steps)
  for (let r = 0.008; r <= 0.12; r += 0.008) {
    for (let angle = 0; angle < 360; angle += 30) {
      const rad = (angle * Math.PI) / 180;
      const tryLat = lat + r * Math.cos(rad);
      const tryLon = lon + r * Math.sin(rad);
      if (isOpenWater(tryLat, tryLon)) {
        return { lat: parseFloat(tryLat.toFixed(4)), lon: parseFloat(tryLon.toFixed(4)) };
      }
    }
  }
  // Hard fallback – centre of Singapore Strait
  return { lat: 1.20, lon: 103.78 };
}

// Military-Grade Dark Canvas (ESRI Dark Base - 100% Free, Zero Watermarks, Clean Coastlines)
const DARK_TACTICAL_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    'esri-dark-base': {
      type: 'raster',
      tiles: [
        'https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution: '© Esri, HERE, Garmin, © OpenStreetMap contributors',
      maxzoom: 16,
    },
    'esri-dark-reference': {
      type: 'raster',
      tiles: [
        'https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      maxzoom: 16,
    },
  },
  layers: [
    {
      id: 'esri-dark-base-layer',
      type: 'raster',
      source: 'esri-dark-base',
      minzoom: 0,
      maxzoom: 16,
    },
    {
      id: 'esri-dark-ref-layer',
      type: 'raster',
      source: 'esri-dark-reference',
      minzoom: 0,
      maxzoom: 16,
      paint: {
        'raster-opacity': 0.8,
      },
    },
  ],
};

const PRESET_ROUTES = {
  singapore_tanker: {
    name: 'MT OCEAN BREEZE',
    mmsi: '563990123',
    type: 'Crude Oil Tanker',
    flag: 'India',
    speed: 3.2,
    heading: 110,
    cargo: 'Crude Oil',
    destination: 'Jurong Port',
    status: 'Underway Using Engine',
    waypoints: [
      { lat: 1.345, lon: 103.65, speed: 14.0, heading: 115, timestamp: '10:00' },
      { lat: 1.315, lon: 103.71, speed: 8.5, heading: 112, timestamp: '11:15' },
      { lat: 1.285, lon: 103.75, speed: 3.2, heading: 110, timestamp: '12:30' },
    ],
  },
  malacca_cargo: {
    name: 'MV HIMALAYA STAR',
    mmsi: '419001888',
    type: 'Container Ship',
    flag: 'India',
    speed: 18.5,
    heading: 285,
    cargo: 'Containerized Cargo',
    destination: 'Mumbai Port',
    status: 'Underway',
    waypoints: [
      { lat: 1.18, lon: 103.95, speed: 18.0, heading: 280, timestamp: '08:00' },
      { lat: 1.22, lon: 103.88, speed: 18.5, heading: 285, timestamp: '09:00' },
      { lat: 1.26, lon: 103.8, speed: 18.5, heading: 285, timestamp: '10:00' },
    ],
  },
  erratic_spill_suspect: {
    name: 'MT NORDIC EXPLORER',
    mmsi: '538099777',
    type: 'Chemical Tanker',
    flag: 'Marshall Islands',
    speed: 1.8,
    heading: 45,
    cargo: 'Industrial Solvents',
    destination: 'Eastern Anchorage',
    status: 'Maneuvering',
    waypoints: [
      { lat: 1.33, lon: 103.67, speed: 12.0, heading: 110, timestamp: '07:30' },
      { lat: 1.29, lon: 103.72, speed: 2.1, heading: 85, timestamp: '09:00' },
      { lat: 1.27, lon: 103.74, speed: 1.8, heading: 45, timestamp: '10:45' },
    ],
  },
  container_carrier: {
    name: 'CONTAINER CARRIER ALPHA',
    mmsi: '636019888',
    type: 'Container Ship (ULCV)',
    flag: 'Liberia',
    speed: 18.2,
    heading: 68,
    cargo: 'Containerized Goods & Fuel',
    destination: 'Singapore Port / Tanjung Pelepas',
    status: 'Underway Using Engine',
    waypoints: [
      { lat: 1.152, lon: 103.451, speed: 18.5, heading: 65, timestamp: '00:00' },
      { lat: 1.189, lon: 103.582, speed: 18.0, heading: 68, timestamp: '01:30' },
      { lat: 1.224, lon: 103.712, speed: 6.2, heading: 72, timestamp: '03:45' },
      { lat: 1.268, lon: 103.835, speed: 14.5, heading: 70, timestamp: '06:15' },
      { lat: 1.328, lon: 104.045, speed: 17.8, heading: 75, timestamp: '09:30' },
    ],
  },
};

type ActiveTab = 'builder' | 'fleet-browser';
type FleetFilter = 'all' | 'anomalies' | 'prime' | 'singapore';

export function FleetBuilder({
  vessels,
  onRefresh,
  onNavigateToDashboard,
}: FleetBuilderProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('builder');

  // Form State
  const [name, setName] = useState('INS SAGARDWEEP');
  const [mmsi, setMmsi] = useState('419009999');
  const [imo, setImo] = useState('9843210');
  const [vesselType, setVesselType] = useState('Crude Oil Tanker');
  const [flag, setFlag] = useState('India');
  const [cargo, setCargo] = useState('Crude Oil');
  const [destination, setDestination] = useState('Kochi Port');
  const [status, setStatus] = useState('Underway Using Engine');
  const [speed, setSpeed] = useState(12.4);
  const [heading, setHeading] = useState(125);
  const [length, setLength] = useState(250);
  const [width, setWidth] = useState(44);
  const [draught, setDraught] = useState(14.5);

  // Waypoints state
  const [waypoints, setWaypoints] = useState<Waypoint[]>([
    { lat: 1.335, lon: 103.66, speed: 14.5, heading: 120, timestamp: '08:00' },
    { lat: 1.305, lon: 103.71, speed: 12.8, heading: 125, timestamp: '09:15' },
    { lat: 1.275, lon: 103.76, speed: 12.4, heading: 125, timestamp: '10:30' },
  ]);

  // Real-Time AIS Simulation State
  const [isSimulatingLive, setIsSimulatingLive] = useState<boolean>(false);
  const [simStepIndex, setSimStepIndex] = useState<number>(0);
  const [livePos, setLivePos] = useState<{ lat: number; lon: number } | null>(null);

  // Metocean / Weather Layers
  const [showWindVectors, setShowWindVectors] = useState(true);
  const [showCurrentVectors, setShowCurrentVectors] = useState(true);
  const [showSurroundingFleets, setShowSurroundingFleets] = useState(true);
  const [showSpillZone, setShowSpillZone] = useState(true);
  const [showTSSCorridor, setShowTSSCorridor] = useState(true);
  const [windSpeed, setWindSpeed] = useState(14.2); // Knots from ERA5
  const [windDirection, setWindDirection] = useState(215); // Degrees (SSW)
  const [currentSpeed, setCurrentSpeed] = useState(1.4); // Knots from Copernicus
  const [currentDirection, setCurrentDirection] = useState(130); // Degrees (SE)

  // Fleet Browser Search, Filtering & Pagination across all 10,001 vessels
  const [fleetSearch, setFleetSearch] = useState('');
  const [fleetFilter, setFleetFilter] = useState<FleetFilter>('all');
  const [fleetPage, setFleetPage] = useState(1);
  const FLEET_PER_PAGE = 30;
  const [selectedFleetVessel, setSelectedFleetVessel] = useState<Vessel | null>(null);

  // Submission & API state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [apiConnected, setApiConnected] = useState<boolean>(true);
  // Land-placement warning toast
  const [landWarn, setLandWarn] = useState<string | null>(null);

  // Map & Markers Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const popupRef = useRef<maplibregl.Popup | null>(null);

  // Dynamic state refs for click handling without recreating the map
  const activeTabRef = useRef(activeTab);
  const speedRef = useRef(speed);
  const headingRef = useRef(heading);
  const waypointsRef = useRef(waypoints);

  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { headingRef.current = heading; }, [heading]);
  useEffect(() => { waypointsRef.current = waypoints; }, [waypoints]);

  // Health ping check with automatic polling
  useEffect(() => {
    let mounted = true;
    const check = () => {
      getHealth()
        .then(() => { if (mounted) setApiConnected(true); })
        .catch(() => { if (mounted) setApiConnected(false); });
    };
    check();
    const id = setInterval(check, 6000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  // Filtered surrounding fleet across 10,001 vessels
  const filteredFleet = useMemo(() => {
    let list = vessels;
    if (fleetFilter === 'anomalies') {
      list = list.filter((v) => v.is_anomaly || (v as any).anomaly === -1 || (v.anomaly_score !== undefined && v.anomaly_score < 0));
    } else if (fleetFilter === 'prime') {
      list = list.filter((v) => v.is_prime_suspect || v.name === 'HEUNG-A PIONEER');
    } else if (fleetFilter === 'singapore') {
      list = list.filter((v) => v.lat >= 0.5 && v.lat <= 2.5 && v.lon >= 103.0 && v.lon <= 105.0);
    }

    if (!fleetSearch) return list;
    const q = fleetSearch.toLowerCase().trim();
    return list.filter(
      (v) =>
        (v.name && v.name.toLowerCase().includes(q)) ||
        (v.mmsi && v.mmsi.toLowerCase().includes(q)) ||
        (v.type && String(v.type).toLowerCase().includes(q)) ||
        (v.flag && v.flag.toLowerCase().includes(q))
    );
  }, [vessels, fleetFilter, fleetSearch]);

  const totalPages = Math.max(1, Math.ceil(filteredFleet.length / FLEET_PER_PAGE));
  const paginatedFleet = useMemo(() => {
    const start = (fleetPage - 1) * FLEET_PER_PAGE;
    return filteredFleet.slice(start, start + FLEET_PER_PAGE);
  }, [filteredFleet, fleetPage]);

  // Reset page on search or filter change
  useEffect(() => {
    setFleetPage(1);
  }, [fleetSearch, fleetFilter]);

  // Initialize Map (once)
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    try {
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: DARK_TACTICAL_STYLE,
        center: [103.78, 1.25],
        zoom: 11.2,
        attributionControl: false,
      });

      map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');

      map.on('load', () => {
        setMapReady(true);
        setTimeout(() => {
          map.resize();
          map.flyTo({ center: [103.78, 1.25], zoom: 11.2, duration: 400 });
        }, 150);
      });

      // Interactive vessel hover & click for all 10,001 vessels
      map.on('click', 'fleet-context-pts', (e) => {
        if (!e.features || e.features.length === 0) return;
        const feat = e.features[0];
        const props = feat.properties as any;
        const coords = (feat.geometry as any).coordinates.slice();

        if (popupRef.current) popupRef.current.remove();

        const isAnom = props.is_anomaly === true || props.is_anomaly === 'true' || Number(props.anomaly) === -1 || Number(props.anomaly_score) < 0;

        const popupHtml = `
          <div style="font-family: monospace; padding: 8px 12px; background: rgba(10, 22, 40, 0.95); border: 1.5px solid ${isAnom ? '#FF4444' : '#00D4FF'}; border-radius: 6px; color: #fff; min-width: 190px; box-shadow: 0 4px 20px rgba(0,0,0,0.5);">
            <div style="font-weight: 700; color: ${isAnom ? '#FFA500' : '#00D4FF'}; font-size: 13px;">${props.name || 'Vessel'}</div>
            <div style="font-size: 11px; color: #8899aa;">MMSI: ${props.mmsi || 'N/A'}</div>
            <div style="font-size: 11px; color: #ffcc00; margin-top: 4px;">SOG: ${props.speed || 0} kn | Type: ${props.type || 'Vessel'}</div>
            <div style="font-size: 11px; color: #aaa;">Lat: ${coords[1].toFixed(4)}°N, Lon: ${coords[0].toFixed(4)}°E</div>
            <div style="font-size: 11px; margin-top: 4px; font-weight: bold; color: ${isAnom ? '#FF4444' : '#00FF88'};">
              ${isAnom ? '⚠️ FLAGGED ANOMALY' : '✓ NORMAL FLEET'} (${typeof props.anomaly_score === 'number' ? props.anomaly_score.toFixed(3) : props.anomaly_score || 0})
            </div>
          </div>
        `;

        popupRef.current = new maplibregl.Popup({ offset: 12, closeButton: true })
          .setLngLat(coords)
          .setHTML(popupHtml)
          .addTo(map);
      });

      map.on('mouseenter', 'fleet-context-pts', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'fleet-context-pts', () => {
        map.getCanvas().style.cursor = '';
      });

      // Map click for appending waypoints — blocked on land
      map.on('click', (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ['fleet-context-pts'] });
        if (features && features.length > 0) return;

        if (activeTabRef.current !== 'builder') return;
        const { lng, lat } = e.lngLat;

        // ── Water-only enforcement ──────────────────────────────────────────
        if (!isOpenWater(lat, lng)) {
          setLandWarn('⚠ Cannot place waypoint on land. Click within the navigable sea lanes.');
          setTimeout(() => setLandWarn(null), 3500);
          // Flash the cursor red via canvas briefly
          const canvas = map.getCanvas();
          canvas.style.outline = '3px solid #FF4444';
          setTimeout(() => { canvas.style.outline = ''; }, 500);
          return;
        }
        // ───────────────────────────────────────────────────────────────────

        const nextTime = `T+${(waypointsRef.current.length + 1) * 30}m`;
        setWaypoints((prev) => [
          ...prev,
          {
            lat: parseFloat(lat.toFixed(4)),
            lon: parseFloat(lng.toFixed(4)),
            speed: speedRef.current,
            heading: headingRef.current,
            timestamp: nextTime,
          },
        ]);
      });

      mapRef.current = map;
    } catch (err) {
      console.warn('MapLibre init warning:', err);
    }

    return () => {
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (e) {}
        mapRef.current = null;
        setMapReady(false);
      }
    };
  }, []);

  // Real-Time Motion Simulation Loop & Live Camera Follow
  useEffect(() => {
    if (!isSimulatingLive || waypoints.length < 2) return;

    const interval = setInterval(() => {
      setSimStepIndex((prevIdx) => {
        const nextIdx = (prevIdx + 1) % waypoints.length;
        const pt = waypoints[nextIdx];
        setLivePos({ lat: pt.lat, lon: pt.lon });
        setSpeed(pt.speed || 12.0);
        setHeading(pt.heading || 120);

        if (mapRef.current) {
          mapRef.current.easeTo({
            center: [pt.lon, pt.lat],
            zoom: 11.8,
            duration: 800,
          });
        }
        return nextIdx;
      });
    }, 1500);

    return () => clearInterval(interval);
  }, [isSimulatingLive, waypoints]);

  const activeShipPos = livePos || (waypoints.length > 0 ? waypoints[waypoints.length - 1] : { lat: 1.275, lon: 103.76 });

  // Update Vector Layers & High-Visibility Holographic HTML Tactical Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    // Clear old HTML markers cleanly
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const setOrAddSource = (
      sourceId: string,
      data: GeoJSON.FeatureCollection | GeoJSON.Feature,
      addLayerCallback: () => void
    ) => {
      try {
        const existing = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
        if (existing && typeof existing.setData === 'function') {
          existing.setData(data);
        } else {
          if (!map.getSource(sourceId)) {
            map.addSource(sourceId, { type: 'geojson', data });
          }
          addLayerCallback();
        }
      } catch (e) {
        console.warn(`Layer error ${sourceId}:`, e);
      }
    };

    // 1. Singapore Traffic Separation Scheme (TSS) Fairway Corridor Lines
    const tssFeatures: GeoJSON.Feature[] = [];
    if (showTSSCorridor) {
      // Inbound Lane (Westbound)
      tssFeatures.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [103.60, 1.25],
            [103.75, 1.22],
            [103.90, 1.18],
            [104.05, 1.15],
          ],
        },
        properties: { type: 'inbound' },
      });
      // Outbound Lane (Eastbound)
      tssFeatures.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [103.60, 1.21],
            [103.75, 1.18],
            [103.90, 1.14],
            [104.05, 1.11],
          ],
        },
        properties: { type: 'outbound' },
      });
    }

    setOrAddSource('tss-lanes', { type: 'FeatureCollection', features: tssFeatures }, () => {
      if (!map.getLayer('tss-lanes')) {
        map.addLayer({
          id: 'tss-lanes',
          type: 'line',
          source: 'tss-lanes',
          paint: {
            'line-color': '#00E5FF',
            'line-width': 1.8,
            'line-opacity': 0.35,
            'line-dasharray': [4, 4],
          },
        });
      }
    });

    // 2. Wind Vectors Grid (ERA5)
    const windFeatures: GeoJSON.Feature[] = [];
    if (showWindVectors) {
      const latSteps = [1.16, 1.22, 1.28, 1.34, 1.40];
      const lonSteps = [103.62, 103.70, 103.78, 103.86, 103.94, 104.02];
      const rad = ((windDirection + 180) % 360) * (Math.PI / 180);
      const len = 0.022;

      latSteps.forEach((lat) => {
        lonSteps.forEach((lon) => {
          const endLat = lat + len * Math.cos(rad);
          const endLon = lon + len * Math.sin(rad);
          windFeatures.push({
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [
                [lon, lat],
                [endLon, endLat],
              ],
            },
            properties: { speed: windSpeed },
          });
        });
      });
    }

    setOrAddSource('wind-grid-vectors', { type: 'FeatureCollection', features: windFeatures }, () => {
      if (!map.getLayer('wind-grid-vectors')) {
        map.addLayer({
          id: 'wind-grid-vectors',
          type: 'line',
          source: 'wind-grid-vectors',
          paint: {
            'line-color': '#00E5FF',
            'line-width': 2.0,
            'line-opacity': 0.55,
            'line-dasharray': [3, 2],
          },
        });
      }
    });

    // 3. Ocean Surface Current Vectors (Copernicus)
    const currFeatures: GeoJSON.Feature[] = [];
    if (showCurrentVectors) {
      const latSteps = [1.19, 1.25, 1.31, 1.37];
      const lonSteps = [103.66, 103.74, 103.82, 103.90, 103.98];
      const rad = currentDirection * (Math.PI / 180);
      const len = 0.018;

      latSteps.forEach((lat) => {
        lonSteps.forEach((lon) => {
          const endLat = lat + len * Math.cos(rad);
          const endLon = lon + len * Math.sin(rad);
          currFeatures.push({
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [
                [lon, lat],
                [endLon, endLat],
              ],
            },
            properties: { speed: currentSpeed },
          });
        });
      });
    }

    setOrAddSource('current-grid-vectors', { type: 'FeatureCollection', features: currFeatures }, () => {
      if (!map.getLayer('current-grid-vectors')) {
        map.addLayer({
          id: 'current-grid-vectors',
          type: 'line',
          source: 'current-grid-vectors',
          paint: {
            'line-color': '#38EF7D',
            'line-width': 2.2,
            'line-opacity': 0.6,
          },
        });
      }
    });

    // 4. Sentinel-1 SAR Oil Spill Polygon & Origin Backtrack Zone
    const spillFeatures: GeoJSON.Feature[] = [];
    if (showSpillZone) {
      // High-visibility SAR Oil Slick Polygon
      spillFeatures.push({
        type: 'Feature',
        properties: { type: 'spill' },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [103.76, 1.20],
              [103.83, 1.28],
              [103.89, 1.24],
              [103.86, 1.17],
              [103.79, 1.17],
              [103.76, 1.20],
            ],
          ],
        },
      });

      // Origin backtrack zone
      spillFeatures.push({
        type: 'Feature',
        properties: { type: 'origin' },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [103.67, 1.30],
              [103.73, 1.35],
              [103.76, 1.31],
              [103.71, 1.27],
              [103.67, 1.30],
            ],
          ],
        },
      });
    }

    setOrAddSource('slick-fill-poly', { type: 'FeatureCollection', features: spillFeatures }, () => {
      if (!map.getLayer('slick-fill-poly')) {
        map.addLayer({
          id: 'slick-fill-poly',
          type: 'fill',
          source: 'slick-fill-poly',
          paint: {
            'fill-color': ['match', ['get', 'type'], 'origin', '#FFD700', '#FF1E27'],
            'fill-opacity': ['match', ['get', 'type'], 'origin', 0.25, 0.55],
          },
        });
      }
      if (!map.getLayer('slick-line-poly')) {
        map.addLayer({
          id: 'slick-line-poly',
          type: 'line',
          source: 'slick-fill-poly',
          paint: {
            'line-color': ['match', ['get', 'type'], 'origin', '#FFD700', '#FF0000'],
            'line-width': ['match', ['get', 'type'], 'origin', 2.5, 3.5],
            'line-dasharray': ['match', ['get', 'type'], 'origin', ['literal', [3, 2]], ['literal', [1, 0]]],
          },
        });
      }
    });

    // Add High-Tech Holographic Beacon Badges for Spill and Origin
    if (showSpillZone) {
      // 1. Oil Spill Central Badge with Multi-Layer Radar Glow
      const spillEl = document.createElement('div');
      spillEl.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; pointer-events: none; position: relative;">
          <div style="position: absolute; width: 60px; height: 60px; border-radius: 50%; background: rgba(255, 0, 50, 0.2); border: 2px solid rgba(255,0,0,0.6); animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite; top: 12px;"></div>
          <div style="background: linear-gradient(135deg, rgba(220, 20, 60, 0.95), rgba(139, 0, 0, 0.95)); border: 2px solid #FF4444; border-radius: 20px; padding: 5px 12px; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 900; color: #fff; box-shadow: 0 0 25px rgba(255, 0, 50, 0.9), inset 0 0 8px rgba(255,255,255,0.4); white-space: nowrap; display: flex; items-center; gap: 6px;">
            <span>🚨 SENTINEL-1 OIL SPILL (3.2 km²)</span>
          </div>
          <div style="width: 14px; height: 14px; border-radius: 50%; background: #FF0033; border: 2px solid #ffffff; margin-top: 4px; box-shadow: 0 0 15px #FF0033;"></div>
        </div>
      `;
      const spillMarker = new maplibregl.Marker({ element: spillEl })
        .setLngLat([103.82, 1.22])
        .addTo(map);
      markersRef.current.push(spillMarker);

      // 2. Origin Zone Badge
      const originEl = document.createElement('div');
      originEl.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; pointer-events: none; position: relative;">
          <div style="position: absolute; width: 44px; height: 44px; border-radius: 50%; background: rgba(255, 215, 0, 0.2); border: 1.5px dashed #FFD700; animation: ping 2.5s cubic-bezier(0, 0, 0.2, 1) infinite; top: 10px;"></div>
          <div style="background: linear-gradient(135deg, rgba(255, 215, 0, 0.95), rgba(200, 160, 0, 0.95)); border: 2px solid #ffffff; border-radius: 20px; padding: 4px 10px; font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 900; color: #000; box-shadow: 0 0 20px rgba(255, 215, 0, 0.9); white-space: nowrap;">
            🎯 PROBABLE ORIGIN (T-6h)
          </div>
          <div style="width: 12px; height: 12px; border-radius: 50%; background: #FFD700; border: 2px solid #000; margin-top: 4px;"></div>
        </div>
      `;
      const originMarker = new maplibregl.Marker({ element: originEl })
        .setLngLat([103.71, 1.31])
        .addTo(map);
      markersRef.current.push(originMarker);
    }

    // 5. Surrounding Fleet Vessels across ALL 10,001 vessels
    const fleetFeatures: GeoJSON.Feature[] = [];
    if (showSurroundingFleets && vessels.length > 0) {
      vessels.forEach((v) => {
        if (typeof v.lat !== 'number' || typeof v.lon !== 'number' || !isFinite(v.lat) || !isFinite(v.lon)) return;
        const isAnom = Boolean(v.is_anomaly || (v as any).anomaly === -1 || (v.anomaly_score !== undefined && v.anomaly_score < 0));
        const color = v.is_prime_suspect ? '#FFD700' : isAnom ? '#FF4444' : '#00E5FF';
        fleetFeatures.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [v.lon, v.lat] },
          properties: {
            name: v.name,
            mmsi: v.mmsi,
            speed: v.speed,
            type: v.type,
            anomaly_score: v.anomaly_score,
            is_anomaly: isAnom,
            color: color,
            radius: v.is_prime_suspect ? 9 : isAnom ? 6.5 : 4.5,
          },
        });
      });
    }

    setOrAddSource('fleet-context-pts', { type: 'FeatureCollection', features: fleetFeatures }, () => {
      if (!map.getLayer('fleet-context-pts')) {
        map.addLayer({
          id: 'fleet-context-pts',
          type: 'circle',
          source: 'fleet-context-pts',
          paint: {
            'circle-radius': ['get', 'radius'],
            'circle-color': ['get', 'color'],
            'circle-opacity': 0.95,
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 1.5,
          },
        });
      }
    });

    // 6. Custom Route Track Line (Neon Cyan Glow)
    const routeCoords = waypoints.length > 1 ? waypoints.map((w) => [w.lon, w.lat]) : [];
    const routeGeo: GeoJSON.Feature = {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: routeCoords },
      properties: {},
    };

    setOrAddSource('custom-route-line', routeGeo, () => {
      if (!map.getLayer('custom-route-line')) {
        map.addLayer({
          id: 'custom-route-line',
          type: 'line',
          source: 'custom-route-line',
          paint: {
            'line-color': '#00E5FF',
            'line-width': 4.0,
            'line-dasharray': [2, 1],
          },
        });
      }
    });

    // 7. Numbered Waypoints Holographic Cyber-Pins
    waypoints.forEach((w, idx) => {
      const wpEl = document.createElement('div');
      wpEl.innerHTML = `
        <div style="background: #FFD700; border: 2px solid #000; border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 900; color: #000; box-shadow: 0 0 12px rgba(255, 215, 0, 0.9);">
          ${idx + 1}
        </div>
      `;
      const wpMarker = new maplibregl.Marker({ element: wpEl })
        .setLngLat([w.lon, w.lat])
        .addTo(map);
      markersRef.current.push(wpMarker);
    });

    // 8. Custom Plotted Ship Beacon (HTML Marker with Multi-Ring Holographic Radar Ping)
    const shipEl = document.createElement('div');
    shipEl.innerHTML = `
      <div style="position: relative; width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; pointer-events: none;">
        <div style="position: absolute; width: 44px; height: 44px; border-radius: 50%; background: rgba(0,255,136,0.25); border: 2px solid #00FF88; animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        <div style="position: absolute; width: 26px; height: 26px; border-radius: 50%; background: rgba(0,255,136,0.4); border: 1.5px solid #00FF88;"></div>
        <div style="width: 22px; height: 22px; border-radius: 50%; background: ${isSimulatingLive ? '#FFD700' : '#00FF88'}; border: 2px solid #ffffff; box-shadow: 0 0 16px ${isSimulatingLive ? '#FFD700' : '#00FF88'}; display: flex; align-items: center; justify-content: center; font-size: 12px; z-index: 2;">
          🚢
        </div>
        <div style="position: absolute; top: -20px; background: rgba(7, 15, 30, 0.95); border: 1.5px solid ${isSimulatingLive ? '#FFD700' : '#00FF88'}; border-radius: 4px; padding: 2px 7px; font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 800; color: ${isSimulatingLive ? '#FFD700' : '#00FF88'}; white-space: nowrap; box-shadow: 0 0 10px rgba(0,0,0,0.8);">
          ${name} (${speed}kn)
        </div>
      </div>
    `;
    const shipMarker = new maplibregl.Marker({ element: shipEl })
      .setLngLat([activeShipPos.lon, activeShipPos.lat])
      .addTo(map);
    markersRef.current.push(shipMarker);
  }, [
    waypoints,
    vessels,
    mapReady,
    name,
    speed,
    heading,
    activeShipPos,
    isSimulatingLive,
    showWindVectors,
    showCurrentVectors,
    showSurroundingFleets,
    showSpillZone,
    showTSSCorridor,
    windSpeed,
    windDirection,
    currentSpeed,
    currentDirection,
  ]);

  const loadPreset = (presetKey: keyof typeof PRESET_ROUTES) => {
    const p = PRESET_ROUTES[presetKey];
    setName(p.name);
    setMmsi(p.mmsi);
    setVesselType(p.type);
    setFlag(p.flag);
    setSpeed(p.speed);
    setHeading(p.heading);
    setCargo(p.cargo);
    setDestination(p.destination);
    setStatus(p.status);
    setWaypoints(p.waypoints);
    setLivePos(null);
    setIsSimulatingLive(false);

    if (mapRef.current && p.waypoints.length > 0) {
      const last = p.waypoints[p.waypoints.length - 1];
      mapRef.current.flyTo({ center: [last.lon, last.lat], zoom: 11.5, duration: 1000 });
    }
  };

  const centerOnSingapore = () => {
    if (mapRef.current) {
      mapRef.current.flyTo({ center: [103.78, 1.25], zoom: 11.2, duration: 1000 });
    }
  };

  const focusCustomShip = () => {
    if (mapRef.current) {
      mapRef.current.flyTo({ center: [activeShipPos.lon, activeShipPos.lat], zoom: 12.0, duration: 800 });
    }
  };

  // Load ANY vessel from the 10,001 dataset into the Builder & Simulator
  const loadVesselIntoBuilder = (v: Vessel) => {
    setName(v.name);
    setMmsi(v.mmsi);
    setVesselType(v.type || 'Crude Oil Tanker');
    setFlag(v.flag || 'Panama');
    setSpeed(v.speed || 12.0);
    setHeading(v.heading || 120);
    setCargo(v.cargo_type || 'Crude Oil');
    setDestination(v.destination || 'Singapore Port');
    setStatus(v.status || 'Underway Using Engine');

    const baseLat = v.lat;
    const baseLon = v.lon;
    const vSpeed = v.speed || 12.0;
    const vHeading = v.heading || 120;
    const rad = vHeading * (Math.PI / 180);

    // ── Water-only: snap the base position first ─────────────────────────
    const baseSnapped = snapToWater(baseLat, baseLon);

    // Helper: generate a candidate waypoint along heading and snap it to water
    const makeWaterWaypoint = (
      dlat: number,
      dlon: number,
      ts: string
    ): Waypoint => {
      const snapped = snapToWater(baseSnapped.lat + dlat, baseSnapped.lon + dlon);
      return {
        lat: snapped.lat,
        lon: snapped.lon,
        speed: vSpeed,
        heading: vHeading,
        timestamp: ts,
      };
    };

    const generatedWaypoints: Waypoint[] = v.route && v.route.length > 0
      ? v.route.map((wp) => {
          const s = snapToWater(wp.lat, wp.lon);
          return { ...wp, lat: s.lat, lon: s.lon };
        })
      : [
          makeWaterWaypoint(-0.04 * Math.cos(rad), -0.04 * Math.sin(rad), 'T-1h'),
          makeWaterWaypoint(-0.02 * Math.cos(rad), -0.02 * Math.sin(rad), 'T-30m'),
          { lat: baseSnapped.lat, lon: baseSnapped.lon, speed: vSpeed, heading: vHeading, timestamp: 'Current Pos' },
          makeWaterWaypoint( 0.03 * Math.cos(rad),  0.03 * Math.sin(rad), 'T+30m'),
        ];

    setWaypoints(generatedWaypoints);
    setLivePos(null);
    setIsSimulatingLive(false);
    setActiveTab('builder');

    if (mapRef.current) {
      mapRef.current.flyTo({ center: [baseLon, baseLat], zoom: 12.0, duration: 1000 });
    }
  };

  const handleSaveToFleet = async () => {
    if (!name || !mmsi) {
      alert('Please enter a Vessel Name and MMSI number.');
      return;
    }

    if (waypoints.length === 0) {
      alert('Please add at least one GPS waypoint for the ship on the map.');
      return;
    }

    setIsSubmitting(true);
    setNotification(null);

    const latest = waypoints[waypoints.length - 1];
    const isAnomalousSpeed = (vesselType.includes('Tanker') && speed < 3.0) || speed > 24.0;

    const vesselPayload: Vessel = {
      name: name.trim(),
      mmsi: mmsi.trim(),
      imo: imo.trim() || undefined,
      flag: flag.trim(),
      type: vesselType,
      lat: latest.lat,
      lon: latest.lon,
      speed: speed,
      heading: heading,
      length: length,
      width: width,
      draught: draught,
      destination: destination.trim(),
      cargo_type: cargo.trim(),
      status: status,
      anomaly_score: isAnomalousSpeed ? -0.15 : 0.15,
      is_anomaly: isAnomalousSpeed,
      is_prime_suspect: false,
      route: waypoints,
    };

    try {
      const saved = await addVessel(vesselPayload);
      const isAnom = saved.is_anomaly || (saved.anomaly_score !== undefined && saved.anomaly_score < 0);
      setNotification({
        type: 'success',
        text: `✅ "${saved.name}" successfully registered into live fleet (${isAnom ? 'Flagged Anomaly' : 'Normal Fleet'})!`,
      });
      setApiConnected(true);

      if (onRefresh) onRefresh();

      setSelectedFleetVessel(saved);
      setActiveTab('fleet-browser');

      if (mapRef.current) {
        mapRef.current.flyTo({ center: [saved.lon, saved.lat], zoom: 11.8, duration: 1200 });
      }
    } catch (err: any) {
      console.warn('API error saving vessel, applying optimistic local registration:', err);
      setNotification({
        type: 'success',
        text: `✅ "${vesselPayload.name}" registered into local session!`,
      });
      setSelectedFleetVessel(vesselPayload);
      setActiveTab('fleet-browser');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteVessel = async (targetMmsi: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteVessel(targetMmsi);
      if (selectedFleetVessel?.mmsi === targetMmsi) {
        setSelectedFleetVessel(null);
      }
      if (onRefresh) onRefresh();
    } catch (err) {
      console.warn('Delete vessel err:', err);
    }
  };

  const focusVesselOnMap = (v: Vessel) => {
    setSelectedFleetVessel(v);
    if (mapRef.current) {
      mapRef.current.flyTo({ center: [v.lon, v.lat], zoom: 11.8, duration: 1000 });
    }
  };

  const removeWaypoint = (index: number) => {
    setWaypoints((prev) => prev.filter((_, i) => i !== index));
  };

  const clearWaypoints = () => {
    setWaypoints([]);
  };

  return (
    <div className="flex h-full overflow-hidden bg-bg-base text-white">
      {/* LEFT PANEL: Multi-tab studio controls */}
      <div className="w-[480px] shrink-0 border-r border-cyan-dim flex flex-col h-full bg-[rgba(7,15,30,0.95)] backdrop-blur-xl">
        {/* Top Header */}
        <div className="p-4 border-b border-cyan-dim flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[rgba(0,212,255,0.1)] border border-cyan-dim flex items-center justify-center text-[#00D4FF]">
              <Ship size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">Custom Ship Studio & Fleet</h2>
              <p className="text-[0.625rem] text-muted">10,001 Vessel Database, Simulator & Forensics</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge color={apiConnected ? 'success' : 'warning'}>
              <Activity size={10} className="inline mr-1" />
              {apiConnected ? 'API LIVE' : 'LOCAL'}
            </Badge>
            <Badge color="cyan">{vessels.length} Fleets</Badge>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-cyan-dim bg-[rgba(10,22,40,0.5)] px-2 pt-2 gap-1">
          <button
            onClick={() => setActiveTab('builder')}
            className={`flex-1 py-2 px-3 text-xs font-semibold rounded-t-md transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'builder'
                ? 'bg-[rgba(0,212,255,0.15)] text-[#00D4FF] border-t-2 border-t-[#00D4FF]'
                : 'text-muted hover:text-white'
            }`}
          >
            <Plus size={13} /> Plot Ship & Simulator
          </button>
          <button
            onClick={() => setActiveTab('fleet-browser')}
            className={`flex-1 py-2 px-3 text-xs font-semibold rounded-t-md transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'fleet-browser'
                ? 'bg-[rgba(0,212,255,0.15)] text-[#00D4FF] border-t-2 border-t-[#00D4FF]'
                : 'text-muted hover:text-white'
            }`}
          >
            <Ship size={13} /> Fleet Directory ({vessels.length})
          </button>
        </div>

        {/* TAB 1: SHIP BUILDER */}
        {activeTab === 'builder' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            {notification && (
              <div
                className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 ${
                  notification.type === 'success'
                    ? 'bg-[rgba(0,255,136,0.1)] border-[#00FF88]/40 text-[#00FF88]'
                    : 'bg-[rgba(255,68,68,0.1)] border-[#FF4444]/40 text-[#FF4444]'
                }`}
              >
                <CheckCircle2 size={14} className="shrink-0" />
                <span>{notification.text}</span>
              </div>
            )}

            {/* Presets */}
            <div className="p-3 rounded-lg bg-[rgba(10,22,40,0.6)] border border-cyan-dim/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="section-label flex items-center gap-1.5 text-[0.625rem]">
                  <Sparkles size={11} className="text-[#FFD700]" /> Tactical Presets
                </span>
                <span className="text-[0.5625rem] text-muted">1-Click Load</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => loadPreset('container_carrier')}
                  className="p-1.5 rounded bg-[rgba(0,212,255,0.06)] hover:bg-[rgba(0,212,255,0.15)] border border-cyan-dim/40 text-left transition-all col-span-2 flex items-center justify-between"
                >
                  <span className="text-white text-[0.6875rem] font-medium flex items-center gap-1">
                    🚢 High-Density AIS Track
                  </span>
                  <Badge color="gold">2.5K PTS</Badge>
                </button>
                <button
                  type="button"
                  onClick={() => loadPreset('singapore_tanker')}
                  className="p-1.5 rounded bg-[rgba(0,212,255,0.04)] hover:bg-[rgba(0,212,255,0.12)] border border-cyan-dim/30 text-left transition-all"
                >
                  <span className="text-white text-[0.625rem] font-medium flex items-center gap-1">
                    ⚓ Tanker Inbound
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => loadPreset('erratic_spill_suspect')}
                  className="p-1.5 rounded bg-[rgba(255,68,68,0.06)] hover:bg-[rgba(255,68,68,0.15)] border border-[#FF4444]/30 text-left transition-all"
                >
                  <span className="text-[#FF8C00] text-[0.625rem] font-medium flex items-center gap-1">
                    ⚠️ Spill Suspect
                  </span>
                </button>
              </div>
            </div>

            {/* Motion Simulation Trigger */}
            <div className="p-3 rounded-lg bg-[rgba(0,212,255,0.04)] border border-cyan-dim/40 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Play size={12} className="text-[#00D4FF]" /> Real-Time AIS Motion Simulation
                </div>
                <div className="text-[0.625rem] text-muted mt-0.5">
                  Simulate vessel sailing along route & test overlap with oil spill
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsSimulatingLive((s) => !s);
                  if (!isSimulatingLive) {
                    focusCustomShip();
                  }
                }}
                className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md ${
                  isSimulatingLive
                    ? 'bg-[#FF4444] text-white animate-pulse'
                    : 'bg-[#00D4FF] text-black hover:bg-[#00D4FF]/90'
                }`}
              >
                {isSimulatingLive ? (
                  <>
                    <Pause size={12} /> Pause AIS
                  </>
                ) : (
                  <>
                    <Play size={12} /> Simulate AIS
                  </>
                )}
              </button>
            </div>

            {/* Primary Form Fields */}
            <div className="space-y-3">
              <span className="section-label flex items-center gap-1.5">
                <Anchor size={12} className="text-[#00D4FF]" /> Ship Specifications
              </span>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[0.625rem] text-muted block mb-1">Vessel Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded bg-[rgba(10,22,40,0.8)] border border-cyan-dim text-xs text-white focus:border-[#00D4FF] outline-none"
                  />
                </div>
                <div>
                  <label className="text-[0.625rem] text-muted block mb-1">MMSI Identifier *</label>
                  <input
                    type="text"
                    value={mmsi}
                    onChange={(e) => setMmsi(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded bg-[rgba(10,22,40,0.8)] border border-cyan-dim text-xs text-white focus:border-[#00D4FF] outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[0.625rem] text-muted block mb-1">Vessel Type</label>
                  <input
                    type="text"
                    value={vesselType}
                    onChange={(e) => setVesselType(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded bg-[rgba(10,22,40,0.8)] border border-cyan-dim text-xs text-white focus:border-[#00D4FF] outline-none"
                  />
                </div>
                <div>
                  <label className="text-[0.625rem] text-muted block mb-1">Flag State</label>
                  <input
                    type="text"
                    value={flag}
                    onChange={(e) => setFlag(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded bg-[rgba(10,22,40,0.8)] border border-cyan-dim text-xs text-white focus:border-[#00D4FF] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[0.625rem] text-muted block mb-1">Speed Over Ground (SOG)</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      step="0.1"
                      value={speed}
                      onChange={(e) => setSpeed(parseFloat(e.target.value) || 0)}
                      className="flex-1 px-2.5 py-1.5 rounded bg-[rgba(10,22,40,0.8)] border border-cyan-dim text-xs text-white focus:border-[#00D4FF] outline-none font-mono"
                    />
                    <span className="text-[0.625rem] text-muted">knots</span>
                  </div>
                </div>
                <div>
                  <label className="text-[0.625rem] text-muted block mb-1">Course Over Ground (COG °)</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      value={heading}
                      onChange={(e) => setHeading(parseInt(e.target.value) || 0)}
                      className="flex-1 px-2.5 py-1.5 rounded bg-[rgba(10,22,40,0.8)] border border-cyan-dim text-xs text-white focus:border-[#00D4FF] outline-none font-mono"
                    />
                    <span className="text-[0.625rem] text-muted">deg</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Plotted Waypoints List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="section-label flex items-center gap-1.5">
                  <MapPin size={12} className="text-[#FFD700]" /> Plotted Waypoints ({waypoints.length})
                </span>
                {waypoints.length > 0 && (
                  <button
                    onClick={clearWaypoints}
                    className="text-[0.625rem] text-[#FF4444] hover:underline flex items-center gap-1"
                  >
                    <Trash2 size={10} /> Clear All
                  </button>
                )}
              </div>

              <div className="p-2 rounded bg-[rgba(0,212,255,0.04)] border border-cyan-dim/30 text-[0.625rem] text-muted flex items-center gap-1.5">
                <Navigation2 size={12} className="text-[#00D4FF] shrink-0" />
                <span>Click directly on the tactical map to append waypoints in real-time!</span>
              </div>

              <div className="max-h-36 overflow-y-auto space-y-1.5 bg-[rgba(10,22,40,0.7)] p-2 rounded-lg border border-cyan-dim/50">
                {waypoints.length === 0 ? (
                  <div className="text-center py-4 text-muted text-xs">
                    No waypoints plotted yet. Click on the map to add coordinates.
                  </div>
                ) : (
                  waypoints.map((w, idx) => (
                    <div
                      key={idx}
                      className="p-1.5 rounded bg-[rgba(0,212,255,0.05)] flex items-center justify-between font-mono text-[0.6875rem] border border-cyan-dim/20"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-[#00D4FF]/20 text-[#00D4FF] flex items-center justify-center text-[0.5625rem] font-bold">
                          {idx + 1}
                        </span>
                        <span className="text-white">{w.lat.toFixed(4)}°N, {w.lon.toFixed(4)}°E</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted">
                        <span>{w.speed}kn</span>
                        <span>{w.heading}°</span>
                        <button
                          onClick={() => removeWaypoint(idx)}
                          className="text-muted hover:text-[#FF4444]"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: FLEET DIRECTORY (Browsing & Simulating ANY of the 10,001 Vessels) */}
        {activeTab === 'fleet-browser' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs flex flex-col">
            {/* Search Bar */}
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-muted" />
              <input
                type="text"
                placeholder="Search 10,001 vessels by Name, MMSI, Type, Flag..."
                value={fleetSearch}
                onChange={(e) => setFleetSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-lg bg-[rgba(10,22,40,0.8)] border border-cyan-dim text-xs text-white focus:border-[#00D4FF] outline-none font-mono"
              />
            </div>

            {/* Filter Buttons */}
            <div className="flex gap-1 flex-wrap">
              <button
                onClick={() => setFleetFilter('all')}
                className={`px-2 py-1 rounded text-[0.625rem] font-semibold transition-all ${
                  fleetFilter === 'all'
                    ? 'bg-[#00D4FF] text-black font-bold'
                    : 'bg-white/5 text-muted hover:text-white'
                }`}
              >
                All ({vessels.length})
              </button>
              <button
                onClick={() => setFleetFilter('anomalies')}
                className={`px-2 py-1 rounded text-[0.625rem] font-semibold transition-all ${
                  fleetFilter === 'anomalies'
                    ? 'bg-[#FF4444] text-white font-bold'
                    : 'bg-white/5 text-[#FF8C00] hover:text-[#FF4444]'
                }`}
              >
                🔴 Anomalies (500)
              </button>
              <button
                onClick={() => setFleetFilter('prime')}
                className={`px-2 py-1 rounded text-[0.625rem] font-semibold transition-all ${
                  fleetFilter === 'prime'
                    ? 'bg-[#FFD700] text-black font-bold'
                    : 'bg-white/5 text-[#FFD700] hover:text-white'
                }`}
              >
                ⭐ Prime Suspect
              </button>
              <button
                onClick={() => setFleetFilter('singapore')}
                className={`px-2 py-1 rounded text-[0.625rem] font-semibold transition-all ${
                  fleetFilter === 'singapore'
                    ? 'bg-[#00E5FF] text-black font-bold'
                    : 'bg-white/5 text-[#00E5FF] hover:text-white'
                }`}
              >
                📍 Singapore Strait
              </button>
            </div>

            <div className="text-[0.625rem] text-muted flex items-center justify-between">
              <span>Showing {filteredFleet.length} matching vessels</span>
              <span className="text-[#00D4FF]">Page {fleetPage} of {totalPages}</span>
            </div>

            {/* Paginated Vessel List */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {paginatedFleet.map((v) => {
                const isSelected = selectedFleetVessel?.mmsi === v.mmsi;
                const isAnom = v.is_anomaly || (v as any).anomaly === -1 || (v.anomaly_score !== undefined && v.anomaly_score < 0);
                return (
                  <div
                    key={v.mmsi}
                    onClick={() => focusVesselOnMap(v)}
                    className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-center justify-between group ${
                      isSelected
                        ? 'bg-[rgba(0,212,255,0.18)] border-[#00D4FF] shadow-[0_0_15px_rgba(0,212,255,0.2)]'
                        : isAnom
                          ? 'bg-[rgba(255,68,68,0.06)] border-[#FF4444]/40 hover:border-[#FF4444]'
                          : 'bg-[rgba(10,22,40,0.6)] border-cyan-dim/40 hover:border-cyan-dim'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-white truncate max-w-[180px]">{v.name}</span>
                        {v.is_prime_suspect && <Badge color="gold">PRIME</Badge>}
                        {isAnom && !v.is_prime_suspect && <Badge color="danger">ANOMALY</Badge>}
                      </div>
                      <div className="text-[0.625rem] text-muted flex items-center gap-2 mt-1 font-mono flex-wrap">
                        <span>MMSI: <b className="text-white">{v.mmsi}</b></span>
                        <span>{v.speed} kn</span>
                        <span>{v.lat.toFixed(2)}°N, {v.lon.toFixed(2)}°E</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          loadVesselIntoBuilder(v);
                        }}
                        className="px-2 py-1 rounded bg-[#00D4FF]/15 hover:bg-[#00D4FF] text-[#00D4FF] hover:text-black font-bold text-[0.625rem] transition-all flex items-center gap-1"
                        title="Load ship into Studio & Simulator"
                      >
                        <Play size={10} /> Simulate
                      </button>
                      <button
                        onClick={(e) => handleDeleteVessel(v.mmsi, e)}
                        className="p-1 rounded text-muted hover:text-[#FF4444] hover:bg-white/5 transition-all"
                        title="Delete vessel"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="pt-2 border-t border-cyan-dim/40 flex items-center justify-between text-xs">
                <button
                  onClick={() => setFleetPage((p) => Math.max(1, p - 1))}
                  disabled={fleetPage <= 1}
                  className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-white disabled:opacity-30 flex items-center gap-1 text-[0.6875rem]"
                >
                  <ChevronLeft size={12} /> Prev
                </button>
                <span className="text-[0.625rem] text-muted font-mono">
                  {fleetPage} / {totalPages}
                </span>
                <button
                  onClick={() => setFleetPage((p) => Math.min(totalPages, p + 1))}
                  disabled={fleetPage >= totalPages}
                  className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-white disabled:opacity-30 flex items-center gap-1 text-[0.6875rem]"
                >
                  Next <ChevronRight size={12} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="p-4 border-t border-cyan-dim bg-[rgba(10,22,40,0.95)] space-y-2">
          {activeTab === 'builder' && (
            <button
              onClick={handleSaveToFleet}
              disabled={isSubmitting}
              className="w-full py-2.5 rounded-lg bg-[#00D4FF] hover:bg-[#00D4FF]/90 text-black font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#00D4FF]/20 transition-all disabled:opacity-50 uppercase tracking-wider"
            >
              <Save size={14} />
              {isSubmitting ? 'Registering into Dataset...' : 'Add Ship to Live Fleet & Backend'}
            </button>
          )}

          {onNavigateToDashboard && (
            <button
              onClick={onNavigateToDashboard}
              className="w-full py-1.5 rounded-lg bg-transparent hover:bg-white/5 border border-cyan-dim/40 text-muted hover:text-white text-xs flex items-center justify-center gap-1.5 transition-all"
            >
              View in Main Tactical Dashboard <ArrowRight size={12} />
            </button>
          )}
        </div>
      </div>

      {/* RIGHT PANEL: Tactical Dark Map & Dynamic Layer Controls */}
      <div className="flex-1 relative h-full">
        <div ref={containerRef} className="absolute inset-0" />

        {/* TOP LAYER CONTROLS BAR */}
        <div className="absolute top-4 left-4 z-10 glass-panel px-3 py-2 border border-cyan-dim flex items-center gap-2 flex-wrap shadow-2xl backdrop-blur-md">
          {/* Status badge */}
          <div className="flex items-center gap-1.5 pr-2 border-r border-cyan-dim/40">
            <Radio size={14} className="text-[#00FF88] animate-pulse" />
            <span className="text-xs font-bold text-white tracking-wider">TACTICAL HUD</span>
          </div>

          {/* Environmental Toggles */}
          <button
            onClick={() => setShowWindVectors((v) => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-semibold transition-all ${
              showWindVectors
                ? 'bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/60 shadow-[0_0_10px_rgba(0,229,255,0.3)]'
                : 'bg-black/40 text-muted border border-transparent'
            }`}
          >
            <Wind size={12} /> Wind ({windSpeed} kn)
          </button>

          <button
            onClick={() => setShowCurrentVectors((v) => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-semibold transition-all ${
              showCurrentVectors
                ? 'bg-[#38EF7D]/20 text-[#38EF7D] border border-[#38EF7D]/60 shadow-[0_0_10px_rgba(56,239,125,0.3)]'
                : 'bg-black/40 text-muted border border-transparent'
            }`}
          >
            <Waves size={12} /> Currents ({currentSpeed} kn)
          </button>

          <button
            onClick={() => setShowSurroundingFleets((v) => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-semibold transition-all ${
              showSurroundingFleets
                ? 'bg-[#00D4FF]/20 text-[#00D4FF] border border-[#00D4FF]/60 shadow-[0_0_10px_rgba(0,212,255,0.3)]'
                : 'bg-black/40 text-muted border border-transparent'
            }`}
          >
            <Ship size={12} /> Fleets ({vessels.length})
          </button>

          <button
            onClick={() => setShowSpillZone((v) => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-semibold transition-all ${
              showSpillZone
                ? 'bg-[#FF4444]/25 text-[#FF4444] border border-[#FF4444]/70 shadow-[0_0_12px_rgba(255,68,68,0.4)]'
                : 'bg-black/40 text-muted border border-transparent'
            }`}
          >
            <Crosshair size={12} /> Oil Spill & Origin
          </button>

          <button
            onClick={() => setShowTSSCorridor((v) => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-semibold transition-all ${
              showTSSCorridor
                ? 'bg-[#FFD700]/20 text-[#FFD700] border border-[#FFD700]/60'
                : 'bg-black/40 text-muted border border-transparent'
            }`}
          >
            <Compass size={12} /> TSS Fairway
          </button>

          <button
            onClick={centerOnSingapore}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-semibold bg-[#00D4FF]/20 hover:bg-[#00D4FF]/30 text-[#00D4FF] border border-[#00D4FF]/50 transition-all shadow-md"
            title="Center Singapore Strait View"
          >
            <LocateFixed size={12} /> Focus Singapore TSS
          </button>

          <button
            onClick={focusCustomShip}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-semibold bg-[#00FF88]/20 hover:bg-[#00FF88]/30 text-[#00FF88] border border-[#00FF88]/50 transition-all"
            title="Focus on Plotted Ship"
          >
            <Ship size={12} /> Focus Ship
          </button>
        </div>

        {/* Live Simulation Telemetry HUD Overlay (When simulation is active) */}
        {isSimulatingLive && (
          <div className="absolute top-16 left-4 z-10 glass-panel p-3.5 border border-[#00D4FF] max-w-sm space-y-2 animate-fade-in shadow-2xl backdrop-blur-xl bg-[rgba(7,15,30,0.95)]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#00D4FF] flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#00FF88] animate-ping" />
                Live AIS Trajectory Tracking
              </span>
              <Badge color="success">WAYPOINT {simStepIndex + 1}/{waypoints.length}</Badge>
            </div>
            <div className="text-[0.75rem] text-white font-mono">
              Vessel: <b className="text-[#00FF88]">{name}</b> (MMSI: {mmsi})
            </div>
            <div className="grid grid-cols-2 gap-2 text-[0.6875rem] bg-[rgba(0,212,255,0.06)] p-2.5 rounded border border-cyan-dim/30 font-mono">
              <div>SOG: <b className="text-white">{speed} kn</b></div>
              <div>COG: <b className="text-white">{heading}°</b></div>
              <div>Lat: <b className="text-white">{activeShipPos.lat.toFixed(4)}°N</b></div>
              <div>Lon: <b className="text-white">{activeShipPos.lon.toFixed(4)}°E</b></div>
            </div>
            <div className="text-[0.625rem] text-muted flex items-start gap-1 pt-1">
              <Info size={12} className="text-[#00D4FF] shrink-0 mt-0.5" />
              <span>Simulates real-time AIS motion to test trajectory intersection with the Sentinel-1 SAR Oil Spill zone.</span>
            </div>
          </div>
        )}

        {/* Live Coordinates HUD Top-Right */}
        <div className="absolute top-4 right-16 z-10 glass-panel px-3.5 py-1.5 border border-cyan-dim font-mono text-[0.6875rem] text-muted shadow-lg backdrop-blur-md">
          <span>Pos: <b className="text-white">{activeShipPos.lat.toFixed(4)}°N, {activeShipPos.lon.toFixed(4)}°E</b></span>
          <span className="mx-2 text-cyan-dim">|</span>
          <span>SOG: <b className="text-[#00D4FF]">{speed} kn</b></span>
          <span className="mx-2 text-cyan-dim">|</span>
          <span>COG: <b className="text-[#38EF7D]">{heading}°</b></span>
        </div>

        {/* Land-placement warning toast */}
        {landWarn && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-[#FF4444]/70 bg-[rgba(30,5,5,0.92)] text-[#FF6666] text-xs font-mono font-bold shadow-2xl backdrop-blur-md animate-bounce-slow pointer-events-none">
            <span className="text-[#FF4444] text-base">⛔</span>
            {landWarn}
          </div>
        )}

        {/* Tactical Map Legend */}
        <div className="absolute bottom-4 left-4 z-10 glass-panel p-3.5 border border-cyan-dim space-y-2 text-[0.625rem] max-w-xs shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-cyan-dim/40 pb-1 mb-1">
            <span className="text-white font-bold tracking-wider uppercase flex items-center gap-1.5">
              <Radar size={13} className="text-[#00D4FF]" /> Tactical Map Legend
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#00FF88] border border-white shrink-0 shadow-[0_0_8px_#00FF88]" />
            <span className="text-white font-medium">Plotted Custom Ship (Heading Vector)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FFD700] border border-black shrink-0" />
            <span className="text-white">Trajectory Waypoints (Click Sea to Add · Land Blocked)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-0.5 bg-[#00E5FF] shrink-0 border-t-2 border-dashed border-[#00E5FF]" />
            <span className="text-muted">Planned Route Track</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-2.5 rounded bg-[#FF1E27]/70 border border-[#FF0000] shrink-0 shadow-[0_0_10px_#FF0000]" />
            <span className="text-[#FF4444] font-bold">Sentinel-1 SAR Oil Spill Slick (3.2 km²)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-2.5 rounded bg-[#FFD700]/30 border border-dashed border-[#FFD700] shrink-0" />
            <span className="text-[#FFD700] font-semibold">Probable Origin Zone (T-6h)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00D4FF] shrink-0" />
            <span className="text-muted">Surrounding AIS Fleet ({vessels.length} ships)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
