import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Vessel } from '@/lib/api';

interface TacticalMapProps {
  vessels: Vessel[];
  primeSuspectName?: string;
  onVesselClick?: (v: Vessel) => void;
}

const DEFAULT_MAP_CENTER: [number, number] = [103.8, 1.25];
const DEFAULT_MAP_ZOOM = 9;

const OSM_RASTER_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    'osm-tiles': {
      type: 'raster',
      tiles: [
        'https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
        'https://b.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
        'https://c.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: 'osm-raster',
      type: 'raster',
      source: 'osm-tiles',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

const VESSEL_LAYERS = [
  'vessel-routes',
  'vessels-normal',
  'vessels-anomaly',
  'vessels-prime',
  'vessels-prime-pulse',
  'slick-fill',
  'slick-outline',
  'drift-trajectory',
  'drift-arrow',
  'origin-fill',
  'origin-outline',
] as const;

export function TacticalMap({ vessels, primeSuspectName, onVesselClick }: TacticalMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [hovered, setHovered] = useState<Vessel | null>(null);

  // --- Initialize map exactly once ---
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_RASTER_STYLE,
      center: DEFAULT_MAP_CENTER,
      zoom: DEFAULT_MAP_ZOOM,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');

    map.on('load', () => setMapReady(true));

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  // --- Center map dynamically when new dataset is loaded ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || vessels.length === 0) return;

    try {
      const bounds = new maplibregl.LngLatBounds();
      let hasValidCoords = false;
      vessels.forEach((v) => {
        if (!isNaN(v.lon) && !isNaN(v.lat) && v.lon >= -180 && v.lon <= 180 && v.lat >= -90 && v.lat <= 90) {
          bounds.extend([v.lon, v.lat]);
          hasValidCoords = true;
        }
      });

      if (hasValidCoords && vessels.length > 0) {
        map.fitBounds(bounds, { padding: 80, maxZoom: 12, duration: 1000 });
      }
    } catch {
      // ignore
    }
  }, [vessels, mapReady]);

  // --- Add / refresh all overlays whenever vessels or map readiness changes ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    // Remove all layers first, then remove all sources cleanly
    VESSEL_LAYERS.forEach((id) => {
      try {
        if (map.getLayer(id)) map.removeLayer(id);
      } catch (e) {
        // ignore
      }
    });

    VESSEL_LAYERS.forEach((id) => {
      try {
        if (map.getSource(id)) map.removeSource(id);
      } catch (e) {
        // ignore
      }
    });

    const isPrime = (v: Vessel) =>
      v.is_prime_suspect || (primeSuspectName !== undefined && v.name === primeSuspectName);

    const isAnomaly = (v: Vessel) =>
      !isPrime(v) && (v.is_anomaly || v.anomaly_score > 0.5);

    // ----- Vessel Trajectory Routes (Lines) -----
    const routeFeatures: GeoJSON.Feature[] = [];
    vessels.forEach((v) => {
      if (v.route && v.route.length > 1) {
        const coords = v.route.map((w) => [w.lon, w.lat]);
        routeFeatures.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: coords },
          properties: {
            name: v.name,
            mmsi: v.mmsi,
            isPrime: isPrime(v),
            isAnomaly: isAnomaly(v),
            color: isPrime(v) ? '#FFD700' : isAnomaly(v) ? '#FF8C00' : '#00D4FF',
          },
        });
      }
    });

    if (routeFeatures.length > 0) {
      map.addSource('vessel-routes', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: routeFeatures },
      });
      map.addLayer({
        id: 'vessel-routes',
        type: 'line',
        source: 'vessel-routes',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 2,
          'line-dasharray': [2, 1.5],
          'line-opacity': 0.75,
        },
      });
    }

    // ----- Vessel circle markers -----
    const toFeature = (v: Vessel): GeoJSON.Feature => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [v.lon, v.lat] },
      properties: {
        name: v.name,
        mmsi: v.mmsi,
        speed: v.speed,
        anomaly_score: v.anomaly_score,
        type: v.type,
      },
    });

    const normalFeatures = vessels.filter((v) => !isPrime(v) && !isAnomaly(v)).map(toFeature);
    const anomalyFeatures = vessels.filter(isAnomaly).map(toFeature);
    const primeFeatures = vessels.filter(isPrime).map(toFeature);

    const addCircleLayer = (
      id: string,
      features: GeoJSON.Feature[],
      color: string,
      radius: number,
      stroke: number
    ) => {
      if (features.length === 0) return;
      map.addSource(id, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features },
      });
      map.addLayer({
        id,
        type: 'circle',
        source: id,
        paint: {
          'circle-radius': radius,
          'circle-color': color,
          'circle-opacity': 0.85,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': stroke,
        },
      });
    };

    addCircleLayer('vessels-normal', normalFeatures, '#0FB9B1', 6, 1.5);
    addCircleLayer('vessels-anomaly', anomalyFeatures, '#FF8C00', 8, 2);
    addCircleLayer('vessels-prime', primeFeatures, '#FFD700', 10, 2.5);

    // Pulsing ring for prime suspect
    if (primeFeatures.length > 0) {
      map.addSource('vessels-prime-pulse', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: primeFeatures },
      });
      map.addLayer({
        id: 'vessels-prime-pulse',
        type: 'circle',
        source: 'vessels-prime-pulse',
        paint: {
          'circle-radius': 22,
          'circle-color': '#FFD700',
          'circle-opacity': 0.1,
          'circle-stroke-color': '#FFD700',
          'circle-stroke-width': 1.5,
          'circle-stroke-opacity': 0.4,
        },
      });
    }

    // Click → popup for any vessel layer
    const vesselPopup = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
      if (!e.features || e.features.length === 0) return;
      const f = e.features[0];
      const coords = (f.geometry as GeoJSON.Point).coordinates as [number, number];
      const p = f.properties as { name: string; mmsi: string; speed: number; anomaly_score: number; type?: string };
      const prime = primeSuspectName !== undefined && p.name === primeSuspectName;
      const color = prime ? '#FFD700' : p.anomaly_score > 0.5 ? '#FF8C00' : '#0FB9B1';
      new maplibregl.Popup({ maxWidth: '240px' })
        .setLngLat(coords)
        .setHTML(
          `<div style="font-family:Inter,sans-serif;padding:6px">
            <div style="font-size:13px;font-weight:600;color:${color};margin-bottom:4px">${prime ? '★ ' : ''}${p.name}</div>
            <div style="font-size:11px;color:#444">MMSI: <b>${p.mmsi}</b></div>
            <div style="font-size:11px;color:#444">Type: <b>${p.type || 'Vessel'}</b></div>
            <div style="font-size:11px;color:#444">Speed: <b>${p.speed} kn</b></div>
            <div style="font-size:11px;color:${color}">Anomaly: <b>${((p.anomaly_score || 0) * 100).toFixed(0)}%</b></div>
          </div>`
        )
        .addTo(map);
      if (onVesselClick) {
        const vessel = vessels.find((v) => v.name === p.name);
        if (vessel) onVesselClick(vessel);
      }
    };

    ['vessels-normal', 'vessels-anomaly', 'vessels-prime'].forEach((layerId) => {
      if (!map.getLayer(layerId)) return;
      map.on('click', layerId, vesselPopup);
      map.on('mouseenter', layerId, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', layerId, () => {
        map.getCanvas().style.cursor = '';
      });
    });

    // Hover tooltip
    const hoverHandler = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
      if (!e.features || e.features.length === 0) return;
      const p = e.features[0].properties as { name: string };
      const vessel = vessels.find((v) => v.name === p.name);
      setHovered(vessel || null);
    };
    ['vessels-normal', 'vessels-anomaly', 'vessels-prime'].forEach((layerId) => {
      if (map.getLayer(layerId)) map.on('mousemove', layerId, hoverHandler);
    });

    // ----- Detected oil spill polygon (red) near map center -----
    const spillGeoJSON: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [103.78, 1.22],
                [103.84, 1.28],
                [103.88, 1.24],
                [103.85, 1.18],
                [103.79, 1.19],
                [103.78, 1.22],
              ],
            ],
          },
        },
      ],
    };
    map.addSource('slick-fill', { type: 'geojson', data: spillGeoJSON });
    map.addLayer({
      id: 'slick-fill',
      type: 'fill',
      source: 'slick-fill',
      paint: { 'fill-color': '#FF4444', 'fill-opacity': 0.25 },
    });
    map.addLayer({
      id: 'slick-outline',
      type: 'line',
      source: 'slick-fill',
      paint: { 'line-color': '#FF4444', 'line-width': 2 },
    });

    // ----- Drift trajectory (orange dashed) + arrowhead -----
    map.addSource('drift-trajectory', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: [
                [103.72, 1.32],
                [103.76, 1.30],
                [103.79, 1.28],
                [103.82, 1.25],
              ],
            },
          },
        ],
      },
    });
    map.addLayer({
      id: 'drift-trajectory',
      type: 'line',
      source: 'drift-trajectory',
      paint: { 'line-color': '#FF8C00', 'line-width': 2.5, 'line-dasharray': [3, 2] },
    });

    // ----- Origin zone (gold dashed circle) -----
    const originCenter: [number, number] = [103.72, 1.32];
    const radius = 0.015;
    const ring: number[][] = [];
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * 2 * Math.PI;
      ring.push([originCenter[0] + radius * Math.cos(a), originCenter[1] + radius * Math.sin(a)]);
    }
    map.addSource('origin-fill', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } },
        ],
      },
    });
    map.addLayer({
      id: 'origin-fill',
      type: 'fill',
      source: 'origin-fill',
      paint: { 'fill-color': '#FFD700', 'fill-opacity': 0.1 },
    });
    map.addLayer({
      id: 'origin-outline',
      type: 'line',
      source: 'origin-fill',
      paint: { 'line-color': '#FFD700', 'line-width': 1.5, 'line-dasharray': [2, 2] },
    });
  }, [vessels, primeSuspectName, mapReady, onVesselClick]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="absolute inset-0 rounded-lg overflow-hidden" />

      {/* Legend */}
      <div className="absolute bottom-3 left-3 glass-panel px-3 py-2 z-10 space-y-1.5">
        <div className="section-label mb-1">Legend</div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-[#FF4444] border border-[#FF4444]" />
          <span className="text-[0.625rem] text-white/80">Detected Spill</span>
        </div>
        <div className="flex items-center gap-2">
          <svg width="14" height="3" className="shrink-0">
            <line x1="0" y1="1.5" x2="14" y2="1.5" stroke="#FF8C00" strokeWidth="2" strokeDasharray="3 2" />
          </svg>
          <span className="text-[0.625rem] text-white/80">Drift Trajectory</span>
        </div>
        <div className="flex items-center gap-2">
          <svg width="14" height="3" className="shrink-0">
            <line x1="0" y1="1.5" x2="14" y2="1.5" stroke="#00D4FF" strokeWidth="2" strokeDasharray="2 1.5" />
          </svg>
          <span className="text-[0.625rem] text-white/80">Vessel Route Track</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#0FB9B1] border border-white" />
          <span className="text-[0.625rem] text-white/80">Vessel (Normal)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#FF8C00] border border-white" />
          <span className="text-[0.625rem] text-white/80">Vessel (Suspicious)</span>
        </div>
      </div>

      {/* Hover tooltip */}
      {hovered && (
        <div className="absolute pointer-events-none glass-panel px-2.5 py-1.5 text-xs z-20 left-1/2 -translate-y-1/2 top-12">
          <div className="font-semibold text-white">{hovered.name}</div>
          <div className="text-muted text-[0.625rem]">
            MMSI {hovered.mmsi} · {hovered.speed} kn · {hovered.type}
          </div>
        </div>
      )}
    </div>
  );
}
