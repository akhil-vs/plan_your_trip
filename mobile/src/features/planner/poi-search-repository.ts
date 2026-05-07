import AsyncStorage from "@react-native-async-storage/async-storage";
import { env } from "@/config/env";
import { nativePoiDiscover } from "./poi-search-native";
import type { DiscoverCategory } from "./mapbox-discover-categories";
import type { POIDetail, POIFeature } from "./poi-search-model";
import {
  haversineMeters,
  metersAlongRoute,
  minDistanceToPolylineMeters,
  samplePolyline,
} from "./poi-search-route-utils";

type LngLat = [number, number];

type SearchBoxFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: Record<string, unknown>;
};
type SearchOptions = {
  boundingBox?: [number, number, number, number];
};

const MAPBOX_SEARCH_BASE = "https://api.mapbox.com/search/searchbox/v1";
const ROUTE_BUFFER_METERS = 500;
const NATIVE_ROUTE_BUFFER_METERS = 1000;
const NEARBY_CACHE_DISTANCE_METERS = 500;
const CACHE_TTL_MS = 30 * 60 * 1000;
const SEARCH_IN_AREA_MAX_DISTANCE_METERS = 3000;
const SEARCH_NEARBY_MAX_DISTANCE_METERS = 20_000;
const RETRY_SUPPRESSION_MS = 12_000;
const MAX_RETRY_ATTEMPTS = 2;
const DETAILS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const suppressedRetryKeys = new Map<string, number>();
const preferredLanguage = () => {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale || "en";
    const primary = locale.split("-")[0]?.trim();
    return primary || "en";
  } catch {
    return "en";
  }
};

const asRecord = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

const toFeature = (feature: SearchBoxFeature): POIFeature | null => {
  const geometry = feature.geometry;
  const properties = asRecord(feature.properties);
  const coords = geometry?.coordinates;
  if (!coords || !Number.isFinite(coords[0]) || !Number.isFinite(coords[1])) return null;
  const mapboxId = String(properties.mapbox_id ?? "");
  if (!mapboxId) return null;
  return {
    mapboxId,
    name: String(properties.name_preferred ?? properties.name ?? "Unknown place"),
    coordinates: [coords[0], coords[1]],
    category: String(properties.feature_type ?? properties.poi_category ?? "poi"),
    address: String(properties.place_formatted ?? properties.full_address ?? ""),
    distanceMeters: 0,
    routeOffsetMeters: null,
    fullDetails: null,
  };
};

const dedupeByMapboxId = (items: POIFeature[]) => {
  const map = new Map<string, POIFeature>();
  for (const item of items) {
    if (!map.has(item.mapboxId)) map.set(item.mapboxId, item);
  }
  return Array.from(map.values());
};

const normalizeQuery = (categories: DiscoverCategory[]) => {
  const ids = categories.map((c) => c.id);
  if (ids.includes("museum") || ids.includes("park") || ids.includes("scenic_viewpoint")) return "tourist attractions";
  if (ids.includes("gas_station")) return "gas station";
  if (ids.includes("hotel")) return "hotels";
  if (ids.includes("parking")) return "parking";
  return "restaurants cafes bars";
};

const shouldUseBroadQuery = (categories: DiscoverCategory[]) => {
  const ids = categories.map((c) => c.id);
  // Attractions broad query often returns generic "attractions" list entries.
  // Prefer concrete category searches for better relevance.
  if (
    ids.includes("museum") ||
    ids.includes("park") ||
    ids.includes("scenic_viewpoint") ||
    ids.includes("historic") ||
    ids.includes("amusement_park") ||
    ids.includes("zoo") ||
    ids.includes("aquarium") ||
    ids.includes("art_gallery")
  ) {
    return false;
  }
  return true;
};

const isAttractionsSet = (categories: DiscoverCategory[]) => {
  const ids = categories.map((c) => c.id);
  return (
    ids.includes("museum") ||
    ids.includes("park") ||
    ids.includes("scenic_viewpoint") ||
    ids.includes("historic") ||
    ids.includes("amusement_park") ||
    ids.includes("zoo") ||
    ids.includes("aquarium") ||
    ids.includes("art_gallery")
  );
};

const isParkingLikePoi = (poi: POIFeature) => {
  const hay = `${poi.name} ${poi.address} ${poi.category}`.toLowerCase();
  return (
    hay.includes("parking") ||
    hay.includes("car park") ||
    hay.includes("parking garage") ||
    hay.includes("park and ride") ||
    hay.includes("multi-storey")
  );
};

const filterAttractionsNoise = (items: POIFeature[], categories: DiscoverCategory[]) => {
  if (!isAttractionsSet(categories)) return items;
  return items.filter((poi) => !isParkingLikePoi(poi));
};

const localBoundingBox = (location: LngLat, radiusKm = 6): [number, number, number, number] => {
  const lat = location[1];
  const lng = location[0];
  const latDelta = radiusKm / 111.0;
  const lngDelta = radiusKm / (111.0 * Math.max(Math.cos((lat * Math.PI) / 180), 0.2));
  return [lng - lngDelta, lat - latDelta, lng + lngDelta, lat + latDelta];
};

const normalizeCategoryId = (categoryId: string): string => {
  const key = categoryId.trim().toLowerCase();
  switch (key) {
    case "restaurants":
      return "restaurant";
    case "bars":
      return "bar";
    case "parking_lot":
      return "parking";
    case "hotels":
      return "hotel";
    default:
      return key;
  }
};

const toSearchboxCategorySlug = (categoryId: string): string | null => {
  switch (normalizeCategoryId(categoryId)) {
    case "restaurant":
      return "restaurant";
    case "coffee_shop_cafe":
      return "cafe";
    case "bar":
      return "bar";
    case "parking":
      return "parking";
    case "hotel":
      return "hotel";
    case "museum":
      return "museum";
    case "park":
      return "park";
    case "scenic_viewpoint":
      return "viewpoint";
    case "historic":
      return "historic_site";
    case "amusement_park":
      return "theme_park";
    case "zoo":
      return "zoo";
    case "aquarium":
      return "aquarium";
    case "art_gallery":
      return "art_gallery";
    case "gas_station":
      return "gas_station";
    default:
      return null;
  }
};

const shouldRetryStatus = (status: number) => status === 429 || (status >= 500 && status <= 599);

async function fetchWithRetry(url: string, retryKey = url, retries = MAX_RETRY_ATTEMPTS): Promise<Response> {
  const suppressedUntil = suppressedRetryKeys.get(retryKey);
  if (suppressedUntil && suppressedUntil > Date.now()) {
    return new Response(null, { status: 429, statusText: "retry_suppressed" });
  }
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url);
      if (!shouldRetryStatus(response.status)) return response;
      if (attempt === retries) {
        suppressedRetryKeys.set(retryKey, Date.now() + RETRY_SUPPRESSION_MS);
        return response;
      }
    } catch (error) {
      if (attempt === retries) {
        suppressedRetryKeys.set(retryKey, Date.now() + RETRY_SUPPRESSION_MS);
        throw error;
      }
    }
    const backoff = 300 * 2 ** attempt + Math.floor(Math.random() * 120);
    await sleep(backoff);
  }
  return fetch(url);
}

async function fetchCategorySearchbox(
  category: DiscoverCategory,
  proximity: LngLat,
  sessionToken: string,
  limit: number,
  options?: SearchOptions
): Promise<POIFeature[]> {
  const token = env.mapboxPublicToken;
  if (!token) return [];
  const slug = toSearchboxCategorySlug(category.id);
  if (!slug) {
    console.warn(`[POI] unknown category id "${category.id}"`);
    return [];
  }
  const params = new URLSearchParams({
    access_token: token,
    proximity: `${proximity[0]},${proximity[1]}`,
    limit: String(limit),
    language: preferredLanguage(),
    session_token: sessionToken,
  });
  if (options?.boundingBox) {
    params.set("bbox", options.boundingBox.join(","));
  }
  const response = await fetchWithRetry(
    `${MAPBOX_SEARCH_BASE}/category/${encodeURIComponent(slug)}?${params.toString()}`
  );
  if (!response.ok) {
    console.warn(`[POI] category failed for "${slug}" (${response.status})`);
    // Some tokens/regions reject category path lookups for otherwise valid slugs.
    // Fallback to suggest+retrieve for the category query so chips still show data.
    return fetchSuggestRetrieveBroad(normalizeCategoryId(category.id).replace(/_/g, " "), proximity, sessionToken, limit);
  }
  const payload = await response.json().catch(() => ({ features: [] }));
  const features = Array.isArray(payload?.features) ? payload.features : [];
  return features
    .map((feature: unknown) => toFeature(feature as SearchBoxFeature))
    .filter((v: POIFeature | null): v is POIFeature => Boolean(v));
}

async function fetchSuggestRetrieveBroad(
  query: string,
  proximity: LngLat,
  sessionToken: string,
  limit: number,
  options?: SearchOptions
): Promise<POIFeature[]> {
  const token = env.mapboxPublicToken;
  if (!token) return [];
  const suggestParams = new URLSearchParams({
    access_token: token,
    q: query,
    proximity: `${proximity[0]},${proximity[1]}`,
    limit: String(limit),
    language: preferredLanguage(),
    session_token: sessionToken,
    types: "poi",
  });
  if (options?.boundingBox) {
    suggestParams.set("bbox", options.boundingBox.join(","));
  }
  const suggestResponse = await fetchWithRetry(`${MAPBOX_SEARCH_BASE}/suggest?${suggestParams.toString()}`);
  if (!suggestResponse.ok) return [];
  const suggestPayload = await suggestResponse.json().catch(() => ({ suggestions: [] }));
  const suggestions = Array.isArray(suggestPayload?.suggestions) ? suggestPayload.suggestions : [];
  const ids = suggestions
    .map((s: unknown) => asRecord(s))
    .map((s: Record<string, unknown>) => (typeof s.mapbox_id === "string" ? s.mapbox_id : ""))
    .filter(Boolean)
    .slice(0, limit) as string[];
  const rows: POIFeature[] = [];
  for (const id of ids) {
    const retrieveParams = new URLSearchParams({
      access_token: token,
      session_token: sessionToken,
      language: preferredLanguage(),
    });
    const retrieveResponse = await fetchWithRetry(
      `${MAPBOX_SEARCH_BASE}/retrieve/${encodeURIComponent(id)}?${retrieveParams.toString()}`
    );
    if (!retrieveResponse.ok) continue;
    const payload = await retrieveResponse.json().catch(() => ({ features: [] }));
    const first = Array.isArray(payload?.features) ? (payload.features[0] as SearchBoxFeature) : null;
    if (!first) continue;
    const parsed = toFeature(first);
    if (parsed) rows.push(parsed);
    await sleep(120);
  }
  return rows;
}

type NearbyCacheEntry = { center: LngLat; data: POIFeature[]; savedAt: number };
type RouteCacheEntry = { signature: string; data: POIFeature[]; savedAt: number };
type DetailCacheEntry = { savedAt: number; data: POIDetail };

const poiStorageKey = (bucket: string, key: string) => `plan-your-trip:${bucket}:${encodeURIComponent(key)}`;

const isLngLat = (value: unknown): value is LngLat =>
  Array.isArray(value) &&
  value.length === 2 &&
  Number.isFinite(value[0]) &&
  Number.isFinite(value[1]);

const isPoiFeature = (value: unknown): value is POIFeature => {
  const record = asRecord(value);
  return (
    typeof record.mapboxId === "string" &&
    typeof record.name === "string" &&
    isLngLat(record.coordinates) &&
    typeof record.category === "string" &&
    typeof record.address === "string" &&
    Number.isFinite(record.distanceMeters) &&
    (record.routeOffsetMeters === null || Number.isFinite(record.routeOffsetMeters))
  );
};

const isNearbyCacheEntry = (value: unknown): value is NearbyCacheEntry => {
  const record = asRecord(value);
  return (
    isLngLat(record.center) &&
    Number.isFinite(record.savedAt) &&
    Array.isArray(record.data) &&
    record.data.every((item: unknown) => isPoiFeature(item))
  );
};

const isRouteCacheEntry = (value: unknown): value is RouteCacheEntry => {
  const record = asRecord(value);
  return (
    typeof record.signature === "string" &&
    Number.isFinite(record.savedAt) &&
    Array.isArray(record.data) &&
    record.data.every((item: unknown) => isPoiFeature(item))
  );
};

const isDetailCacheEntry = (value: unknown): value is DetailCacheEntry => {
  const record = asRecord(value);
  const detail = asRecord(record.data);
  return (
    Number.isFinite(record.savedAt) &&
    (detail.phone === undefined || typeof detail.phone === "string") &&
    (detail.website === undefined || typeof detail.website === "string") &&
    (detail.hours === undefined || (Array.isArray(detail.hours) && detail.hours.every((item) => typeof item === "string")))
  );
};

async function readStorageCache<T extends { savedAt: number }>(
  bucket: string,
  key: string,
  ttlMs: number,
  isValid: (value: unknown) => value is T
): Promise<T | null> {
  const storageKey = poiStorageKey(bucket, key);
  try {
    const raw = await AsyncStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isValid(parsed) || Date.now() - parsed.savedAt > ttlMs) {
      await AsyncStorage.removeItem(storageKey);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function writeStorageCache<T extends { savedAt: number }>(bucket: string, key: string, entry: T) {
  try {
    await AsyncStorage.setItem(poiStorageKey(bucket, key), JSON.stringify(entry));
  } catch {
    // Persistent POI cache is opportunistic; network search can still continue.
  }
}

export class POISearchRepository {
  private nearbyCache = new Map<string, NearbyCacheEntry>();
  private routeCache = new Map<string, RouteCacheEntry>();
  private detailsCache = new Map<string, DetailCacheEntry>();
  private inFlightPoiSearches = new Map<string, Promise<POIFeature[]>>();
  private inFlightDetails = new Map<string, Promise<POIDetail>>();

  private isFresh(savedAt: number) {
    return Date.now() - savedAt <= CACHE_TTL_MS;
  }

  private routeSignature(route: LngLat[]) {
    if (!route.length) return "empty";
    const first = route[0];
    const mid = route[Math.floor(route.length / 2)];
    const last = route[route.length - 1];
    return `${route.length}:${first[0].toFixed(4)},${first[1].toFixed(4)}:${mid[0].toFixed(4)},${mid[1].toFixed(4)}:${last[0].toFixed(4)},${last[1].toFixed(4)}`;
  }

  private async getNearbyCache(key: string, location: LngLat) {
    const cached = this.nearbyCache.get(key);
    if (
      cached &&
      this.isFresh(cached.savedAt) &&
      haversineMeters(location, cached.center) <= NEARBY_CACHE_DISTANCE_METERS
    ) {
      return cached.data;
    }
    const stored = await readStorageCache("poi-nearby", key, CACHE_TTL_MS, isNearbyCacheEntry);
    if (
      stored &&
      haversineMeters(location, stored.center) <= NEARBY_CACHE_DISTANCE_METERS
    ) {
      this.nearbyCache.set(key, stored);
      return stored.data;
    }
    return null;
  }

  private async setNearbyCache(key: string, center: LngLat, data: POIFeature[]) {
    const entry = { center, data, savedAt: Date.now() };
    this.nearbyCache.set(key, entry);
    await writeStorageCache("poi-nearby", key, entry);
  }

  private async getRouteCache(key: string) {
    const cached = this.routeCache.get(key);
    if (cached && this.isFresh(cached.savedAt)) {
      return cached.data;
    }
    const stored = await readStorageCache("poi-route", key, CACHE_TTL_MS, isRouteCacheEntry);
    if (!stored) return null;
    this.routeCache.set(key, stored);
    return stored.data;
  }

  private async setRouteCache(key: string, data: POIFeature[]) {
    const entry = { signature: key, data, savedAt: Date.now() };
    this.routeCache.set(key, entry);
    await writeStorageCache("poi-route", key, entry);
  }

  private async runDedupedPoiSearch(key: string, producer: () => Promise<POIFeature[]>) {
    const pending = this.inFlightPoiSearches.get(key);
    if (pending) return pending;
    const promise = producer().finally(() => {
      this.inFlightPoiSearches.delete(key);
    });
    this.inFlightPoiSearches.set(key, promise);
    return promise;
  }

  async searchNearby(categories: DiscoverCategory[], location: LngLat, sessionToken: string): Promise<POIFeature[]> {
    const key = `${categories.map((c) => c.id).sort().join("|")}::nearby::${location[0].toFixed(3)},${location[1].toFixed(3)}`;
    const cached = await this.getNearbyCache(key, location);
    if (cached) return cached;

    return this.runDedupedPoiSearch(key, async () => {
      const nearbyBbox = localBoundingBox(location, 12);
      if (nativePoiDiscover.isAvailable(env.mapboxPublicToken)) {
        const data = dedupeByMapboxId(
          await nativePoiDiscover.searchNearby(
            env.mapboxPublicToken,
            categories.map((c) => normalizeCategoryId(c.id)),
            location
          )
        );
        const localized = data
          .map((poi) => ({ ...poi, distanceMeters: haversineMeters(location, poi.coordinates) }))
          .filter((poi) => Number.isFinite(poi.distanceMeters) && poi.distanceMeters <= SEARCH_NEARBY_MAX_DISTANCE_METERS)
          .sort((a, b) => a.distanceMeters - b.distanceMeters)
          .slice(0, 30);
        await this.setNearbyCache(key, location, localized);
        return localized;
      }

      const selected = categories.length <= 4 ? categories : categories.slice(0, 3);
      const results: POIFeature[] = [];
      if (shouldUseBroadQuery(selected)) {
        const primary = await fetchSuggestRetrieveBroad(normalizeQuery(selected), location, sessionToken, 10, {
          boundingBox: nearbyBbox,
        });
        results.push(...primary);
      }
      if (results.length < 10) {
        for (const category of selected) {
          const batch = await fetchCategorySearchbox(category, location, sessionToken, 10, {
            boundingBox: nearbyBbox,
          });
          results.push(...batch);
          await sleep(300);
        }
      }
      const deduped = filterAttractionsNoise(dedupeByMapboxId(results), categories);
      const localized = deduped
        .map((poi) => ({ ...poi, distanceMeters: haversineMeters(location, poi.coordinates) }))
        .filter((poi) => Number.isFinite(poi.distanceMeters) && poi.distanceMeters <= SEARCH_NEARBY_MAX_DISTANCE_METERS)
        .sort((a, b) => a.distanceMeters - b.distanceMeters)
        .slice(0, 30);
      await this.setNearbyCache(key, location, localized);
      return localized;
    });
  }

  async searchInArea(
    categories: DiscoverCategory[],
    location: LngLat,
    sessionToken: string
  ): Promise<POIFeature[]> {
    const bbox = localBoundingBox(location, 6);
    const key = `${categories.map((c) => c.id).sort().join("|")}::area::${bbox.map((v) => v.toFixed(3)).join(",")}`;
    const cached = await this.getNearbyCache(key, location);
    if (cached) return cached;

    return this.runDedupedPoiSearch(key, async () => {
      const selected = categories.length <= 4 ? categories : categories.slice(0, 3);
      const results: POIFeature[] = [];
      if (shouldUseBroadQuery(selected)) {
        const primary = await fetchSuggestRetrieveBroad(normalizeQuery(selected), location, sessionToken, 12, {
          boundingBox: bbox,
        });
        results.push(...primary);
      }
      for (const category of selected) {
        const batch = await fetchCategorySearchbox(category, location, sessionToken, 12, { boundingBox: bbox });
        results.push(...batch);
        await sleep(300);
      }
      const deduped = filterAttractionsNoise(dedupeByMapboxId(results), categories);
      const closeBy = deduped
        .map((poi) => ({ ...poi, distanceMeters: haversineMeters(location, poi.coordinates) }))
        .filter((poi) => poi.distanceMeters <= SEARCH_IN_AREA_MAX_DISTANCE_METERS)
        .sort((a, b) => a.distanceMeters - b.distanceMeters)
        .slice(0, 30);
      await this.setNearbyCache(key, location, closeBy);
      return closeBy;
    });
  }

  async searchAlongRoute(
    categories: DiscoverCategory[],
    routePolyline: LngLat[],
    sessionToken: string
  ): Promise<POIFeature[]> {
    const routeKey = `${categories.map((c) => c.id).sort().join("|")}::${this.routeSignature(routePolyline)}`;
    const cachedRoute = await this.getRouteCache(routeKey);
    if (cachedRoute) return cachedRoute;

    return this.runDedupedPoiSearch(routeKey, async () => {
      if (nativePoiDiscover.isAvailable(env.mapboxPublicToken)) {
        const nativeResults = dedupeByMapboxId(
          await nativePoiDiscover.searchAlongRoute(
            env.mapboxPublicToken,
            categories.map((c) => normalizeCategoryId(c.id)),
            routePolyline
          )
        );
        const withRouteMeta: POIFeature[] = [];
        for (const poi of nativeResults) {
          const dist = minDistanceToPolylineMeters(poi.coordinates, routePolyline);
          if (!Number.isFinite(dist) || dist > NATIVE_ROUTE_BUFFER_METERS) continue;
          const offset = metersAlongRoute(poi.coordinates, routePolyline);
          withRouteMeta.push({ ...poi, distanceMeters: dist, routeOffsetMeters: offset });
        }
        withRouteMeta.sort(
          (a, b) => (a.routeOffsetMeters ?? Number.POSITIVE_INFINITY) - (b.routeOffsetMeters ?? Number.POSITIVE_INFINITY)
        );
        const filtered = filterAttractionsNoise(withRouteMeta, categories);
        await this.setRouteCache(routeKey, filtered);
        return filtered;
      }
      const samplePoints = samplePolyline(routePolyline, 5000, 20);
      if (!samplePoints.length) return [];
      const selected = categories.length <= 4 ? categories : categories.slice(0, 3);
      const allRows: POIFeature[] = [];
      for (const point of samplePoints) {
        if (shouldUseBroadQuery(selected)) {
          const broad = await fetchSuggestRetrieveBroad(normalizeQuery(selected), point, sessionToken, 5);
          allRows.push(...broad);
        }
        for (const category of selected) {
          const batch = await fetchCategorySearchbox(category, point, sessionToken, 4);
          allRows.push(...batch);
          await sleep(300);
        }
      }
      const all = dedupeByMapboxId(allRows);
      const withRouteMeta: POIFeature[] = [];
      for (const poi of all) {
        const dist = minDistanceToPolylineMeters(poi.coordinates, routePolyline);
        if (!Number.isFinite(dist) || dist > ROUTE_BUFFER_METERS) continue;
        const offset = metersAlongRoute(poi.coordinates, routePolyline);
        withRouteMeta.push({ ...poi, distanceMeters: dist, routeOffsetMeters: offset });
      }
      withRouteMeta.sort(
        (a, b) => (a.routeOffsetMeters ?? Number.POSITIVE_INFINITY) - (b.routeOffsetMeters ?? Number.POSITIVE_INFINITY)
      );
      const filtered = filterAttractionsNoise(withRouteMeta, categories);
      await this.setRouteCache(routeKey, filtered);
      return filtered;
    });
  }

  async retrieveDetails(mapboxId: string, sessionToken: string): Promise<POIDetail> {
    const cacheKey = mapboxId;
    const cached = this.detailsCache.get(cacheKey);
    if (cached && Date.now() - cached.savedAt <= DETAILS_CACHE_TTL_MS) {
      return cached.data;
    }
    const stored = await readStorageCache("poi-details", cacheKey, DETAILS_CACHE_TTL_MS, isDetailCacheEntry);
    if (stored) {
      this.detailsCache.set(cacheKey, stored);
      return stored.data;
    }
    const pending = this.inFlightDetails.get(cacheKey);
    if (pending) return pending;

    const request = (async () => {
      const token = env.mapboxPublicToken;
      if (!token) return {};
      const params = new URLSearchParams({
        access_token: token,
        session_token: sessionToken,
        language: preferredLanguage(),
      });
      const retrieveUrl = `${MAPBOX_SEARCH_BASE}/retrieve/${encodeURIComponent(mapboxId)}?${params.toString()}`;
      const res = await fetchWithRetry(retrieveUrl, `details:${cacheKey}`);
      if (!res.ok) throw new Error(`Mapbox retrieve failed (${res.status})`);
      const payload = await res.json().catch(() => ({ features: [] }));
      const feature = Array.isArray(payload?.features) ? payload.features[0] : null;
      const properties = asRecord(asRecord(feature).properties);
      const hoursRaw = properties.opening_hours;
      const hoursRec = asRecord(hoursRaw);
      const hours = Array.isArray(hoursRec.weekday_text) ? (hoursRec.weekday_text as string[]) : [];
      const details = {
        phone: typeof properties.tel === "string" ? properties.tel : undefined,
        website: typeof properties.website === "string" ? properties.website : undefined,
        hours,
      };
      const entry = { savedAt: Date.now(), data: details };
      this.detailsCache.set(cacheKey, entry);
      await writeStorageCache("poi-details", cacheKey, entry);
      return details;
    })().finally(() => {
      this.inFlightDetails.delete(cacheKey);
    });
    this.inFlightDetails.set(cacheKey, request);
    return request;
  }
}

export const poiSearchRepository = new POISearchRepository();
