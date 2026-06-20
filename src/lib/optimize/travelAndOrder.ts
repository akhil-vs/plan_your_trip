/**
 * Shared travel matrix + waypoint ordering (also used by /api/optimize).
 */

import { unstable_cache } from "next/cache";
import { normalizeCoord } from "@/lib/server/memoryCache";

export interface OptimizerWaypoint {
  id?: string;
  name: string;
  lat: number;
  lng: number;
  order?: number;
  isTransitSplit?: boolean;
  visitMinutes?: number;
  openMinutes?: number;
  closeMinutes?: number;
}

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}

export function haversineKm(a: OptimizerWaypoint, b: OptimizerWaypoint): number {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function estimateLegMinutes(
  a: OptimizerWaypoint,
  b: OptimizerWaypoint,
  travelMode: "driving" | "walking" | "cycling"
): number {
  const speedKmPerHour =
    travelMode === "walking" ? 5 : travelMode === "cycling" ? 18 : 60;
  const hours = haversineKm(a, b) / speedKmPerHour;
  return Math.max(1, Math.round(hours * 60));
}

export type MatrixPayload = {
  durations: (number | null)[][];
  distances: (number | null)[][];
};

const MATRIX_CACHE_REVALIDATE_SECONDS = 30 * 24 * 60 * 60; // 30 days

function formatCoordinatesForMatrix(waypoints: OptimizerWaypoint[]): string {
  return waypoints.map((wp) => `${normalizeCoord(wp.lng, 6)},${normalizeCoord(wp.lat, 6)}`).join(";");
}

async function fetchMapboxMatrixDirect(
  profile: string,
  coordinates: string,
  token: string
): Promise<MatrixPayload> {
  const params = new URLSearchParams({
    access_token: token,
    annotations: "duration,distance",
  });
  const res = await fetch(
    `https://api.mapbox.com/directions-matrix/v1/${profile}/${coordinates}?${params}`
  ).catch(() => null);
  if (!res || !res.ok) throw new Error("Matrix request failed");
  const data = (await res.json().catch(() => null)) as
    | {
        durations?: (number | null)[][];
        distances?: (number | null)[][];
      }
    | null;
  if (!data?.durations || !data?.distances) throw new Error("Matrix response missing annotations");
  return { durations: data.durations, distances: data.distances };
}

export async function fetchMapboxMatrix(
  waypoints: OptimizerWaypoint[],
  travelMode: "driving" | "walking" | "cycling"
): Promise<MatrixPayload | null> {
  const token = process.env.MAPBOX_ACCESS_TOKEN;
  if (!token || waypoints.length < 2 || waypoints.length > 25) return null;
  const profile =
    travelMode === "walking"
      ? "mapbox/walking"
      : travelMode === "cycling"
        ? "mapbox/cycling"
        : "mapbox/driving";
  const coordinates = formatCoordinatesForMatrix(waypoints);
  const getCachedMatrix = unstable_cache(
    () => fetchMapboxMatrixDirect(profile, coordinates, token),
    ["mapbox-matrix", profile, coordinates],
    { revalidate: MATRIX_CACHE_REVALIDATE_SECONDS }
  );
  return getCachedMatrix().catch(() => null);
}

export function createFallbackMatrix(
  waypoints: OptimizerWaypoint[],
  travelMode: "driving" | "walking" | "cycling"
): MatrixPayload {
  const size = waypoints.length;
  const durations: number[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => 0)
  );
  const distances: number[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => 0)
  );
  for (let i = 0; i < size; i += 1) {
    for (let j = 0; j < size; j += 1) {
      if (i === j) continue;
      durations[i][j] = estimateLegMinutes(waypoints[i], waypoints[j], travelMode) * 60;
      distances[i][j] = Math.round(haversineKm(waypoints[i], waypoints[j]) * 1000);
    }
  }
  return { durations, distances };
}

export function getLegMetric(
  matrix: (number | null)[][],
  fallbackSecondsOrMeters: number
): (from: number, to: number) => number {
  return (from: number, to: number) => {
    if (from === to) return 0;
    const value = matrix[from]?.[to];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      return value;
    }
    return fallbackSecondsOrMeters;
  };
}

export type RouteNode = OptimizerWaypoint & {
  matrixIndex: number;
  originalIndex: number;
};

/** Sum of matrix edge costs along ordered route nodes (used by /api/optimize). */
export function matrixRouteCost(
  route: RouteNode[],
  getCost: (fromMatrixIndex: number, toMatrixIndex: number) => number
): number {
  if (route.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < route.length - 1; i += 1) {
    total += getCost(route[i].matrixIndex, route[i + 1].matrixIndex);
  }
  return total;
}

function nearestNeighborMatrixOrder(
  nodes: RouteNode[],
  fixedStart: boolean,
  fixedEnd: boolean,
  getCost: (fromMatrixIndex: number, toMatrixIndex: number) => number
): RouteNode[] {
  if (nodes.length <= 2) return nodes;
  const remaining = [...nodes];
  const route: RouteNode[] = [];
  const endNode = fixedEnd ? remaining.pop() : null;
  route.push(remaining.shift() as RouteNode);
  while (remaining.length > 0) {
    const current = route[route.length - 1];
    let bestIdx = 0;
    let best = Number.POSITIVE_INFINITY;
    for (let i = 0; i < remaining.length; i += 1) {
      const cost = getCost(current.matrixIndex, remaining[i].matrixIndex);
      if (cost < best) {
        best = cost;
        bestIdx = i;
      }
    }
    route.push(remaining.splice(bestIdx, 1)[0]);
  }
  if (endNode) route.push(endNode);
  return route;
}

function twoOptRefineByCost(
  route: RouteNode[],
  fixedStart: boolean,
  fixedEnd: boolean,
  getCost: (fromMatrixIndex: number, toMatrixIndex: number) => number
): RouteNode[] {
  if (route.length < 4) return route;
  const start = fixedStart ? 1 : 0;
  const endExclusive = fixedEnd ? route.length - 1 : route.length;
  if (endExclusive - start < 3) return route;
  let improved = true;
  let bestRoute = [...route];
  let bestCost = matrixRouteCost(bestRoute, getCost);
  while (improved) {
    improved = false;
    for (let i = start; i < endExclusive - 2; i += 1) {
      for (let k = i + 1; k < endExclusive - 1; k += 1) {
        const candidate = [...bestRoute];
        const reversed = candidate.slice(i, k + 1).reverse();
        candidate.splice(i, k - i + 1, ...reversed);
        const candidateCost = matrixRouteCost(candidate, getCost);
        if (candidateCost + 1e-9 < bestCost) {
          bestRoute = candidate;
          bestCost = candidateCost;
          improved = true;
        }
      }
    }
  }
  return bestRoute;
}

function heldKarpPath(
  interior: RouteNode[],
  startNode: RouteNode | null,
  endNode: RouteNode | null,
  getCost: (fromMatrixIndex: number, toMatrixIndex: number) => number
): RouteNode[] | null {
  const n = interior.length;
  if (n === 0) return [];
  const fullMask = (1 << n) - 1;
  const dp: number[][] = Array.from({ length: 1 << n }, () =>
    Array.from({ length: n }, () => Number.POSITIVE_INFINITY)
  );
  const parent: number[][] = Array.from({ length: 1 << n }, () =>
    Array.from({ length: n }, () => -1)
  );
  for (let j = 0; j < n; j += 1) {
    const fromCost = startNode
      ? getCost(startNode.matrixIndex, interior[j].matrixIndex)
      : 0;
    dp[1 << j][j] = fromCost;
  }
  for (let mask = 1; mask <= fullMask; mask += 1) {
    for (let last = 0; last < n; last += 1) {
      if (((mask >> last) & 1) === 0) continue;
      const base = dp[mask][last];
      if (!Number.isFinite(base)) continue;
      for (let next = 0; next < n; next += 1) {
        if ((mask >> next) & 1) continue;
        const nextMask = mask | (1 << next);
        const candidate =
          base + getCost(interior[last].matrixIndex, interior[next].matrixIndex);
        if (candidate < dp[nextMask][next]) {
          dp[nextMask][next] = candidate;
          parent[nextMask][next] = last;
        }
      }
    }
  }
  let bestLast = -1;
  let best = Number.POSITIVE_INFINITY;
  for (let last = 0; last < n; last += 1) {
    const tail = endNode
      ? getCost(interior[last].matrixIndex, endNode.matrixIndex)
      : 0;
    const total = dp[fullMask][last] + tail;
    if (total < best) {
      best = total;
      bestLast = last;
    }
  }
  if (bestLast < 0) return null;
  const order: number[] = [];
  let mask = fullMask;
  let cursor = bestLast;
  while (cursor >= 0) {
    order.push(cursor);
    const prev = parent[mask][cursor];
    mask ^= 1 << cursor;
    cursor = prev;
  }
  order.reverse();
  return order.map((idx) => interior[idx]);
}

function optimizeSegmentByMatrix(
  segment: RouteNode[],
  fixedStart: boolean,
  fixedEnd: boolean,
  getCost: (fromMatrixIndex: number, toMatrixIndex: number) => number
): RouteNode[] {
  if (segment.length <= 2) return segment;
  const startNode = fixedStart ? segment[0] : null;
  const endNode = fixedEnd ? segment[segment.length - 1] : null;
  const interior = segment.slice(fixedStart ? 1 : 0, fixedEnd ? -1 : undefined);
  if (interior.length <= 1) return segment;
  let bestInterior: RouteNode[] | null = null;
  if (interior.length <= 10) {
    bestInterior = heldKarpPath(interior, startNode, endNode, getCost);
  }
  if (!bestInterior) {
    const seeded = nearestNeighborMatrixOrder(
      segment,
      fixedStart,
      fixedEnd,
      getCost
    );
    const refined = twoOptRefineByCost(seeded, fixedStart, fixedEnd, getCost);
    const originalCost = matrixRouteCost(segment, getCost);
    const refinedCost = matrixRouteCost(refined, getCost);
    const improvementRatio =
      originalCost > 0 ? (originalCost - refinedCost) / originalCost : 0;
    return improvementRatio >= 0.03 ? refined : segment;
  }
  return [
    ...(startNode ? [startNode] : []),
    ...bestInterior,
    ...(endNode ? [endNode] : []),
  ];
}

export function optimizeWithLocksByMatrix(
  waypoints: RouteNode[],
  fixedStart: boolean,
  fixedEnd: boolean,
  lockedWaypointIds: Set<string>,
  getCost: (fromMatrixIndex: number, toMatrixIndex: number) => number
): RouteNode[] {
  if (waypoints.length < 3) return waypoints;
  const effectiveLocked = new Set<string>(lockedWaypointIds);
  if (fixedStart && waypoints[0]?.id) effectiveLocked.add(waypoints[0].id);
  const lastWaypoint = waypoints[waypoints.length - 1];
  if (fixedEnd && lastWaypoint?.id) effectiveLocked.add(lastWaypoint.id);
  const lockedIndexes = waypoints
    .map((wp, idx) => ({ id: wp.id, idx }))
    .filter((entry) => entry.id && effectiveLocked.has(entry.id))
    .map((entry) => entry.idx)
    .sort((a, b) => a - b);
  if (lockedIndexes.length === 0) {
    return optimizeSegmentByMatrix(waypoints, fixedStart, fixedEnd, getCost);
  }
  const result = [...waypoints];
  const bounds = [-1, ...lockedIndexes, waypoints.length];
  for (let i = 0; i < bounds.length - 1; i += 1) {
    const startBound = bounds[i];
    const endBound = bounds[i + 1];
    const unlockedStart = startBound + 1;
    const unlockedEnd = endBound - 1;
    if (unlockedStart > unlockedEnd) continue;
    const hasStartAnchor = startBound >= 0;
    const hasEndAnchor = endBound < waypoints.length;
    const segment: RouteNode[] = [];
    if (hasStartAnchor) segment.push(result[startBound]);
    for (let idx = unlockedStart; idx <= unlockedEnd; idx += 1) {
      segment.push(result[idx]);
    }
    if (hasEndAnchor) segment.push(result[endBound]);
    const optimizedSegment = optimizeSegmentByMatrix(
      segment,
      hasStartAnchor,
      hasEndAnchor,
      getCost
    );
    const interiorStart = hasStartAnchor ? 1 : 0;
    const interiorEndExclusive = hasEndAnchor
      ? optimizedSegment.length - 1
      : optimizedSegment.length;
    const optimizedInterior = optimizedSegment.slice(
      interiorStart,
      interiorEndExclusive
    );
    for (let j = 0; j < optimizedInterior.length; j += 1) {
      result[unlockedStart + j] = optimizedInterior[j];
    }
  }
  return result;
}

export function mapOptimizedIntermediateOrder(
  original: RouteNode[],
  optimized: RouteNode[],
  fixedStart: boolean,
  fixedEnd: boolean
): number[] {
  if (!fixedStart || !fixedEnd || original.length <= 2) return [];
  const originalIntermediates = original.slice(1, -1).map((wp) => wp.id || "");
  const indexById = new Map<string, number>();
  originalIntermediates.forEach((id, idx) => {
    indexById.set(id, idx);
  });
  return optimized
    .slice(1, -1)
    .map((wp) => indexById.get(wp.id || ""))
    .filter((idx): idx is number => typeof idx === "number");
}

export function optimizeWaypointOrderByDurationMatrix(input: {
  waypoints: Array<{ id: string; name: string; lat: number; lng: number }>;
  durations: (number | null)[][];
  fixedStart?: boolean;
  fixedEnd?: boolean;
  lockedWaypointIds?: string[];
}): string[] {
  const fixedStart = input.fixedStart !== false;
  const fixedEnd = input.fixedEnd !== false;
  const nodes: RouteNode[] = input.waypoints.map((wp, idx) => ({
    ...wp,
    matrixIndex: idx,
    originalIndex: idx,
  }));
  const averageFallbackSeconds = Math.max(60, 10 * 60);
  const getDurationSeconds = getLegMetric(input.durations, averageFallbackSeconds);
  const optimized = optimizeWithLocksByMatrix(
    nodes,
    fixedStart,
    fixedEnd,
    new Set(input.lockedWaypointIds || []),
    getDurationSeconds
  );
  return optimized
    .map((wp) => wp.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}
