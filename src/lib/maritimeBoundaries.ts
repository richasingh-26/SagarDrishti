/**
 * Maritime Navigation & Land Boundary Utility
 * Enforces realistic maritime physics: ships and oil slicks can only navigate in ocean/water,
 * strictly preventing vessels from travelling across or being placed on landmasses
 * (Singapore Island, Peninsular Malaysia / Johor, and Indonesian Riau Islands).
 */

// Format: [lon, lat]
export const SINGAPORE_MAINLAND: [number, number][] = [
  [103.60, 1.26],
  [103.60, 1.32],
  [103.63, 1.36],
  [103.67, 1.42],
  [103.73, 1.45],
  [103.82, 1.46],
  [103.92, 1.42],
  [103.99, 1.41],
  [104.04, 1.35],
  [104.02, 1.31],
  [103.95, 1.30],
  [103.86, 1.26],
  [103.82, 1.25],
  [103.76, 1.27],
  [103.70, 1.28],
  [103.65, 1.27],
  [103.60, 1.26],
];

// Peninsular Malaysia / Johor (North of Singapore & Northwest of Tuas)
export const JOHOR_MALAYSIA: [number, number][] = [
  [103.00, 2.50],
  [105.00, 2.50],
  [105.00, 1.42],
  [104.25, 1.40],
  [104.10, 1.43],
  [103.98, 1.45],
  [103.92, 1.46],
  [103.76, 1.47],
  [103.68, 1.46],
  [103.58, 1.38],
  [103.48, 1.30],
  [103.00, 1.30],
  [103.00, 2.50],
];

// Batam Island (Indonesia)
export const BATAM_INDONESIA: [number, number][] = [
  [103.90, 1.16],
  [104.05, 1.18],
  [104.16, 1.16],
  [104.18, 1.05],
  [104.10, 0.98],
  [103.95, 0.98],
  [103.88, 1.06],
  [103.90, 1.16],
];

// Bintan Island (Indonesia)
export const BINTAN_INDONESIA: [number, number][] = [
  [104.22, 1.20],
  [104.35, 1.22],
  [104.55, 1.20],
  [104.55, 0.95],
  [104.25, 0.95],
  [104.20, 1.08],
  [104.22, 1.20],
];

// Ray casting algorithm for 2D Point-in-Polygon check
export function isPointInPolygon(point: [number, number], vs: [number, number][]): boolean {
  const x = point[0];
  const y = point[1];
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0];
    const yi = vs[i][1];
    const xj = vs[j][0];
    const yj = vs[j][1];

    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Checks whether a given geographic coordinate (lat, lon) is on land.
 */
export function isPointOnLand(lat: number, lon: number): boolean {
  if (typeof lat !== 'number' || typeof lon !== 'number' || !isFinite(lat) || !isFinite(lon)) {
    return false;
  }

  // Quick box checks for high performance
  // 1. Far north into Malaysia
  if (lat >= 1.46) return true;
  if (lat >= 1.30 && lon <= 103.55) return true;

  const pt: [number, number] = [lon, lat];
  if (isPointInPolygon(pt, SINGAPORE_MAINLAND)) return true;
  if (isPointInPolygon(pt, JOHOR_MALAYSIA)) return true;
  if (isPointInPolygon(pt, BATAM_INDONESIA)) return true;
  if (isPointInPolygon(pt, BINTAN_INDONESIA)) return true;

  // Jurong Island & Sentosa coastal checks
  if (lat >= 1.255 && lat <= 1.285 && lon >= 103.68 && lon <= 103.74) return true;

  return false;
}

/**
 * Returns true if the coordinate is strictly in navigable ocean / water.
 */
export function isPointInWater(lat: number, lon: number): boolean {
  return !isPointOnLand(lat, lon);
}

/**
 * Snaps any coordinate that falls on land into the nearest safe navigable
 * ocean fairway within the Singapore Strait TSS corridor.
 */
export function snapToWater(lat: number, lon: number): [number, number] {
  if (isPointInWater(lat, lon)) {
    return [parseFloat(lat.toFixed(4)), parseFloat(lon.toFixed(4))];
  }

  // Singapore Strait safe water fairway baseline:
  // Lat ~1.200 to 1.240 runs unobstructed from Lon 103.45 to Lon 104.35
  const clampedLon = Math.max(103.45, Math.min(104.35, lon));
  let safeLat = 1.220;

  // If point is north (Singapore island / Johor), push south into the southern fairway
  if (lat >= 1.25) {
    // Follow the natural curve of the strait
    safeLat = 1.215 + (clampedLon - 103.80) * 0.025;
  }
  // If point is south (Batam / Indonesia), push north into the central fairway
  else if (lat <= 1.18) {
    safeLat = 1.210 + (clampedLon - 103.80) * 0.02;
  }

  // Double check water guarantee
  if (isPointOnLand(safeLat, clampedLon)) {
    safeLat = 1.218; // 100% deep ocean fairway south of Singapore
  }

  return [parseFloat(safeLat.toFixed(4)), parseFloat(clampedLon.toFixed(4))];
}
