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

function nearestNeighborOrder(
  waypoints: OptimizerWaypoint[],
  fixedStart: boolean,
  fixedEnd: boolean
): OptimizerWaypoint[] {
  if (waypoints.length <= 2) return waypoints;

  const remaining = [...waypoints];
  const route: OptimizerWaypoint[] = [];
  const endWaypoint = fixedEnd ? remaining.pop() : null;

  if (fixedStart) {
    route.push(remaining.shift() as OptimizerWaypoint);
  } else {
    route.push(remaining.shift() as OptimizerWaypoint);
  }

  while (remaining.length > 0) {
    const current = route[route.length - 1];
    let nextIdx = 0;
    let best = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const dist = haversineKm(current, remaining[i]);
      if (dist < best) {
        best = dist;
        nextIdx = i;
      }
    }
    route.push(remaining.splice(nextIdx, 1)[0]);
  }

  if (endWaypoint) route.push(endWaypoint);
  return route;
}

function routeDistanceKm(route: OptimizerWaypoint[]): number {
  if (route.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < route.length - 1; i++) {
    total += haversineKm(route[i], route[i + 1]);
  }
  return total;
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

function twoOptRefine(
  route: OptimizerWaypoint[],
  fixedStart: boolean,
  fixedEnd: boolean
): OptimizerWaypoint[] {
  if (route.length < 4) return route;
  const start = fixedStart ? 1 : 0;
  const endExclusive = fixedEnd ? route.length - 1 : route.length;
  if (endExclusive - start < 3) return route;

  let improved = true;
  let bestRoute = [...route];
  let bestDistance = routeDistanceKm(bestRoute);

  while (improved) {
    improved = false;
    for (let i = start; i < endExclusive - 2; i++) {
      for (let k = i + 1; k < endExclusive - 1; k++) {
        const candidate = [...bestRoute];
        const reversed = candidate.slice(i, k + 1).reverse();
        candidate.splice(i, k - i + 1, ...reversed);
        const candidateDistance = routeDistanceKm(candidate);
        if (candidateDistance + 1e-9 < bestDistance) {
          bestRoute = candidate;
          bestDistance = candidateDistance;
          improved = true;
        }
      }
    }
  }

  return bestRoute;
}

function optimizeSegment(
  segmentWaypoints: OptimizerWaypoint[],
  fixedStart: boolean,
  fixedEnd: boolean
): OptimizerWaypoint[] {
  const originalDistance = routeDistanceKm(segmentWaypoints);
  const seed = nearestNeighborOrder(segmentWaypoints, fixedStart, fixedEnd);
  const refined = twoOptRefine(seed, fixedStart, fixedEnd);
  const optimizedDistance = routeDistanceKm(refined);
  // Keep user-entered route unless optimization gives a meaningful gain.
  const minImprovementRatio = 0.03;
  const improvementRatio =
    originalDistance > 0
      ? (originalDistance - optimizedDistance) / originalDistance
      : 0;
  return improvementRatio >= minImprovementRatio ? refined : segmentWaypoints;
}

function optimizeWithLocks(
  waypoints: OptimizerWaypoint[],
  fixedStart: boolean,
  fixedEnd: boolean,
  lockedWaypointIds: Set<string>
): OptimizerWaypoint[] {
  if (waypoints.length < 3) return waypoints;

  const effectiveLocked = new Set<string>(lockedWaypointIds);
  if (fixedStart && waypoints[0]?.id) effectiveLocked.add(waypoints[0].id);
  const lastWaypoint = waypoints[waypoints.length - 1];
  if (fixedEnd && lastWaypoint?.id) {
    effectiveLocked.add(lastWaypoint.id);
  }

  const lockedIndexes = waypoints
    .map((wp, idx) => ({ id: wp.id, idx }))
    .filter((entry) => entry.id && effectiveLocked.has(entry.id))
    .map((entry) => entry.idx);

  if (lockedIndexes.length === 0) {
    return optimizeSegment(waypoints, fixedStart, fixedEnd);
  }

  const result = [...waypoints];
  const bounds = [-1, ...lockedIndexes, waypoints.length];

  for (let i = 0; i < bounds.length - 1; i++) {
    const startBound = bounds[i];
    const endBound = bounds[i + 1];
    const unlockedStart = startBound + 1;
    const unlockedEnd = endBound - 1;
    if (unlockedStart > unlockedEnd) continue;

    const hasStartAnchor = startBound >= 0;
    const hasEndAnchor = endBound < waypoints.length;
    const segment: OptimizerWaypoint[] = [];
    if (hasStartAnchor) segment.push(result[startBound]);
    for (let idx = unlockedStart; idx <= unlockedEnd; idx++) {
      segment.push(result[idx]);
    }
    if (hasEndAnchor) segment.push(result[endBound]);

    const optimizedSegment = optimizeSegment(
      segment,
      hasStartAnchor,
      hasEndAnchor
    );

    const interiorStart = hasStartAnchor ? 1 : 0;
    const interiorEndExclusive = hasEndAnchor
      ? optimizedSegment.length - 1
      : optimizedSegment.length;
    const optimizedInterior = optimizedSegment.slice(
      interiorStart,
      interiorEndExclusive
    );

    for (let j = 0; j < optimizedInterior.length; j++) {
      result[unlockedStart + j] = optimizedInterior[j];
    }
  }

  return result;
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

  const refined = optimizeWithLocks(
    waypoints,
    fixedStart,
    fixedEnd,
    new Set(lockedWaypointIds)
  );

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
      const legMinutes = estimateLegMinutes(current, next, travelMode);
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
          : estimateLegMinutes(optimized[prevInDayIndex], waypoint, travelMode);
      let legMeters =
        prevInDayIndex === null
          ? 0
          : Math.round(haversineKm(optimized[prevInDayIndex], waypoint) * 1000);
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
          ? estimateLegMinutes(previousWaypoint, waypoint, travelMode)
          : 0;
        const carryTravelMeters = previousWaypoint
          ? Math.round(haversineKm(previousWaypoint, waypoint) * 1000)
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

  return NextResponse.json({ waypoints: optimized, days, conflicts });
}
