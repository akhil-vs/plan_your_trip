import React, { useEffect, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import Mapbox, { Location } from "@rnmapbox/maps";
import { MAPBOX_ACCESS_TOKEN } from "@env";
import { UserLocationPuck } from "./UserLocationPuck";
import { useRouteContext } from "../../context/RouteContext";
import { RouteLayer } from "./RouteLayer";
import { WaypointMarkers } from "./WaypointMarkers";

type AppMapViewProps = {
  hasLocationPermission: boolean;
  onUserLocationUpdate?: (location: Location) => void;
};

export function AppMapView({ hasLocationPermission, onUserLocationUpdate }: AppMapViewProps) {
  const cameraRef = useRef<Mapbox.Camera>(null);
  const { state } = useRouteContext();

  useEffect(() => {
    Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN);
  }, []);

  const routeBounds = useMemo(() => {
    const coordinates = state.route?.geometry?.coordinates ?? [];
    if (!coordinates.length) {
      return null;
    }

    let minLng = coordinates[0][0];
    let maxLng = coordinates[0][0];
    let minLat = coordinates[0][1];
    let maxLat = coordinates[0][1];

    coordinates.forEach(([lng, lat]) => {
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    });

    return { ne: [maxLng, maxLat] as [number, number], sw: [minLng, minLat] as [number, number] };
  }, [state.route]);

  useEffect(() => {
    if (!routeBounds || !cameraRef.current) {
      return;
    }

    cameraRef.current.fitBounds(routeBounds.ne, routeBounds.sw, [60, 60, 60, 60], 600);
  }, [routeBounds]);

  return (
    <View style={styles.container}>
      <Mapbox.MapView
        style={styles.map}
        styleURL={Mapbox.StyleURL.Street}
        logoEnabled={false}
        compassEnabled
        onUserLocationUpdate={onUserLocationUpdate}
      >
        <Mapbox.Camera
          ref={cameraRef}
          followUserLocation={hasLocationPermission && !state.route}
          followZoomLevel={14}
          animationMode="flyTo"
          animationDuration={600}
        />
        <RouteLayer route={state.route} />
        <WaypointMarkers origin={state.origin} destination={state.destination} waypoints={state.waypoints} />
        <UserLocationPuck visible={hasLocationPermission} />
      </Mapbox.MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
});
