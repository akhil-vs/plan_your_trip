import { randomUUID } from "@/lib/randomUuid";

export interface SearchResult {
  id: string;
  name: string;
  fullName: string;
  featureType?: string;
  lat?: number;
  lng?: number;
}

let searchSessionToken = randomUUID();

export function resetSearchSession() {
  searchSessionToken = randomUUID();
}

const SEARCH_CACHE_TTL_MS = 60 * 60 * 1000;
const RETRIEVE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_MEMORY_CACHE_ENTRIES = 200;
const MAX_PERSISTED_CACHE_ENTRIES = 1000;

interface SearchCacheEntry<T> {
  data: T;
  savedAt: number;
}

const searchCache = new Map<string, SearchCacheEntry<SearchResult[]>>();
const retrieveCache = new Map<string, SearchCacheEntry<SearchResult>>();
const inflightSearches = new Map<string, Promise<SearchResult[]>>();
const inflightRetrieves = new Map<string, Promise<SearchResult | null>>();

const normalizeQuery = (query: string) => query.trim().toLowerCase().replace(/\s+/g, " ");

const searchStorageKey = (bucket: string, cacheKey: string) =>
  `plan-your-trip:${bucket}:${encodeURIComponent(cacheKey)}`;

function getSearchCacheKey(
  query: string,
  proximity?: { lng: number; lat: number },
  context?: string
): string {
  const prox = proximity
    ? `${Math.round(proximity.lng * 100) / 100},${Math.round(proximity.lat * 100) / 100}`
    : "";
  const ctx = context?.trim() || "default";
  return `${query}|${prox}|${ctx}`;
}

export type SearchLocationOptions = {
  context?: "generate" | "planner";
  limit?: number;
};

const isSearchResult = (value: unknown): value is SearchResult => {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.name === "string" &&
    (record.fullName === undefined || typeof record.fullName === "string") &&
    (record.featureType === undefined || typeof record.featureType === "string") &&
    (record.lat === undefined || Number.isFinite(record.lat)) &&
    (record.lng === undefined || Number.isFinite(record.lng))
  );
};

function pruneMemoryCache<T>(cache: Map<string, SearchCacheEntry<T>>) {
  while (cache.size > MAX_MEMORY_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (!oldest) return;
    cache.delete(oldest);
  }
}

function prunePersistentCache(bucket: string) {
  if (typeof window === "undefined") return;
  try {
    const prefix = `plan-your-trip:${bucket}:`;
    const rows: Array<{ key: string; savedAt: number }> = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key?.startsWith(prefix)) continue;
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { savedAt?: unknown };
      rows.push({ key, savedAt: Number(parsed.savedAt) || 0 });
    }
    if (rows.length <= MAX_PERSISTED_CACHE_ENTRIES) return;
    rows
      .sort((a, b) => b.savedAt - a.savedAt)
      .slice(MAX_PERSISTED_CACHE_ENTRIES)
      .forEach((row) => window.localStorage.removeItem(row.key));
  } catch {
    // Browser storage is an optimization; ignore quota/private-mode failures.
  }
}

function getCachedValue<T>(
  bucket: string,
  cache: Map<string, SearchCacheEntry<T>>,
  cacheKey: string,
  ttlMs: number,
  isValid: (value: unknown) => value is T
): T | null {
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.savedAt <= ttlMs) {
    return cached.data;
  }

  if (typeof window === "undefined") return null;
  const storageKey = searchStorageKey(bucket, cacheKey);
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt?: unknown; data?: unknown };
    if (!Number.isFinite(parsed.savedAt) || Date.now() - Number(parsed.savedAt) > ttlMs || !isValid(parsed.data)) {
      cache.delete(cacheKey);
      window.localStorage.removeItem(storageKey);
      return null;
    }
    const entry = { savedAt: Number(parsed.savedAt), data: parsed.data };
    cache.set(cacheKey, entry);
    pruneMemoryCache(cache);
    return entry.data;
  } catch {
    return null;
  }
}

function setCachedValue<T>(
  bucket: string,
  cache: Map<string, SearchCacheEntry<T>>,
  cacheKey: string,
  data: T
) {
  const entry = { savedAt: Date.now(), data };
  cache.set(cacheKey, entry);
  pruneMemoryCache(cache);
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(searchStorageKey(bucket, cacheKey), JSON.stringify(entry));
    prunePersistentCache(bucket);
  } catch {
    // Search still works without persistent browser cache.
  }
}

export async function searchLocations(
  query: string,
  proximity?: { lng: number; lat: number },
  options?: SearchLocationOptions
): Promise<SearchResult[]> {
  const normalized = normalizeQuery(query);
  if (normalized.length < 3) return [];

  const cacheKey = getSearchCacheKey(normalized, proximity, options?.context);
  const cached = getCachedValue(
    "web-search",
    searchCache,
    cacheKey,
    SEARCH_CACHE_TTL_MS,
    (value): value is SearchResult[] => Array.isArray(value) && value.every(isSearchResult)
  );
  if (cached) return cached;

  const inflight = inflightSearches.get(cacheKey);
  if (inflight) return inflight;

  const request = (async () => {
    const params = new URLSearchParams({
      q: normalized,
      limit: String(options?.limit ?? 8),
      language: "en",
      session_token: searchSessionToken,
      ...(proximity && {
        proximity: `${proximity.lng},${proximity.lat}`,
      }),
      ...(options?.context && { context: options.context }),
    });

    const res = await fetch(`/api/search?${params}`);
    if (!res.ok) return [];
    const results = (await res.json()) as SearchResult[];
    if (results.every(isSearchResult)) {
      setCachedValue("web-search", searchCache, cacheKey, results);
      return results;
    }
    return [];
  })().finally(() => {
    inflightSearches.delete(cacheKey);
  });
  inflightSearches.set(cacheKey, request);
  return request;
}

export async function retrieveLocationById(
  mapboxId: string
): Promise<SearchResult | null> {
  const id = mapboxId.trim();
  if (!id) return null;
  const cacheKey = `${id}|en`;
  const cached = getCachedValue("web-retrieve", retrieveCache, cacheKey, RETRIEVE_CACHE_TTL_MS, isSearchResult);
  if (cached) return cached;

  const inflight = inflightRetrieves.get(cacheKey);
  if (inflight) return inflight;

  const request = (async () => {
    const params = new URLSearchParams({
      mapbox_id: id,
      language: "en",
      session_token: searchSessionToken,
    });
    const res = await fetch(`/api/search?${params}`);
    if (!res.ok) return null;
    const result = (await res.json()) as SearchResult;
    if (!isSearchResult(result)) return null;
    setCachedValue("web-retrieve", retrieveCache, cacheKey, result);
    return result;
  })().finally(() => {
    inflightRetrieves.delete(cacheKey);
  });
  inflightRetrieves.set(cacheKey, request);
  return request;
}

export interface DirectionsResult {
  distance: number;
  duration: number;
  geometry: GeoJSON.LineString;
  legs: { distance: number; duration: number }[];
}

export async function getDirections(
  coordinates: [number, number][],
  options?: { signal?: AbortSignal }
): Promise<DirectionsResult | null> {
  if (coordinates.length < 2) return null;

  const coords = coordinates.map((c) => c.join(",")).join(";");
  const params = new URLSearchParams({
    coordinates: coords,
  });

  const res = await fetch(`/api/directions?${params}`, { signal: options?.signal });
  if (!res.ok) return null;
  return res.json();
}

interface OptimizerInputWaypoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  order: number;
  isLocked?: boolean;
  visitMinutes?: number;
  openMinutes?: number;
  closeMinutes?: number;
  isTransitSplit?: boolean;
  notes?: string;
}

export async function optimizeWaypoints(
  waypoints: OptimizerInputWaypoint[],
  fixedStart = true,
  fixedEnd = true,
  travelMode: "driving" | "walking" | "cycling" = "driving",
  dayStartMinutes?: number,
  dayEndMinutes?: number,
  defaultVisitMinutes?: number,
  lockedWaypointIds?: string[],
  visitMinutesByWaypointId?: Record<string, number>,
  timeWindowsByWaypointId?: Record<string, { openMinutes: number; closeMinutes: number }>,
  autoSplitLongTransfers = true
): Promise<
  | {
      waypoints: OptimizerInputWaypoint[];
      days: {
        day: number;
        waypointIndexes: number[];
        estimatedTravelMinutes: number;
        estimatedTravelMeters?: number;
      }[];
      conflicts: { waypointId?: string; message: string }[];
      optimization?: {
        objective: "duration";
        originalTravelSeconds: number;
        optimizedTravelSeconds: number;
        optimizedIntermediateWaypointIndex: number[];
      };
    }
  | null
> {
  if (waypoints.length < 2) {
    return { waypoints, days: [], conflicts: [] };
  }
  const res = await fetch("/api/optimize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      waypoints,
      fixedStart,
      fixedEnd,
      travelMode,
      dayStartMinutes,
      dayEndMinutes,
      defaultVisitMinutes,
      lockedWaypointIds,
      visitMinutesByWaypointId,
      timeWindowsByWaypointId,
      autoSplitLongTransfers,
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    waypoints?: OptimizerInputWaypoint[];
    days?: {
      day: number;
      waypointIndexes: number[];
      estimatedTravelMinutes: number;
      estimatedTravelMeters?: number;
    }[];
    conflicts?: { waypointId?: string; message: string }[];
    optimization?: {
      objective: "duration";
      originalTravelSeconds: number;
      optimizedTravelSeconds: number;
      optimizedIntermediateWaypointIndex: number[];
    };
  };
  if (!data.waypoints) return null;
  return {
    waypoints: data.waypoints,
    days: data.days || [],
    conflicts: data.conflicts || [],
    optimization: data.optimization,
  };
}
