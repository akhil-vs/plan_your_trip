import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/api-auth";
import { canUseAdvancedOptimization } from "@/lib/subscription";

interface OptimizerWaypoint {
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

interface DayPlan {
  day: number;
  waypointIndexes: number[];
  estimatedTravelMinutes: number;
  estimatedTravelMeters: number;
}

interface OptimizeConflict {
  waypointId?: string;
  message: string;
}

interface OptimizeMeta {
  objective: "duration";
  originalTravelSeconds: number;
  optimizedTravelSeconds: number;
  optimizedIntermediateWaypointIndex: number[];
}

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}

function haversineKm(a: OptimizerWaypoint, b: OptimizerWaypoint): number {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function estimateLegMinutes(
  a: OptimizerWaypoint,
  b: OptimizerWaypoint,
  travelMode: "driving" | "walking" | "cycling"
): number {
  const speedKmPerHour =
    travelMode === "walking" ? 5 : travelMode === "cycling" ? 18 : 60;
  const hours = haversineKm(a, b) / speedKmPerHour;
  return Math.max(1, Math.round(hours * 60));
}

type MatrixPayload = {
  durations: (number | null)[][];
  distances: (number | null)[][];
};

function formatCoordinatesForMatrix(waypoints: OptimizerWaypoint[]): string {
  return waypoints.map((wp) => `${wp.lng},${wp.lat}`).join(";");
}

async function fetchMapboxMatrix(
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
  const params = new URLSearchParams({
    access_token: token,
    annotations: "duration,distance",
  });
  const coordinates = formatCoordinatesForMatrix(waypoints);
  const res = await fetch(
    `https://api.mapbox.com/directions-matrix/v1/${profile}/${coordinates}?${params}`
  ).catch(() => null);
  if (!res || !res.ok) return null;
  const data = (await res.json().catch(() => null)) as
    | {
        durations?: (number | null)[][];
        distances?: (number | null)[][];
      }
    | null;
  if (!data?.durations || !data?.distances) return null;
  return { durations: data.durations, distances: data.distances };
}

function createFallbackMatrix(
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

function getLegMetric(
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

type RouteNode = OptimizerWaypoint & {
  matrixIndex: number;
  originalIndex: number;
};

function routeCost(
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
  let bestCost = routeCost(bestRoute, getCost);
  while (improved) {
    improved = false;
    for (let i = start; i < endExclusive - 2; i += 1) {
      for (let k = i + 1; k < endExclusive - 1; k += 1) {
        const candidate = [...bestRoute];
        const reversed = candidate.slice(i, k + 1).reverse();
        candidate.splice(i, k - i + 1, ...reversed);
        const candidateCost = routeCost(candidate, getCost);
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
          base +
          getCost(interior[last].matrixIndex, interior[next].matrixIndex);
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
    const originalCost = routeCost(segment, getCost);
    const refinedCost = routeCost(refined, getCost);
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

function optimizeWithLocksByMatrix(
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

function mapOptimizedIntermediateOrder(
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
  return optimized.map((wp) => wp.id);
}

function interpolateWaypoint(
  from: OptimizerWaypoint,
  to: OptimizerWaypoint,
  ratio: number
): Pick<OptimizerWaypoint, "lat" | "lng"> {
  return {
    lat: from.lat + (to.lat - from.lat) * ratio,
    lng: from.lng + (to.lng - from.lng) * ratio,
  };
}

export async function POST(req: NextRequest) {
  const authUser = await getApiUser(req);
  const advancedOptimizationEnabled = canUseAdvancedOptimization(
    authUser?.plan || "FREE"
  );
  const body = await req.json().catch(() => null);
  const rawWaypoints = (body?.waypoints || []) as OptimizerWaypoint[];
  // Transit split points are synthetic output of optimization; exclude them
  // from the next optimization input to avoid recursive splitting/id collisions.
  const waypoints = rawWaypoints.filter((wp) => !wp.isTransitSplit);
  const fixedStart = body?.fixedStart !== false;
  const fixedEnd = body?.fixedEnd !== false;
  const travelMode = (advancedOptimizationEnabled
    ? body?.travelMode || "driving"
    : "driving") as
    | "driving"
    | "walking"
    | "cycling";
  const dayStartMinutes =
    typeof body?.dayStartMinutes === "number" &&
    Number.isFinite(body.dayStartMinutes) &&
    body.dayStartMinutes >= 0 &&
    body.dayStartMinutes <= 23 * 60 + 59
      ? Math.round(body.dayStartMinutes)
      : 9 * 60;
  const dayEndMinutes =
    typeof body?.dayEndMinutes === "number" &&
    Number.isFinite(body.dayEndMinutes) &&
    body.dayEndMinutes >= 0 &&
    body.dayEndMinutes <= 24 * 60
      ? Math.round(body.dayEndMinutes)
      : 20 * 60;
  const safeDayEndMinutes = Math.max(dayStartMinutes + 30, dayEndMinutes);
  const visitMinutesByWaypointId =
    advancedOptimizationEnabled &&
    body?.visitMinutesByWaypointId && typeof body.visitMinutesByWaypointId === "object"
      ? (body.visitMinutesByWaypointId as Record<string, number>)
      : {};
  const defaultVisitMinutes =
    typeof body?.defaultVisitMinutes === "number" &&
    Number.isFinite(body.defaultVisitMinutes) &&
    body.defaultVisitMinutes > 0
      ? Math.max(5, Math.round(body.defaultVisitMinutes))
      : 60;
  const timeWindowsByWaypointId =
    advancedOptimizationEnabled &&
    body?.timeWindowsByWaypointId && typeof body.timeWindowsByWaypointId === "object"
      ? (body.timeWindowsByWaypointId as Record<
          string,
          { openMinutes?: number; closeMinutes?: number }
        >)
      : {};
  const lockedWaypointIds = advancedOptimizationEnabled && Array.isArray(body?.lockedWaypointIds)
    ? (body.lockedWaypointIds as string[]).filter(
        (id) => typeof id === "string" && id.length > 0
      )
    : [];
  const autoSplitLongTransfers = body?.autoSplitLongTransfers !== false;

  if (!Array.isArray(waypoints) || waypoints.length < 2) {
    return NextResponse.json(
      { error: "At least 2 waypoints are required" },
      { status: 400 }
    );
  }

  const routeNodes: RouteNode[] = waypoints.map((wp, idx) => ({
    ...wp,
    matrixIndex: idx,
    originalIndex: idx,
  }));
  const matrix = (await fetchMapboxMatrix(routeNodes, travelMode)) || createFallbackMatrix(routeNodes, travelMode);
  const averageFallbackSeconds = Math.max(
    60,
    Math.round(
      routeNodes.length > 1
        ? routeNodes
            .slice(0, -1)
            .reduce(
              (sum, node, idx) =>
                sum + estimateLegMinutes(node, routeNodes[idx + 1], travelMode) * 60,
              0
            ) / (routeNodes.length - 1)
        : 600
    )
  );
  const averageFallbackMeters = Math.max(
    1000,
    Math.round(
      routeNodes.length > 1
        ? routeNodes
            .slice(0, -1)
            .reduce(
              (sum, node, idx) => sum + Math.round(haversineKm(node, routeNodes[idx + 1]) * 1000),
              0
            ) / (routeNodes.length - 1)
        : 10000
    )
  );
  const getDurationSeconds = getLegMetric(matrix.durations, averageFallbackSeconds);
  const getDistanceMeters = getLegMetric(matrix.distances, averageFallbackMeters);
  const refinedNodes = optimizeWithLocksByMatrix(
    routeNodes,
    fixedStart,
    fixedEnd,
    new Set(lockedWaypointIds),
    getDurationSeconds
  );
  const refined = refinedNodes.map((node) => ({
    id: node.id,
    name: node.name,
    lat: node.lat,
    lng: node.lng,
    order: node.order,
    isTransitSplit: node.isTransitSplit,
    visitMinutes: node.visitMinutes,
    openMinutes: node.openMinutes,
    closeMinutes: node.closeMinutes,
  }));
  const originalTravelSeconds = Math.round(routeCost(routeNodes, getDurationSeconds));
  const optimizedTravelSeconds = Math.round(routeCost(refinedNodes, getDurationSeconds));
  const optimizationMeta: OptimizeMeta = {
    objective: "duration",
    originalTravelSeconds,
    optimizedTravelSeconds,
    optimizedIntermediateWaypointIndex: mapOptimizedIntermediateOrder(
      routeNodes,
      refinedNodes,
      fixedStart,
      fixedEnd
    ),
  };

  const dailyWindowMinutes = Math.max(30, safeDayEndMinutes - dayStartMinutes);
  const maxLegMinutesBeforeSplit = Math.max(
    30,
    dailyWindowMinutes - Math.min(defaultVisitMinutes, 60)
  );

  // If one transfer leg is longer than what can fit in a day, add "en-route"
  // virtual waypoints so itinerary is naturally split across days.
  const splitAwareRoute: OptimizerWaypoint[] = [];
  const autoSplitConflicts: OptimizeConflict[] = [];
  const splitBatchId = Date.now().toString(36);
  if (autoSplitLongTransfers) {
    for (let i = 0; i < refined.length; i += 1) {
      const current = refined[i];
      splitAwareRoute.push(current);
      const next = refined[i + 1];
      if (!next) continue;
      const currentMatrixIdx = routeNodes.findIndex((node) => node.id === current.id);
      const nextMatrixIdx = routeNodes.findIndex((node) => node.id === next.id);
      const legSeconds =
        currentMatrixIdx >= 0 && nextMatrixIdx >= 0
          ? getDurationSeconds(currentMatrixIdx, nextMatrixIdx)
          : estimateLegMinutes(current, next, travelMode) * 60;
      const legMinutes = Math.max(1, Math.round(legSeconds / 60));
      if (legMinutes <= maxLegMinutesBeforeSplit) continue;

      const segments = Math.ceil(legMinutes / maxLegMinutesBeforeSplit);
      for (let segment = 1; segment < segments; segment += 1) {
        const ratio = segment / segments;
        const point = interpolateWaypoint(current, next, ratio);
        splitAwareRoute.push({
          id: `transit-${splitBatchId}-${current.id || i}-${next.id || i + 1}-${segment}`,
          // Keep synthetic transfer stops clearly virtual so users do not interpret
          // geocoder labels (e.g. "Wales") as intentional itinerary destinations.
          name: `Transit stop between ${current.name} and ${next.name}`,
          lat: point.lat,
          lng: point.lng,
          isTransitSplit: true,
          visitMinutes: 0,
          openMinutes: 0,
          closeMinutes: 24 * 60,
        });
      }
      autoSplitConflicts.push({
        message: `Long transfer from ${current.name} to ${next.name} was split across ${segments} travel segments.`,
      });
    }
  } else {
    splitAwareRoute.push(...refined);
  }

  const optimized = splitAwareRoute.map((wp, i) => ({
    ...wp,
    order: i,
  }));

  const getVisitMinutes = (wp: OptimizerWaypoint) => {
    if (wp.isTransitSplit) return 0;
    const raw = wp.id ? visitMinutesByWaypointId[wp.id] : undefined;
    if (raw === 0) return 0;
    if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
      return Math.max(5, Math.round(raw));
    }
    return defaultVisitMinutes;
  };

  const getWindow = (wp: OptimizerWaypoint) => {
    if (wp.isTransitSplit) {
      return { openMinutes: 0, closeMinutes: 24 * 60 };
    }
    const raw = wp.id ? timeWindowsByWaypointId[wp.id] : undefined;
    const openMinutes =
      typeof raw?.openMinutes === "number" && Number.isFinite(raw.openMinutes)
        ? Math.max(0, Math.round(raw.openMinutes))
        : 0;
    const closeMinutes =
      typeof raw?.closeMinutes === "number" && Number.isFinite(raw.closeMinutes)
        ? Math.min(24 * 60, Math.round(raw.closeMinutes))
        : 24 * 60;
    return {
      openMinutes: Math.min(openMinutes, closeMinutes),
      closeMinutes: Math.max(closeMinutes, openMinutes),
    };
  };

  const canFitWaypointInDay = (
    waypoint: OptimizerWaypoint,
    arrivalMinutes: number,
    dayStart: number,
    dayEnd: number
  ) => {
    const visitMinutes = getVisitMinutes(waypoint);
    const { openMinutes, closeMinutes } = getWindow(waypoint);
    const windowStart = Math.max(dayStart, openMinutes);
    const windowEnd = Math.min(dayEnd, closeMinutes);
    const visitStart = Math.max(arrivalMinutes, windowStart);
    const visitEnd = visitStart + visitMinutes;
    return {
      fits: visitEnd <= windowEnd,
      visitStart,
      visitEnd,
      windowStart,
      windowEnd,
      visitMinutes,
    };
  };

  const days: DayPlan[] = [];
  const conflicts: OptimizeConflict[] = [...autoSplitConflicts];

  if (optimized.length > 0) {
    let currentDay = 1;
    let currentIndexes: number[] = [];
    let currentTravelMinutes = 0;
    let currentTravelMeters = 0;
    let currentClockMinutes = dayStartMinutes;

    for (let i = 0; i < optimized.length; i++) {
      const waypoint = optimized[i];
      let prevInDayIndex =
        currentIndexes.length > 0 ? currentIndexes[currentIndexes.length - 1] : null;
      let legMinutes =
        prevInDayIndex === null
          ? 0
          : Math.max(
              1,
              Math.round(
                ((optimized[prevInDayIndex].isTransitSplit || waypoint.isTransitSplit
                  ? estimateLegMinutes(optimized[prevInDayIndex], waypoint, travelMode) * 60
                  : getDurationSeconds(
                      routeNodes.findIndex(
                        (node) => node.id === optimized[prevInDayIndex].id
                      ),
                      routeNodes.findIndex((node) => node.id === waypoint.id)
                    )) || 60) / 60
              )
            );
      let legMeters =
        prevInDayIndex === null
          ? 0
          : Math.round(
              optimized[prevInDayIndex].isTransitSplit || waypoint.isTransitSplit
                ? haversineKm(optimized[prevInDayIndex], waypoint) * 1000
                : getDistanceMeters(
                    routeNodes.findIndex(
                      (node) => node.id === optimized[prevInDayIndex].id
                    ),
                    routeNodes.findIndex((node) => node.id === waypoint.id)
                  )
            );
      let projectedTravelMinutes = currentTravelMinutes + legMinutes;
      let projectedTravelMeters = currentTravelMeters + legMeters;
      let projectedArrival = currentClockMinutes + legMinutes;
      let fitCurrent = canFitWaypointInDay(
        waypoint,
        projectedArrival,
        dayStartMinutes,
        safeDayEndMinutes
      );
      if (currentIndexes.length > 0 && !fitCurrent.fits) {
        days.push({
          day: currentDay,
          waypointIndexes: currentIndexes,
          estimatedTravelMinutes: currentTravelMinutes,
          estimatedTravelMeters: currentTravelMeters,
        });

        currentDay += 1;
        currentIndexes = [];
        currentTravelMinutes = 0;
        currentTravelMeters = 0;
        currentClockMinutes = dayStartMinutes;
        const previousWaypoint = optimized[i - 1];
        const carryTravelMinutes = previousWaypoint
          ? Math.max(
              1,
              Math.round(
                ((previousWaypoint.isTransitSplit || waypoint.isTransitSplit
                  ? estimateLegMinutes(previousWaypoint, waypoint, travelMode) * 60
                  : getDurationSeconds(
                      routeNodes.findIndex((node) => node.id === previousWaypoint.id),
                      routeNodes.findIndex((node) => node.id === waypoint.id)
                    )) || 60) / 60
              )
            )
          : 0;
        const carryTravelMeters = previousWaypoint
          ? Math.round(
              previousWaypoint.isTransitSplit || waypoint.isTransitSplit
                ? haversineKm(previousWaypoint, waypoint) * 1000
                : getDistanceMeters(
                    routeNodes.findIndex((node) => node.id === previousWaypoint.id),
                    routeNodes.findIndex((node) => node.id === waypoint.id)
                  )
            )
          : 0;
        prevInDayIndex = null;
        legMinutes = carryTravelMinutes;
        legMeters = carryTravelMeters;
        projectedTravelMinutes = carryTravelMinutes;
        projectedTravelMeters = carryTravelMeters;
        projectedArrival = currentClockMinutes + carryTravelMinutes;
        fitCurrent = canFitWaypointInDay(
          waypoint,
          projectedArrival,
          dayStartMinutes,
          safeDayEndMinutes
        );
      }

      if (!fitCurrent.fits) {
        conflicts.push({
          waypointId: waypoint.id,
          message: `${waypoint.name} cannot fit within the configured day/opening window`,
        });
      }
      currentIndexes.push(i);
      currentTravelMinutes = projectedTravelMinutes;
      currentTravelMeters = projectedTravelMeters;
      currentClockMinutes = Math.max(projectedArrival, fitCurrent.visitStart);
      currentClockMinutes += fitCurrent.visitMinutes;
    }

    if (currentIndexes.length > 0) {
      days.push({
        day: currentDay,
        waypointIndexes: currentIndexes,
        estimatedTravelMinutes: currentTravelMinutes,
        estimatedTravelMeters: currentTravelMeters,
      });
    }
  }

  return NextResponse.json({ waypoints: optimized, days, conflicts, optimization: optimizationMeta });
}
