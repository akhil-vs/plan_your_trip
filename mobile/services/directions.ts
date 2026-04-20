import { apiFetch, parseJson } from "./api";

export type RouteInfo = {
  distance: number;
  duration: number;
  geometry: { type: "LineString"; coordinates: [number, number][] } | null;
  legs: { distance: number; duration: number }[];
};

/** Build `lng,lat;lng,lat` for Mapbox directions API (via backend). */
export function formatCoordinates(coords: { lat: number; lng: number }[]): string {
  return coords.map((c) => `${c.lng},${c.lat}`).join(";");
}

export async function fetchDirections(
  waypoints: { lat: number; lng: number }[],
  profile: "driving" | "walking" | "cycling" = "driving"
): Promise<RouteInfo | null> {
  if (waypoints.length < 2) return null;
  const coordinates = formatCoordinates(waypoints);
  const params = new URLSearchParams({ coordinates, profile });
  const res = await apiFetch(`/api/directions?${params}`, { skipAuth: true });
  if (!res.ok) return null;
  return parseJson<RouteInfo>(res);
}
