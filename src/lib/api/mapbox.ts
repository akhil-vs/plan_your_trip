export interface SearchResult {
  id: string;
  name: string;
  fullName: string;
  lat: number;
  lng: number;
}

let searchSessionToken = crypto.randomUUID();

export function resetSearchSession() {
  searchSessionToken = crypto.randomUUID();
}

const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

interface SearchCacheEntry {
  results: SearchResult[];
  expiresAt: number;
}

const searchCache = new Map<string, SearchCacheEntry>();

function getSearchCacheKey(query: string, proximity?: { lng: number; lat: number }): string {
  const q = query.trim().toLowerCase();
  const prox = proximity
    ? `${Math.round(proximity.lng * 100) / 100},${Math.round(proximity.lat * 100) / 100}`
    : "";
  return `${q}|${prox}`;
}

export async function searchLocations(
  query: string,
  proximity?: { lng: number; lat: number }
): Promise<SearchResult[]> {
  if (!query.trim()) return [];

  const cacheKey = getSearchCacheKey(query, proximity);
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.results;
  }

  const params = new URLSearchParams({
    q: query,
    limit: "8",
    language: "en",
    session_token: searchSessionToken,
    ...(proximity && {
      proximity: `${proximity.lng},${proximity.lat}`,
    }),
  });

  const res = await fetch(`/api/search?${params}`);
  if (!res.ok) return [];
  const results = (await res.json()) as SearchResult[];
  searchCache.set(cacheKey, {
    results,
    expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
  });
  return results;
}

export interface DirectionsResult {
  distance: number;
  duration: number;
  geometry: GeoJSON.LineString;
  legs: { distance: number; duration: number }[];
}

export async function getDirections(
  coordinates: [number, number][]
): Promise<DirectionsResult | null> {
  if (coordinates.length < 2) return null;

  const coords = coordinates.map((c) => c.join(",")).join(";");
  const params = new URLSearchParams({
    coordinates: coords,
  });

  const res = await fetch(`/api/directions?${params}`);
  if (!res.ok) return null;
  return res.json();
}
