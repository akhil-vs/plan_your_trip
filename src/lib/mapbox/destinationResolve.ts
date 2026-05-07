import { randomUUID } from "@/lib/randomUuid";
import { getOrSetCache, normalizeCoord } from "@/lib/server/memoryCache";

export type ResolvedDestination = {
  mapboxId: string;
  name: string;
  fullName: string;
  lat: number;
  lng: number;
  bbox?: [number, number, number, number];
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
  return {
    mapboxId,
    name: props.name || props.place_formatted || "Destination",
    fullName: props.full_address || props.place_formatted || props.name || "Destination",
    lat,
    lng,
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

const TTL_SUGGEST_MS = 15 * 60 * 1000;
const TTL_RETRIEVE_MS = 24 * 60 * 60 * 1000;
const TTL_AREA_CANDIDATES_MS = 30 * 60 * 1000;
const AREA_CACHE_KEY_VERSION = "v2";

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
    return getOrSetCache(`mapbox:retrieve:${language}:${id}`, TTL_RETRIEVE_MS, () =>
      mapboxRetrieve(id, language, token, sessionToken)
    );
  }

  const q = input.destinationQuery?.trim();
  if (!q || q.length < 2) return null;

  const suggestions = await getOrSetCache(
    `mapbox:suggest:${language}:5:${q.toLowerCase()}`,
    TTL_SUGGEST_MS,
    () => mapboxSuggest(q, "5", language, token, sessionToken)
  );
  const first = suggestions[0];
  if (!first?.id) return null;
  return getOrSetCache(`mapbox:retrieve:${language}:${first.id}`, TTL_RETRIEVE_MS, () =>
    mapboxRetrieve(first.id, language, token, sessionToken)
  );
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
  const destKey = (destinationLabel || "").trim().toLowerCase().slice(0, 80);
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
  const hotspotNameQueries = [
    "land's end",
    "lands end",
    "st ives",
    "penzance",
    "st michael's mount",
    "st michaels mount",
    "harbour",
    "old town",
    "cliff",
    "promenade",
    "historic quarter",
  ];
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
        out.push({
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
        out.push({
          name,
          lng: Number(coords[0]),
          lat: Number(coords[1]),
          category: "locality",
        });
      }
    }
  }
  if (destinationLabel?.trim()) {
    for (const q of hotspotNameQueries) {
      const params = new URLSearchParams({
        access_token: token,
        language,
        limit: "6",
        types: "poi,place,locality",
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
        out.push({
          name,
          lng: Number(coords[0]),
          lat: Number(coords[1]),
          category: "must_see",
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
