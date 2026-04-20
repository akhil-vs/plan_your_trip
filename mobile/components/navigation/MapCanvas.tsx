import React from "react";
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from "react-native-maps";
import { StyleSheet } from "react-native";
import type { WaypointData } from "../../store/tripStore";

interface Props {
  mapRef: React.RefObject<MapView | null>;
  region: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  mapPadding: { top: number; right: number; bottom: number; left: number };
  routeCoords: { latitude: number; longitude: number }[];
  waypoints: WaypointData[];
  onRegionChangeComplete: (region: Props["region"]) => void;
  onLongPress: (event: {
    nativeEvent: { coordinate: { latitude: number; longitude: number } };
  }) => void;
  onUserLocationChange?: (event: {
    nativeEvent: { coordinate?: { latitude: number; longitude: number } };
  }) => void;
}

export function MapCanvas({
  mapRef,
  region,
  mapPadding,
  routeCoords,
  waypoints,
  onRegionChangeComplete,
  onLongPress,
  onUserLocationChange,
}: Props) {
  return (
    <MapView
      ref={mapRef}
      provider={PROVIDER_DEFAULT}
      style={StyleSheet.absoluteFill}
      region={region}
      mapPadding={mapPadding}
      showsUserLocation
      followsUserLocation={false}
      showsMyLocationButton={false}
      onRegionChangeComplete={onRegionChangeComplete}
      onUserLocationChange={onUserLocationChange}
      onLongPress={onLongPress}
      rotateEnabled
      zoomEnabled
      pitchEnabled
      scrollEnabled
    >
      {waypoints.map((wp, index) => (
        <Marker
          key={wp.id}
          coordinate={{ latitude: wp.lat, longitude: wp.lng }}
          title={wp.name}
          description={wp.role ?? "stop"}
          pinColor={index === 0 ? "#1A73E8" : index === waypoints.length - 1 ? "#0F9D58" : "#DB4437"}
        />
      ))}
      {routeCoords.length > 1 ? (
        <>
          <Polyline
            coordinates={routeCoords}
            strokeWidth={8}
            strokeColor="rgba(26,115,232,0.25)"
            lineJoin="round"
            lineCap="round"
          />
          <Polyline
            coordinates={routeCoords}
            strokeWidth={5}
            strokeColor="#1A73E8"
            lineJoin="round"
            lineCap="round"
          />
        </>
      ) : null}
    </MapView>
  );
}
