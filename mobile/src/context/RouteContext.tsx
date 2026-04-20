import React, { createContext, useContext, useMemo, useReducer } from "react";
import { MapboxDirectionsRoute, RoutePoint, RouteWaypoint, TravelMode } from "../shared/types/route.types";

export type TripWaypointInput = {
  name: string;
  lat: number;
  lng: number;
  order: number;
};

type RouteState = {
  origin: RoutePoint | null;
  destination: RoutePoint | null;
  waypoints: RouteWaypoint[];
  travelMode: TravelMode;
  route: MapboxDirectionsRoute | null;
  isLoading: boolean;
  error: string | null;
};

type RouteAction =
  | { type: "SET_ORIGIN"; payload: RoutePoint | null }
  | { type: "SET_DESTINATION"; payload: RoutePoint | null }
  | { type: "ADD_WAYPOINT"; payload: RouteWaypoint }
  | { type: "UPDATE_WAYPOINT"; payload: RouteWaypoint }
  | { type: "REMOVE_WAYPOINT"; payload: string }
  | { type: "REORDER_WAYPOINTS"; payload: RouteWaypoint[] }
  | { type: "SET_TRAVEL_MODE"; payload: TravelMode }
  | { type: "SET_ROUTE"; payload: MapboxDirectionsRoute | null }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "LOAD_TRIP_WAYPOINTS"; payload: TripWaypointInput[] };

const initialState: RouteState = {
  origin: null,
  destination: null,
  waypoints: [],
  travelMode: "driving-traffic",
  route: null,
  isLoading: false,
  error: null,
};

function routeReducer(state: RouteState, action: RouteAction): RouteState {
  switch (action.type) {
    case "SET_ORIGIN":
      return { ...state, origin: action.payload };
    case "SET_DESTINATION":
      return { ...state, destination: action.payload };
    case "ADD_WAYPOINT":
      return state.waypoints.length >= 23 ? state : { ...state, waypoints: [...state.waypoints, action.payload] };
    case "UPDATE_WAYPOINT":
      return {
        ...state,
        waypoints: state.waypoints.map((waypoint) => (waypoint.id === action.payload.id ? action.payload : waypoint)),
      };
    case "REMOVE_WAYPOINT":
      return { ...state, waypoints: state.waypoints.filter((waypoint) => waypoint.id !== action.payload) };
    case "REORDER_WAYPOINTS":
      return { ...state, waypoints: action.payload };
    case "SET_TRAVEL_MODE":
      return { ...state, travelMode: action.payload };
    case "SET_ROUTE":
      return { ...state, route: action.payload };
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    case "LOAD_TRIP_WAYPOINTS": {
      const sorted = [...action.payload].sort((a, b) => a.order - b.order);
      if (sorted.length < 2) {
        return { ...state, error: "Itinerary needs at least two stops to build a route." };
      }
      const origin: RoutePoint = {
        name: sorted[0].name,
        coords: [sorted[0].lng, sorted[0].lat],
      };
      const destination: RoutePoint = {
        name: sorted[sorted.length - 1].name,
        coords: [sorted[sorted.length - 1].lng, sorted[sorted.length - 1].lat],
      };
      const waypoints: RouteWaypoint[] = sorted.slice(1, -1).map((w, i) => ({
        id: `trip-wpt-${w.order}-${i}`,
        name: w.name,
        coords: [w.lng, w.lat],
      }));
      return { ...state, origin, destination, waypoints, error: null };
    }
    default:
      return state;
  }
}

type RouteContextValue = {
  state: RouteState;
  dispatch: React.Dispatch<RouteAction>;
};

const RouteContext = createContext<RouteContextValue | undefined>(undefined);

export function RouteProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(routeReducer, initialState);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <RouteContext.Provider value={value}>{children}</RouteContext.Provider>;
}

export function useRouteContext() {
  const context = useContext(RouteContext);
  if (!context) {
    throw new Error("useRouteContext must be used within RouteProvider");
  }
  return context;
}
