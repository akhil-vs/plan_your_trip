import { fetchDirections, type RouteInfo } from "./directions";
import type { TransportMode, WaypointData, RoutePreviewMetric } from "../store/tripStore";

export interface RouteComputationResult {
  route: RouteInfo | null;
  previewByMode: Record<TransportMode, RoutePreviewMetric>;
  activePreview: RoutePreviewMetric;
}

const speedByModeKmph: Record<TransportMode, number> = {
  car: 48,
  bike: 18,
  walking: 5,
  transit: 32,
};

const profileByMode: Partial<Record<TransportMode, "driving" | "walking" | "cycling">> = {
  car: "driving",
  bike: "cycling",
  walking: "walking",
};

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(a.lat)) *
      Math.cos(toRad(b.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return 6371 * (2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)));
}

function estimateDistanceKm(points: WaypointData[]): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    total += haversineKm(points[i], points[i + 1]);
  }
  return total;
}

function computeMockPreview(distanceKm: number, mode: TransportMode): RoutePreviewMetric {
  const etaMinutes = Math.max(1, Math.round((distanceKm / speedByModeKmph[mode]) * 60));
  return {
    distanceKm: Number(distanceKm.toFixed(1)),
    etaMinutes,
  };
}

export async function computeRoutePlan(
  waypoints: WaypointData[],
  activeMode: TransportMode
): Promise<RouteComputationResult> {
  const ordered = [...waypoints].sort((a, b) => a.order - b.order);
  const distanceKmFallback = estimateDistanceKm(ordered);
  const previewByMode = {
    car: computeMockPreview(distanceKmFallback, "car"),
    bike: computeMockPreview(distanceKmFallback, "bike"),
    walking: computeMockPreview(distanceKmFallback, "walking"),
    transit: computeMockPreview(distanceKmFallback, "transit"),
  };

  if (ordered.length < 2) {
    return {
      route: null,
      previewByMode,
      activePreview: previewByMode[activeMode],
    };
  }

  const serviceMode = profileByMode[activeMode] ?? "driving";
  const route = await fetchDirections(
    ordered.map((w) => ({ lat: w.lat, lng: w.lng })),
    serviceMode
  );

  if (!route) {
    return {
      route: null,
      previewByMode,
      activePreview: previewByMode[activeMode],
    };
  }

  const serviceDistanceKm = route.distance / 1000;
  const serviceDurationMin = route.duration / 60;
  previewByMode[activeMode] = {
    distanceKm: Number(serviceDistanceKm.toFixed(1)),
    etaMinutes: Math.max(1, Math.round(serviceDurationMin)),
  };

  return {
    route,
    previewByMode,
    activePreview: previewByMode[activeMode],
  };
}
