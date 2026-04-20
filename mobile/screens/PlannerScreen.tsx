import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSharedValue } from "react-native-reanimated";
import MapView from "react-native-maps";
import { routeNames } from "../constants/routes";
import type { RootStackParamList } from "../navigation/types";
import { useMapStore } from "../store/mapStore";
import {
  MAX_INTERMEDIATE_STOPS,
  type TransportMode,
  type WaypointData,
  useTripStore,
} from "../store/tripStore";
import { searchPlaces, retrievePlace, reverseGeocodeName, type PlaceSuggestion } from "../services/places";
import { computeRoutePlan } from "../services/routeEngine";
import { colors } from "../constants/theme";
import { fetchTrip } from "../services/trips";
import { MapCanvas } from "../components/navigation/MapCanvas";
import { FloatingSearchBar } from "../components/navigation/FloatingSearchBar";
import { PlannerBottomSheet } from "../components/navigation/PlannerBottomSheet";
import { SearchPanel } from "../components/navigation/SearchPanel";
import { RoutePlannerStack } from "../components/navigation/RoutePlannerStack";
import { RoutePreviewPanel } from "../components/navigation/RoutePreviewPanel";
import { TransportModeChips } from "../components/navigation/TransportModeChips";
import { MapFloatingControls } from "../components/navigation/MapFloatingControls";
import { usePlannerBottomSheet } from "../hooks/usePlannerBottomSheet";
import { useRoutePlannerInteractions } from "../hooks/useRoutePlannerInteractions";
import { useNavigationAnimations } from "../hooks/useNavigationAnimations";

type Props = NativeStackScreenProps<RootStackParamList, typeof routeNames.PlannerTrip>;
type PlannerState = "search" | "route" | "navigation";

function normalizeRouteRoles(points: WaypointData[]): WaypointData[] {
  if (!points.length) return [];
  return points.map((point, index) => ({
    ...point,
    role: index === 0 ? "start" : index === points.length - 1 ? "destination" : "stop",
    order: index,
  }));
}

function hasSameWaypointOrder(a: WaypointData[], b: WaypointData[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].id !== b[i].id) return false;
  }
  return true;
}

export function PlannerScreen({ route }: Props) {
  const { tripId } = route.params;
  const mapRef = useRef<MapView>(null);
  const animatedSnap = useSharedValue(0);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceSuggestion[]>([]);
  const [plannerState, setPlannerState] = useState<PlannerState>("search");
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(
    null
  );

  const waypoints = useTripStore((s) => s.waypoints);
  const setTripId = useTripStore((s) => s.setTripId);
  const setTripName = useTripStore((s) => s.setTripName);
  const resetTrip = useTripStore((s) => s.resetTrip);
  const routeInfo = useTripStore((s) => s.route);
  const transportMode = useTripStore((s) => s.transportMode);
  const routePreviewByMode = useTripStore((s) => s.routePreviewByMode);
  const setRoute = useTripStore((s) => s.setRoute);
  const setTransportMode = useTripStore((s) => s.setTransportMode);
  const setRoutePreviewMetric = useTripStore((s) => s.setRoutePreviewMetric);
  const reorderWaypoints = useTripStore((s) => s.reorderWaypoints);
  const updateWaypoint = useTripStore((s) => s.updateWaypoint);

  const latitude = useMapStore((s) => s.latitude);
  const longitude = useMapStore((s) => s.longitude);
  const latitudeDelta = useMapStore((s) => s.latitudeDelta);
  const longitudeDelta = useMapStore((s) => s.longitudeDelta);
  const mapPadding = useMapStore((s) => s.mapPadding);
  const bottomSheetSnapIndex = useMapStore((s) => s.bottomSheetSnapIndex);
  const followUserLocation = useMapStore((s) => s.followUserLocation);
  const setRegion = useMapStore((s) => s.setRegion);
  const setMapPadding = useMapStore((s) => s.setMapPadding);
  const setBottomSheetSnapIndex = useMapStore((s) => s.setBottomSheetSnapIndex);
  const setFollowUserLocation = useMapStore((s) => s.setFollowUserLocation);

  const region = useMemo(
    () => ({
      latitude,
      longitude,
      latitudeDelta,
      longitudeDelta,
    }),
    [latitude, longitude, latitudeDelta, longitudeDelta]
  );

  const sortedWaypoints = useMemo(
    () => [...waypoints].sort((a, b) => a.order - b.order),
    [waypoints]
  );
  const stopsCount = sortedWaypoints.filter((w) => (w.role ?? "stop") === "stop").length;

  const routeCoords = useMemo(() => {
    const coords = routeInfo?.geometry?.coordinates ?? [];
    if (coords.length > 1) {
      return coords.map(([lng, lat]: [number, number]) => ({ latitude: lat, longitude: lng }));
    }
    return sortedWaypoints.map((w) => ({ latitude: w.lat, longitude: w.lng }));
  }, [routeInfo, sortedWaypoints]);

  useEffect(() => {
    let mounted = true;
    async function loadTrip() {
      try {
        const data = (await fetchTrip(tripId)) as { name: string; waypoints: WaypointData[] };
        if (!mounted) return;
        setTripId(tripId);
        setTripName(data.name ?? "");
        if (Array.isArray(data.waypoints) && data.waypoints.length) {
          reorderWaypoints(normalizeRouteRoles(data.waypoints));
          const lats = data.waypoints.map((w) => w.lat);
          const lngs = data.waypoints.map((w) => w.lng);
          setRegion({
            latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
            longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2,
            latitudeDelta: Math.max(0.05, Math.max(...lats) - Math.min(...lats)) * 1.5,
            longitudeDelta: Math.max(0.05, Math.max(...lngs) - Math.min(...lngs)) * 1.5,
          });
          setPlannerState("route");
          setBottomSheetSnapIndex(1);
        }
      } catch {
        // Keep planner usable even if trip hydration fails.
      }
    }
    void loadTrip();
    return () => {
      mounted = false;
      resetTrip();
    };
  }, [tripId, reorderWaypoints, resetTrip, setBottomSheetSnapIndex, setRegion, setTripId, setTripName]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (query.trim().length < 3) {
        setResults([]);
        return;
      }
      const next = await searchPlaces(query);
      setResults(next);
    }, 220);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    async function syncRoute() {
      const computed = await computeRoutePlan(sortedWaypoints, transportMode);
      if (cancelled) return;
      if (
        computed.optimizedWaypoints &&
        !hasSameWaypointOrder(computed.optimizedWaypoints, sortedWaypoints)
      ) {
        reorderWaypoints(normalizeRouteRoles(computed.optimizedWaypoints));
      }
      setRoute(computed.route);
      (Object.keys(computed.previewByMode) as TransportMode[]).forEach((mode) => {
        setRoutePreviewMetric(mode, computed.previewByMode[mode]);
      });
    }
    void syncRoute();
    return () => {
      cancelled = true;
    };
  }, [sortedWaypoints, transportMode, setRoute, setRoutePreviewMetric, reorderWaypoints]);

  const handlePaddingChange = useCallback(
    (paddingBottom: number) => {
      setMapPadding({ bottom: paddingBottom });
    },
    [setMapPadding]
  );
  usePlannerBottomSheet(bottomSheetSnapIndex, handlePaddingChange);
  useNavigationAnimations(plannerState === "navigation");

  async function onSelectResult(item: PlaceSuggestion) {
    const place = await retrievePlace(item.id, `mobile-${Date.now()}`);
    if (!place) return;
    const label = place.fullName || place.name;
    if (sortedWaypoints.length === 0) {
      reorderWaypoints(
        normalizeRouteRoles([
          {
            id: `start-${Date.now()}`,
            name: "Your location",
            lat: region.latitude,
            lng: region.longitude,
            order: 0,
            role: "start",
          },
          {
            id: `dest-${Date.now()}`,
            name: label,
            lat: place.lat,
            lng: place.lng,
            order: 1,
            role: "destination",
          },
        ])
      );
    } else if (sortedWaypoints.length === 1) {
      reorderWaypoints(
        normalizeRouteRoles([
          sortedWaypoints[0],
          {
            id: `dest-${Date.now()}`,
            name: label,
            lat: place.lat,
            lng: place.lng,
            order: 1,
            role: "destination",
          },
        ])
      );
    } else {
      const next = [...sortedWaypoints];
      next.splice(next.length - 1, 0, {
        id: `stop-${Date.now()}`,
        name: label,
        lat: place.lat,
        lng: place.lng,
        order: 0,
        role: "stop",
      });
      reorderWaypoints(normalizeRouteRoles(next));
    }
    setPlannerState("route");
    setBottomSheetSnapIndex(1);
    setQuery("");
    setResults([]);
  }

  async function onMapLongPress(e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    Alert.alert("Add Stop Here", "Add this point as a route stop?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Add Stop",
        onPress: async () => {
          const name = await reverseGeocodeName(latitude, longitude);
          const next = [...sortedWaypoints];
          if (next.length < 2) {
            next.push({
              id: `start-${Date.now()}`,
              name: "Your location",
              lat: region.latitude,
              lng: region.longitude,
              order: 0,
              role: "start",
            });
            next.push({
              id: `dest-${Date.now()}`,
              name,
              lat: latitude,
              lng: longitude,
              order: 1,
              role: "destination",
            });
          } else {
            next.splice(next.length - 1, 0, {
              id: `stop-${Date.now()}`,
              name,
              lat: latitude,
              lng: longitude,
              order: 0,
              role: "stop",
            });
          }
          reorderWaypoints(normalizeRouteRoles(next));
          setPlannerState("route");
        },
      },
    ]);
  }

  const { moveWaypoint } = useRoutePlannerInteractions(sortedWaypoints, reorderWaypoints);

  const activePreview = routePreviewByMode[transportMode] ?? { etaMinutes: 0, distanceKm: 0 };

  return (
    <GestureHandlerRootView style={styles.root}>
      <View style={styles.root}>
        <MapCanvas
          mapRef={mapRef}
          region={region}
          mapPadding={mapPadding}
          routeCoords={routeCoords}
          waypoints={sortedWaypoints}
          onRegionChangeComplete={(nextRegion) => {
            setRegion(nextRegion);
            if (followUserLocation) {
              const hasUser =
                userLocation &&
                Math.abs(nextRegion.latitude - userLocation.latitude) < 0.0004 &&
                Math.abs(nextRegion.longitude - userLocation.longitude) < 0.0004;
              if (!hasUser) setFollowUserLocation(false);
            }
          }}
          onUserLocationChange={(event) => {
            const coord = event.nativeEvent.coordinate;
            if (!coord) return;
            setUserLocation(coord);
            if (!followUserLocation) return;
            const nextRegion = {
              latitude: coord.latitude,
              longitude: coord.longitude,
              latitudeDelta: region.latitudeDelta,
              longitudeDelta: region.longitudeDelta,
            };
            setRegion(nextRegion);
            mapRef.current?.animateToRegion(nextRegion, 350);
          }}
          onLongPress={onMapLongPress}
        />

        <SafeAreaView style={styles.topOverlay} pointerEvents="box-none">
          <FloatingSearchBar
            value={query}
            onPress={() => {
              setPlannerState("search");
              setBottomSheetSnapIndex(2);
            }}
            onVoicePress={() => {
              Alert.alert("Voice search", "Voice input is coming soon.");
            }}
          />
        </SafeAreaView>

        <MapFloatingControls
          following={followUserLocation}
          onToggleFollow={() => setFollowUserLocation(!followUserLocation)}
          onRecenter={() => {
            const target = userLocation
              ? {
                  latitude: userLocation.latitude,
                  longitude: userLocation.longitude,
                  latitudeDelta: region.latitudeDelta,
                  longitudeDelta: region.longitudeDelta,
                }
              : region;
            setFollowUserLocation(true);
            setRegion(target);
            mapRef.current?.animateToRegion(target, 350);
          }}
        />

        <PlannerBottomSheet
          snapIndex={bottomSheetSnapIndex}
          setSnapIndex={setBottomSheetSnapIndex}
          animatedSnap={animatedSnap}
        >
          {plannerState === "search" ? (
            <SearchPanel
              query={query}
              autoFocus={plannerState === "search"}
              onChangeQuery={setQuery}
              results={results}
              onSelectResult={onSelectResult}
            />
          ) : (
            <View style={styles.sheetBody}>
              <RoutePreviewPanel
                etaMinutes={activePreview.etaMinutes}
                distanceKm={activePreview.distanceKm}
                stopsCount={stopsCount}
              />
              <TransportModeChips
                mode={transportMode}
                previewByMode={routePreviewByMode}
                onChangeMode={setTransportMode}
              />
              <RoutePlannerStack
                waypoints={sortedWaypoints}
                canAddStop={stopsCount < MAX_INTERMEDIATE_STOPS}
                onAddStop={() => {
                  const next = [...sortedWaypoints];
                  if (next.length < 2) return;
                  next.splice(next.length - 1, 0, {
                    id: `stop-${Date.now()}`,
                    name: "New stop",
                    lat: region.latitude + 0.01,
                    lng: region.longitude + 0.01,
                    order: 0,
                    role: "stop",
                  });
                  reorderWaypoints(normalizeRouteRoles(next));
                }}
                onEditStopName={(id, name) => updateWaypoint(id, { name })}
                onRemoveStop={(id) => {
                  const next = sortedWaypoints.filter((point) => point.id !== id);
                  reorderWaypoints(normalizeRouteRoles(next));
                }}
                onMoveStopUp={(index) => {
                  if (index <= 1) return;
                  moveWaypoint(index, -1);
                }}
                onMoveStopDown={(index) => {
                  if (index >= sortedWaypoints.length - 2) return;
                  moveWaypoint(index, 1);
                }}
              />
              <Pressable
                style={styles.navButton}
                onPress={() =>
                  setPlannerState((prev) => (prev === "navigation" ? "route" : "navigation"))
                }
              >
                <Text style={styles.navButtonText}>
                  {plannerState === "navigation" ? "Exit navigation mode" : "Start navigation mode"}
                </Text>
              </Pressable>
              {plannerState === "navigation" ? (
                <View style={styles.navigationCard}>
                  <Text style={styles.navigationTitle}>Navigation active</Text>
                  <Text style={styles.navigationSub}>
                    Following your location with live route preview.
                  </Text>
                </View>
              ) : null}
            </View>
          )}
        </PlannerBottomSheet>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  topOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    zIndex: 5,
  },
  sheetBody: { paddingHorizontal: 16, gap: 12, flex: 1 },
  navButton: {
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  navButtonText: { color: "#fff", fontWeight: "700" },
  navigationCard: {
    borderRadius: 14,
    padding: 12,
    backgroundColor: "#E8F0FE",
    borderWidth: 1,
    borderColor: colors.primary,
  },
  navigationTitle: { color: colors.primary, fontWeight: "700", marginBottom: 4 },
  navigationSub: { color: colors.textSecondary, fontSize: 13 },
});
