export const MAPBOX_ATTRACTION_CATEGORIES = [
  "historic_site",
  "castle",
  "monument_and_landmark",
  "museum",
  "tourist_attraction",
  "park",
  "entertainment",
  "restaurant",
  "hotel",
] as const;

export const MAPBOX_ATTRACTIONS_DEFAULT_RADIUS_METERS = 30000;
export const MAPBOX_ATTRACTIONS_DEFAULT_LIMIT_PER_CATEGORY = 10;
export const MAPBOX_ATTRACTIONS_MAX_RADIUS_METERS = 50000;
export const MAPBOX_ATTRACTIONS_MAX_LIMIT_PER_CATEGORY = 10;

export type MapboxRankedAttraction = {
  id: string;
  name: string;
  fullName: string;
  lat: number;
  lng: number;
  category: string;
  poiCategories: string[];
  distanceMeters: number;
  popularityScore: number;
  tierScore: number;
  score: number;
};

type SearchWindow =
  | { kind: "bbox"; bbox: [number, number, number, number] }
  | { kind: "radius"; lat: number; lng: number; radiusMeters: number };

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}

function haversineMeters(
  origin: { lat: number; lng: number },
  dest: { lat: number; lng: number }
): number {
  const earthRadius = 6371000;
  const dLat = toRad(dest.lat - origin.lat);
  const dLng = toRad(dest.lng - origin.lng);
  const lat1 = toRad(origin.lat);
  const lat2 = toRad(dest.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * earthRadius * Math.asin(Math.sqrt(h));
}

function metersPerDegreeLng(lat: number): number {
  return 111320 * Math.max(0.15, Math.cos(toRad(lat)));
}

function approxBboxDiagonalMeters(bbox: [number, number, number, number]): number {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const latMeters = Math.abs(maxLat - minLat) * 111320;
  const lngMeters = Math.abs(maxLng - minLng) * metersPerDegreeLng((minLat + maxLat) / 2);
  return Math.hypot(latMeters, lngMeters);
}

function splitBboxIntoGrid(
  bbox: [number, number, number, number],
  rows: number,
  cols: number
): Array<[number, number, number, number]> {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const out: Array<[number, number, number, number]> = [];
  const rowCount = Math.max(1, rows);
  const colCount = Math.max(1, cols);
  const latStep = (maxLat - minLat) / rowCount;
  const lngStep = (maxLng - minLng) / colCount;
  for (let r = 0; r < rowCount; r += 1) {
    for (let c = 0; c < colCount; c += 1) {
      const tileMinLat = minLat + latStep * r;
      const tileMaxLat = r === rowCount - 1 ? maxLat : tileMinLat + latStep;
      const tileMinLng = minLng + lngStep * c;
      const tileMaxLng = c === colCount - 1 ? maxLng : tileMinLng + lngStep;
      out.push([tileMinLng, tileMinLat, tileMaxLng, tileMaxLat]);
    }
  }
  return out;
}

function buildSearchWindows(input: {
  lat: number;
  lng: number;
  radiusMeters: number;
  bbox?: [number, number, number, number];
}): SearchWindow[] {
  if (!input.bbox) {
    return [{ kind: "radius", lat: input.lat, lng: input.lng, radiusMeters: input.radiusMeters }];
  }
  const diagonalMeters = approxBboxDiagonalMeters(input.bbox);
  if (diagonalMeters < 12000) {
    return [{ kind: "bbox", bbox: input.bbox }];
  }
  // Densely covered destination regions need multiple category requests.
  const grid = diagonalMeters > 30000 ? splitBboxIntoGrid(input.bbox, 2, 2) : splitBboxIntoGrid(input.bbox, 1, 2);
  return grid.map((tile) => ({ kind: "bbox" as const, bbox: tile }));
}

function parsePopularity(props: Record<string, unknown>): number {
  const raw = props.popularity;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return clampNumber(raw, 0, 1);
  }
  const ratingRaw = props.rating;
  if (typeof ratingRaw === "number" && Number.isFinite(ratingRaw)) {
    return clampNumber(ratingRaw / 5, 0, 1);
  }
  return 0.5;
}

function computeCategoryTier(poiCategories: string[], requestedCategory: string): number {
  const all = [...poiCategories, requestedCategory];
  if (
    all.some((c) =>
      [
        "historic_site",
        "castle",
        "monument_and_landmark",
        "museum",
        "tourist_attraction",
      ].includes(c)
    )
  ) {
    return 1;
  }
  if (all.some((c) => ["park", "entertainment"].includes(c))) return 0.7;
  return 0.4;
}

type MapboxCategoryFeature = {
  id?: string;
  geometry?: { coordinates?: [number, number] };
  properties?: Record<string, unknown>;
};

export async function fetchMapboxCategoryAttractions(input: {
  lat: number;
  lng: number;
  bbox?: [number, number, number, number];
  radiusMeters?: number;
  limitPerCategory?: number;
  accessToken: string;
}): Promise<MapboxRankedAttraction[]> {
  const radiusMeters = clampNumber(
    input.radiusMeters ?? MAPBOX_ATTRACTIONS_DEFAULT_RADIUS_METERS,
    500,
    MAPBOX_ATTRACTIONS_MAX_RADIUS_METERS
  );
  const limitPerCategory = clampNumber(
    input.limitPerCategory ?? MAPBOX_ATTRACTIONS_DEFAULT_LIMIT_PER_CATEGORY,
    1,
    MAPBOX_ATTRACTIONS_MAX_LIMIT_PER_CATEGORY
  );

  const { lat, lng, accessToken } = input;
  const bbox =
    Array.isArray(input.bbox) &&
    input.bbox.length === 4 &&
    input.bbox.every((v) => Number.isFinite(v))
      ? input.bbox
      : undefined;

  const searchWindows = buildSearchWindows({ lat, lng, radiusMeters, bbox });
  const results = await Promise.all(
    MAPBOX_ATTRACTION_CATEGORIES.map(async (category) => {
      const featuresAcrossWindows = await Promise.all(
        searchWindows.map(async (window) => {
      const params = new URLSearchParams({
        limit: String(limitPerCategory),
        language: "en",
        access_token: accessToken,
      });
      if (window.kind === "bbox") {
        params.set("bbox", window.bbox.join(","));
      } else {
        params.set("proximity", `${window.lng},${window.lat}`);
        params.set("radius", String(window.radiusMeters));
      }
      const url = `https://api.mapbox.com/search/searchbox/v1/category/${encodeURIComponent(
        category
      )}?${params}`;
      const res = await fetch(url).catch(() => null);
      if (!res?.ok) return [] as MapboxCategoryFeature[];
      const payload = (await res.json().catch(() => null)) as
        | { features?: MapboxCategoryFeature[] }
        | null;
      return Array.isArray(payload?.features) ? payload.features : [];
        })
      );
      const features = featuresAcrossWindows.flat();
      return features
        .map((f): MapboxRankedAttraction | null => {
          const coords = f.geometry?.coordinates;
          if (!Array.isArray(coords) || coords.length < 2) return null;
          const lon = Number(coords[0]);
          const latCoord = Number(coords[1]);
          if (!Number.isFinite(lon) || !Number.isFinite(latCoord)) return null;
          const props = (f.properties || {}) as Record<string, unknown>;
          const mapboxId =
            (typeof props.mapbox_id === "string" && props.mapbox_id) ||
            (typeof f.id === "string" && f.id) ||
            `${category}:${latCoord.toFixed(5)},${lon.toFixed(5)}`;
          const name =
            (typeof props.name === "string" && props.name) ||
            (typeof props.name_preferred === "string" && props.name_preferred) ||
            "Unknown place";
          const fullName =
            (typeof props.full_address === "string" && props.full_address) ||
            (typeof props.place_formatted === "string" && props.place_formatted) ||
            name;
          const poiCategories = Array.isArray(props.poi_category)
            ? props.poi_category
                .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
                .map((x) => x.trim())
            : [];

          const distanceMeters = haversineMeters(
            { lat, lng },
            { lat: latCoord, lng: lon }
          );
          const proximityScore = Math.max(
            0,
            1 - distanceMeters / Math.max(radiusMeters, 1000)
          );
          const popularityScore = parsePopularity(props);
          const tierScore = computeCategoryTier(poiCategories, category);
          const score = proximityScore * 0.4 + popularityScore * 0.4 + tierScore * 0.2;

          return {
            id: mapboxId,
            name,
            fullName,
            lat: latCoord,
            lng: lon,
            category,
            poiCategories,
            distanceMeters,
            popularityScore,
            tierScore,
            score,
          };
        })
        .filter((x): x is MapboxRankedAttraction => Boolean(x));
    })
  );

  const merged = results.flat();
  merged.sort((a, b) => b.score - a.score);
  const deduped: MapboxRankedAttraction[] = [];
  const seen = new Set<string>();
  for (const item of merged) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    deduped.push(item);
  }
  return deduped;
}

