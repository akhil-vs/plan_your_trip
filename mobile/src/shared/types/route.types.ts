import { LngLat } from "./place.types";

export type TravelMode = "driving-traffic" | "walking" | "cycling";

export type RoutePoint = {
  coords: LngLat;
  name: string;
};

export type RouteWaypoint = RoutePoint & {
  id: string;
};

export type RouteStep = {
  distance: number;
  duration: number;
  instruction: string;
};

export type RouteGeometry = {
  type: "LineString";
  coordinates: LngLat[];
};

export type MapboxDirectionsRoute = {
  distance: number;
  duration: number;
  geometry: RouteGeometry;
  legs?: Array<{
    steps?: Array<{
      distance: number;
      duration: number;
      maneuver?: { instruction?: string };
    }>;
  }>;
};

export type MapboxDirectionsResponse = {
  routes: MapboxDirectionsRoute[];
};

export type SavedRoute = {
  id: string;
  name: string;
  distance: number;
  duration: number;
  createdAt: string;
};
