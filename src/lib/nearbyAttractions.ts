import { getOrSetCache, normalizeCoord } from "@/lib/server/memoryCache";

export type AttractionStop = {
  name: string;
  lat: number;
  lng: number;
  popularityScore?: number;
  category?: string;
};

const TTL_ATTRACTION_RADIUS_MS = 20 * 60 * 1000;
const TTL_ATTRACTION_AREA_MS = 20 * 60 * 1000;

/**
 * Fetch up to `limit` attraction-like stops near a point for onboarding stubs.
 */
export async function fetchNearbyAttractionStops(
  lat: number,
  lng: number,
  limit: number
): Promise<AttractionStop[]> {
  return fetchNearbyAttractionStopsRadius(lat, lng, 8000, Math.min(limit, 12));
}

/**
 * OpenTripMap radius search (meters). Falls back to synthetic offsets when API missing or errors.
 */
export async function fetchNearbyAttractionStopsRadius(
  lat: number,
  lng: number,
  radiusMeters: number,
  limit: number,
  kinds = "interesting_places",
  minRate = 1
): Promise<AttractionStop[]> {
  const cacheKey = `otm:radius:${normalizeCoord(lat, 3)}:${normalizeCoord(lng, 3)}:${Math.round(radiusMeters)}:${Math.min(limit, 50)}:${kinds}:${minRate}`;
  return getOrSetCache(cacheKey, TTL_ATTRACTION_RADIUS_MS, async () => {
  const apiKey = process.env.OPENTRIPMAP_API_KEY;
  if (!apiKey || limit <= 0) {
    return fallbackStops(lat, lng, limit);
  }

  try {
    const params = new URLSearchParams({
      radius: String(Math.min(Math.max(radiusMeters, 1000), 50000)),
      lon: String(lng),
      lat: String(lat),
      kinds,
      rate: String(Math.max(1, Math.min(3, Math.round(minRate)))),
      format: "json",
      limit: String(Math.min(limit, 50)),
      apikey: apiKey,
    });
    const res = await fetch(
      `https://api.opentripmap.com/0.1/en/places/radius?${params}`,
      { next: { revalidate: 0 } }
    );
    if (!res.ok) return fallbackStops(lat, lng, limit);
    const data = (await res.json()) as Array<{
      name: string;
      point: { lon: number; lat: number };
      rate?: number | string;
      kinds?: string;
    }>;
    const out: AttractionStop[] = [];
    for (const p of data || []) {
      if (!p?.point || !p.name) continue;
      const dLat = p.point.lat - lat;
      const dLng = p.point.lon - lng;
      if (Math.abs(dLat) < 1e-6 && Math.abs(dLng) < 1e-6) continue;
      const scoreRaw =
        typeof p.rate === "number"
          ? p.rate
          : typeof p.rate === "string"
            ? Number.parseFloat(p.rate)
            : undefined;
      const popularityScore = Number.isFinite(scoreRaw) ? Number(scoreRaw) : undefined;
      const category = typeof p.kinds === "string" ? p.kinds.split(",")[0] : undefined;
      out.push({
        name: p.name,
        lat: p.point.lat,
        lng: p.point.lon,
        popularityScore,
        category,
      });
      if (out.length >= limit) break;
    }
    if (out.length >= limit) return out.slice(0, limit);
    return [...out, ...fallbackStops(lat, lng, limit - out.length)];
  } catch {
    return fallbackStops(lat, lng, limit);
  }
  });
}

/** Approximate max width/height of a Mapbox bbox in km (for adaptive OTM sampling). */
export function bboxSpanKm(bbox?: [number, number, number, number]): number | null {
  if (!bbox || bbox.length !== 4) return null;
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const centerLat = (minLat + maxLat) / 2;
  const latKm = Math.max(0, maxLat - minLat) * 111;
  const lngKm =
    Math.max(0, maxLng - minLng) * 111 * Math.max(Math.cos((centerLat * Math.PI) / 180), 0.25);
  return Math.max(latKm, lngKm);
}

export type OtmSamplingParams = {
  ringKmOuter: number;
  ringKmInner: number | null;
  ringPoints: number;
  radiusPrimaryMeters: number;
  useBboxGrid: boolean;
};

/**
 * Ring/radius tuned for compact cities (Edinburgh, Paris core) vs sprawling regions.
 * OTM radius returns the nearest `limit` POIs — extra ring seeds beat a huge radius alone.
 */
export function computeOtmSamplingParams(
  days: number,
  bbox?: [number, number, number, number]
): OtmSamplingParams {
  const spanKm = bboxSpanKm(bbox);
  const compact = spanKm != null && spanKm <= 28;
  const d = Math.min(Math.max(days, 1), 14);

  if (compact) {
    return {
      ringKmOuter: 1.5 + d * 1.4,
      ringKmInner: 1.2,
      ringPoints: Math.min(10, Math.max(5, d + 2)),
      radiusPrimaryMeters: Math.min(22000, 6000 + d * 3500),
      useBboxGrid: Boolean(bbox && bbox.length === 4),
    };
  }

  return {
    ringKmOuter: 8 + d * 4,
    ringKmInner: null,
    ringPoints: Math.min(10, Math.max(4, d + 2)),
    radiusPrimaryMeters: Math.min(18000 + d * 4500, 50000),
    useBboxGrid: true,
  };
}

function dedupeAttractionStops(stops: AttractionStop[]): AttractionStop[] {
  const out: AttractionStop[] = [];
  for (const s of stops) {
    const key = s.name.trim().toLowerCase();
    let dupIndex = -1;
    for (let i = 0; i < out.length; i += 1) {
      const o = out[i];
      const ok = o.name.trim().toLowerCase();
      if (key === ok || (key.length >= 6 && ok.includes(key)) || (ok.length >= 6 && key.includes(ok))) {
        dupIndex = i;
        break;
      }
    }
    const score = s.popularityScore ?? 0;
    if (dupIndex >= 0) {
      if (score > (out[dupIndex].popularityScore ?? 0)) out[dupIndex] = s;
    } else {
      out.push(s);
    }
  }
  return out;
}

/** Sample points on a circle around `centerLat/centerLng` (degrees) for broader POI coverage. */
export function ringSamplePointsKm(
  centerLat: number,
  centerLng: number,
  ringKm: number,
  count: number
): Array<{ lat: number; lng: number }> {
  const latKm = 111;
  const lngKm = 111 * Math.max(Math.cos((centerLat * Math.PI) / 180), 0.25);
  const deltaLatMax = ringKm / latKm;
  const deltaLngMax = ringKm / lngKm;
  const pts: Array<{ lat: number; lng: number }> = [];
  for (let i = 0; i < count; i += 1) {
    const angle = (2 * Math.PI * i) / Math.max(count, 1);
    pts.push({
      lat: centerLat + deltaLatMax * Math.sin(angle),
      lng: centerLng + deltaLngMax * Math.cos(angle),
    });
  }
  return pts;
}

export async function fetchAttractionsAroundDestination(
  centerLat: number,
  centerLng: number,
  targetCount: number,
  days: number,
  bbox?: [number, number, number, number]
): Promise<AttractionStop[]> {
  const sampling = computeOtmSamplingParams(days, bbox);
  const bboxKey = bbox ? bbox.map((v) => normalizeCoord(v, 3)).join(",") : "none";
  const cacheKey = `otm:area:v3:${normalizeCoord(centerLat, 3)}:${normalizeCoord(centerLng, 3)}:${targetCount}:${days}:${bboxKey}:${sampling.ringKmOuter}`;
  return getOrSetCache(cacheKey, TTL_ATTRACTION_AREA_MS, async () => {
  const perQueryLimit = 50;
  const kindProfiles: Array<{ kinds: string; minRate: number }> = [
    { kinds: "interesting_places", minRate: 2 },
    { kinds: "historic,architecture,museums,cultural,castles", minRate: 1 },
    { kinds: "natural,beaches,islands,view_points", minRate: 1 },
  ];

  const seeds: Array<{ lat: number; lng: number }> = [{ lat: centerLat, lng: centerLng }];
  if (sampling.useBboxGrid && bbox && bbox.length === 4) {
    const [minLng, minLat, maxLng, maxLat] = bbox;
    const width = Math.max(0, maxLng - minLng);
    const height = Math.max(0, maxLat - minLat);
    if (width > 0.02 && height > 0.02) {
      const cols = 4;
      const rows = 4;
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          const tLat = r / (rows - 1);
          const tLng = c / (cols - 1);
          seeds.push({
            lat: minLat + height * tLat,
            lng: minLng + width * tLng,
          });
        }
      }
    }
  }
  if (sampling.ringKmInner != null) {
    seeds.push(
      ...ringSamplePointsKm(centerLat, centerLng, sampling.ringKmInner, Math.min(4, sampling.ringPoints))
    );
  }
  seeds.push(
    ...ringSamplePointsKm(centerLat, centerLng, sampling.ringKmOuter, sampling.ringPoints)
  );
  const uniqueSeeds = dedupeSeeds(seeds);

  const merged: AttractionStop[] = [];
  for (const s of uniqueSeeds) {
    for (const profile of kindProfiles) {
      const batch = await fetchNearbyAttractionStopsRadius(
        s.lat,
        s.lng,
        sampling.radiusPrimaryMeters,
        perQueryLimit,
        profile.kinds,
        profile.minRate
      );
      merged.push(...batch);
    }
  }
  return dedupeAttractionStops(merged);
  });
}

function dedupeSeeds(seeds: Array<{ lat: number; lng: number }>): Array<{ lat: number; lng: number }> {
  const out: Array<{ lat: number; lng: number }> = [];
  const seen = new Set<string>();
  for (const s of seeds) {
    const key = `${normalizeCoord(s.lat, 3)},${normalizeCoord(s.lng, 3)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

function fallbackStops(lat: number, lng: number, count: number): AttractionStop[] {
  const delta = 0.04;
  const names = ["Scenic viewpoint", "Historic quarter", "Local park", "Waterfront walk"];
  const res: AttractionStop[] = [];
  for (let i = 0; i < count; i += 1) {
    res.push({
      name: names[i % names.length],
      lat: lat + (i % 2 === 0 ? delta : -delta * 0.8),
      lng: lng + (i % 2 === 1 ? delta : -delta * 0.6),
      popularityScore: 0,
      category: "sight",
    });
  }
  return res;
}
