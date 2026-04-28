import { env } from "@/config/env";
import type { ApiUser, LocationSearchResult, RouteSummary, Trip, Waypoint } from "@/types/domain";
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
  signal?: AbortSignal;
  sessionToken?: string;
};

type SearchCacheEntry = {
  savedAt: number;
  data: LocationSearchResult[];
};

const SEARCH_CACHE_TTL_MS = 30_000;
const searchLocationsCache = new Map<string, SearchCacheEntry>();
const searchPoisCache = new Map<string, SearchCacheEntry>();
const inflightSearchLocations = new Map<string, Promise<LocationSearchResult[]>>();
const inflightSearchPois = new Map<string, Promise<LocationSearchResult[]>>();

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
    if (!token || !query.trim()) return [];
    const limit = Number.isFinite(options?.limit) ? Math.max(1, Math.min(15, options?.limit ?? 10)) : 10;
    const sessionToken =
      options?.sessionToken ||
      (typeof globalThis.crypto?.randomUUID === "function"
        ? globalThis.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const proximityKey = proximity ? `${proximity.lat.toFixed(4)},${proximity.lng.toFixed(4)}` : "none";
    const cacheKey = `${query.trim().toLowerCase()}|${proximityKey}|${limit}`;
    const cached = searchPoisCache.get(cacheKey);
    if (cached && Date.now() - cached.savedAt <= SEARCH_CACHE_TTL_MS) {
      return cached.data;
    }
    const inflight = inflightSearchPois.get(cacheKey);
    if (inflight) return inflight;
    const requestPromise = (async () => {
    const params = new URLSearchParams({
      access_token: token,
      q: query.trim(),
      types: "poi",
      limit: String(limit),
      session_token: sessionToken,
      language: "en",
    });
    if (proximity) params.set("proximity", `${proximity.lng},${proximity.lat}`);
    const suggestRes = await fetch(
      `https://api.mapbox.com/search/searchbox/v1/suggest?${params.toString()}`
    );
    if (!suggestRes.ok) return [];
    const suggestPayload = await suggestRes.json().catch(() => ({ suggestions: [] }));
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
        const retrieveRes = await fetch(
          `https://api.mapbox.com/search/searchbox/v1/retrieve/${encodeURIComponent(String(s.mapbox_id ?? ""))}?${retrieveParams.toString()}`
        );
        if (!retrieveRes.ok) return null;
        const retrievePayload = await retrieveRes.json().catch(() => ({ features: [] }));
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
          id: String(featureProps.mapbox_id ?? s.mapbox_id),
          name: String(preferredName || "Unknown place"),
          fullName: String(
            featureProps.full_address ??
              s.full_address ??
              featureProps.place_formatted ??
              ""
          ),
          lat: Number(coords[1]),
          lng: Number(coords[0]),
        } as LocationSearchResult;
      })
    );
      const rows = features.filter((v: LocationSearchResult | null): v is LocationSearchResult => Boolean(v));
      searchPoisCache.set(cacheKey, { savedAt: Date.now(), data: rows });
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
    if (!token || !query.trim()) return [];
    const normalizedQuery = query.trim().toLowerCase();
    const encoded = encodeURIComponent(query.trim());
    const limit = Number.isFinite(options?.limit) ? String(Math.max(1, Math.min(30, options?.limit ?? 10))) : "10";
    const proximityKey = proximity ? `${proximity.lat.toFixed(4)},${proximity.lng.toFixed(4)}` : "none";
    const bboxKey =
      options?.bbox && options.bbox.length === 4
        ? options.bbox.map((v) => Number(v).toFixed(4)).join(",")
        : "none";
    const typesKey = options?.types?.trim() || "poi,address,place,locality,neighborhood,district,region,country";
    const cacheKey = `${normalizedQuery}|${proximityKey}|${bboxKey}|${limit}|${typesKey}`;
    const canUseCache = !options?.signal;
    if (canUseCache) {
      const cached = searchLocationsCache.get(cacheKey);
      if (cached && Date.now() - cached.savedAt <= SEARCH_CACHE_TTL_MS) {
        return cached.data;
      }
      const inflight = inflightSearchLocations.get(cacheKey);
      if (inflight) return inflight;
    }
    const requestPromise = (async () => {
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
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?${params.toString()}`,
      { signal: options?.signal }
    );
    if (!res.ok) return [];
    const payload = await res.json().catch(() => ({ features: [] }));
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
      if (canUseCache) {
        searchLocationsCache.set(cacheKey, { savedAt: Date.now(), data: rows });
      }
      return rows;
    })();
    if (!canUseCache) return requestPromise;
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
  trips: () => request<{ myTrips: Trip[]; publicTrips: Trip[] }>("/api/trips"),
  trip: (tripId: string) => request<Trip & { currentUserRole?: string }>(`/api/trips/${tripId}`),
  /** Body should match web `PlannerSidebar` save / POST `/api/trips` (use `buildCreateTripBody`). */
  createTrip: (input: Record<string, unknown>) =>
    request<Trip>("/api/trips", {
      method: "POST",
      body: JSON.stringify(input),
    }),
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
    request<{ id: string; acceptUrl: string; emailDelivered: boolean }>(
      `/api/trips/${tripId}/invites`,
      { method: "POST", body: JSON.stringify({ email, role }) }
    ),
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
};
