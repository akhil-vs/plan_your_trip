import AsyncStorage from "@react-native-async-storage/async-storage";
import { env } from "@/config/env";
import { randomUUID } from "@/lib/randomUuid";
import type {
  ApiUser,
  DiscoveryGem,
  GuideArticle,
  LocationSearchResult,
  RouteSummary,
  SavedGem,
  StaycationListing,
  Trip,
  Waypoint,
} from "@/types/domain";
import { getAccessToken, clearAccessToken } from "./session";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const firstSegment = (value: unknown) => {
  if (typeof value !== "string") return "";
  return value.split(",")[0]?.trim() ?? "";
};
const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

type RequestOptions = RequestInit & { auth?: boolean };
type SearchLocationOptions = {
  bbox?: [number, number, number, number];
  limit?: number;
  types?: string;
  context?: "generate" | "planner";
  signal?: AbortSignal;
  sessionToken?: string;
};

type SearchCacheEntry = {
  savedAt: number;
  data: LocationSearchResult[];
};
type RetrySuppressionEntry = { until: number; reason: string };

const SEARCH_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const SEARCH_RETRY_SUPPRESSION_MS = 12_000;
const SEARCH_MAX_RETRIES = 2;
const searchLocationsCache = new Map<string, SearchCacheEntry>();
const searchPoisCache = new Map<string, SearchCacheEntry>();
const inflightSearchLocations = new Map<string, Promise<LocationSearchResult[]>>();
const inflightSearchPois = new Map<string, Promise<LocationSearchResult[]>>();
const suppressedSearchKeys = new Map<string, RetrySuppressionEntry>();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const shouldRetryStatus = (status: number) => status === 429 || (status >= 500 && status <= 599);

const getSuppressedReason = (key: string) => {
  const entry = suppressedSearchKeys.get(key);
  if (!entry) return null;
  if (Date.now() > entry.until) {
    suppressedSearchKeys.delete(key);
    return null;
  }
  return entry.reason;
};

const suppressSearchKey = (key: string, reason: string) => {
  suppressedSearchKeys.set(key, { until: Date.now() + SEARCH_RETRY_SUPPRESSION_MS, reason });
};

const normalizeSearchQuery = (query: string) => query.trim().toLowerCase().replace(/\s+/g, " ");

const searchStorageKey = (bucket: string, cacheKey: string) =>
  `plan-your-trip:${bucket}:${encodeURIComponent(cacheKey)}`;

const isLocationSearchResult = (value: unknown): value is LocationSearchResult => {
  const record = asRecord(value);
  return (
    typeof record.id === "string" &&
    typeof record.name === "string" &&
    Number.isFinite(record.lat) &&
    Number.isFinite(record.lng)
  );
};

const isSearchCacheEntry = (value: unknown): value is SearchCacheEntry => {
  const record = asRecord(value);
  return (
    Number.isFinite(record.savedAt) &&
    Array.isArray(record.data) &&
    record.data.every((item: unknown) => isLocationSearchResult(item))
  );
};

async function getSearchCache(
  bucket: string,
  memoryCache: Map<string, SearchCacheEntry>,
  cacheKey: string
): Promise<LocationSearchResult[] | null> {
  const cached = memoryCache.get(cacheKey);
  if (cached && Date.now() - cached.savedAt <= SEARCH_CACHE_TTL_MS) {
    return cached.data;
  }

  const storageKey = searchStorageKey(bucket, cacheKey);
  try {
    const raw = await AsyncStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isSearchCacheEntry(parsed)) {
      await AsyncStorage.removeItem(storageKey);
      return null;
    }
    if (Date.now() - parsed.savedAt > SEARCH_CACHE_TTL_MS) {
      memoryCache.delete(cacheKey);
      await AsyncStorage.removeItem(storageKey);
      return null;
    }
    memoryCache.set(cacheKey, parsed);
    return parsed.data;
  } catch {
    return null;
  }
}

async function setSearchCache(
  bucket: string,
  memoryCache: Map<string, SearchCacheEntry>,
  cacheKey: string,
  data: LocationSearchResult[]
) {
  const entry = { savedAt: Date.now(), data };
  memoryCache.set(cacheKey, entry);
  try {
    await AsyncStorage.setItem(searchStorageKey(bucket, cacheKey), JSON.stringify(entry));
  } catch {
    // Search still works if the device refuses the persistent cache write.
  }
}

async function fetchJsonWithRetry<T>(url: string, keyForSuppression: string, options?: RequestInit): Promise<T | null> {
  const suppressedReason = getSuppressedReason(keyForSuppression);
  if (suppressedReason) return null;

  for (let attempt = 0; attempt <= SEARCH_MAX_RETRIES; attempt += 1) {
    try {
      const res = await fetch(url, options);
      if (res.ok) {
        return (await res.json().catch(() => null)) as T | null;
      }
      if (!shouldRetryStatus(res.status) || attempt === SEARCH_MAX_RETRIES) {
        if (shouldRetryStatus(res.status)) {
          suppressSearchKey(keyForSuppression, `status:${res.status}`);
        }
        return null;
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return null;
      }
      if (attempt === SEARCH_MAX_RETRIES) {
        suppressSearchKey(keyForSuppression, error instanceof Error ? error.message : "network_error");
        return null;
      }
    }
    const baseDelay = 250 * 2 ** attempt;
    const jitter = Math.floor(Math.random() * 120);
    await sleep(baseDelay + jitter);
  }
  return null;
}

function isLikelyUnreachableHost(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return (
    err.message === "Network request failed" || err.message.includes("Network request failed")
  );
}

function networkFailureHint(baseUrl: string): string {
  if (/localhost|127\.0\.0\.1/i.test(baseUrl)) {
    return ` The API URL is ${baseUrl} — on a phone, "localhost" is the phone itself. Use your PC's LAN IP (e.g. http://192.168.1.10:3000): set EXPO_PUBLIC_API_BASE_URL in mobile/.env, or set NEXTAUTH_URL in the repo root .env to that LAN URL (mobile/app.config.js copies it when EXPO_PUBLIC_API_BASE_URL is unset). Run npm run dev:lan from the repo root, then restart Metro with npx expo start --dev-client --clear.`;
  }
  return ` Tried ${baseUrl}. Open that URL in the phone's browser; if it does not load, fix Wi‑Fi/firewall or start the Next.js server.`;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (options.auth !== false) {
    const token = await getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const baseUrl = env.apiBaseUrl;
  const url = `${baseUrl}${path}`;
  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (err) {
    if (isLikelyUnreachableHost(err)) {
      throw new Error(`Network request failed.${networkFailureHint(baseUrl)}`);
    }
    throw err;
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) {
      await clearAccessToken();
    }
    const message =
      typeof payload?.error === "string" ? payload.error : "Request failed";
    throw new ApiError(message, response.status);
  }
  return payload as T;
}

export const api = {
  searchPois: async (
    query: string,
    proximity?: { lat: number; lng: number },
    options?: { limit?: number; sessionToken?: string }
  ): Promise<LocationSearchResult[]> => {
    const token = env.mapboxPublicToken;
    const normalizedQuery = normalizeSearchQuery(query);
    if (!token || !normalizedQuery) return [];
    const limit = Number.isFinite(options?.limit) ? Math.max(1, Math.min(15, options?.limit ?? 10)) : 10;
    const sessionToken = options?.sessionToken || randomUUID();
    const proximityKey = proximity ? `${proximity.lat.toFixed(4)},${proximity.lng.toFixed(4)}` : "none";
    const cacheKey = `${normalizedQuery}|${proximityKey}|${limit}`;
    const cached = await getSearchCache("search-pois", searchPoisCache, cacheKey);
    if (cached) return cached;
    const inflight = inflightSearchPois.get(cacheKey);
    if (inflight) return inflight;
    const requestPromise = (async () => {
      const params = new URLSearchParams({
        access_token: token,
        q: normalizedQuery,
        types: "poi",
        limit: String(limit),
        session_token: sessionToken,
        language: "en",
      });
      if (proximity) params.set("proximity", `${proximity.lng},${proximity.lat}`);
      const suggestPayload = await fetchJsonWithRetry<{ suggestions?: unknown[] }>(
        `https://api.mapbox.com/search/searchbox/v1/suggest?${params.toString()}`,
        `pois:suggest:${normalizedQuery}|${proximityKey}|${limit}`
      );
      if (!suggestPayload) return [];
      const suggestions = Array.isArray(suggestPayload?.suggestions) ? suggestPayload.suggestions : [];
      const top = suggestions
        .filter((s: unknown) => {
          const record = asRecord(s);
          return typeof record.mapbox_id === "string" && record.mapbox_id.length > 0;
        })
        .slice(0, limit);
      const features = await Promise.all(
        top.map(async (sUnknown: unknown) => {
          const s = asRecord(sUnknown);
          const retrieveParams = new URLSearchParams({
            access_token: token,
            session_token: sessionToken,
          });
          const mapboxId = String(s.mapbox_id ?? "");
          if (!mapboxId) return null;
          const retrievePayload = await fetchJsonWithRetry<{ features?: unknown[] }>(
            `https://api.mapbox.com/search/searchbox/v1/retrieve/${encodeURIComponent(mapboxId)}?${retrieveParams.toString()}`,
            `pois:retrieve:${mapboxId}`
          );
          if (!retrievePayload) return null;
          const featureRaw = Array.isArray(retrievePayload?.features) ? retrievePayload.features[0] : null;
          const feature = asRecord(featureRaw);
          const geometry = asRecord(feature.geometry);
          const featureProps = asRecord(feature.properties);
          const coords = geometry.coordinates;
          if (!Array.isArray(coords) || coords.length < 2) return null;
          const preferredName =
            featureProps.name_preferred ??
            featureProps.name ??
            s.name_preferred ??
            s.name ??
            firstSegment(featureProps.place_formatted) ??
            firstSegment(s.full_address);
          return {
            id: String(featureProps.mapbox_id ?? mapboxId),
            name: String(preferredName || "Unknown place"),
            fullName: String(featureProps.full_address ?? s.full_address ?? featureProps.place_formatted ?? ""),
            lat: Number(coords[1]),
            lng: Number(coords[0]),
          } as LocationSearchResult;
        })
      );
      const rows = features.filter((v: LocationSearchResult | null): v is LocationSearchResult => Boolean(v));
      await setSearchCache("search-pois", searchPoisCache, cacheKey, rows);
      return rows;
    })();
    inflightSearchPois.set(cacheKey, requestPromise);
    try {
      return await requestPromise;
    } finally {
      inflightSearchPois.delete(cacheKey);
    }
  },

  searchLocations: async (
    query: string,
    proximity?: { lat: number; lng: number },
    options?: SearchLocationOptions
  ): Promise<LocationSearchResult[]> => {
    const token = env.mapboxPublicToken;
    const normalizedQuery = normalizeSearchQuery(query);
    if (!token || normalizedQuery.length < 3) return [];
    const encoded = encodeURIComponent(normalizedQuery);
    const limit = Number.isFinite(options?.limit) ? String(Math.max(1, Math.min(30, options?.limit ?? 10))) : "10";
    const proximityKey = proximity ? `${proximity.lat.toFixed(4)},${proximity.lng.toFixed(4)}` : "none";
    const bboxKey =
      options?.bbox && options.bbox.length === 4
        ? options.bbox.map((v) => Number(v).toFixed(4)).join(",")
        : "none";
    const typesKey = options?.types?.trim() || "poi,address,place,locality,neighborhood,district,region,country";
    const contextKey = options?.context?.trim() || "default";
    const useUnifiedDestinationSearch = !options?.types;
    const cacheKey = `${normalizedQuery}|${proximityKey}|${bboxKey}|${limit}|${typesKey}|${contextKey}|${useUnifiedDestinationSearch ? "unified" : "legacy"}`;
    const cached = await getSearchCache("search-locations", searchLocationsCache, cacheKey);
    if (cached) return cached;
    const canShareInflight = !options?.signal;
    if (canShareInflight) {
      const inflight = inflightSearchLocations.get(cacheKey);
      if (inflight) return inflight;
    }
    const sessionToken = options?.sessionToken || randomUUID();
    const requestPromise = (async () => {
      if (useUnifiedDestinationSearch) {
        const params = new URLSearchParams({
          q: normalizedQuery,
          limit,
          language: "en",
          session_token: sessionToken,
        });
        if (proximity) params.set("proximity", `${proximity.lng},${proximity.lat}`);
        if (options?.context) params.set("context", options.context);
        const suggestions = await request<
          Array<{ id: string; name: string; fullName: string; featureType?: string; lat?: number; lng?: number }>
        >(`/api/search?${params.toString()}`, {
          auth: false,
          signal: options?.signal,
        }).catch(() => []);
        const rowsWithCoords = await Promise.all(
          (Array.isArray(suggestions) ? suggestions : []).slice(0, Number(limit)).map(async (item) => {
            if (!item?.id || typeof item.name !== "string") return null;
            if (Number.isFinite(item.lat) && Number.isFinite(item.lng)) {
              return {
                id: String(item.id),
                name: String(item.name),
                fullName: String(item.fullName ?? item.name),
                lat: Number(item.lat),
                lng: Number(item.lng),
              } as LocationSearchResult;
            }
            const retrieveParams = new URLSearchParams({
              mapbox_id: String(item.id),
              language: "en",
              session_token: sessionToken,
            });
            const retrieved = await request<{
              id: string;
              name: string;
              fullName: string;
              lat: number;
              lng: number;
            }>(`/api/search?${retrieveParams.toString()}`, {
              auth: false,
              signal: options?.signal,
            }).catch(() => null);
            if (!retrieved || !Number.isFinite(retrieved.lat) || !Number.isFinite(retrieved.lng)) return null;
            return {
              id: String(retrieved.id),
              name: String(retrieved.name),
              fullName: String(retrieved.fullName ?? retrieved.name),
              lat: Number(retrieved.lat),
              lng: Number(retrieved.lng),
            } as LocationSearchResult;
          })
        );
        const rows = rowsWithCoords.filter((v: LocationSearchResult | null): v is LocationSearchResult => Boolean(v));
        await setSearchCache("search-locations", searchLocationsCache, cacheKey, rows);
        return rows;
      }

      const params = new URLSearchParams({
        access_token: token,
        autocomplete: "true",
        limit,
        language: "en",
        types: typesKey,
      });
      if (proximity) params.set("proximity", `${proximity.lng},${proximity.lat}`);
      if (options?.bbox && options.bbox.length === 4) {
        params.set("bbox", options.bbox.map((v) => String(v)).join(","));
      }
      if (sessionToken) {
        params.set("session_token", sessionToken);
      }
      const payload = await fetchJsonWithRetry<{ features?: unknown[] }>(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?${params.toString()}`,
        `locations:suggest:${cacheKey}`,
        { signal: options?.signal }
      );
      if (!payload) return [];
      const features = Array.isArray(payload?.features) ? payload.features : [];
      const rows = features
        .map((featureUnknown: unknown) => {
          const f = asRecord(featureUnknown);
          const geometry = asRecord(f.geometry);
          const properties = asRecord(f.properties);
          const coords = geometry.coordinates;
          if (!Array.isArray(coords) || coords.length < 2) return null;
          const preferredName =
            properties.name ??
            f.text ??
            firstSegment(f.place_name) ??
            firstSegment(properties.full_address);
          return {
            id: String(f.id ?? `${coords[1]}:${coords[0]}`),
            name: String(preferredName || "Unknown place"),
            fullName: String(properties.full_address ?? f.place_name ?? ""),
            lat: Number(coords[1]),
            lng: Number(coords[0]),
          } as LocationSearchResult;
        })
        .filter((v: LocationSearchResult | null): v is LocationSearchResult => Boolean(v));
      await setSearchCache("search-locations", searchLocationsCache, cacheKey, rows);
      return rows;
    })();
    if (!canShareInflight) return requestPromise;
    inflightSearchLocations.set(cacheKey, requestPromise);
    try {
      return await requestPromise;
    } finally {
      inflightSearchLocations.delete(cacheKey);
    }
  },

  login: (email: string, password: string) =>
    request<{ token: string; user: { id: string; email: string; name: string | null } }>(
      "/api/auth/mobile/login",
      { method: "POST", auth: false, body: JSON.stringify({ email, password }) }
    ),
  register: (name: string, email: string, password: string) =>
    request<{ id: string; name: string; email: string }>("/api/auth/register", {
      method: "POST",
      auth: false,
      body: JSON.stringify({ name, email, password }),
    }),
  me: () => request<ApiUser>("/api/account/me"),
  notifications: (take = 30) =>
    request<{
      notifications: Array<{
        id: string;
        type: string;
        title: string;
        body: string;
        data: unknown;
        readAt: string | null;
        createdAt: string;
      }>;
      unreadCount: number;
    }>(`/api/notifications?take=${take}`),
  notificationMarkRead: (id: string) =>
    request<{ success: boolean; alreadyRead?: boolean }>(`/api/notifications/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ read: true }),
    }),
  notificationsMarkAllRead: () =>
    request<{ success: boolean; count: number }>("/api/notifications/read-all", { method: "POST" }),
  trips: () => request<{ myTrips: Trip[]; publicTrips: Trip[] }>("/api/trips"),
  trip: (tripId: string) => request<Trip & { currentUserRole?: string }>(`/api/trips/${tripId}`),
  /** Body should match web `PlannerSidebar` save / POST `/api/trips` (use `buildCreateTripBody`). */
  createTrip: (input: Record<string, unknown>) =>
    request<Trip>("/api/trips", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  generateTripFromDestination: (input: {
    destination?: string;
    mapboxId?: string;
    days: number;
    pace?: string;
    interests?: string[];
  }) =>
    request<{ trip: Trip; narrative?: unknown; resolvedDestination?: unknown }>(
      "/api/trips/generate-from-destination",
      {
        method: "POST",
        body: JSON.stringify(input),
      }
    ),
  updateTrip: (tripId: string, input: Record<string, unknown>) =>
    request<Trip>(`/api/trips/${tripId}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  deleteTrip: (tripId: string) =>
    request<{ success: boolean }>(`/api/trips/${tripId}`, { method: "DELETE" }),
  directions: (coordinates: string) =>
    request<RouteSummary>(`/api/directions?coordinates=${encodeURIComponent(coordinates)}`),
  optimize: (body: Record<string, unknown>) =>
    request<{
      waypoints: Waypoint[];
      days: { day: number; waypointIndexes: number[]; estimatedTravelMinutes: number }[];
      conflicts: { message: string; waypointId?: string }[];
    }>("/api/optimize", { method: "POST", body: JSON.stringify(body) }),
  reverseGeocode: (lat: number, lng: number) =>
    request<{ name?: string }>(`/api/reverse-geocode?lat=${lat}&lng=${lng}`),
  invites: (tripId: string) =>
    request<
      {
        id: string;
        email: string;
        token: string;
        role: "EDITOR" | "VIEWER";
        status: string;
        expiresAt: string;
      }[]
    >(`/api/trips/${tripId}/invites`),
  members: (tripId: string) =>
    request<
      {
        id: string;
        role: "OWNER" | "EDITOR" | "VIEWER";
        user: { id: string; name: string | null; email: string };
      }[]
    >(`/api/trips/${tripId}/members`),
  addMember: (tripId: string, email: string, role: "EDITOR" | "VIEWER") =>
    request<{
      id: string;
      role: "EDITOR" | "VIEWER";
      user: { id: string; name: string | null; email: string };
    }>(`/api/trips/${tripId}/members`, {
      method: "POST",
      body: JSON.stringify({ email, role }),
    }),
  removeMember: (tripId: string, userId: string) =>
    request<{ success: boolean }>(`/api/trips/${tripId}/members`, {
      method: "DELETE",
      body: JSON.stringify({ userId }),
    }),
  chatMessages: (tripId: string) =>
    request<
      {
        id: string;
        body: string | null;
        imageUrl: string | null;
        createdAt: string;
        user: { id: string; name: string | null };
      }[]
    >(`/api/trips/${tripId}/chat`),
  postChatMessage: (tripId: string, body: { body?: string; imageUrl?: string }) =>
    request<{ id: string }>(`/api/trips/${tripId}/chat`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  tripEvents: (tripId: string, limit = 30) =>
    request<
      {
        id: string;
        type: string;
        payload: unknown;
        actorId: string | null;
        createdAt: string;
      }[]
    >(`/api/trips/${tripId}/events?mode=history&limit=${limit}`),
  createInvite: (tripId: string, email: string, role: "EDITOR" | "VIEWER") =>
    request<{
      id: string;
      token: string;
      acceptUrl: string;
      emailDelivered: boolean;
      emailWarning?: string | null;
    }>(`/api/trips/${tripId}/invites`, { method: "POST", body: JSON.stringify({ email, role }) }),
  revokeInvite: (tripId: string, inviteId: string) =>
    request<{ id: string }>(`/api/trips/${tripId}/invites`, {
      method: "DELETE",
      body: JSON.stringify({ inviteId }),
    }),
  acceptInvite: (token: string) =>
    request<{ success: boolean; tripId: string; role: string }>(
      `/api/trips/invites/${token}/accept`,
      { method: "POST" }
    ),
  publishTrip: (tripId: string) =>
    request<{ shareUrl: string; shareId: string; isPublic: boolean }>(
      `/api/trips/${tripId}/share`,
      { method: "POST" }
    ),
  finalizeTrip: (tripId: string) =>
    request<{ id: string; status: "DRAFT" | "FINALIZED"; isPublic: boolean }>(
      `/api/trips/${tripId}/finalize`,
      { method: "POST" }
    ),
  unfinalizeTrip: (tripId: string) =>
    request<{ id: string; status: "DRAFT" | "FINALIZED"; isPublic: boolean }>(
      `/api/trips/${tripId}/finalize`,
      { method: "DELETE" }
    ),
  unpublishTrip: (tripId: string) =>
    request<{ shareId: string; isPublic: boolean }>(`/api/trips/${tripId}/share`, {
      method: "DELETE",
    }),
  sharedTrip: (shareId: string) =>
    request<Trip & { user?: { name?: string | null } }>(`/api/public/trips/${shareId}`, {
      auth: false,
    }),
  accountPlan: () =>
    request<{ id: string; email: string; name: string | null; plan: "FREE" | "PRO" | "TEAM" }>(
      "/api/account/plan"
    ),
  updatePlan: (plan: "FREE" | "PRO" | "TEAM") =>
    request<{ id: string; email: string; name: string | null; plan: "FREE" | "PRO" | "TEAM" }>(
      "/api/account/plan",
      { method: "PUT", body: JSON.stringify({ plan }) }
    ),
  onboardingComplete: (input: {
    destinationName: string;
    lat: number;
    lng: number;
    travelPreference: "solo" | "couple" | "family" | "group";
  }) =>
    request<{ tripId: string }>("/api/onboarding/complete", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  onboardingSkip: () => request<{ ok: boolean }>("/api/onboarding/skip", { method: "POST" }),
  adminStats: (days: 7 | 30 | 90 = 7) =>
    request<{
      kpis: {
        totalUsers: number;
        totalTrips: number;
        publicTrips: number;
        finalizedTrips: number;
        pendingInvites: number;
        collaborators: number;
        newUsers7d: number;
        newTrips7d: number;
        windowDays: number;
      };
      planDistribution: { plan: string; count: number }[];
    }>(`/api/admin/stats?days=${days}`),
  adminUsers: () =>
    request<
      {
        id: string;
        name: string | null;
        email: string;
        plan: "FREE" | "PRO" | "TEAM";
        createdAt: string;
        _count: { trips: number; tripMembers: number };
      }[]
    >("/api/admin/users"),
  adminUpdateUserPlan: (userId: string, plan: "FREE" | "PRO" | "TEAM") =>
    request<{ id: string; name: string | null; email: string; plan: "FREE" | "PRO" | "TEAM" }>(
      "/api/admin/users",
      { method: "PATCH", body: JSON.stringify({ userId, plan }) }
    ),
  discoveryGems: (input?: { category?: string; region?: string; limit?: number }) =>
    request<{
      categories: { key: string; label: string }[];
      regions: { key: string; label: string }[];
      gems: DiscoveryGem[];
    }>(
      `/api/gems?category=${encodeURIComponent(input?.category || "waterfalls")}&region=${encodeURIComponent(
        input?.region || "england"
      )}&limit=${encodeURIComponent(String(input?.limit || 12))}`
    ),
  savedGems: (tripId: string) => request<SavedGem[]>(`/api/gems/saved?tripId=${encodeURIComponent(tripId)}`),
  saveGem: (gemId: string, body: { tripId: string; name: string; category: string; lat: number; lng: number }) =>
    request<SavedGem>(`/api/gems/${encodeURIComponent(gemId)}/save`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  unsaveGem: (gemId: string, tripId: string) =>
    request<{ success: boolean }>(
      `/api/gems/${encodeURIComponent(gemId)}/save?tripId=${encodeURIComponent(tripId)}`,
      {
        method: "DELETE",
      }
    ),
  guides: (input?: { region?: string; category?: string }) =>
    request<GuideArticle[]>(
      `/api/guides?region=${encodeURIComponent(input?.region || "")}&category=${encodeURIComponent(
        input?.category || ""
      )}`
    ),
  staycations: (input?: { region?: string; tags?: string[]; budgetBand?: string }) =>
    request<StaycationListing[]>(
      `/api/staycations?region=${encodeURIComponent(input?.region || "")}&budgetBand=${encodeURIComponent(
        input?.budgetBand || ""
      )}&tags=${encodeURIComponent((input?.tags || []).join(","))}`
    ),
  parkingNearby: (lat: number, lng: number, radius = 3500) =>
    request<{ id: string; name: string; lat: number; lng: number; address: string; confidenceScore: number }[]>(
      `/api/parking/nearby?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(
        String(lng)
      )}&radius=${encodeURIComponent(String(radius))}`
    ),
};
