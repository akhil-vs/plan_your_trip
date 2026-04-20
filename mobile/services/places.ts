import { apiFetch, parseJson } from "./api";

export type PlaceSuggestion = { id: string; name: string; fullName: string };

export type PlaceWithCoords = PlaceSuggestion & { lat: number; lng: number };

export async function searchPlaces(
  query: string,
  options?: {
    proximity?: { lat: number; lng: number };
    sessionToken?: string;
    limit?: number;
  }
): Promise<PlaceSuggestion[]> {
  const params = new URLSearchParams({
    q: query,
    limit: String(options?.limit ?? 8),
  });
  if (options?.proximity) {
    params.set("proximity", `${options.proximity.lng},${options.proximity.lat}`);
  }
  if (options?.sessionToken) {
    params.set("session_token", options.sessionToken);
  }
  const res = await apiFetch(`/api/search?${params}`);
  if (!res.ok) return [];
  return parseJson<PlaceSuggestion[]>(res);
}

export async function retrievePlace(
  mapboxId: string,
  sessionToken: string
): Promise<PlaceWithCoords | null> {
  const params = new URLSearchParams({
    mapbox_id: mapboxId,
    session_token: sessionToken,
  });
  const res = await apiFetch(`/api/search?${params}`);
  if (!res.ok) return null;
  const data = await parseJson<PlaceWithCoords & { error?: string }>(res);
  if (typeof data.lat !== "number" || typeof data.lng !== "number") return null;
  return data as PlaceWithCoords;
}

export async function reverseGeocodeName(lat: number, lng: number): Promise<string> {
  const res = await apiFetch(
    `/api/reverse-geocode?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`
  );
  if (!res.ok) {
    return `Dropped pin (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  }
  const data = await parseJson<{ name?: string }>(res);
  return data.name?.trim() || `Dropped pin (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
}
