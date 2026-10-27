import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  Play,
  Loader2,
  Wind,
  Waves,
  Clock,
  MapPin,
  Crosshair,
  ShieldAlert,
  Ship,
  Sparkles,
  Layers,
  Search,
  Eye,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sliders,
  Box,
  Compass,
  Navigation,
  FileText,
} from 'lucide-react';
import { Badge } from '@/components/Badge';
import { Donut } from '@/components/Donut';
import { Panel, PanelHeader } from '@/components/Panel';
import {
  simulateSpill,
  reconstructOrigin,
  type Vessel,
  type Waypoint,
  type OriginReconstructionResponse,
  type PrimeSuspectResponse,
} from '@/lib/api';

interface VirtualSpillProps {
  vessels: Vessel[];
  primeSuspectName?: string;
}

// Tactical Dark Basemap (ESRI World Dark Gray Canvas - Zero Watermarks)
const DARK_TACTICAL_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    'esri-dark': {
      type: 'raster',
      tiles: [
        'https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution: '© Esri, Garmin, GEBCO, NOAA NGDC, and other contributors',
      maxzoom: 16,
    },
    'esri-labels': {
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
      id: 'esri-dark-layer',
      type: 'raster',
      source: 'esri-dark',
      minzoom: 0,
      maxzoom: 16,
    },
    {
      id: 'esri-labels-layer',
      type: 'raster',
      source: 'esri-labels',
      minzoom: 0,
      maxzoom: 16,
      paint: {
        'raster-opacity': 0.85,
      },
    },
  ],
};

const TEST_PRESETS = [
  {
    name: 'Singapore East TSS (SAR Benchmark)',
    desc: 'Sentinel-1 confirmed spill site near eastern TSS channel',
    lat: 1.250,
    lon: 103.800,
    windSpeed: 14.0,
    windDir: 215,
    currSpeed: 1.4,
    currDir: 130,
    hours: 8,
  },
  {
    name: 'Jurong Anchorage Corridor',
    desc: 'Heavy tanker bunkering & maneuvering channel',
    lat: 1.285,
    lon: 103.725,
    windSpeed: 11.5,
    windDir: 230,
    currSpeed: 1.1,
    currDir: 125,
    hours: 6,
  },
  {
    name: 'Malacca Strait West Inbound',
    desc: 'High speed container & crude carrier route',
    lat: 1.205,
    lon: 103.885,
    windSpeed: 16.0,
    windDir: 200,
    currSpeed: 1.8,
    currDir: 140,
    hours: 10,
  },
];

// --- 3D HYDRODYNAMIC COMPONENTS ---
function OceanSurface() {
  const meshRef = useRef<THREE.Mesh>(null);
  const geomRef = useRef<THREE.PlaneGeometry>(null);

  useFrame(({ clock }) => {
    if (!geomRef.current || !meshRef.current) return;
    const t = clock.getElapsedTime();
    const pos = geomRef.current.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = Math.sin(x * 0.5 + t) * 0.15 + Math.cos(y * 0.5 + t * 0.8) * 0.1;
      pos.setZ(i, z);
    }
    pos.needsUpdate = true;
    geomRef.current.computeVertexNormals();
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
      <planeGeometry ref={geomRef} args={[10, 10, 64, 64]} />
      <meshStandardMaterial
        color="#0a2a4a"
        roughness={0.2}
        metalness={0.6}
        emissive="#001830"
        emissiveIntensity={0.3}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function OceanWireframe() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();
    const pos = (meshRef.current.geometry as THREE.PlaneGeometry).attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = Math.sin(x * 0.5 + t) * 0.15 + Math.cos(y * 0.5 + t * 0.8) * 0.1;
      pos.setZ(i, z);
    }
    pos.needsUpdate = true;
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.49, 0]}>
      <planeGeometry args={[10, 10, 32, 32]} />
      <meshBasicMaterial color="#00D4FF" wireframe transparent opacity={0.08} side={THREE.DoubleSide} />
    </mesh>
  );
}

function OilSpillMesh({ intensity = 1, spread = 1 }: { intensity?: number; spread?: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const particles = useRef<THREE.Points>(null);

  const { positions, colors } = useMemo(() => {
    const count = 350;
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * spread * 1.5;
      pos[i * 3] = Math.cos(angle) * r;
      pos[i * 3 + 1] = -0.3 + Math.random() * 0.05;
      pos[i * 3 + 2] = Math.sin(angle) * r;
      const shade = Math.random();
      col[i * 3] = 0.15 + shade * 0.25;
      col[i * 3 + 1] = 0.05 + shade * 0.1;
      col[i * 3 + 2] = 0.02;
    }
    return { positions: pos, colors: col };
  }, [spread]);

  useFrame(({ clock }) => {
    if (!particles.current) return;
    const t = clock.getElapsedTime();
    const pos = particles.current.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, -0.3 + Math.sin(x * 0.5 + t) * 0.05 + Math.random() * 0.02);
    }
    pos.needsUpdate = true;

    if (groupRef.current) {
      groupRef.current.scale.setScalar(1 + Math.sin(t * 0.5) * 0.02 * intensity);
    }
  });

  return (
    <group ref={groupRef}>
      <points ref={particles}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.08} vertexColors transparent opacity={0.75} sizeAttenuation />
      </points>
    </group>
  );
}

function Vessel3D() {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      const t = clock.getElapsedTime();
      ref.current.position.y = -0.2 + Math.sin(t) * 0.02;
      ref.current.rotation.y = Math.sin(t * 0.3) * 0.05;
    }
  });
  return (
    <group ref={ref} position={[0, -0.2, 0]}>
      <mesh>
        <boxGeometry args={[0.6, 0.12, 0.18]} />
        <meshStandardMaterial color="#2a3a4a" roughness={0.5} metalness={0.3} />
      </mesh>
      <mesh position={[0.1, 0.08, 0]}>
        <boxGeometry args={[0.2, 0.08, 0.12]} />
        <meshStandardMaterial color="#3a4a5a" roughness={0.4} />
      </mesh>
      <mesh position={[-0.35, 0, 0]}>
        <coneGeometry args={[0.09, 0.15, 4]} />
        <meshStandardMaterial color="#2a3a4a" roughness={0.5} />
      </mesh>
    </group>
  );
}

// --- MAIN VIRTUAL SPILL COMPONENT ---
export function VirtualSpill({ vessels, primeSuspectName }: VirtualSpillProps) {
  // Visual Mode
  const [viewMode, setViewMode] = useState<'map' | '3d' | 'split'>('map');

  // Custom Spill Location (Default: Singapore East Channel SAR hotspot)
  const [slickLat, setSlickLat] = useState<number>(1.2500);
  const [slickLon, setSlickLon] = useState<number>(103.8000);
  const [isDropSpillMode, setIsDropSpillMode] = useState<boolean>(false);
  const [spillVolume, setSpillVolume] = useState<number>(450); // m3

  // Metocean Simulation Parameters
  const [windSpeed, setWindSpeed] = useState<number>(14.0); // knots
  const [windDirection, setWindDirection] = useState<number>(215); // deg
  const [currentSpeed, setCurrentSpeed] = useState<number>(1.4); // knots
  const [currentDirection, setCurrentDirection] = useState<number>(130); // deg
  const [backtrackHours, setBacktrackHours] = useState<number>(8); // hours

  // Map Layer Toggles
  const [showWindOverlay, setShowWindOverlay] = useState<boolean>(true);
  const [showCurrentOverlay, setShowCurrentOverlay] = useState<boolean>(true);
  const [showFleetOverlay, setShowFleetOverlay] = useState<boolean>(true);
  const [showBacktrackLine, setShowBacktrackLine] = useState<boolean>(true);

  // Execution & Results State
  const [running, setRunning] = useState<boolean>(false);
  const [reconstruction, setReconstruction] = useState<OriginReconstructionResponse | null>(null);
  const [selectedSuspect, setSelectedSuspect] = useState<Vessel | null>(null);
  const [candidateIous, setCandidateIous] = useState<Record<string, number | null>>({});
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Map Refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapReady, setMapReady] = useState<boolean>(false);

  // Dynamic state refs for click handling without recreating the map
  const isDropModeRef = useRef(isDropSpillMode);
  useEffect(() => {
    isDropModeRef.current = isDropSpillMode;
  }, [isDropSpillMode]);

  // Set initial selected vessel
  useEffect(() => {
    if (vessels.length > 0 && !selectedSuspect) {
      const prime = vessels.find((v) => v.is_prime_suspect || v.name === primeSuspectName);
      setSelectedSuspect(prime || vessels[0]);
    }
  }, [vessels, selectedSuspect, primeSuspectName]);

  // Map Initialization (Runs once)
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: DARK_TACTICAL_STYLE,
      center: [slickLon, slickLat],
      zoom: 10.5,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');

    map.on('load', () => setMapReady(true));

    map.on('click', (e) => {
      if (isDropModeRef.current) {
        const { lng, lat } = e.lngLat;
        setSlickLat(parseFloat(lat.toFixed(4)));
        setSlickLon(parseFloat(lng.toFixed(4)));
        setIsDropSpillMode(false);
      }
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  // Run Attribution & Backtrack Identification
  const handleRunAttribution = useCallback(async () => {
    setRunning(true);
    setStatusMsg(null);
    try {
      const resp = await reconstructOrigin(
        slickLat,
        slickLon,
        backtrackHours,
        windSpeed,
        windDirection,
        currentSpeed,
        currentDirection,
        spillVolume
      );
      setReconstruction(resp);

      if (resp.candidate_vessels && resp.candidate_vessels.length > 0) {
        setSelectedSuspect(resp.candidate_vessels[0]);
        const candidates = resp.candidate_vessels.slice(0, 6);
        const results = await Promise.all(candidates.map(async (v) => {
          const simulation = await simulateSpill(v.name, v.lat, v.lon, backtrackHours, windSpeed, windDirection, currentSpeed, currentDirection);
          return [v.mmsi, simulation.iou_score_pct ?? null] as const;
        }));
        setCandidateIous(Object.fromEntries(results));
      }

      setStatusMsg(`🎯 Attribution Complete: "${resp.prime_suspect?.name || 'Top Suspect'}" identified with ${resp.confidence_pct}% model confidence.`);

      // Pan map to origin zone
      if (mapRef.current) {
        mapRef.current.flyTo({
          center: [resp.origin_lon, resp.origin_lat],
          zoom: 11.2,
          duration: 1200,
        });
      }
    } catch (err) {
      console.warn('Backend error:', err);
      setStatusMsg('⚠️ Backend unavailable — please retry in a moment.');
    } finally {
      setRunning(false);
    }
  }, [slickLat, slickLon, backtrackHours, windSpeed, windDirection, currentSpeed, currentDirection, spillVolume]);

  // Load Preset
  const applyPreset = (preset: typeof TEST_PRESETS[0]) => {
    setSlickLat(preset.lat);
    setSlickLon(preset.lon);
    setWindSpeed(preset.windSpeed);
    setWindDirection(preset.windDir);
    setCurrentSpeed(preset.currSpeed);
    setCurrentDirection(preset.currDir);
    setBacktrackHours(preset.hours);

    if (mapRef.current) {
      mapRef.current.flyTo({ center: [preset.lon, preset.lat], zoom: 10.8, duration: 1000 });
    }
  };

  // Update Map Layers whenever state or reconstruction changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const layersToClear = [
      'spill-location-pulse',
      'spill-location-core',
      'spill-polygon-border',
      'spill-polygon-fill',
      'backtrack-corridor-glow',
      'backtrack-corridor-line',
      'backtrack-waypoint-pts',
      'origin-zone-line',
      'origin-zone-fill',
      'origin-center-marker',
      'surrounding-fleet-pts',
      'selected-suspect-track',
      'prime-suspect-highlight',
      'wind-stream-lines',
      'current-stream-lines',
    ];

    const sourcesToClear = [
      'spill-location-core',
      'spill-polygon-fill',
      'backtrack-corridor-line',
      'backtrack-waypoint-pts',
      'origin-zone-fill',
      'origin-center-marker',
      'surrounding-fleet-pts',
      'selected-suspect-track',
      'prime-suspect-highlight',
      'wind-stream-lines',
      'current-stream-lines',
    ];

    layersToClear.forEach((l) => {
      try {
        if (map.getLayer(l)) map.removeLayer(l);
      } catch (e) {
        // ignore
      }
    });

    sourcesToClear.forEach((s) => {
      try {
        if (map.getSource(s)) map.removeSource(s);
      } catch (e) {
        // ignore
      }
    });

    // 1. Wind & Current Streamlines
    if (showWindOverlay) {
      const windFeatures: GeoJSON.Feature[] = [];
      const latSteps = [1.16, 1.22, 1.28, 1.34, 1.40];
      const lonSteps = [103.65, 103.73, 103.81, 103.89, 103.97, 104.05];
      const rad = ((windDirection + 180) % 360) * (Math.PI / 180);
      const len = 0.022;

      latSteps.forEach((lat) => {
        lonSteps.forEach((lon) => {
          windFeatures.push({
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [
                [lon, lat],
                [lon + len * Math.sin(rad), lat + len * Math.cos(rad)],
              ],
            },
            properties: {},
          });
        });
      });

      map.addSource('wind-stream-lines', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: windFeatures },
      });
      map.addLayer({
        id: 'wind-stream-lines',
        type: 'line',
        source: 'wind-stream-lines',
        paint: {
          'line-color': '#00E5FF',
          'line-width': 1.5,
          'line-opacity': 0.35,
          'line-dasharray': [3, 2],
        },
      });
    }

    if (showCurrentOverlay) {
      const currFeatures: GeoJSON.Feature[] = [];
      const latSteps = [1.18, 1.24, 1.30, 1.36];
      const lonSteps = [103.68, 103.76, 103.84, 103.92, 104.00];
      const rad = currentDirection * (Math.PI / 180);
      const len = 0.018;

      latSteps.forEach((lat) => {
        lonSteps.forEach((lon) => {
          currFeatures.push({
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [
                [lon, lat],
                [lon + len * Math.sin(rad), lat + len * Math.cos(rad)],
              ],
            },
            properties: {},
          });
        });
      });

      map.addSource('current-stream-lines', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: currFeatures },
      });
      map.addLayer({
        id: 'current-stream-lines',
        type: 'line',
        source: 'current-stream-lines',
        paint: {
          'line-color': '#38EF7D',
          'line-width': 1.8,
          'line-opacity': 0.35,
        },
      });
    }

    // 2. Custom Spill Area (Polygon & Core Point)
    const slickRadiusDeg = 0.015 + (spillVolume / 1000) * 0.01;
    const slickPolygonCoords: [number, number][] = [];
    for (let i = 0; i <= 36; i++) {
      const angle = (i / 36) * Math.PI * 2;
      slickPolygonCoords.push([
        slickLon + slickRadiusDeg * 1.3 * Math.cos(angle),
        slickLat + slickRadiusDeg * 0.9 * Math.sin(angle),
      ]);
    }

    map.addSource('spill-polygon-fill', {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [slickPolygonCoords] },
        properties: {},
      },
    });

    map.addLayer({
      id: 'spill-polygon-fill',
      type: 'fill',
      source: 'spill-polygon-fill',
      paint: {
        'fill-color': '#FF4444',
        'fill-opacity': 0.35,
      },
    });

    map.addLayer({
      id: 'spill-polygon-border',
      type: 'line',
      source: 'spill-polygon-fill',
      paint: {
        'line-color': '#FF4444',
        'line-width': 2.5,
      },
    });

    // Spill Center Marker
    map.addSource('spill-location-core', {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [slickLon, slickLat] },
        properties: {},
      },
    });

    map.addLayer({
      id: 'spill-location-pulse',
      type: 'circle',
      source: 'spill-location-core',
      paint: {
        'circle-radius': 16,
        'circle-color': '#FF4444',
        'circle-opacity': 0.25,
      },
    });

    map.addLayer({
      id: 'spill-location-core',
      type: 'circle',
      source: 'spill-location-core',
      paint: {
        'circle-radius': 7,
        'circle-color': '#FF4444',
        'circle-stroke-color': '#FFFFFF',
        'circle-stroke-width': 2,
      },
    });

    // 3. Backtrack Trajectory Corridor & Origin Zone
    if (showBacktrackLine && reconstruction && reconstruction.backtrack_trajectory) {
      const trajCoords = reconstruction.backtrack_trajectory.map((w) => [w.lon, w.lat]);

      map.addSource('backtrack-corridor-line', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: trajCoords },
          properties: {},
        },
      });

      map.addLayer({
        id: 'backtrack-corridor-glow',
        type: 'line',
        source: 'backtrack-corridor-line',
        paint: {
          'line-color': '#FFD700',
          'line-width': 8,
          'line-opacity': 0.2,
        },
      });

      map.addLayer({
        id: 'backtrack-corridor-line',
        type: 'line',
        source: 'backtrack-corridor-line',
        paint: {
          'line-color': '#FFD700',
          'line-width': 3,
          'line-dasharray': [3, 1.5],
        },
      });

      // Backtrack Waypoint steps
      const wpFeatures: GeoJSON.Feature[] = reconstruction.backtrack_trajectory.map((w) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [w.lon, w.lat] },
        properties: { label: w.timestamp },
      }));

      map.addSource('backtrack-waypoint-pts', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: wpFeatures },
      });

      map.addLayer({
        id: 'backtrack-waypoint-pts',
        type: 'circle',
        source: 'backtrack-waypoint-pts',
        paint: {
          'circle-radius': 5,
          'circle-color': '#FFD700',
          'circle-stroke-color': '#000000',
          'circle-stroke-width': 1.5,
        },
      });

      // Origin Zone Probability Ellipse
      const origRadDeg = (reconstruction.origin_radius_km || 3.5) / 111.0;
      const originPoly: [number, number][] = [];
      for (let i = 0; i <= 36; i++) {
        const a = (i / 36) * Math.PI * 2;
        originPoly.push([
          reconstruction.origin_lon + origRadDeg * 1.2 * Math.cos(a),
          reconstruction.origin_lat + origRadDeg * 0.9 * Math.sin(a),
        ]);
      }

      map.addSource('origin-zone-fill', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [originPoly] },
          properties: {},
        },
      });

      map.addLayer({
        id: 'origin-zone-fill',
        type: 'fill',
        source: 'origin-zone-fill',
        paint: {
          'fill-color': '#FFD700',
          'fill-opacity': 0.15,
        },
      });

      map.addLayer({
        id: 'origin-zone-line',
        type: 'line',
        source: 'origin-zone-fill',
        paint: {
          'line-color': '#FFD700',
          'line-width': 2,
          'line-dasharray': [2, 2],
        },
      });

      map.addSource('origin-center-marker', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [reconstruction.origin_lon, reconstruction.origin_lat] },
          properties: {},
        },
      });

      map.addLayer({
        id: 'origin-center-marker',
        type: 'circle',
        source: 'origin-center-marker',
        paint: {
          'circle-radius': 8,
          'circle-color': '#FFD700',
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': 2,
        },
      });
    }

    // 4. Surrounding Fleet Vessels
    if (showFleetOverlay && vessels.length > 0) {
      const fleetFeatures: GeoJSON.Feature[] = vessels.map((v) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [v.lon, v.lat] },
        properties: {
          name: v.name,
          mmsi: v.mmsi,
          speed: v.speed,
          is_prime: v.is_prime_suspect,
          color: v.is_prime_suspect ? '#FFD700' : v.is_anomaly ? '#FF8C00' : '#0FB9B1',
        },
      }));

      map.addSource('surrounding-fleet-pts', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: fleetFeatures },
      });

      map.addLayer({
        id: 'surrounding-fleet-pts',
        type: 'circle',
        source: 'surrounding-fleet-pts',
        paint: {
          'circle-radius': ['case', ['get', 'is_prime'], 8, 4.5],
          'circle-color': ['get', 'color'],
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': ['case', ['get', 'is_prime'], 2, 0.8],
          'circle-opacity': 0.9,
        },
      });
    }

    // 5. Selected Suspect Track
    if (selectedSuspect && selectedSuspect.route && selectedSuspect.route.length > 1) {
      const selCoords = selectedSuspect.route.map((w) => [w.lon, w.lat]);
      map.addSource('selected-suspect-track', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: selCoords },
          properties: {},
        },
      });

      map.addLayer({
        id: 'selected-suspect-track',
        type: 'line',
        source: 'selected-suspect-track',
        paint: {
          'line-color': '#00E5FF',
          'line-width': 3.5,
          'line-dasharray': [2, 1],
        },
      });
    }
  }, [
    mapReady,
    slickLat,
    slickLon,
    spillVolume,
    showWindOverlay,
    showCurrentOverlay,
    showFleetOverlay,
    showBacktrackLine,
    windSpeed,
    windDirection,
    currentSpeed,
    currentDirection,
    vessels,
    reconstruction,
    selectedSuspect,
  ]);

  const primeSuspectData = reconstruction?.prime_suspect || {
    name: selectedSuspect?.name || 'Analysing...',
    mmsi: selectedSuspect?.mmsi || '—',
    type: selectedSuspect?.type || '—',
    attribution_score: selectedSuspect?.anomaly_score || 0,
    reason: reconstruction ? 'Spatial-temporal route intersects reverse drift origin zone during estimated discharge window.' : 'Run attribution to identify suspect.',
  };

  const confidenceScore = reconstruction?.confidence_pct || 0;
  const iouMatchScore = selectedSuspect ? candidateIous[selectedSuspect.mmsi] : null;
  const matchColor = confidenceScore > 80 ? '#00FF88' : confidenceScore > 60 ? '#FFA500' : '#FF4444';

  const spreadFactor = 1 + (backtrackHours / 24) * 1.5 + (windSpeed / 30) * 0.5;

  return (
    <div className="flex h-full overflow-hidden bg-bg-base text-white">
      {/* LEFT PANEL: Interactive Controls, Custom Spill Placement & Suspect Ranking */}
      <div className="w-[440px] shrink-0 border-r border-cyan-dim flex flex-col h-full bg-[rgba(7,15,30,0.95)] backdrop-blur-xl">
        {/* Header */}
        <div className="p-4 border-b border-cyan-dim flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#FF4444]/15 border border-[#FF4444]/40 flex items-center justify-center text-[#FF4444]">
              <Crosshair size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">Virtual Spill & Attribution</h2>
              <p className="text-[0.625rem] text-muted">Custom Spill Placement & Ship Identification</p>
            </div>
          </div>
          <Badge color={reconstruction ? 'gold' : 'cyan'}>
            {reconstruction ? 'IDENTIFIED' : 'TEST READY'}
          </Badge>
        </div>

        {/* View Mode Switcher */}
        <div className="flex border-b border-cyan-dim bg-[rgba(10,22,40,0.5)] px-3 py-2 gap-1.5">
          <button
            onClick={() => setViewMode('map')}
            className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded transition-all flex items-center justify-center gap-1.5 ${
              viewMode === 'map'
                ? 'bg-[#00D4FF]/20 text-[#00D4FF] border border-[#00D4FF]/50'
                : 'text-muted hover:text-white bg-black/20'
            }`}
          >
            <MapPin size={12} /> Tactical Map
          </button>
          <button
            onClick={() => setViewMode('3d')}
            className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded transition-all flex items-center justify-center gap-1.5 ${
              viewMode === '3d'
                ? 'bg-[#A855F7]/20 text-[#A855F7] border border-[#A855F7]/50'
                : 'text-muted hover:text-white bg-black/20'
            }`}
          >
            <Box size={12} /> 3D Hydrodynamic
          </button>
          <button
            onClick={() => setViewMode('split')}
            className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded transition-all flex items-center justify-center gap-1.5 ${
              viewMode === 'split'
                ? 'bg-[#38EF7D]/20 text-[#38EF7D] border border-[#38EF7D]/50'
                : 'text-muted hover:text-white bg-black/20'
            }`}
          >
            <Layers size={12} /> Split View
          </button>
        </div>

        {/* Main Controls Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {statusMsg && (
            <div className="p-2.5 rounded-lg bg-[rgba(0,255,136,0.08)] border border-[#00FF88]/40 text-[#00FF88] text-xs flex items-center gap-2">
              <CheckCircle2 size={15} className="shrink-0" />
              <span>{statusMsg}</span>
            </div>
          )}

          {/* SECTION 1: CUSTOM SPILL PLACEMENT */}
          <div className="p-3.5 rounded-lg bg-[rgba(10,22,40,0.7)] border border-cyan-dim/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="section-label flex items-center gap-1.5 text-white">
                <MapPin size={13} className="text-[#FF4444]" /> 1. Custom Spill Placement
              </span>
              <button
                onClick={() => setIsDropSpillMode((prev) => !prev)}
                className={`px-2 py-1 rounded text-[0.625rem] font-bold flex items-center gap-1 transition-all ${
                  isDropSpillMode
                    ? 'bg-[#FF4444] text-white animate-pulse'
                    : 'bg-[#FF4444]/20 hover:bg-[#FF4444]/30 text-[#FF4444] border border-[#FF4444]/50'
                }`}
              >
                <Crosshair size={11} /> {isDropSpillMode ? 'Click Map to Place...' : '📍 Drop Spill on Map'}
              </button>
            </div>

            {/* Coordinates display & manual input */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[0.5625rem] text-muted block mb-1">SPILL LATITUDE (°N)</label>
                <input
                  type="number"
                  step="0.0001"
                  value={slickLat}
                  onChange={(e) => setSlickLat(parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1.5 rounded bg-[rgba(5,12,24,0.8)] border border-cyan-dim text-white font-mono text-xs focus:border-[#FF4444] outline-none"
                />
              </div>
              <div>
                <label className="text-[0.5625rem] text-muted block mb-1">SPILL LONGITUDE (°E)</label>
                <input
                  type="number"
                  step="0.0001"
                  value={slickLon}
                  onChange={(e) => setSlickLon(parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1.5 rounded bg-[rgba(5,12,24,0.8)] border border-cyan-dim text-white font-mono text-xs focus:border-[#FF4444] outline-none"
                />
              </div>
            </div>

            {/* Test Presets */}
            <div>
              <span className="text-[0.5625rem] text-muted block mb-1.5">QUICK TEST PRESETS (JUDGE BENCHMARKS)</span>
              <div className="grid grid-cols-3 gap-1.5">
                {TEST_PRESETS.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => applyPreset(p)}
                    className="p-1.5 rounded bg-[rgba(0,212,255,0.06)] hover:bg-[rgba(0,212,255,0.18)] border border-cyan-dim/40 text-[0.5625rem] text-left truncate text-white transition-all"
                    title={p.desc}
                  >
                    📍 {p.name.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>

            {/* Spill Volume */}
            <div>
              <div className="flex items-center justify-between text-[0.625rem] text-muted mb-1">
                <span>Estimated Spill Volume</span>
                <span className="text-white font-mono font-bold">{spillVolume} m³ ({Math.round(spillVolume * 6.29)} bbl)</span>
              </div>
              <input
                type="range"
                min="50"
                max="2000"
                step="25"
                value={spillVolume}
                onChange={(e) => setSpillVolume(Number(e.target.value))}
                className="w-full accent-[#FF4444]"
              />
            </div>
          </div>

          {/* SECTION 2: METOCEAN & BACKTRACK PARAMETERS */}
          <div className="p-3.5 rounded-lg bg-[rgba(10,22,40,0.7)] border border-cyan-dim/50 space-y-3">
            <span className="section-label flex items-center gap-1.5 text-white">
              <Sliders size={13} className="text-[#00D4FF]" /> 2. Metocean Forcing & Backtrack Window
            </span>

            {/* Backtrack duration slider */}
            <div>
              <div className="flex items-center justify-between text-[0.625rem] text-muted mb-1">
                <span className="flex items-center gap-1"><Clock size={11} /> Backtrack Time Horizon</span>
                <span className="text-[#FFD700] font-mono font-bold">T-{backtrackHours}h ({(backtrackHours * 1.852 * 1.4).toFixed(1)} km drift)</span>
              </div>
              <input
                type="range"
                min="2"
                max="24"
                step="2"
                value={backtrackHours}
                onChange={(e) => setBacktrackHours(Number(e.target.value))}
                className="w-full accent-[#FFD700]"
              />
            </div>

            {/* Wind & Current Sliders */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <div className="flex items-center justify-between text-[0.5625rem] text-muted mb-1">
                  <span><Wind size={10} className="inline text-[#00E5FF]" /> Wind (ERA5)</span>
                  <span className="text-[#00E5FF] font-mono">{windSpeed} kn</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="35"
                  step="1"
                  value={windSpeed}
                  onChange={(e) => setWindSpeed(Number(e.target.value))}
                  className="w-full accent-[#00E5FF]"
                />
              </div>
              <div>
                <div className="flex items-center justify-between text-[0.5625rem] text-muted mb-1">
                  <span><Waves size={10} className="inline text-[#38EF7D]" /> Current (Copernicus)</span>
                  <span className="text-[#38EF7D] font-mono">{currentSpeed} kn</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.1"
                  value={currentSpeed}
                  onChange={(e) => setCurrentSpeed(Number(e.target.value))}
                  className="w-full accent-[#38EF7D]"
                />
              </div>
            </div>
          </div>

          {/* EXECUTE ATTRIBUTION BUTTON */}
          <button
            onClick={handleRunAttribution}
            disabled={running}
            className="w-full py-3 rounded-lg bg-gradient-to-r from-[#FFD700] via-[#FFA500] to-[#FF4444] text-black font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#FFD700]/20 hover:brightness-110 active:scale-[0.99] transition-all disabled:opacity-50 uppercase tracking-wider"
          >
            {running ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Backtracking Reverse Drift & AIS Traffic...
              </>
            ) : (
              <>
                <Play size={16} fill="black" />
                Run Attribution Test & Identify Vessel
              </>
            )}
          </button>

          {/* SECTION 3: TOP IDENTIFIED SUSPECT SHIP CARD */}
          <div className="p-3.5 rounded-lg bg-[rgba(255,215,0,0.06)] border border-[#FFD700]/40 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="section-label flex items-center gap-1.5 text-[#FFD700]">
                <ShieldAlert size={14} /> Prime Suspect Vessel
              </span>
              <Badge color="gold">{confidenceScore}% MATCH</Badge>
            </div>

            <div className="bg-[rgba(10,22,40,0.8)] p-3 rounded-lg border border-[#FFD700]/30 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Ship size={14} className="text-[#FFD700]" />
                    {primeSuspectData.name}
                  </h3>
                  <p className="text-[0.625rem] text-muted">MMSI: {primeSuspectData.mmsi} • {primeSuspectData.type}</p>
                </div>
                <div className="text-right">
                  <span className="text-[0.5625rem] text-muted block">IoU Match</span>
                  <span className="metric-value text-sm text-[#00FF88]">{iouMatchScore === null || iouMatchScore === undefined ? '--' : `${iouMatchScore.toFixed(2)}%`}</span>
                </div>
              </div>

              <p className="text-[0.6875rem] text-muted leading-relaxed bg-[rgba(0,0,0,0.3)] p-2 rounded border border-cyan-dim/20">
                {primeSuspectData.reason}
              </p>

              {reconstruction && (
                <div className="grid grid-cols-2 gap-2 pt-1 text-[0.625rem] text-muted">
                  <div>Origin Lat/Lon: <b className="text-white">{reconstruction.origin_lat}°N, {reconstruction.origin_lon}°E</b></div>
                  <div>Discharge Window: <b className="text-white">{reconstruction.discharge_window}</b></div>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 4: CANDIDATE SUSPECTS LEADERBOARD */}
          {reconstruction && reconstruction.candidate_vessels && reconstruction.candidate_vessels.length > 0 && (
            <div className="space-y-2">
              <span className="section-label flex items-center gap-1.5 text-white">
                <Ship size={13} className="text-[#00D4FF]" /> Ranked Suspect Candidates ({reconstruction.candidate_vessels.length})
              </span>

              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {reconstruction.candidate_vessels.slice(0, 6).map((v, idx) => (
                  <div
                    key={v.mmsi || idx}
                    onClick={() => {
                      setSelectedSuspect(v);
                      if (mapRef.current) {
                        mapRef.current.flyTo({ center: [v.lon, v.lat], zoom: 11.5, duration: 800 });
                      }
                    }}
                    className={`p-2 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                      selectedSuspect?.mmsi === v.mmsi
                        ? 'bg-[rgba(0,212,255,0.15)] border-[#00D4FF]'
                        : 'bg-[rgba(10,22,40,0.6)] border-cyan-dim/40 hover:border-cyan-dim'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[0.625rem] font-bold ${
                        idx === 0 ? 'bg-[#FFD700] text-black' : 'bg-white/10 text-white'
                      }`}>
                        #{idx + 1}
                      </span>
                      <div>
                        <div className="font-semibold text-white text-xs truncate max-w-[170px]">{v.name}</div>
                        <div className="text-[0.5625rem] text-muted">{v.type} • {v.speed} kn</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-mono font-bold text-[#FFD700]">
                        {candidateIous[v.mmsi] === null || candidateIous[v.mmsi] === undefined ? '--' : `${candidateIous[v.mmsi]!.toFixed(2)}%`}
                      </span>
                      <span className="text-[0.5625rem] text-muted block">SAR IoU</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANEL: Tactical Map / 3D Canvas / Comparison View */}
      <div className="flex-1 flex flex-col h-full relative overflow-hidden">
        {/* TOP HUD BAR */}
        <div className="h-12 border-b border-cyan-dim px-4 flex items-center justify-between bg-[rgba(7,15,30,0.85)] backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Crosshair size={14} className="text-[#00FF88]" />
              Singapore Strait Hydrodynamic Corridor
            </span>
            <span className="text-xs text-muted">|</span>
            <span className="text-xs text-muted font-mono">
              Spill Target: <b className="text-white">{slickLat.toFixed(4)}°N, {slickLon.toFixed(4)}°E</b>
            </span>
          </div>

          {/* Quick layer toggles */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowWindOverlay((v) => !v)}
              className={`px-2 py-1 rounded text-[0.625rem] font-semibold flex items-center gap-1 transition-all ${
                showWindOverlay ? 'bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/50' : 'bg-black/30 text-muted'
              }`}
            >
              <Wind size={11} /> Wind Vectors
            </button>
            <button
              onClick={() => setShowCurrentOverlay((v) => !v)}
              className={`px-2 py-1 rounded text-[0.625rem] font-semibold flex items-center gap-1 transition-all ${
                showCurrentOverlay ? 'bg-[#38EF7D]/20 text-[#38EF7D] border border-[#38EF7D]/50' : 'bg-black/30 text-muted'
              }`}
            >
              <Waves size={11} /> Ocean Currents
            </button>
            <button
              onClick={() => setShowFleetOverlay((v) => !v)}
              className={`px-2 py-1 rounded text-[0.625rem] font-semibold flex items-center gap-1 transition-all ${
                showFleetOverlay ? 'bg-[#0FB9B1]/20 text-[#0FB9B1] border border-[#0FB9B1]/50' : 'bg-black/30 text-muted'
              }`}
            >
              <Ship size={11} /> Fleet Overlay ({vessels.length})
            </button>
          </div>
        </div>

        {/* VIEW CONTAINER */}
        <div className="flex-1 relative overflow-hidden">
          {/* MAP VIEW */}
          <div
            className={`absolute inset-0 transition-opacity duration-300 ${
              viewMode === 'map' ? 'opacity-100 z-10 pointer-events-auto' : viewMode === 'split' ? 'w-1/2 opacity-100 z-10 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }`}
          >
            <div ref={mapContainerRef} className="w-full h-full" />

            {/* Tactical Map Floating Legend */}
            <div className="absolute bottom-4 left-4 z-20 glass-panel px-3 py-2 space-y-1 border border-cyan-dim max-w-xs text-[0.625rem]">
              <div className="font-bold text-white mb-1">Attribution Overlay Legend</div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#FF4444] border border-white" />
                <span>Custom Dropped Spill Location</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#FFD700] border border-black" />
                <span>Backtracked Origin Zone (Discharge Point)</span>
              </div>
              <div className="flex items-center gap-2">
                <svg width="14" height="3">
                  <line x1="0" y1="1.5" x2="14" y2="1.5" stroke="#FFD700" strokeWidth="2" strokeDasharray="3 1.5" />
                </svg>
                <span>Reverse Drift Trajectory Line (T-{backtrackHours}h)</span>
              </div>
              <div className="flex items-center gap-2">
                <svg width="14" height="3">
                  <line x1="0" y1="1.5" x2="14" y2="1.5" stroke="#00E5FF" strokeWidth="2" strokeDasharray="2 1" />
                </svg>
                <span>Identified Suspect Ship Route Track</span>
              </div>
            </div>
          </div>

          {/* 3D HYDRODYNAMIC VIEW */}
          <div
            className={`absolute inset-0 transition-opacity duration-300 ${
              viewMode === '3d'
                ? 'opacity-100 z-10 pointer-events-auto'
                : viewMode === 'split'
                ? 'left-1/2 w-1/2 opacity-100 z-10 pointer-events-auto border-l border-cyan-dim'
                : 'opacity-0 pointer-events-none'
            }`}
          >
            <Canvas camera={{ position: [3, 3, 5], fov: 50 }} gl={{ antialias: true, alpha: true }}>
              <ambientLight intensity={0.4} />
              <directionalLight position={[5, 5, 5]} intensity={0.7} color="#00D4FF" />
              <pointLight position={[-3, 2, -3]} intensity={0.4} color="#0066cc" />
              <OceanSurface />
              <OceanWireframe />
              <OilSpillMesh spread={spreadFactor} />
              <Vessel3D />
              <OrbitControls
                enablePan={false}
                minDistance={3}
                maxDistance={10}
                maxPolarAngle={Math.PI / 2.2}
                enableDamping
                dampingFactor={0.05}
              />
            </Canvas>

            {/* 3D Overlay Telemetry */}
            <div className="absolute top-4 left-4 glass-panel px-3 py-1.5 border border-cyan-dim text-xs space-y-1">
              <div className="section-label text-[#A855F7]">3D Hydrodynamic Physics Engine</div>
              <div className="text-[0.6875rem] text-white">
                Fay Spreading • Leeway: 3.0% Wind + 100% Surface Drift
              </div>
            </div>

            {/* Bottom comparison cards in 3D mode */}
            <div className="absolute bottom-4 left-4 right-4 grid grid-cols-2 gap-3 pointer-events-none">
              <div className="glass-panel p-2.5 border border-cyan-dim/40 pointer-events-auto">
                <div className="flex items-center justify-between text-[0.625rem] mb-1">
                  <span className="font-bold text-white">Sentinel-1 SAR Ground Truth</span>
                  <Badge color="danger">SAR 2026-09-18</Badge>
                </div>
                <div className="h-16 rounded bg-[radial-gradient(ellipse_at_40%_50%,rgba(255,68,68,0.5)_0%,transparent_75%)] border border-[#FF4444]/30 flex items-end p-1.5 text-[0.5625rem] text-muted">
                  Spill Core: {slickLat.toFixed(4)}°N, {slickLon.toFixed(4)}°E
                </div>
              </div>
              <div className="glass-panel p-2.5 border border-cyan-dim/40 pointer-events-auto">
                <div className="flex items-center justify-between text-[0.625rem] mb-1">
                  <span className="font-bold text-white">Simulated Reverse Slick</span>
                  <Badge color="cyan">T-{backtrackHours}h PREDICTED</Badge>
                </div>
                <div className="h-16 rounded bg-[radial-gradient(ellipse_at_50%_50%,rgba(0,212,255,0.45)_0%,transparent_75%)] border border-[#00D4FF]/30 flex items-end p-1.5 text-[0.5625rem] text-muted">
                  Origin: {reconstruction?.origin_lat || slickLat}°N, {reconstruction?.origin_lon || slickLon}°E
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
