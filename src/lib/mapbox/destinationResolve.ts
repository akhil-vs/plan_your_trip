import { randomUUID } from "@/lib/randomUuid";
import { haversineKm } from "@/lib/optimize/travelAndOrder";
import { getOrSetCache, normalizeCoord } from "@/lib/server/memoryCache";

export type ResolvedDestination = {
  mapboxId: string;
  name: string;
  fullName: string;
  lat: number;
  lng: number;
  bbox?: [number, number, number, number];
  featureType?: string;
};

export type MapboxAreaCandidate = {
  name: string;
  lat: number;
  lng: number;
  category?: string;
};

async function mapboxSuggest(
  q: string,
  limit: string,
  language: string,
  token: string,
  sessionToken: string
) {
  const allowedFeatureTypes = new Set([
    "country",
    "region",
    "district",
    "place",
    "locality",
    "neighborhood",
  ]);
  const params = new URLSearchParams({
    q,
    access_token: token,
    session_token: sessionToken,
    limit,
    language,
    types: "country,region,district,place,locality,neighborhood",
  });
  const url = `https://api.mapbox.com/search/searchbox/v1/suggest?${params}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Mapbox suggest failed: ${res.status} ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return (data.suggestions || [])
    .filter(
      (s: { mapbox_id?: string; feature_type?: string }) =>
        s.mapbox_id &&
        typeof s.feature_type === "string" &&
        allowedFeatureTypes.has(s.feature_type)
    )
    .slice(0, Number(limit))
    .map(
      (s: {
        mapbox_id: string;
        name: string;
        full_address?: string;
        place_formatted?: string;
      }) => ({
        id: s.mapbox_id,
        name: s.name,
        fullName: s.full_address || s.place_formatted || s.name,
      })
    ) as { id: string; name: string; fullName: string }[];
}

async function mapboxRetrieve(
  mapboxId: string,
  language: string,
  token: string,
  sessionToken: string
): Promise<ResolvedDestination | null> {
  const params = new URLSearchParams({
    access_token: token,
    language,
    session_token: sessionToken,
  });
  const url = `https://api.mapbox.com/search/searchbox/v1/retrieve/${encodeURIComponent(mapboxId)}?${params}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const feature = data.features?.[0];
  if (!feature?.geometry?.coordinates) return null;
  const props = feature.properties || {};
  const [lng, lat] = feature.geometry.coordinates as [number, number];
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const featureType =
    typeof props.feature_type === "string"
      ? props.feature_type
      : typeof props.category === "string"
        ? props.category
        : undefined;
  return {
    mapboxId,
    name: props.name || props.place_formatted || "Destination",
    fullName: props.full_address || props.place_formatted || props.name || "Destination",
    lat,
    lng,
    featureType,
    bbox:
      Array.isArray(feature.bbox) &&
      feature.bbox.length === 4 &&
      feature.bbox.every((v: unknown) => Number.isFinite(Number(v)))
        ? [
            Number(feature.bbox[0]),
            Number(feature.bbox[1]),
            Number(feature.bbox[2]),
            Number(feature.bbox[3]),
          ]
        : undefined,
  };
}

const TTL_SUGGEST_MS = 60 * 60 * 1000;
const TTL_RETRIEVE_MS = 24 * 60 * 60 * 1000;
const TTL_AREA_CANDIDATES_MS = 30 * 60 * 1000;
const AREA_CACHE_KEY_VERSION = "v2";

const AREA_FEATURE_TYPES = new Set([
  "country",
  "region",
  "district",
  "place",
  "locality",
  "neighborhood",
]);

const POI_FEATURE_TYPES = new Set(["poi", "landmark", "attraction", "establishment"]);

function bboxSpanKm(bbox: [number, number, number, number]): number {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const centerLat = (minLat + maxLat) / 2;
  const latSpan = haversineKm(
    { name: "", lat: minLat, lng: minLng },
    { name: "", lat: maxLat, lng: minLng }
  );
  const lngSpan = haversineKm(
    { name: "", lat: centerLat, lng: minLng },
    { name: "", lat: centerLat, lng: maxLng }
  );
  return Math.max(latSpan, lngSpan);
}

async function reverseGeocodeParentArea(
  lat: number,
  lng: number,
  token: string,
  language: string
): Promise<ResolvedDestination | null> {
  const params = new URLSearchParams({
    access_token: token,
    language,
    types: "place,locality,region,district",
    limit: "1",
  });
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?${params}`;
  const res = await fetch(url).catch(() => null);
  if (!res || !res.ok) return null;
  const data = await res.json().catch(() => null);
  const feature = Array.isArray(data?.features) ? data.features[0] : null;
  if (!feature?.geometry?.coordinates) return null;
  const props = feature.properties || {};
  const [parentLng, parentLat] = feature.geometry.coordinates as [number, number];
  if (!Number.isFinite(parentLat) || !Number.isFinite(parentLng)) return null;
  const bbox =
    Array.isArray(feature.bbox) &&
    feature.bbox.length === 4 &&
    feature.bbox.every((v: unknown) => Number.isFinite(Number(v)))
      ? [
          Number(feature.bbox[0]),
          Number(feature.bbox[1]),
          Number(feature.bbox[2]),
          Number(feature.bbox[3]),
        ]
      : undefined;
  return {
    mapboxId: String(feature.id || `${parentLat}:${parentLng}`),
    name: String(props.name || feature.text || "Destination"),
    fullName: String(props.full_address || feature.place_name || props.name || "Destination"),
    lat: parentLat,
    lng: parentLng,
    bbox: bbox as [number, number, number, number] | undefined,
    featureType: typeof feature.place_type?.[0] === "string" ? feature.place_type[0] : "place",
  };
}

async function expandToSurroundingArea(
  resolved: ResolvedDestination,
  token: string,
  language: string
): Promise<ResolvedDestination> {
  const featureType = (resolved.featureType || "").toLowerCase();
  const hasUsableBbox =
    resolved.bbox && bboxSpanKm(resolved.bbox) >= 12;

  if (AREA_FEATURE_TYPES.has(featureType) && hasUsableBbox) {
    return resolved;
  }

  if (!POI_FEATURE_TYPES.has(featureType) && hasUsableBbox) {
    return resolved;
  }

  const parent = await reverseGeocodeParentArea(resolved.lat, resolved.lng, token, language);
  if (!parent) return resolved;

  return {
    ...parent,
    name: parent.name || resolved.name,
    fullName: parent.fullName || resolved.fullName,
  };
}

function normalizeSearchQuery(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Resolve a free-text destination or existing Mapbox ID to coordinates (server-side).
 */
export async function resolveDestination(input: {
  destinationQuery?: string;
  mapboxId?: string;
}): Promise<ResolvedDestination | null> {
  const token = process.env.MAPBOX_ACCESS_TOKEN;
  if (!token) return null;

  const language = "en";
  const sessionToken = randomUUID();

  if (input.mapboxId?.trim()) {
    const id = input.mapboxId.trim();
    const resolved = await getOrSetCache(`mapbox:retrieve:${language}:${id}`, TTL_RETRIEVE_MS, () =>
      mapboxRetrieve(id, language, token, sessionToken)
    );
    if (!resolved) return null;
    return expandToSurroundingArea(resolved, token, language);
  }

  const q = normalizeSearchQuery(input.destinationQuery ?? "");
  if (q.length < 3) return null;

  const suggestions = await getOrSetCache(
    `mapbox:suggest:${language}:5:${q}`,
    TTL_SUGGEST_MS,
    () => mapboxSuggest(q, "5", language, token, sessionToken)
  );
  const first = suggestions[0];
  if (!first?.id) return null;
  const resolved = await getOrSetCache(`mapbox:retrieve:${language}:${first.id}`, TTL_RETRIEVE_MS, () =>
    mapboxRetrieve(first.id, language, token, sessionToken)
  );
  if (!resolved) return null;
  return expandToSurroundingArea(resolved, token, language);
}

/**
 * Destination-area Mapbox POI candidates (geometry/label source only).
 * Popularity is enriched later from external providers.
 */
export async function fetchMapboxAreaCandidates(input: {
  lat: number;
  lng: number;
  days: number;
  limit: number;
  bbox?: [number, number, number, number];
  destinationLabel?: string;
}): Promise<MapboxAreaCandidate[]> {
  const token = process.env.MAPBOX_ACCESS_TOKEN;
  if (!token) return [];

  const { lat, lng, days, limit, bbox, destinationLabel } = input;
  const destKey = normalizeSearchQuery(destinationLabel || "").slice(0, 80);
  const bboxKey = bbox ? bbox.map((v) => normalizeCoord(v, 3)).join(",") : "none";
  const areaKey = `mapbox:area:${AREA_CACHE_KEY_VERSION}:${normalizeCoord(lat, 3)}:${normalizeCoord(lng, 3)}:${days}:${limit}:${bboxKey}:${destKey}`;
  return getOrSetCache(areaKey, TTL_AREA_CANDIDATES_MS, async () => {
  const language = "en";
  const poiQueries = [
    "tourist attraction",
    "landmark",
    "beach",
    "harbour",
    "castle",
    "mount",
    "historic site",
  ];
  const localityQueries = ["town", "village", "coastal town"];
  const genericHotspotQueries = [
    "top tourist attractions",
    "famous landmark",
    "historic old town",
    "viewpoint",
    "national museum",
    "castle",
    "cathedral",
    "harbour",
    "promenade",
    "historic quarter",
    "beach",
  ];
  const cornwallHotspotQueries = [
    "land's end",
    "lands end",
    "st ives",
    "penzance",
    "st michael's mount",
    "st michaels mount",
  ];
  const maxFetchKm = bbox ? Math.min(48, 22 + days * 4) : Math.min(42, 18 + days * 3);
  const ring = Math.min(12, Math.max(6, days + 4));
  const seeds: Array<{ lat: number; lng: number }> = [{ lat, lng }];
  if (bbox && bbox.length === 4) {
    const [minLng, minLat, maxLng, maxLat] = bbox;
    const width = Math.max(0, maxLng - minLng);
    const height = Math.max(0, maxLat - minLat);
    if (width > 0.04 && height > 0.04) {
      const cols = Math.min(5, Math.max(3, Math.round(Math.sqrt(Math.max(1, days)))));
      const rows = Math.min(5, Math.max(3, Math.round(Math.sqrt(Math.max(1, days + 2)))));
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          const tLat = rows === 1 ? 0.5 : r / (rows - 1);
          const tLng = cols === 1 ? 0.5 : c / (cols - 1);
          seeds.push({
            lat: minLat + height * tLat,
            lng: minLng + width * tLng,
          });
        }
      }
    }
  }

  if (ring > 0) {
    const latKm = 111;
    const lngKm = 111 * Math.max(Math.cos((lat * Math.PI) / 180), 0.25);
    const ringKm = bbox ? 24 + days * 9 : 16 + days * 7;
    const dLat = ringKm / latKm;
    const dLng = ringKm / lngKm;
    for (let i = 0; i < ring; i += 1) {
      const angle = (2 * Math.PI * i) / ring;
      seeds.push({
        lat: lat + dLat * Math.sin(angle),
        lng: lng + dLng * Math.cos(angle),
      });
    }
  }

  const uniqueSeeds = dedupeSeeds(seeds);
  const out: MapboxAreaCandidate[] = [];
  const perReq = Math.min(24, Math.max(8, Math.ceil((limit * 2) / Math.max(1, uniqueSeeds.length))));

  const pushIfNear = (row: MapboxAreaCandidate) => {
    const km = haversineKm(
      { name: "", lat, lng },
      { name: "", lat: row.lat, lng: row.lng }
    );
    if (km <= maxFetchKm) out.push(row);
  };

  for (const seed of uniqueSeeds) {
    for (const q of poiQueries) {
      const params = new URLSearchParams({
        access_token: token,
        language,
        limit: String(perReq),
        types: "poi",
        proximity: `${seed.lng},${seed.lat}`,
      });
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?${params.toString()}`;
      const res = await fetch(url).catch(() => null);
      if (!res || !res.ok) continue;
      const data = await res.json().catch(() => null);
      const features = Array.isArray(data?.features) ? data.features : [];
      for (const f of features) {
        const props = (f?.properties ?? {}) as Record<string, unknown>;
        const coords = f?.geometry?.coordinates as [number, number] | undefined;
        if (!coords || !Number.isFinite(coords[0]) || !Number.isFinite(coords[1])) continue;
        const name =
          String(props.name || f?.text || "").trim() ||
          String(props.place_formatted || "").trim();
        if (!name) continue;
        const category = typeof props?.category === "string" ? props.category : "poi";
        pushIfNear({
          name,
          lng: Number(coords[0]),
          lat: Number(coords[1]),
          category,
        });
      }
    }
    for (const q of localityQueries) {
      const params = new URLSearchParams({
        access_token: token,
        language,
        limit: String(Math.max(6, Math.floor(perReq / 2))),
        types: "place,locality",
        proximity: `${seed.lng},${seed.lat}`,
      });
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?${params.toString()}`;
      const res = await fetch(url).catch(() => null);
      if (!res || !res.ok) continue;
      const data = await res.json().catch(() => null);
      const features = Array.isArray(data?.features) ? data.features : [];
      for (const f of features) {
        const props = (f?.properties ?? {}) as Record<string, unknown>;
        const coords = f?.geometry?.coordinates as [number, number] | undefined;
        if (!coords || !Number.isFinite(coords[0]) || !Number.isFinite(coords[1])) continue;
        const name =
          String(props.name || f?.text || "").trim() ||
          String(props.place_formatted || "").trim();
        if (!name) continue;
        pushIfNear({
          name,
          lng: Number(coords[0]),
          lat: Number(coords[1]),
          category: "locality",
        });
      }
    }
  }
  if (destinationLabel?.trim()) {
    const labelKey = normalizeSearchQuery(destinationLabel);
    const hotspotQueries = [
      ...genericHotspotQueries,
      ...(labelKey.includes("cornwall") ||
      labelKey.includes("penzance") ||
      labelKey.includes("st ives") ||
      labelKey.includes("lands end")
        ? cornwallHotspotQueries
        : []),
    ];
    for (const q of hotspotQueries) {
      const params = new URLSearchParams({
        access_token: token,
        language,
        limit: "6",
        types: "poi",
        proximity: `${lng},${lat}`,
      });
      const contextual = `${q} ${destinationLabel.trim()}`;
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(contextual)}.json?${params.toString()}`;
      const res = await fetch(url).catch(() => null);
      if (!res || !res.ok) continue;
      const data = await res.json().catch(() => null);
      const features = Array.isArray(data?.features) ? data.features : [];
      for (const f of features) {
        const props = (f?.properties ?? {}) as Record<string, unknown>;
        const coords = f?.geometry?.coordinates as [number, number] | undefined;
        if (!coords || !Number.isFinite(coords[0]) || !Number.isFinite(coords[1])) continue;
        const name =
          String(props.name || f?.text || "").trim() ||
          String(props.place_formatted || "").trim();
        if (!name) continue;
        pushIfNear({
          name,
          lng: Number(coords[0]),
          lat: Number(coords[1]),
          category: "attraction",
        });
      }
    }
  }
  return out;
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
