import { apiFetch, parseJson } from "./api";

export type RouteInfo = {
  distance: number;
  duration: number;
  geometry: { type: "LineString"; coordinates: [number, number][] } | null;
  legs: { distance: number; duration: number }[];
};

export type OptimizerWaypoint = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  order: number;
  isLocked?: boolean;
};

export type OptimizeWaypointsResponse = {
  waypoints: OptimizerWaypoint[];
  optimization?: {
    objective: "duration";
    originalTravelSeconds: number;
    optimizedTravelSeconds: number;
    optimizedIntermediateWaypointIndex: number[];
  };
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

export async function fetchOptimizedWaypoints(
  waypoints: OptimizerWaypoint[],
  profile: "driving" | "walking" | "cycling" = "driving"
): Promise<OptimizeWaypointsResponse | null> {
  if (waypoints.length < 3) return null;
  const res = await apiFetch("/api/optimize", {
    method: "POST",
    body: JSON.stringify({
      waypoints,
      fixedStart: true,
      fixedEnd: true,
      travelMode: profile,
      lockedWaypointIds: waypoints.filter((wp) => wp.isLocked).map((wp) => wp.id),
    }),
  });
  if (!res.ok) return null;
  const data = await parseJson<OptimizeWaypointsResponse>(res);
  if (!Array.isArray(data.waypoints)) return null;
  return data;
}
