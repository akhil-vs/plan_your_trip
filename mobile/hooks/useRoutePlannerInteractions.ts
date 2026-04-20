import { useCallback } from "react";
import type { WaypointData } from "../store/tripStore";

export function useRoutePlannerInteractions(
  sortedWaypoints: WaypointData[],
  reorderWaypoints: (waypoints: WaypointData[]) => void
) {
  const moveWaypoint = useCallback(
    (index: number, direction: -1 | 1) => {
      const next = [...sortedWaypoints];
      const target = index + direction;
      if (target < 0 || target >= next.length) return;
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      reorderWaypoints(next);
    },
    [sortedWaypoints, reorderWaypoints]
  );

  return { moveWaypoint };
}
