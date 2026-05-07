import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/api-auth";
import { canUseAdvancedOptimization } from "@/lib/subscription";
import type { OptimizerWaypoint, RouteNode } from "@/lib/optimize/travelAndOrder";
import {
  createFallbackMatrix,
  estimateLegMinutes,
  fetchMapboxMatrix,
  getLegMetric,
  haversineKm,
  mapOptimizedIntermediateOrder,
  matrixRouteCost,
  optimizeWithLocksByMatrix,
  optimizeWaypointOrderByDurationMatrix,
} from "@/lib/optimize/travelAndOrder";

export { optimizeWaypointOrderByDurationMatrix };

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
  const originalTravelSeconds = Math.round(matrixRouteCost(routeNodes, getDurationSeconds));
  const optimizedTravelSeconds = Math.round(matrixRouteCost(refinedNodes, getDurationSeconds));
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
      const prevWaypointInDay =
        prevInDayIndex === null ? null : optimized[prevInDayIndex];
      let legMinutes =
        prevWaypointInDay === null
          ? 0
          : Math.max(
              1,
              Math.round(
                ((prevWaypointInDay.isTransitSplit || waypoint.isTransitSplit
                  ? estimateLegMinutes(prevWaypointInDay, waypoint, travelMode) * 60
                  : getDurationSeconds(
                      routeNodes.findIndex((node) => node.id === prevWaypointInDay.id),
                      routeNodes.findIndex((node) => node.id === waypoint.id)
                    )) || 60) / 60
              )
            );
      let legMeters =
        prevWaypointInDay === null
          ? 0
          : Math.round(
              prevWaypointInDay.isTransitSplit || waypoint.isTransitSplit
                ? haversineKm(prevWaypointInDay, waypoint) * 1000
                : getDistanceMeters(
                    routeNodes.findIndex((node) => node.id === prevWaypointInDay.id),
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
