import React from "react";
import { useRoute } from "../hooks/useRoute";

/** Keeps directions in sync whenever origin, destination, mode, or waypoints change on any screen. */
export function RouteDirectionsSync() {
  useRoute();
  return null;
}
