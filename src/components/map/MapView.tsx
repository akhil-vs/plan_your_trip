"use client";

import { useCallback, useEffect, useRef } from "react";
import Map, { NavigationControl, MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { useMapStore, getMapStyleUrl } from "@/stores/mapStore";
import { useTripStore } from "@/stores/tripStore";
import { RouteLayer } from "./RouteLayer";
import { WaypointMarkers } from "./WaypointMarkers";
import { POIMarkers } from "./POIMarkers";
import { MapStyleToggle } from "./MapStyleToggle";
import { WaypointExplorePanel } from "./WaypointExplorePanel";
import { RouteSummaryPanel } from "./RouteSummaryPanel";

interface MapViewProps {
  mapboxToken: string;
}

export function MapView({ mapboxToken }: MapViewProps) {
  const mapRef = useRef<MapRef>(null);
  const {
    viewState,
    setViewState,
    mapStyle,
    pickPointsMode,
    setPickPointsMode,
    sidebarOpen,
  } = useMapStore();
  const insertWaypointNear = useTripStore((s) => s.insertWaypointNear);
  const addWaypoint = useTripStore((s) => s.addWaypoint);
  const waypoints = useTripStore((s) => s.waypoints);

  const handleMove = useCallback(
    (evt: { viewState: typeof viewState }) => {
      setViewState(evt.viewState);
    },
    [setViewState]
  );

  const reverseGeocodeName = useCallback(
    async (lat: number, lng: number): Promise<string> => {
      try {
        const params = new URLSearchParams({
          lat: String(lat),
          lng: String(lng),
        });
        const res = await fetch(`/api/reverse-geocode?${params}`);
        if (!res.ok) throw new Error("Reverse geocode failed");
        const data = (await res.json()) as { name?: string };
        if (data?.name && data.name.trim()) return data.name.trim();
      } catch {
        // fall through to coordinate fallback
      }
      return `Selected location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
    },
    []
  );

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    // Ensure the map recalculates canvas size when layout changes.
    const timer = window.setTimeout(() => {
      map.resize();
    }, 60);
    const onResize = () => map.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", onResize);
    };
  }, [sidebarOpen]);

  return (
    <div className="relative w-full h-full overflow-visible">
      <Map
        ref={mapRef}
        {...viewState}
        onMove={handleMove}
        mapboxAccessToken={mapboxToken}
        mapStyle={getMapStyleUrl(mapStyle)}
        style={{ width: "100%", height: "100%" }}
        attributionControl={false}
        onClick={(e) => {
          if (!pickPointsMode) return;
          // Marker clicks already stop propagation, so this is for "tap-to-add" only.
          setPickPointsMode(false);
          const { lng, lat } = e.lngLat;
          void (async () => {
            const name = await reverseGeocodeName(lat, lng);
            if (waypoints.length > 0) {
              insertWaypointNear({ name, lat, lng });
            } else {
              addWaypoint({ name, lat, lng });
            }
            setViewState({ longitude: lng, latitude: lat, zoom: 12 });
          })();
        }}
      >
        <NavigationControl position="bottom-right" />
        <RouteLayer />
        <WaypointMarkers />
        <POIMarkers type="attractions" />
        <POIMarkers type="stays" />
        <POIMarkers type="food" />
        <POIMarkers type="parking" />
      </Map>
      {pickPointsMode && (
        <div className="absolute top-[max(0.5rem,env(safe-area-inset-top))] left-2 z-[60]">
          <div className="flex items-center gap-2 bg-white rounded-xl shadow-lg border px-3 py-2">
            <div className="text-xs font-semibold text-blue-700">
              Tap on the map to add a stop
            </div>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground underline"
              onClick={() => setPickPointsMode(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      <div className="absolute top-[max(0.5rem,env(safe-area-inset-top))] right-2 sm:top-4 sm:right-4 flex flex-col gap-1.5 z-[50] max-w-[calc(100vw-1rem)]">
        <MapStyleToggle />
        <RouteSummaryPanel />
      </div>
      <WaypointExplorePanel />
    </div>
  );
}
