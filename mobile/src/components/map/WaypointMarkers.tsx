import React from "react";
import { StyleSheet, View } from "react-native";
import Mapbox from "@rnmapbox/maps";
import { RoutePoint, RouteWaypoint } from "../../shared/types/route.types";

type WaypointMarkersProps = {
  origin: RoutePoint | null;
  destination: RoutePoint | null;
  waypoints: RouteWaypoint[];
};

export function WaypointMarkers({ origin, destination, waypoints }: WaypointMarkersProps) {
  return (
    <>
      {origin ? (
        <Mapbox.PointAnnotation id="origin-marker" coordinate={origin.coords}>
          <View style={styles.originMarker} />
        </Mapbox.PointAnnotation>
      ) : null}
      {waypoints.map((waypoint) => (
        <Mapbox.PointAnnotation key={waypoint.id} id={`waypoint-${waypoint.id}`} coordinate={waypoint.coords}>
          <View style={styles.waypointMarker} />
        </Mapbox.PointAnnotation>
      ))}
      {destination ? (
        <Mapbox.PointAnnotation id="destination-marker" coordinate={destination.coords}>
          <View style={styles.destinationMarker} />
        </Mapbox.PointAnnotation>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  originMarker: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#34A853",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  waypointMarker: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#1A73E8",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  destinationMarker: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#EA4335",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
});
