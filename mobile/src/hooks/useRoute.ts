import { useEffect } from "react";
import { useRouteContext } from "../context/RouteContext";
import { STRINGS } from "../shared/constants/strings";
import { useMapboxDirections } from "./useMapboxDirections";

export function useRoute() {
  const { state } = useRouteContext();
  const { fetchDirections } = useMapboxDirections();

  useEffect(() => {
    if (!state.origin || !state.destination) {
      return;
    }

    const validWaypoints = state.waypoints.filter(
      (waypoint) =>
        Number.isFinite(waypoint.coords[0]) &&
        Number.isFinite(waypoint.coords[1]) &&
        waypoint.name !== STRINGS.waypointPlaceholder,
    );

    const coords = [
      state.origin.coords,
      ...validWaypoints.map((waypoint) => waypoint.coords),
      state.destination.coords,
    ];

    void fetchDirections(coords);
  }, [fetchDirections, state.destination, state.origin, state.travelMode, state.waypoints]);
}
