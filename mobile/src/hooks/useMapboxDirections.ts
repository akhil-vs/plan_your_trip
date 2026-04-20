import { useCallback } from "react";
import { useRouteContext } from "../context/RouteContext";
import { getDirections } from "../shared/api/mapbox";
import { LngLat } from "../shared/types/place.types";

export function useMapboxDirections() {
  const { dispatch, state } = useRouteContext();

  const fetchDirections = useCallback(
    async (coords: LngLat[]) => {
      dispatch({ type: "SET_LOADING", payload: true });
      try {
        const data = await getDirections(coords, state.travelMode);
        const primaryRoute = data.routes[0] ?? null;
        dispatch({ type: "SET_ROUTE", payload: primaryRoute });
        dispatch({ type: "SET_ERROR", payload: null });
      } catch (_error) {
        dispatch({ type: "SET_ROUTE", payload: null });
        dispatch({ type: "SET_ERROR", payload: "Unable to fetch route directions." });
      } finally {
        dispatch({ type: "SET_LOADING", payload: false });
      }
    },
    [dispatch, state.travelMode],
  );

  return { fetchDirections };
}
