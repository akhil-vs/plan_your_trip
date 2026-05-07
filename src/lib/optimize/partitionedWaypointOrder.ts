import {
  createFallbackMatrix,
  fetchMapboxMatrix,
  optimizeWaypointOrderByDurationMatrix,
  type OptimizerWaypoint,
} from "@/lib/optimize/travelAndOrder";

export type PartitionWaypoint = {
  id: string;
  name: string;
  lat: number;
  lng: number;
};

/**
 * Reorders stops within each day only; day membership stays fixed.
 * Used after geographic clustering so user-selected day count is preserved.
 */
export async function reorderWaypointsWithinDayPartitions(
  waypoints: PartitionWaypoint[],
  dayIndexPerWaypoint: number[],
  travelMode: "driving" | "walking" | "cycling"
): Promise<PartitionWaypoint[]> {
  if (waypoints.length === 0) return [];
  if (waypoints.length !== dayIndexPerWaypoint.length) {
    throw new Error("dayIndexPerWaypoint length must match waypoints");
  }

  const numDays = Math.max(0, ...dayIndexPerWaypoint) + 1;
  const groups: PartitionWaypoint[][] = Array.from({ length: numDays }, () => []);

  waypoints.forEach((wp, i) => {
    const d = dayIndexPerWaypoint[i];
    if (d < 0 || d >= numDays) return;
    groups[d].push(wp);
  });

  const reorderedGroups = await Promise.all(
    groups.map(async (segment) => {
      if (segment.length <= 1) return segment;
      const asOpt: OptimizerWaypoint[] = segment.map((s) => ({
        id: s.id,
        name: s.name,
        lat: s.lat,
        lng: s.lng,
      }));
      const matrix =
        (await fetchMapboxMatrix(asOpt, travelMode)) ??
        createFallbackMatrix(asOpt, travelMode);
      const orderedIds = optimizeWaypointOrderByDurationMatrix({
        waypoints: segment,
        durations: matrix.durations,
        fixedStart: false,
        fixedEnd: false,
      });
      const byId = new Map(segment.map((w) => [w.id, w]));
      return orderedIds.map((id) => byId.get(id)).filter((w): w is PartitionWaypoint => Boolean(w));
    })
  );

  return reorderedGroups.flat();
}
