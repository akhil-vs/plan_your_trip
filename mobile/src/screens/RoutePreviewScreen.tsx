import React from "react";
import { StyleSheet, View } from "react-native";
import { AppMapView } from "../components/map/AppMapView";
import { RouteBottomSheet } from "../components/bottomsheet/RouteBottomSheet";
import { useRouteContext } from "../context/RouteContext";
import { useUserLocation } from "../hooks/useUserLocation";

export function RoutePreviewScreen() {
  const { state } = useRouteContext();
  const { hasPermission } = useUserLocation();
  const showRouteSheet = Boolean(state.origin && state.destination);

  return (
    <View style={styles.container}>
      <AppMapView hasLocationPermission={hasPermission} />
      {showRouteSheet ? <RouteBottomSheet /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
});
