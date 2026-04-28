import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, AppState, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Mapbox from "@rnmapbox/maps";
import DraggableFlatList, { type RenderItemParams } from "react-native-draggable-flatlist";
import { buildTripUpdateBody } from "@/lib/trip-payload";
import { api } from "@/services/api";
import type { LocationSearchResult, Trip, Waypoint } from "@/types/domain";
import { lngLatBoundsFromCoordinates } from "@/utils/map-bounds";
import { mapStyles, mapUiTokens, type MapStyleId } from "./map-tokens";
import { CHIP_DEFINITIONS, type ChipType } from "./poi-search-model";
import { usePOISearchViewModel } from "./poi-search-view-model";
import { haversineMeters as geoDistanceMeters } from "./poi-search-route-utils";

type Props = { tripId: string };

const FALLBACK_COORDINATE: [number, number] = [77.5946, 12.9716];

const toCoordinatesParam = (waypoints: Waypoint[]) =>
  waypoints.map((w) => `${w.lng},${w.lat}`).join(";");
const CATEGORY_OPTIONS = (Object.keys(CHIP_DEFINITIONS) as ChipType[]).map((key) => ({
  key,
  ...CHIP_DEFINITIONS[key],
}));

const IMPERIAL_REGIONS = new Set(["US", "LR", "MM", "GB"]);

const regionFromLocale = (locale: string) => {
  const normalized = locale.replace("_", "-");
  const parts = normalized.split("-");
  for (const part of parts) {
    if (/^[A-Z]{2}$/.test(part.toUpperCase())) return part.toUpperCase();
  }
  return "";
};

const usesImperialDistance = () => {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale || "";
    const region = regionFromLocale(locale);
    return IMPERIAL_REGIONS.has(region);
  } catch {
    return false;
  }
};

const formatDurationReadable = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0m";
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
};

const formatDistanceReadable = (meters: number, imperial: boolean) => {
  if (!Number.isFinite(meters) || meters <= 0) return imperial ? "0 mi" : "0 km";
  if (imperial) {
    const miles = meters / 1609.344;
    if (miles < 10) return `${miles.toFixed(1)} mi`;
    return `${Math.round(miles)} mi`;
  }
  const km = meters / 1000;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
};
const formatNearbyDistance = (meters: number, imperial: boolean) => {
  if (!Number.isFinite(meters) || meters < 0) return "";
  if (imperial) {
    const mi = meters / 1609.344;
    if (mi < 0.2) return `${Math.round(meters)} m`;
    return `${mi.toFixed(mi < 10 ? 1 : 0)} mi`;
  }
  if (meters < 1000) return `${Math.round(meters)} m`;
  const km = meters / 1000;
  return `${km.toFixed(km < 10 ? 1 : 0)} km`;
};

const toLngLat = (location: unknown): [number, number] | null => {
  const coords = (location as { coords?: { longitude?: number; latitude?: number } } | null)?.coords;
  if (!coords) return null;
  const { longitude, latitude } = coords;
  if (typeof longitude !== "number" || typeof latitude !== "number") return null;
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
  return [longitude, latitude];
};

export function TripPlannerScreen({ tripId }: Props) {
  const sheetRef = useRef<BottomSheet>(null);
  const cameraRef = useRef<React.ComponentRef<typeof Mapbox.Camera>>(null);
  const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(null);
  const [styleId, setStyleId] = useState<MapStyleId>("light");
  const [pickMode, setPickMode] = useState(false);
  const [queued, setQueued] = useState<LocationSearchResult[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [myLocationFocused, setMyLocationFocused] = useState(false);
  const [poiSearchText, setPoiSearchText] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState<LocationSearchResult[]>([]);
  const [bannerListMode, setBannerListMode] = useState<"SUGGESTIONS" | "POIS">("POIS");
  const [notice, setNotice] = useState<{ type: "success" | "info" | "error"; text: string } | null>(
    null
  );
  const poiVM = usePOISearchViewModel();
  const [poiDetailExpanded, setPoiDetailExpanded] = useState(false);
  const lastNearbyMapCenterRef = useRef<[number, number] | null>(null);
  const mapMoveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressCameraEventsUntilRef = useRef(0);
  const lastCameraTriggeredRefreshAtRef = useRef(0);
  const suggestionRequestIdRef = useRef(0);

  const runProgrammaticCameraMove = (fn: () => void, suppressMs = 1200) => {
    suppressCameraEventsUntilRef.current = Date.now() + suppressMs;
    fn();
  };

  const { data: trip, refetch } = useQuery({
    queryKey: ["trip", tripId],
    queryFn: () => api.trip(tripId),
  });

  const waypoints = useMemo(() => trip?.waypoints ?? [], [trip?.waypoints]);
  const coordinatesParam = useMemo(() => toCoordinatesParam(waypoints), [waypoints]);
  const center = useMemo<[number, number]>(() => {
    if (waypoints.length > 0) return [waypoints[0].lng, waypoints[0].lat];
    if (currentLocation) return currentLocation;
    return FALLBACK_COORDINATE;
  }, [waypoints, currentLocation]);
  const overviewZoomLevel = useMemo(() => {
    if (waypoints.length > 0) return 10;
    if (currentLocation) return 13;
    return 3;
  }, [waypoints.length, currentLocation]);

  const { data: routeSummary } = useQuery({
    queryKey: ["route", tripId, coordinatesParam],
    queryFn: () => api.directions(coordinatesParam),
    enabled: waypoints.length >= 2,
  });

  const routeCoords = routeSummary?.geometry?.coordinates as [number, number][] | undefined;
  const waypointCoords = useMemo(
    () => waypoints.map((w) => [w.lng, w.lat] as [number, number]),
    [waypoints]
  );
  const cameraBounds = useMemo(() => {
    if (routeCoords && routeCoords.length >= 2) {
      return lngLatBoundsFromCoordinates(routeCoords);
    }
    if (waypointCoords.length >= 1) {
      return lngLatBoundsFromCoordinates(waypointCoords);
    }
    return null;
  }, [routeCoords, waypointCoords]);
  const routeCenterPoint = useMemo(() => {
    if (routeCoords && routeCoords.length > 0) {
      const mid = routeCoords[Math.floor(routeCoords.length / 2)];
      return { lng: mid[0], lat: mid[1] };
    }
    if (waypoints.length > 0) return { lng: waypoints[0].lng, lat: waypoints[0].lat };
    if (currentLocation) return { lng: currentLocation[0], lat: currentLocation[1] };
    return { lng: FALLBACK_COORDINATE[0], lat: FALLBACK_COORDINATE[1] };
  }, [routeCoords, waypoints, currentLocation]);
  useEffect(() => {
    poiVM.actions.onRouteUpdated(routeCoords ?? null, waypoints.length);
  }, [routeCoords, waypoints.length]);

  useEffect(() => {
    if (!currentLocation) return;
    poiVM.actions.onLocationUpdated(currentLocation);
  }, [currentLocation]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active" && poiVM.state.activeChip) {
        poiVM.actions.refresh();
      }
    });
    return () => sub.remove();
  }, [poiVM.state.activeChip]);
  useEffect(() => {
    return () => {
      if (mapMoveDebounceRef.current) clearTimeout(mapMoveDebounceRef.current);
    };
  }, []);

  const queueToggle = (place: LocationSearchResult) => {
    setQueued((prev) => {
      const exists = prev.some((p) => p.id === place.id);
      return exists ? prev.filter((p) => p.id !== place.id) : [...prev, place];
    });
  };

  const notify = (type: "success" | "info" | "error", text: string) => {
    setNotice({ type, text });
    setTimeout(() => setNotice(null), 2600);
  };
  const clearSuggestionState = () => {
    setPoiDetailExpanded(false);
  };

  const normalizeUniqueWaypoints = (items: Waypoint[]) => {
    const normalized: Waypoint[] = [];
    const DUPLICATE_METERS = 35; // collapse points that are effectively the same place
    const toRad = (v: number) => (v * Math.PI) / 180;
    const distanceMeters = (a: Waypoint, b: Waypoint) => {
      const R = 6371000;
      const dLat = toRad(b.lat - a.lat);
      const dLng = toRad(b.lng - a.lng);
      const lat1 = toRad(a.lat);
      const lat2 = toRad(b.lat);
      const h =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
      return 2 * R * Math.asin(Math.sqrt(h));
    };

    for (const wp of items) {
      const cleanName = wp.name.trim() || `Stop ${normalized.length + 1}`;
      const duplicateById =
        wp.id && normalized.some((existing) => typeof existing.id === "string" && existing.id === wp.id);
      const duplicateByLocation = normalized.some((existing) => distanceMeters(existing, wp) <= DUPLICATE_METERS);
      if (duplicateById || duplicateByLocation) continue;
      normalized.push({
        ...wp,
        name: cleanName,
        order: normalized.length,
      });
    }
    return normalized;
  };

  const addQueuedStops = async () => {
    if (!trip || queued.length === 0) return;
    const existing = waypoints.map((w) => w.name.toLowerCase().trim());
    const uniqueQueued = queued.filter((q) => !existing.includes(q.name.toLowerCase().trim()));
    if (uniqueQueued.length === 0) {
      Alert.alert("Nothing to add", "Selected places already exist in this itinerary.");
      return;
    }
    const next: Waypoint[] = [
      ...waypoints,
      ...uniqueQueued.map((q, idx) => ({
        name: q.name,
        lat: q.lat,
        lng: q.lng,
        order: waypoints.length + idx,
      })),
    ];
    const deduped = normalizeUniqueWaypoints(next);
    if (deduped.length === waypoints.length) {
      notify("info", "No new unique stops were added.");
      return;
    }
    await api.updateTrip(tripId, buildTripUpdateBody(trip, { waypoints: deduped }));
    setQueued([]);
    void refetch();
    notify("success", `Added ${deduped.length - waypoints.length} stop${deduped.length - waypoints.length !== 1 ? "s" : ""}.`);
  };
  const addPoiToRoute = async (poi: { name: string; coordinates: [number, number] }) => {
    if (!trip) return;
    const nextWaypoint: Waypoint = {
      name: poi.name,
      lat: poi.coordinates[1],
      lng: poi.coordinates[0],
      order: waypoints.length,
    };
    await persistWaypoints([...waypoints, nextWaypoint]);
    notify("success", `Added "${poi.name}" to route.`);
  };

  const persistWaypoints = async (nextWaypoints: Waypoint[], nextDayPlans?: Trip["dayPlans"]) => {
    if (!trip) return;
    try {
      const deduped = normalizeUniqueWaypoints(nextWaypoints);
      await api.updateTrip(
        tripId,
        buildTripUpdateBody(trip, {
          waypoints: deduped,
          dayPlans: nextDayPlans,
        })
      );
      await refetch();
      if (deduped.length !== nextWaypoints.length) {
        notify("info", `Removed ${nextWaypoints.length - deduped.length} duplicate stop${nextWaypoints.length - deduped.length !== 1 ? "s" : ""}.`);
      }
    } catch (error) {
      Alert.alert("Save failed", error instanceof Error ? error.message : "Failed to save itinerary");
      notify("error", "Unable to save itinerary changes.");
    }
  };

  const dragListData = useMemo(
    () => waypoints.map((wp, idx) => ({ ...wp, __dragKey: String(wp.id ?? `${wp.name}-${idx}`) })),
    [waypoints]
  );
  const imperialDistance = useMemo(() => usesImperialDistance(), []);
  const readableDuration = useMemo(
    () => formatDurationReadable(routeSummary?.duration ?? 0),
    [routeSummary?.duration]
  );
  const readableDistance = useMemo(
    () => formatDistanceReadable(routeSummary?.distance ?? 0, imperialDistance),
    [routeSummary?.distance, imperialDistance]
  );
  const poiColor = useMemo(
    () => (poiVM.state.activeChip ? CHIP_DEFINITIONS[poiVM.state.activeChip].color : "#1A73E8"),
    [poiVM.state.activeChip]
  );
  const poiGeoJson = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: poiVM.state.poiResults.map((poi) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: poi.coordinates },
        properties: {
          mapboxId: poi.mapboxId,
          name: poi.name,
          address: poi.address,
        },
      })),
    }),
    [poiVM.state.poiResults]
  );
  const filteredPoiResults = useMemo(() => {
    const q = poiSearchText.trim().toLowerCase();
    if (!q) return poiVM.state.poiResults;
    return poiVM.state.poiResults.filter((poi) =>
      `${poi.name} ${poi.address}`.toLowerCase().includes(q)
    );
  }, [poiSearchText, poiVM.state.poiResults]);
  const suggestionKey = (item: LocationSearchResult, index: number) =>
    `${item.id || "suggestion"}:${item.lat}:${item.lng}:${index}`;
  const poiKey = (mapboxId: string, index: number) => `${mapboxId || "poi"}:${index}`;
  useEffect(() => {
    const query = poiSearchText.trim();
    if (query.length < 2) {
      suggestionRequestIdRef.current += 1;
      setSearchSuggestions([]);
      setSuggesting(false);
      setBannerListMode("POIS");
      return;
    }
    setBannerListMode("SUGGESTIONS");
    const anchor = currentLocation
      ? { lng: currentLocation[0], lat: currentLocation[1] }
      : routeCenterPoint;
    const timer = setTimeout(async () => {
      const requestId = ++suggestionRequestIdRef.current;
      setSuggesting(true);
      try {
        const results = await api.searchLocations(query, anchor, {
          limit: 8,
          // Include postcode and admin levels so postal code searches resolve properly.
          types: "poi,address,postcode,place,locality,neighborhood,district,region,country",
        });
        if (requestId !== suggestionRequestIdRef.current) return;
        setSearchSuggestions(results);
      } catch {
        // Keep previous suggestions on transient failures to avoid visual flicker.
      } finally {
        if (requestId !== suggestionRequestIdRef.current) return;
        setSuggesting(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [poiSearchText, currentLocation, routeCenterPoint]);
  const waitForFreshLocation = () =>
    new Promise<[number, number] | null>((resolve) => {
      let settled = false;
      const onUpdate = (nextLocation: unknown) => {
        const lngLat = toLngLat(nextLocation);
        if (!lngLat || settled) return;
        settled = true;
        clearTimeout(timer);
        Mapbox.locationManager.removeListener(onUpdate);
        resolve(lngLat);
      };
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        Mapbox.locationManager.removeListener(onUpdate);
        resolve(null);
      }, 8000);
      Mapbox.locationManager.addListener(onUpdate);
    });
  const resolveCurrentLocation = async () => {
    if (Platform.OS === "android") {
      try {
        const granted = await Mapbox.requestAndroidLocationPermissions();
        if (!granted) {
          Alert.alert("Location permission required", "Allow location access to use current location.");
          return null;
        }
      } catch {
        Alert.alert("Location permission failed", "Could not request location permission.");
        return null;
      }
    }
    let target = currentLocation;
    if (!target) {
      const lastKnown = await Mapbox.locationManager.getLastKnownLocation();
      target = toLngLat(lastKnown);
    }
    if (!target) {
      target = await waitForFreshLocation();
    }
    if (!target) {
      Alert.alert("Location unavailable", "Could not get GPS location yet. Try again in open sky.");
      return null;
    }
    setCurrentLocation(target);
    return target;
  };
  const focusCurrentLocation = async () => {
    const target = await resolveCurrentLocation();
    if (!target) return;
    runProgrammaticCameraMove(() => {
      cameraRef.current?.setCamera({
        centerCoordinate: target,
        zoomLevel: 13,
        animationDuration: 650,
        animationMode: "easeTo",
      });
    });
    setMyLocationFocused(true);
  };
  const focusRouteOverview = () => {
    if (cameraBounds) {
      runProgrammaticCameraMove(() => {
        cameraRef.current?.fitBounds(cameraBounds.ne, cameraBounds.sw, 56, 650);
      });
    } else {
      runProgrammaticCameraMove(() => {
        cameraRef.current?.setCamera({
          centerCoordinate: center,
          zoomLevel: overviewZoomLevel,
          animationDuration: 650,
          animationMode: "easeTo",
        });
      });
    }
    setMyLocationFocused(false);
  };
  useEffect(() => {
    if (!poiVM.state.activeChip || poiVM.state.poiResults.length === 0) return;
    const allCoords: [number, number][] = [
      ...poiVM.state.poiResults.map((poi) => poi.coordinates),
      ...(routeCoords ?? []),
    ];
    if (allCoords.length < 2) return;
    const bounds = lngLatBoundsFromCoordinates(allCoords);
    if (!bounds) return;
    runProgrammaticCameraMove(() => {
      cameraRef.current?.fitBounds(bounds.ne, bounds.sw, 68, 650);
    }, 1500);
  }, [poiVM.state.activeChip, poiVM.state.poiResults, routeCoords]);

  return (
    <View style={styles.root}>
      <Mapbox.MapView
        style={styles.map}
        styleURL={mapStyles[styleId]}
        compassEnabled
        compassViewPosition={3}
        compassViewMargins={{ x: 12, y: 270 }}
        scaleBarEnabled={false}
        logoEnabled={false}
        onCameraChanged={(event) => {
          const center = event.properties.center as [number, number] | undefined;
          if (center) {
            poiVM.actions.onMapCenterUpdated(center);
          }
          if (!center) return;
          if (Date.now() < suppressCameraEventsUntilRef.current) {
            // Keep center tracking in sync during programmatic animations
            // so we don't trigger a large delta refresh right after suppression ends.
            lastNearbyMapCenterRef.current = center;
            return;
          }
          if (poiVM.state.searchMode !== "NEARBY" || !poiVM.state.activeChip) return;
          const prev = lastNearbyMapCenterRef.current;
          if (!prev) {
            lastNearbyMapCenterRef.current = center;
            return;
          }
          const movedMeters = geoDistanceMeters(prev, center);
          if (movedMeters > 500) {
            const now = Date.now();
            if (now - lastCameraTriggeredRefreshAtRef.current < 6000) {
              lastNearbyMapCenterRef.current = center;
              return;
            }
            lastNearbyMapCenterRef.current = center;
            if (mapMoveDebounceRef.current) clearTimeout(mapMoveDebounceRef.current);
            mapMoveDebounceRef.current = setTimeout(() => {
              lastCameraTriggeredRefreshAtRef.current = Date.now();
              poiVM.actions.refresh();
            }, 700);
          }
        }}
        onPress={async (e) => {
          if (!pickMode) return;
          if (!trip) {
            Alert.alert("Still loading", "Wait for the itinerary to finish loading, then try again.");
            return;
          }
          if (e.geometry.type !== "Point") return;
          const point = e.geometry.coordinates as [number, number];
          const place = await api.reverseGeocode(point[1], point[0]);
          const nextWaypoint: Waypoint = {
            name: place.name ?? `Stop ${waypoints.length + 1}`,
            lat: point[1],
            lng: point[0],
            order: waypoints.length,
          };
          await persistWaypoints([...waypoints, nextWaypoint]);
          setPickMode(false);
          notify("success", "Stop added from map.");
        }}
      >
        <Mapbox.UserLocation
          visible
          onUpdate={(location) => {
            const coords = location.coords;
            if (coords && Number.isFinite(coords.longitude) && Number.isFinite(coords.latitude)) {
              setCurrentLocation([coords.longitude, coords.latitude]);
            }
          }}
        />
        <Mapbox.Camera
          ref={cameraRef}
          {...(cameraBounds
            ? {
                bounds: {
                  ne: cameraBounds.ne,
                  sw: cameraBounds.sw,
                  paddingTop: 72,
                  paddingBottom: 220,
                  paddingLeft: 24,
                  paddingRight: 24,
                },
                animationMode: "easeTo" as const,
                animationDuration: 650,
              }
            : {
                centerCoordinate: center,
                zoomLevel: overviewZoomLevel,
              })}
        />

        {routeSummary?.geometry ? (
          <Mapbox.ShapeSource
            id="routeSource"
            shape={{ type: "Feature", geometry: routeSummary.geometry, properties: {} }}
          >
            <Mapbox.LineLayer
              id="routeHalo"
              style={{ lineColor: mapUiTokens.route.halo, lineWidth: mapUiTokens.route.width + 3 }}
            />
            <Mapbox.LineLayer
              id="routeCore"
              style={{ lineColor: mapUiTokens.route.primary, lineWidth: mapUiTokens.route.width }}
            />
          </Mapbox.ShapeSource>
        ) : null}
        {poiVM.state.activeChip && poiVM.state.poiResults.length > 0 ? (
          <Mapbox.ShapeSource
            id="poi-results"
            shape={poiGeoJson}
            onPress={(event) => {
              const feature = event.features?.[0];
              const mapboxId = String(feature?.properties?.mapboxId ?? "");
              if (!mapboxId) return;
              const poi = poiVM.state.poiResults.find((entry) => entry.mapboxId === mapboxId);
              if (!poi) return;
              setPoiDetailExpanded(true);
              void poiVM.actions.onPOISelected(poi);
              runProgrammaticCameraMove(() => {
                cameraRef.current?.setCamera({
                  centerCoordinate: poi.coordinates,
                  zoomLevel: 14,
                  animationDuration: 450,
                  animationMode: "easeTo",
                });
              });
            }}
          >
            <Mapbox.CircleLayer
              id="poi-results-layer"
              style={{
                circleColor: poiColor,
                circleRadius: 6,
                circleStrokeColor: "#ffffff",
                circleStrokeWidth: 2,
              }}
            />
            <Mapbox.CircleLayer
              id="poi-results-selected-layer"
              filter={["==", ["get", "mapboxId"], poiVM.state.selectedPoiId ?? ""]}
              style={{
                circleColor: "#111827",
                circleRadius: 9,
                circleOpacity: 0.35,
              }}
            />
          </Mapbox.ShapeSource>
        ) : null}

        {waypoints.map((wp, index) => (
          <Mapbox.PointAnnotation
            key={`${wp.id ?? wp.name}-${index}`}
            id={`${wp.id ?? wp.name}-${index}`}
            coordinate={[wp.lng, wp.lat]}
          >
            <View
              style={[
                styles.marker,
                { width: mapUiTokens.markerSize.stop, height: mapUiTokens.markerSize.stop },
                index === 0 && styles.activeMarker,
              ]}
            />
          </Mapbox.PointAnnotation>
        ))}
      </Mapbox.MapView>

      <View
        style={[
          styles.topSearch,
          {
            maxHeight:
              sheetIndex === 0
                ? menuOpen
                  ? 480
                  : 430
                : menuOpen
                  ? 360
                  : 320,
          },
        ]}
      >
        {notice ? (
          <View
            style={[
              styles.notice,
              notice.type === "success" && styles.noticeSuccess,
              notice.type === "error" && styles.noticeError,
              notice.type === "info" && styles.noticeInfo,
            ]}
          >
            <Text style={styles.noticeText}>{notice.text}</Text>
          </View>
        ) : null}
        <View style={styles.searchWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {CATEGORY_OPTIONS.map((category) => {
              const active = poiVM.state.activeChip === category.key;
              return (
                <Pressable
                  key={category.key}
                  style={[styles.categoryChip, active && styles.categoryChipActive]}
                  onPress={() => {
                    clearSuggestionState();
                    poiVM.actions.onChipSelected(category.key);
                  }}
                >
                  <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>
                    {category.emoji} {category.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Pressable
            style={styles.menuTrigger}
            onPress={() => setMenuOpen((v) => !v)}
          >
            <Text style={styles.menuTriggerText}>⋮</Text>
          </Pressable>
        </View>
        <TextInput
          style={styles.searchInput}
          placeholder="Search places and POIs"
          value={poiSearchText}
          onChangeText={setPoiSearchText}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {(searchSuggestions.length > 0 || poiVM.state.poiResults.length > 0) ? (
          <View style={styles.modeTabs}>
            <Pressable
              style={[styles.modeTab, bannerListMode === "SUGGESTIONS" && styles.modeTabActive]}
              onPress={() => setBannerListMode("SUGGESTIONS")}
            >
              <Text style={[styles.modeTabText, bannerListMode === "SUGGESTIONS" && styles.modeTabTextActive]}>
                Suggestions
              </Text>
            </Pressable>
            <Pressable
              style={[styles.modeTab, bannerListMode === "POIS" && styles.modeTabActive]}
              onPress={() => setBannerListMode("POIS")}
            >
              <Text style={[styles.modeTabText, bannerListMode === "POIS" && styles.modeTabTextActive]}>
                POIs
              </Text>
            </Pressable>
          </View>
        ) : null}
        {suggesting ? <Text style={styles.searchHint}>Updating suggestions…</Text> : null}
        {bannerListMode === "SUGGESTIONS" &&
        poiSearchText.trim().length >= 2 &&
        searchSuggestions.length > 0 ? (
          <ScrollView style={styles.resultsList} contentContainerStyle={styles.resultsListContent}>
            {searchSuggestions.map((item, index) => (
              <View key={suggestionKey(item, index)} style={styles.searchResult}>
                <Pressable
                  style={{ flex: 1 }}
                  onPress={() => {
                    runProgrammaticCameraMove(() => {
                      cameraRef.current?.setCamera({
                        centerCoordinate: [item.lng, item.lat],
                        zoomLevel: 14,
                        animationDuration: 450,
                        animationMode: "easeTo",
                      });
                    });
                  }}
                >
                  <Text style={styles.searchTitle}>{item.name}</Text>
                  {item.fullName ? (
                    <Text style={styles.searchSubtitle} numberOfLines={1}>
                      {item.fullName}
                    </Text>
                  ) : null}
                </Pressable>
                <Pressable
                  style={styles.addToRouteBtn}
                  onPress={() => {
                    void addPoiToRoute({ name: item.name, coordinates: [item.lng, item.lat] });
                  }}
                >
                  <Text style={styles.addToRouteBtnText}>Add to route</Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>
        ) : null}
        {(routeCoords?.length ?? 0) > 1 || waypoints.length > 0 ? (
          <View style={styles.modeTabs}>
            <Pressable
              style={[styles.modeTab, poiVM.state.searchMode === "NEARBY" && styles.modeTabActive]}
              onPress={() => poiVM.actions.onModeChanged("NEARBY")}
            >
              <Text style={[styles.modeTabText, poiVM.state.searchMode === "NEARBY" && styles.modeTabTextActive]}>
                Nearby
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.modeTab,
                poiVM.state.searchMode === "ALONG_ROUTE" && styles.modeTabActive,
                !poiVM.state.isAlongRouteEnabled && styles.modeTabDisabled,
              ]}
              disabled={!poiVM.state.isAlongRouteEnabled}
              onPress={() => poiVM.actions.onModeChanged("ALONG_ROUTE")}
            >
              <Text
                style={[
                  styles.modeTabText,
                  poiVM.state.searchMode === "ALONG_ROUTE" && styles.modeTabTextActive,
                  !poiVM.state.isAlongRouteEnabled && styles.modeTabTextDisabled,
                ]}
              >
                Along Route
              </Text>
            </Pressable>
          </View>
        ) : null}
        {menuOpen ? (
          <View style={styles.submenu}>
            <Pressable
              style={styles.submenuItem}
              onPress={() => {
                setMenuOpen(false);
                router.push(`/planner/${tripId}/collaboration`);
              }}
            >
              <Text style={styles.submenuText}>Members & chat</Text>
            </Pressable>
            <Pressable
              style={styles.submenuItem}
              onPress={async () => {
                setMenuOpen(false);
                if (!trip) return;
                if (waypoints.length < 3) {
                  Alert.alert("Add more stops", "Optimization needs at least 3 stops.");
                  return;
                }
                try {
                  const result = await api.optimize({
                    waypoints,
                    fixedStart: true,
                    fixedEnd: true,
                    // Mobile UX: avoid synthetic transit-split pseudo stops.
                    autoSplitLongTransfers: false,
                  });
                  const ordered = normalizeUniqueWaypoints(
                    result.waypoints.map((wp, order) => ({ ...wp, order }))
                  );
                  const optimizedCoords = toCoordinatesParam(ordered);
                  const previewRoute = await api.directions(optimizedCoords);
                  if (!previewRoute?.geometry || previewRoute.geometry.coordinates.length < 2) {
                    notify(
                      "error",
                      "Optimize found an order but road route could not be generated. Try fewer/farther-apart stops."
                    );
                    return;
                  }
                  const dayPlans = result.days.map((d) => ({
                    day: d.day,
                    waypointIndexes: d.waypointIndexes,
                    waypointIds: [] as string[],
                    estimatedTravelMinutes: d.estimatedTravelMinutes,
                  }));
                  await persistWaypoints(ordered, dayPlans);
                  if (Array.isArray(result.conflicts) && result.conflicts.length > 0) {
                    const first = result.conflicts[0]?.message || "Some stops could not fully fit schedule constraints.";
                    notify("info", `Optimized with note: ${first}`);
                  } else {
                    notify("success", "Route optimized and updated.");
                  }
                } catch (error) {
                  const message =
                    error instanceof Error && error.message.trim()
                      ? error.message
                      : "Unable to optimize this itinerary right now.";
                  Alert.alert(
                    "Optimize failed",
                    message
                  );
                  notify("error", `Optimize failed: ${message}`);
                }
              }}
            >
              <Text style={styles.submenuText}>Optimize</Text>
            </Pressable>
            <Pressable
              style={styles.submenuItem}
              onPress={() => {
                setMenuOpen(false);
                const order: MapStyleId[] = ["light", "dark", "terrain"];
                const next = order[(order.indexOf(styleId) + 1) % order.length];
                setStyleId(next);
              }}
            >
              <Text style={styles.submenuText}>Style: {styleId}</Text>
            </Pressable>
          </View>
        ) : null}
        {poiVM.state.activeChip && poiVM.state.isLoading ? <Text style={styles.searchHint}>Searching…</Text> : null}
        {poiVM.state.error ? <Text style={styles.searchHint}>{poiVM.state.error}</Text> : null}
        {poiVM.state.activeChip && !poiVM.state.isLoading && poiVM.state.poiResults.length === 0 && !poiVM.state.error ? (
          <Text style={styles.searchHint}>
            No {CHIP_DEFINITIONS[poiVM.state.activeChip].label} found{" "}
            {poiVM.state.searchMode === "ALONG_ROUTE" ? "along this route" : "nearby"}.
          </Text>
        ) : null}
        {!poiVM.state.isLoading &&
        bannerListMode === "POIS" &&
        poiVM.state.activeChip &&
        filteredPoiResults.length > 0 ? (
          <ScrollView style={styles.resultsList} contentContainerStyle={styles.resultsListContent}>
            {filteredPoiResults.map((poi, index) => {
              const selected = poiVM.state.selectedPoiId === poi.mapboxId;
              const distanceLabel =
                poiVM.state.searchMode === "ALONG_ROUTE"
                  ? `${Math.round(poi.distanceMeters)} m from route`
                  : `${formatNearbyDistance(poi.distanceMeters, imperialDistance)} away`;
              return (
                <View key={poiKey(poi.mapboxId, index)} style={[styles.searchResult, selected && styles.searchResultSelected]}>
                  <Pressable
                    style={{ flex: 1 }}
                    onPress={() => {
                      setPoiDetailExpanded(true);
                      void poiVM.actions.onPOISelected(poi);
                runProgrammaticCameraMove(() => {
                  cameraRef.current?.setCamera({
                    centerCoordinate: poi.coordinates,
                    zoomLevel: 14,
                    animationDuration: 500,
                  });
                      });
                    }}
                  >
                    <Text style={styles.searchTitle}>{poi.name}</Text>
                    <Text style={styles.searchSubtitle} numberOfLines={1}>
                      {poi.address || "Address unavailable"}
                    </Text>
                    <Text style={styles.searchDistance}>{distanceLabel}</Text>
                  </Pressable>
                  <Pressable
                    style={styles.addToRouteBtn}
                    onPress={() => {
                      void addPoiToRoute({ name: poi.name, coordinates: poi.coordinates });
                    }}
                  >
                    <Text style={styles.addToRouteBtnText}>Add to route</Text>
                  </Pressable>
                </View>
              );
            })}
            {poiDetailExpanded && poiVM.state.selectedPoiId ? (
              <View style={styles.poiDetailCard}>
                {(() => {
                  const selected = poiVM.state.poiResults.find((poi) => poi.mapboxId === poiVM.state.selectedPoiId);
                  if (!selected) return <Text style={styles.searchHint}>Select a POI to view details.</Text>;
                  return (
                    <>
                      <Text style={styles.poiDetailTitle}>{selected.name}</Text>
                      <Text style={styles.searchSubtitle}>{selected.address}</Text>
                      {selected.fullDetails?.phone ? <Text style={styles.searchSubtitle}>Phone: {selected.fullDetails.phone}</Text> : null}
                      {selected.fullDetails?.website ? <Text style={styles.searchSubtitle}>Website: {selected.fullDetails.website}</Text> : null}
                      {selected.fullDetails?.hours?.length ? (
                        <Text style={styles.searchSubtitle} numberOfLines={3}>
                          Hours: {selected.fullDetails.hours.join(" | ")}
                        </Text>
                      ) : null}
                    </>
                  );
                })()}
              </View>
            ) : null}
          </ScrollView>
        ) : null}
        {queued.length > 0 ? (
          <View style={styles.queuedBlock}>
            {queued.map((q, idx) => (
              <View key={q.id} style={styles.queuedRow}>
                <Text style={styles.queuedName} numberOfLines={1}>
                  {idx + 1}. {q.name}
                </Text>
                <Pressable onPress={() => queueToggle(q)}>
                  <Text style={styles.removeText}>Remove</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
      </View>
      {sheetIndex === 0 ? (
        <Pressable
          style={styles.myLocationFab}
          onPress={() => {
            if (myLocationFocused) {
              focusRouteOverview();
            } else {
              void focusCurrentLocation();
            }
          }}
        >
          <Text style={styles.myLocationIcon}>⌖</Text>
        </Pressable>
      ) : null}

      <BottomSheet
        ref={sheetRef}
        snapPoints={["22%", "68%"]}
        index={0}
        enableContentPanningGesture
        onChange={(idx) => setSheetIndex(idx)}
      >
        <BottomSheetView style={styles.sheet}>
          <Text style={styles.sheetTitle}>{trip?.name ?? "Trip planner"}</Text>
          <Text style={styles.sheetMeta}>
            {waypoints.length} stops • {readableDistance} • {readableDuration}
          </Text>
          <View style={styles.row}>
            <Pressable
              style={styles.smallBtn}
              onPress={async () => {
                try {
                  const result = await api.publishTrip(tripId);
                  Alert.alert("Share link", result.shareUrl);
                } catch (error) {
                  Alert.alert("Publish failed", String(error));
                }
              }}
            >
              <Text style={styles.smallBtnText}>Publish</Text>
            </Pressable>
            <Pressable
              style={styles.smallBtn}
              onPress={async () => {
                try {
                  await api.unpublishTrip(tripId);
                  Alert.alert("Trip is now private");
                } catch (error) {
                  Alert.alert("Unpublish failed", String(error));
                }
              }}
            >
              <Text style={styles.smallBtnText}>Unpublish</Text>
            </Pressable>
          </View>
          <Text style={styles.dragHint}>Press and drag the handle to reorder stops.</Text>
          <DraggableFlatList
            data={dragListData}
            keyExtractor={(item) => item.__dragKey}
            containerStyle={styles.stopList}
            contentContainerStyle={styles.stopListContent}
            activationDistance={0}
            onDragEnd={({ data }) => {
              const normalized: Waypoint[] = data.map(({ ...item }, idx) => {
                const { __dragKey, ...wp } = item;
                void __dragKey;
                return {
                ...wp,
                order: idx,
                };
              });
              void persistWaypoints(normalized);
            }}
            renderItem={({ item, drag, isActive, getIndex }: RenderItemParams<(Waypoint & { __dragKey: string })>) => {
              const idx = getIndex() ?? 0;
              return (
                <View style={[styles.stopRow, isActive && styles.stopRowActive]}>
                  <Pressable style={styles.dragHandle} onPressIn={drag}>
                    <Text style={styles.dragHandleText}>≡</Text>
                  </Pressable>
                  <Text style={[styles.stop, styles.stopName]}>{idx + 1}. {item.name}</Text>
                  <Pressable
                    style={styles.removeStopBtn}
                    onPress={() => {
                      Alert.alert("Remove stop", `Remove \"${item.name}\" from this itinerary?`, [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Remove",
                          style: "destructive",
                          onPress: async () => {
                            const next = waypoints
                              .filter((_, i) => i !== idx)
                              .map((point, order) => ({ ...point, order }));
                            await persistWaypoints(next);
                            notify("info", "Stop removed.");
                          },
                        },
                      ]);
                    }}
                  >
                    <Text style={styles.removeStopIcon}>X</Text>
                  </Pressable>
                </View>
              );
            }}
          />
        </BottomSheetView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  map: { flex: 1 },
  topSearch: {
    position: "absolute",
    top: 56,
    left: 12,
    right: 12,
    zIndex: 50,
    gap: 8,
    backgroundColor: "rgba(219,234,254,0.46)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.35)",
    padding: 10,
    overflow: "hidden",
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  resultsList: { flexGrow: 1 },
  resultsListContent: { gap: 6, paddingBottom: 2, flexGrow: 1 },
  notice: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 2,
  },
  noticeSuccess: { backgroundColor: "#dcfce7", borderWidth: 1, borderColor: "#86efac" },
  noticeInfo: { backgroundColor: "#e0f2fe", borderWidth: 1, borderColor: "#93c5fd" },
  noticeError: { backgroundColor: "#fee2e2", borderWidth: 1, borderColor: "#fca5a5" },
  noticeText: { fontSize: 12, fontWeight: "600", color: "#1f2937" },
  marker: {
    borderRadius: 99,
    backgroundColor: "#0ea5e9",
    borderColor: "white",
    borderWidth: 2,
  },
  activeMarker: { backgroundColor: "#f97316" },
  sheet: { padding: 16, gap: 8 },
  sheetTitle: { fontSize: 18, fontWeight: "700" },
  sheetMeta: { color: "#6b7280", marginBottom: 6 },
  dragHint: { color: "#6b7280", fontSize: 12, marginBottom: 4 },
  stopList: { flexGrow: 0, minHeight: 120 },
  stopListContent: { paddingBottom: 28 },
  searchWrap: { flexDirection: "row", gap: 8, alignItems: "center" },
  modeTabs: { flexDirection: "row", gap: 8 },
  modeTab: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#fff",
  },
  modeTabActive: { borderColor: "#1d4ed8", backgroundColor: "#dbeafe" },
  modeTabDisabled: { backgroundColor: "#f1f5f9", borderColor: "#e2e8f0" },
  modeTabText: { color: "#1e293b", fontSize: 12, fontWeight: "700" },
  modeTabTextActive: { color: "#1d4ed8" },
  modeTabTextDisabled: { color: "#94a3b8" },
  categoryRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2 },
  categoryChip: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "#fff",
  },
  categoryChipActive: { borderColor: "#2563eb", backgroundColor: "#eff6ff" },
  categoryChipText: { fontSize: 12, color: "#374151", fontWeight: "600" },
  categoryChipTextActive: { color: "#1d4ed8" },
  searchInput: {
    width: "100%",
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.16)",
    borderRadius: 10,
    height: 36,
    paddingHorizontal: 10,
    paddingVertical: 0,
    backgroundColor: "rgba(191,219,254,0.22)",
    color: "#0f172a",
    fontSize: 13,
  },
  searchHint: { color: "#6b7280", fontSize: 12, marginBottom: 2 },
  scrollHint: { color: "#475569", fontSize: 11, fontWeight: "600", textAlign: "center", marginTop: 2 },
  searchSectionTitle: {
    marginTop: 0,
    marginBottom: 2,
    color: "#374151",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  searchResult: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: "#fff",
  },
  searchResultSelected: {
    borderColor: "#2563eb",
    backgroundColor: "#eff6ff",
  },
  searchTitle: { fontSize: 14, fontWeight: "600", color: "#111827" },
  searchSubtitle: { marginTop: 2, color: "#6b7280", fontSize: 12 },
  searchDistance: { marginTop: 2, color: "#475569", fontSize: 11, fontWeight: "600" },
  searchAction: { color: "#2563eb", fontWeight: "700", fontSize: 12 },
  addToRouteBtn: {
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignSelf: "center",
  },
  addToRouteBtnText: { color: "#1d4ed8", fontWeight: "700", fontSize: 12 },
  queuedBlock: { gap: 4, marginTop: 2 },
  queuedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  queuedName: { flex: 1, color: "#111827", fontSize: 13, marginRight: 8 },
  removeText: { color: "#2563eb", fontWeight: "600", fontSize: 12 },
  stop: { fontSize: 14 },
  stopName: { flex: 1 },
  stopRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 2 },
  stopRowActive: {
    backgroundColor: "#eff6ff",
    borderRadius: 10,
    paddingHorizontal: 6,
  },
  dragHandle: {
    width: 26,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  dragHandleText: { fontSize: 14, fontWeight: "700", color: "#374151" },
  removeStopBtn: {
    marginLeft: 2,
    minWidth: 30,
    height: 30,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fff1f2",
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  removeStopIcon: { color: "#b91c1c", fontWeight: "800", fontSize: 13 },
  row: { flexDirection: "row", gap: 8, alignItems: "center" },
  smallBtn: {
    borderRadius: 8,
    backgroundColor: "#2563eb",
    minHeight: 36,
    paddingHorizontal: 12,
    paddingVertical: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  smallBtnDisabled: { backgroundColor: "#93c5fd" },
  smallBtnText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  menuTrigger: {
    minWidth: 38,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
  },
  menuTriggerText: { color: "#fff", fontWeight: "700", fontSize: 17, lineHeight: 17 },
  submenu: {
    marginTop: 6,
    alignSelf: "flex-end",
    minWidth: 230,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    backgroundColor: "#fff",
    overflow: "hidden",
    shadowColor: "#0f172a",
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  submenuItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 42,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    justifyContent: "center",
  },
  submenuText: { color: "#0f172a", fontWeight: "600", fontSize: 13 },
  myLocationFab: {
    position: "absolute",
    right: 12,
    bottom: 214,
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d1d5db",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0f172a",
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3,
    zIndex: 45,
  },
  myLocationIcon: { fontSize: 16, color: "#111827", fontWeight: "700" },
  poiDetailCard: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    padding: 10,
    backgroundColor: "#f8fafc",
    gap: 4,
  },
  poiDetailTitle: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
});
