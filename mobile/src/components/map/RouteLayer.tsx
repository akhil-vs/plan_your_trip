import React from "react";
import Mapbox from "@rnmapbox/maps";
import { MapboxDirectionsRoute } from "../../shared/types/route.types";

type RouteLayerProps = {
  route: MapboxDirectionsRoute | null;
};

export function RouteLayer({ route }: RouteLayerProps) {
  if (!route?.geometry?.coordinates?.length) {
    return null;
  }

  const shape = {
    type: "Feature",
    geometry: route.geometry,
    properties: {},
  } as const;

  return (
    <Mapbox.ShapeSource id="route-source" shape={shape}>
      <Mapbox.LineLayer
        id="route-main-line"
        style={{
          lineColor: "#1A73E8",
          lineWidth: 5,
          lineCap: "round",
          lineJoin: "round",
        }}
      />
    </Mapbox.ShapeSource>
  );
}
