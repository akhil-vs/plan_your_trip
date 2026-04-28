import { useCallback, useMemo, useRef, useState } from "react";
import { CHIP_DEFINITIONS, type ChipType, type POIFeature, type SearchMode } from "./poi-search-model";
import { poiSearchRepository } from "./poi-search-repository";
import { haversineMeters } from "./poi-search-route-utils";

type LngLat = [number, number];

const newSessionToken = () =>
  typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function usePOISearchViewModel() {
  const [activeChip, setActiveChip] = useState<ChipType | null>(null);
  const [searchMode, setSearchMode] = useState<SearchMode>("NEARBY");
  const [isAlongRouteEnabled, setIsAlongRouteEnabled] = useState(false);
  const [poiResults, setPoiResults] = useState<POIFeature[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPoiId, setSelectedPoiId] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState(newSessionToken());
  const [routePolyline, setRoutePolyline] = useState<LngLat[]>([]);
  const [currentLocation, setCurrentLocation] = useState<LngLat | null>(null);
  const [hasStops, setHasStops] = useState(false);
  const [lastNearbySearchOrigin, setLastNearbySearchOrigin] = useState<LngLat | null>(null);
  const inFlightRequest = useRef(0);
  const mapCenterRef = useRef<LngLat | null>(null);
  const lastRequestKeyRef = useRef<string | null>(null);

  const effectiveNearbyAnchor = useCallback((): LngLat | null => {
    const anchor = currentLocation ?? mapCenterRef.current;
    if (!anchor) return null;
    if (!Number.isFinite(anchor[0]) || !Number.isFinite(anchor[1])) return null;
    // Guard against invalid default coordinates.
    if (Math.abs(anchor[0]) < 0.000001 && Math.abs(anchor[1]) < 0.000001) return null;
    return anchor;
  }, [currentLocation]);

  const runSearch = useCallback(
    async (overrideMode?: SearchMode, overrideChip?: ChipType | null) => {
      const chip = overrideChip ?? activeChip;
      if (!chip) return;
      const mode = overrideMode ?? searchMode;
      const categories = CHIP_DEFINITIONS[chip].categories;
      const nearbyAnchorForKey = effectiveNearbyAnchor();
      const requestKey =
        mode === "ALONG_ROUTE"
          ? `ALONG_ROUTE:${chip}:${routePolyline.length}`
          : `NEARBY:${chip}:${nearbyAnchorForKey?.[0]?.toFixed(4) ?? "none"}:${nearbyAnchorForKey?.[1]?.toFixed(4) ?? "none"}:${hasStops}`;
      if (lastRequestKeyRef.current === requestKey && !overrideMode && !overrideChip) {
        return;
      }
      lastRequestKeyRef.current = requestKey;
      const requestId = ++inFlightRequest.current;
      setError(null);
      setIsLoading(true);
      try {
        let results: POIFeature[] = [];
        if (mode === "ALONG_ROUTE" && routePolyline.length > 1) {
          results = await poiSearchRepository.searchAlongRoute(categories, routePolyline, sessionToken);
        } else {
          const nearbyAnchor = effectiveNearbyAnchor();
          if (!nearbyAnchor) {
            setError("Enable location to search nearby");
            if (requestId === inFlightRequest.current) setPoiResults([]);
            return;
          }
          const shouldSearchInArea = !hasStops && routePolyline.length < 2;
          results = shouldSearchInArea
            ? await poiSearchRepository.searchInArea(categories, nearbyAnchor, sessionToken)
            : await poiSearchRepository.searchNearby(categories, nearbyAnchor, sessionToken);
          results = results.map((item) => ({
            ...item,
            distanceMeters: haversineMeters(nearbyAnchor, item.coordinates),
          }));
          setLastNearbySearchOrigin(nearbyAnchor);
        }
        if (requestId !== inFlightRequest.current) return;
        const sortedResults = [...results].sort((a, b) => {
          if (mode === "ALONG_ROUTE") {
            const aOffset = a.routeOffsetMeters ?? Number.POSITIVE_INFINITY;
            const bOffset = b.routeOffsetMeters ?? Number.POSITIVE_INFINITY;
            if (aOffset !== bOffset) return aOffset - bOffset;
          }
          return a.distanceMeters - b.distanceMeters;
        });
        setPoiResults(sortedResults);
      } catch (e) {
        if (requestId !== inFlightRequest.current) return;
        setError(e instanceof Error ? e.message : "Unable to fetch points of interest");
      } finally {
        if (requestId === inFlightRequest.current) setIsLoading(false);
      }
    },
    [activeChip, currentLocation, effectiveNearbyAnchor, hasStops, routePolyline, searchMode, sessionToken]
  );

  const onChipSelected = useCallback(
    (chip: ChipType) => {
      if (activeChip === chip) {
        inFlightRequest.current += 1;
        setActiveChip(null);
        setPoiResults([]);
        setSelectedPoiId(null);
        setError(null);
        lastRequestKeyRef.current = null;
        return;
      }
      const nextMode: SearchMode = isAlongRouteEnabled ? searchMode : "NEARBY";
      setSessionToken(newSessionToken());
      setActiveChip(chip);
      setPoiResults([]);
      setSearchMode(nextMode);
      setSelectedPoiId(null);
      lastRequestKeyRef.current = null;
      void runSearch(nextMode, chip);
    },
    [activeChip, isAlongRouteEnabled, runSearch, searchMode]
  );

  const onModeChanged = useCallback(
    (mode: SearchMode) => {
      if (mode === "ALONG_ROUTE" && !isAlongRouteEnabled) return;
      setSearchMode(mode);
      setSessionToken(newSessionToken());
      setSelectedPoiId(null);
      setPoiResults([]);
      lastRequestKeyRef.current = null;
      void runSearch(mode);
    },
    [isAlongRouteEnabled, runSearch]
  );

  const onRouteUpdated = useCallback(
    (nextRoutePolyline: LngLat[] | null, waypointCount: number) => {
      const hasRoute = Boolean(nextRoutePolyline && nextRoutePolyline.length > 1);
      const enabled = hasRoute && waypointCount > 0;
      setRoutePolyline(nextRoutePolyline ?? []);
      setHasStops(waypointCount > 0);
      setIsAlongRouteEnabled(enabled);
      if (!enabled && searchMode === "ALONG_ROUTE") {
        setSearchMode("NEARBY");
        setSessionToken(newSessionToken());
        lastRequestKeyRef.current = null;
        if (activeChip) void runSearch("NEARBY");
      } else if (enabled && searchMode === "ALONG_ROUTE" && activeChip) {
        setSessionToken(newSessionToken());
        lastRequestKeyRef.current = null;
        void runSearch("ALONG_ROUTE");
      }
    },
    [activeChip, runSearch, searchMode]
  );

  const onLocationUpdated = useCallback(
    (location: LngLat) => {
      setCurrentLocation(location);
      if (
        activeChip &&
        searchMode === "NEARBY" &&
        lastNearbySearchOrigin &&
        haversineMeters(lastNearbySearchOrigin, location) > 500
      ) {
        setSessionToken(newSessionToken());
        lastRequestKeyRef.current = null;
        void runSearch("NEARBY");
      }
    },
    [activeChip, lastNearbySearchOrigin, runSearch, searchMode]
  );

  const onMapCenterUpdated = useCallback((center: LngLat) => {
    mapCenterRef.current = center;
  }, []);

  const onPOISelected = useCallback(
    async (poi: POIFeature) => {
      setSelectedPoiId(poi.mapboxId);
      if (poi.fullDetails) return;
      try {
        const details = await poiSearchRepository.retrieveDetails(poi.mapboxId, sessionToken);
        setPoiResults((prev) =>
          prev.map((entry) => (entry.mapboxId === poi.mapboxId ? { ...entry, fullDetails: details } : entry))
        );
      } catch {
        // keep selection even if details endpoint fails
      }
    },
    [sessionToken]
  );

  const refresh = useCallback(() => {
    setSessionToken(newSessionToken());
    lastRequestKeyRef.current = null;
    void runSearch();
  }, [runSearch]);

  const clear = useCallback(() => {
    inFlightRequest.current += 1;
    setActiveChip(null);
    setPoiResults([]);
    setSelectedPoiId(null);
    setError(null);
    setIsLoading(false);
    lastRequestKeyRef.current = null;
  }, []);

  return useMemo(
    () => ({
      state: {
        activeChip,
        searchMode,
        isAlongRouteEnabled,
        poiResults,
        isLoading,
        error,
        selectedPoiId,
        hasStops,
      },
      actions: {
        onChipSelected,
        onModeChanged,
        onRouteUpdated,
        onLocationUpdated,
        onMapCenterUpdated,
        onPOISelected,
        refresh,
        clear,
      },
    }),
    [
      activeChip,
      searchMode,
      isAlongRouteEnabled,
      poiResults,
      isLoading,
      error,
      selectedPoiId,
      hasStops,
      onChipSelected,
      onModeChanged,
      onRouteUpdated,
      onLocationUpdated,
      onMapCenterUpdated,
      onPOISelected,
      refresh,
      clear,
    ]
  );
}
