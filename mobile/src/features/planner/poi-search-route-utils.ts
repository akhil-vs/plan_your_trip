type LngLat = [number, number];

const EARTH_RADIUS_M = 6371000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

export const haversineMeters = (a: LngLat, b: LngLat) => {
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
};

const toXY = (origin: LngLat, point: LngLat) => {
  const x = toRad(point[0] - origin[0]) * EARTH_RADIUS_M * Math.cos(toRad((origin[1] + point[1]) / 2));
  const y = toRad(point[1] - origin[1]) * EARTH_RADIUS_M;
  return { x, y };
};

const pointToSegmentDistanceMeters = (p: LngLat, a: LngLat, b: LngLat) => {
  const origin = a;
  const pa = toXY(origin, p);
  const ba = toXY(origin, b);
  const baLenSq = ba.x * ba.x + ba.y * ba.y;
  if (baLenSq <= 0) return Math.hypot(pa.x, pa.y);
  const t = Math.max(0, Math.min(1, (pa.x * ba.x + pa.y * ba.y) / baLenSq));
  const projX = ba.x * t;
  const projY = ba.y * t;
  return Math.hypot(pa.x - projX, pa.y - projY);
};

export const minDistanceToPolylineMeters = (point: LngLat, polyline: LngLat[]) => {
  if (polyline.length < 2) return Number.POSITIVE_INFINITY;
  let min = Number.POSITIVE_INFINITY;
  for (let i = 0; i < polyline.length - 1; i += 1) {
    const dist = pointToSegmentDistanceMeters(point, polyline[i], polyline[i + 1]);
    if (dist < min) min = dist;
  }
  return min;
};

export const metersAlongRoute = (point: LngLat, polyline: LngLat[]) => {
  if (polyline.length < 2) return 0;
  let bestOffset = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  let traversed = 0;
  for (let i = 0; i < polyline.length - 1; i += 1) {
    const a = polyline[i];
    const b = polyline[i + 1];
    const segLen = haversineMeters(a, b);
    const origin = a;
    const pp = toXY(origin, point);
    const bb = toXY(origin, b);
    const denom = bb.x * bb.x + bb.y * bb.y;
    const t = denom > 0 ? Math.max(0, Math.min(1, (pp.x * bb.x + pp.y * bb.y) / denom)) : 0;
    const proj: LngLat = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const dist = haversineMeters(point, proj);
    if (dist < bestDist) {
      bestDist = dist;
      bestOffset = traversed + segLen * t;
    }
    traversed += segLen;
  }
  return bestOffset;
};

export const samplePolyline = (polyline: LngLat[], intervalMeters: number, maxPoints: number): LngLat[] => {
  if (!polyline.length) return [];
  if (polyline.length === 1) return [polyline[0]];
  const cumulative: number[] = [0];
  for (let i = 1; i < polyline.length; i += 1) {
    cumulative.push(cumulative[i - 1] + haversineMeters(polyline[i - 1], polyline[i]));
  }
  const total = cumulative[cumulative.length - 1];
  const byInterval = Math.floor(total / intervalMeters) + 1;
  const targetCount = Math.max(2, Math.min(maxPoints, byInterval));
  const samples: LngLat[] = [];
  for (let i = 0; i < targetCount; i += 1) {
    const target = (i / Math.max(1, targetCount - 1)) * total;
    let seg = 1;
    while (seg < cumulative.length && cumulative[seg] < target) seg += 1;
    const segStart = Math.max(1, seg) - 1;
    const segEnd = Math.min(polyline.length - 1, segStart + 1);
    const segDistance = cumulative[segEnd] - cumulative[segStart] || 1;
    const t = (target - cumulative[segStart]) / segDistance;
    const a = polyline[segStart];
    const b = polyline[segEnd];
    samples.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return samples;
};
