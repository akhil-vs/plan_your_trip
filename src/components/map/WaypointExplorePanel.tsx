"use client";

import { useState, useCallback, useEffect } from "react";
import { useMapStore } from "@/stores/mapStore";
import { useTripStore, POI } from "@/stores/tripStore";
import { fetchAttractions } from "@/lib/api/opentripmap";
import { fetchPlaces } from "@/lib/api/geoapify";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  X,
  Landmark,
  Hotel,
  Utensils,
  Star,
  MapPin,
  Loader2,
  ArrowLeft,
  Plus,
  ExternalLink,
  ImageOff,
} from "lucide-react";
import { parseOpeningHoursWindow } from "@/lib/utils/openingHours";

type ExploreTab = "menu" | "attractions" | "stays" | "food";

interface PlaceDetail {
  id: string;
  name: string;
  description: string;
  image: string;
  url: string;
  address: string;
  kinds: string;
  rating: number;
  openingHours?: string;
}

export function WaypointExplorePanel() {
  const {
    activeWaypoint,
    setActiveWaypoint,
    searchRadius,
    routeExploreOpen,
    setRouteExploreOpen,
  } = useMapStore();
  const route = useTripStore((s) => s.route);
  const {
    insertWaypointNear,
    waypoints,
    removeWaypoint,
    setAttractions,
    setStays,
    setFood,
    setSelectedPOI: setGlobalSelectedPOI,
    setHoveredPOIId,
  } = useTripStore();

  const [tab, setTab] = useState<ExploreTab>("menu");
  const [results, setResults] = useState<POI[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPOI, setSelectedPOI] = useState<POI | null>(null);
  const [detail, setDetail] = useState<PlaceDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  const wp = activeWaypoint;
  const isRouteMode =
    routeExploreOpen &&
    !wp &&
    Boolean(route?.geometry?.coordinates && route.geometry.coordinates.length > 1);

  const routeCenter = route?.geometry?.coordinates?.[0]
    ? { lat: route.geometry.coordinates[0][1], lng: route.geometry.coordinates[0][0] }
    : null;
  const hasGeneratedRoute =
    Boolean(route?.geometry?.coordinates && route.geometry.coordinates.length > 1);

  useEffect(() => {
    if (wp || isRouteMode) return;
    setAttractions([]);
    setStays([]);
    setFood([]);
    setGlobalSelectedPOI(null);
    setHoveredPOIId(null);
  }, [
    wp,
    isRouteMode,
    setAttractions,
    setFood,
    setGlobalSelectedPOI,
    setHoveredPOIId,
    setStays,
  ]);

  const handleClose = () => {
    setActiveWaypoint(null);
    setRouteExploreOpen(false);
    setTab("menu");
    setResults([]);
    setSelectedPOI(null);
    setDetail(null);
    setAddedIds(new Set());
    setAttractions([]);
    setStays([]);
    setFood([]);
    setGlobalSelectedPOI(null);
    setHoveredPOIId(null);
  };

  const handleBack = () => {
    if (selectedPOI) {
      setSelectedPOI(null);
      setDetail(null);
      setGlobalSelectedPOI(null);
    } else {
      setTab("menu");
      setResults([]);
      setAttractions([]);
      setStays([]);
      setFood([]);
      setHoveredPOIId(null);
    }
  };

  const handleSearch = useCallback(async (type: ExploreTab) => {
    if (!wp && !isRouteMode) return;
    setTab(type);
    setLoading(true);
    setResults([]);
    try {
      const routeCoords = route?.geometry?.coordinates ?? [];
      const sampleMax = 5;
      const useRouteSampling = type === "attractions" && hasGeneratedRoute;
      const samplePoints: Array<{ lat: number; lng: number }> = useRouteSampling
        ? (() => {
            const coords = routeCoords;
            if (!coords.length) return [];
            const maxSamples = Math.min(sampleMax, coords.length);
            const step = Math.max(1, Math.floor(coords.length / maxSamples));
            const sample = coords
              .filter((_, i) => i === 0 || (step > 0 && i % step === 0))
              .slice(0, maxSamples)
              .map((c) => ({ lng: c[0], lat: c[1] }));
            const last = coords[coords.length - 1];
            const lastPoint = { lng: last[0], lat: last[1] };
            if (
              lastPoint.lat !== sample[sample.length - 1]?.lat ||
              lastPoint.lng !== sample[sample.length - 1]?.lng
            ) {
              sample.push(lastPoint);
            }
            return sample;
          })()
        : wp
          ? [{ lat: wp.lat, lng: wp.lng }]
          : [];

      const seen = new Set<string>();
      const merged: typeof results = [];

      for (const pt of samplePoints) {
        if (type === "attractions") {
          const pois = await fetchAttractions(pt.lat, pt.lng, {
            radius: searchRadius,
            kinds: "interesting_places",
          });
          for (const poi of pois) {
            if (seen.has(poi.id)) continue;
            seen.add(poi.id);
            merged.push(poi);
          }
        } else {
          const category = type === "stays" ? "accommodation" : "catering";
          const pois = await fetchPlaces(pt.lat, pt.lng, {
            radius: searchRadius,
            categories: category,
          });
          for (const poi of pois) {
            if (seen.has(poi.id)) continue;
            seen.add(poi.id);
            merged.push(poi);
          }
        }
        // Keep UI responsive if we get a lot of results
        if (merged.length >= 40) break;
      }

      const finalResults = merged.slice(0, 40);
      setResults(finalResults);

      if (type === "attractions") {
        setAttractions(finalResults);
        setStays([]);
        setFood([]);
      } else if (type === "stays") {
        setStays(finalResults);
        setAttractions([]);
        setFood([]);
      } else {
        setFood(finalResults);
        setAttractions([]);
        setStays([]);
      }
    } catch {
      setResults([]);
      setAttractions([]);
      setStays([]);
      setFood([]);
    } finally {
      setLoading(false);
    }
  }, [
    wp,
    isRouteMode,
    hasGeneratedRoute,
    route?.geometry?.coordinates,
    searchRadius,
    setAttractions,
    setFood,
    setStays,
  ]);

  // Refetch results when search radius changes (while viewing attractions/stays/food)
  useEffect(() => {
    if ((!wp && !isRouteMode) || tab === "menu" || selectedPOI) return;
    handleSearch(tab);
  }, [searchRadius, tab, selectedPOI, wp, isRouteMode, handleSearch]);

  const handleSelectPOI = async (poi: POI) => {
    setSelectedPOI(poi);
    setGlobalSelectedPOI(poi);
    setHoveredPOIId(poi.id);
    setDetail(null);

    if (poi.source === "opentripmap") {
      setDetailLoading(true);
      try {
        const res = await fetch(`/api/attractions/${poi.id}`);
        if (res.ok) {
          const data = await res.json();
          setDetail(data);
        }
      } catch {
        // fall through
      } finally {
        setDetailLoading(false);
      }
    } else {
      setDetail({
        id: poi.id,
        name: poi.name,
        description: "",
        image: poi.image || "",
        url: poi.url || "",
        address: poi.address || "",
        kinds: poi.subcategory || "",
        rating: poi.rating || 0,
        openingHours: poi.openingHours || "",
      });
    }
  };

  const handleAddToRoute = (poi: POI) => {
    const openingHoursSource =
      selectedPOI?.id === poi.id ? detail?.openingHours || poi.openingHours : poi.openingHours;
    const parsedWindow = parseOpeningHoursWindow(
      openingHoursSource
    );
    insertWaypointNear({
      name: poi.name,
      lat: poi.lat,
      lng: poi.lng,
      ...(parsedWindow || {}),
    });
    setAddedIds((prev) => new Set(prev).add(poi.id));
  };

  const isInRoute = (poi: POI) =>
    addedIds.has(poi.id) ||
    waypoints.some(
      (w) =>
        Math.abs(w.lat - poi.lat) < 0.0001 &&
        Math.abs(w.lng - poi.lng) < 0.0001
    );

  const tabIcon = (t: ExploreTab) =>
    t === "attractions" ? Landmark : t === "stays" ? Hotel : Utensils;
  const tabColor = (t: ExploreTab) =>
    t === "attractions"
      ? "text-amber-600"
      : t === "stays"
        ? "text-purple-600"
        : "text-rose-600";
  const tabBg = (t: ExploreTab) =>
    t === "attractions"
      ? "bg-amber-50 hover:bg-amber-100 border-amber-200"
      : t === "stays"
        ? "bg-purple-50 hover:bg-purple-100 border-purple-200"
        : "bg-rose-50 hover:bg-rose-100 border-rose-200";

  if (!wp && !isRouteMode) return null;

  // Detail view for a selected POI
  if (selectedPOI) {
    const CategoryIcon = tabIcon(tab);
    const kinds = (detail?.kinds || selectedPOI.subcategory || "")
      .split(",")
      .map((k) => k.trim().replace(/_/g, " "))
      .filter(Boolean)
      .slice(0, 5);
    const alreadyAdded = isInRoute(selectedPOI);

    return (
      <div className="absolute top-[max(0.5rem,env(safe-area-inset-top))] left-2 right-2 sm:top-3 sm:left-auto sm:right-14 sm:w-[360px] sm:max-w-[360px] z-[100] max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-1.5rem)] bg-white rounded-xl shadow-2xl border flex flex-col animate-in slide-in-from-right-full duration-200">
        {/* Header */}
        <div className="flex items-center gap-2 p-3 border-b shrink-0">
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold truncate flex-1">
            {selectedPOI.name}
          </span>
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={handleClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Image */}
          {detailLoading ? (
            <Skeleton className="w-full h-44" />
          ) : detail?.image ? (
            <div className="relative w-full h-44 bg-gray-100">
              <img
                src={detail.image}
                alt={detail.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          ) : (
            <div className="w-full h-28 bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center">
              <CategoryIcon className="h-10 w-10 text-gray-300" />
            </div>
          )}

          <div className="p-4 space-y-3">
            <div>
              <h3 className="font-bold text-base">{detail?.name || selectedPOI.name}</h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant="secondary" className="text-[10px] capitalize">
                  {tab === "stays" ? "Stay" : tab === "food" ? "Food & Drink" : "Attraction"}
                </Badge>
                {(detail?.rating ?? selectedPOI.rating ?? 0) > 0 && (
                  <div className="flex items-center gap-0.5">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    <span className="text-xs font-medium">{detail?.rating || selectedPOI.rating}</span>
                  </div>
                )}
              </div>
            </div>

            {kinds.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {kinds.map((k) => (
                  <Badge key={k} variant="outline" className="text-[10px] capitalize">
                    {k}
                  </Badge>
                ))}
              </div>
            )}

            {(detail?.address || selectedPOI.address) && (
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>{detail?.address || selectedPOI.address}</span>
              </div>
            )}

            {detailLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
                <Skeleton className="h-3 w-4/6" />
              </div>
            ) : (
              detail?.description && (
                <p className="text-xs text-gray-700 leading-relaxed">
                  {detail.description}
                </p>
              )
            )}

            {detail?.url && (
              <a
                href={detail.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                Learn more
              </a>
            )}
          </div>
        </div>

        {/* Add to route */}
        <div className="p-3 border-t shrink-0">
          <Button
            className="w-full gap-2"
            size="sm"
            onClick={() => handleAddToRoute(selectedPOI)}
            disabled={alreadyAdded}
          >
            <Plus className="h-4 w-4" />
            {alreadyAdded ? "Added to Route" : "Add to Route"}
          </Button>
        </div>
      </div>
    );
  }

  // Results list view
  if (tab !== "menu") {
    const Icon = tabIcon(tab);
    const color = tabColor(tab);

    return (
      <div className="absolute top-[max(0.5rem,env(safe-area-inset-top))] left-2 right-2 sm:top-3 sm:left-auto sm:right-14 sm:w-[360px] sm:max-w-[360px] z-[100] max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-1.5rem)] bg-white rounded-xl shadow-2xl border flex flex-col animate-in slide-in-from-right-full duration-200">
        {/* Header */}
        <div className="flex items-center gap-2 p-3 border-b shrink-0">
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Icon className={`h-4 w-4 ${color} shrink-0`} />
          <span className="text-sm font-semibold truncate flex-1">
            {tab === "attractions"
              ? "Attractions"
              : tab === "stays"
                ? "Stays"
                : "Food & Dining"}{" "}
            near {(isRouteMode || (tab === "attractions" && hasGeneratedRoute))
              ? "your route"
              : wp
                ? wp.name.split(",")[0]
                : ""}
          </span>
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={handleClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto min-h-0 p-2">
          {loading ? (
            <div className="space-y-2 p-2">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : results.length > 0 ? (
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground px-2 py-1">
                {results.length} results within {searchRadius} km
              </p>
              {results.map((poi) => {
                const added = isInRoute(poi);
                return (
                  <div
                    key={poi.id}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer group transition-colors"
                    onMouseEnter={() => setHoveredPOIId(poi.id)}
                    onMouseLeave={() => setHoveredPOIId(null)}
                    onClick={() => handleSelectPOI(poi)}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      tab === "attractions"
                        ? "bg-amber-100"
                        : tab === "stays"
                          ? "bg-purple-100"
                          : "bg-rose-100"
                    }`}>
                      <Icon className={`h-3.5 w-3.5 ${color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate group-hover:text-blue-600 transition-colors">
                        {poi.name}
                      </p>
                      {poi.subcategory && (
                        <p className="text-[10px] text-muted-foreground capitalize truncate">
                          {poi.subcategory.replace(/_/g, " ")}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {(poi.rating ?? 0) > 0 && (
                        <div className="flex items-center gap-0.5 mr-1">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          <span className="text-[10px]">{poi.rating}</span>
                        </div>
                      )}
                      <Button
                        variant={added ? "outline" : "default"}
                        size="icon"
                        className="h-8 w-8 sm:h-7 sm:w-7 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!added) handleAddToRoute(poi);
                        }}
                        disabled={added}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              <Icon className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No results found</p>
              <p className="text-xs mt-1">Try increasing the search radius</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Main menu
  return (
    <div className="absolute top-[max(0.5rem,env(safe-area-inset-top))] left-2 right-2 sm:top-3 sm:left-auto sm:right-14 sm:w-[320px] sm:max-w-[320px] z-[100] bg-white rounded-xl shadow-2xl border flex flex-col animate-in slide-in-from-right-full duration-200">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b">
        {isRouteMode ? (
          <>
            <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold shrink-0">
              R
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">Your route</p>
              {routeCenter ? (
                <p className="text-[10px] text-muted-foreground">
                  {routeCenter.lat.toFixed(4)}, {routeCenter.lng.toFixed(4)}
                </p>
              ) : (
                <p className="text-[10px] text-muted-foreground">Plan your itinerary</p>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold shrink-0">
              {wp ? wp.index + 1 : ""}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{wp?.name}</p>
              <p className="text-[10px] text-muted-foreground">
                {wp ? `${wp.lat.toFixed(4)}, ${wp.lng.toFixed(4)}` : ""}
              </p>
            </div>
          </>
        )}
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Explore buttons */}
      <div className="p-4 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Explore nearby
        </p>
        {(
          [
            { key: "attractions" as ExploreTab, icon: Landmark, label: "Attractions & Sights", desc: "Museums, monuments, landmarks" },
            { key: "stays" as ExploreTab, icon: Hotel, label: "Stays & Accommodation", desc: "Hotels, hostels, apartments" },
            { key: "food" as ExploreTab, icon: Utensils, label: "Food & Dining", desc: "Restaurants, cafes, bars" },
          ] as const
        ).map(({ key, icon: BtnIcon, label, desc }) => (
          <button
            key={key}
            onClick={() => handleSearch(key)}
            className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${tabBg(key)}`}
          >
            <div className={`w-10 h-10 rounded-lg bg-white flex items-center justify-center shadow-sm shrink-0`}>
              <BtnIcon className={`h-5 w-5 ${tabColor(key)}`} />
            </div>
            <div>
              <p className="text-sm font-medium">{label}</p>
              <p className="text-[10px] text-muted-foreground">{desc}</p>
            </div>
          </button>
        ))}
      </div>

      {!isRouteMode && (
        <>
          {/* Remove from route */}
          <div className="px-4 pb-4">
            <Button
              variant="outline"
              size="sm"
              className="w-full text-red-500 hover:text-red-600 hover:bg-red-50"
              onClick={() => {
                if (!wp) return;
                removeWaypoint(wp.id);
                handleClose();
              }}
            >
              <X className="h-3.5 w-3.5 mr-1.5" />
              Remove from Route
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
