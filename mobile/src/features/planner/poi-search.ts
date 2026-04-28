import { api } from "@/services/api";
import type { LocationSearchResult } from "@/types/domain";
import { dedupeResultsByNameProximity, haversineMeters } from "./poi-search-utils";

export type PoiCategory = "attractions" | "parking" | "restaurants" | "accommodations" | "fuel";
export type PoiScope = "route" | "nearby";

export type PoiSearchInput = {
  query: string;
  category: PoiCategory | null;
  currentLocation: [number, number] | null;
  routeCoords?: [number, number][];
  routeRadiusKm: number;
  maxResults?: number;
};

export type RankedPoiResult = LocationSearchResult & {
  distanceMeters: number;
  score: number;
  scope: PoiScope;
  provider: "mapbox";
};

const CATEGORY_CONFIG: Record<PoiCategory, { terms: string[]; radiusMeters: number; minStrongResults: number }> = {
  attractions: {
    terms: [
      "attractions",
      "things to do",
      "landmarks",
      "museum",
      "art gallery",
      "historic site",
      "tourist attraction",
      "points of interest",
    ],
    radiusMeters: 25000,
    minStrongResults: 14,
  },
  parking: {
    terms: ["parking", "parking garage", "car park", "park and ride", "multi storey parking"],
    radiusMeters: 10000,
    minStrongResults: 10,
  },
  restaurants: {
    terms: [
      "restaurant",
      "restaurants near me",
      "dining",
      "food places",
      "cafe",
      "coffee shop",
      "food court",
      "takeaway",
      "fast food",
      "eatery",
      "bistro",
      "brunch",
    ],
    radiusMeters: 12000,
    minStrongResults: 18,
  },
  accommodations: {
    terms: ["hotel", "accommodation", "stay", "hostel", "guest house", "resort", "lodging"],
    radiusMeters: 22000,
    minStrongResults: 12,
  },
  fuel: {
    terms: ["petrol station", "gas station", "fuel station", "diesel station", "ev charging"],
    radiusMeters: 14000,
    minStrongResults: 10,
  },
};

const routeAnchorPoints = (route: [number, number][]) => {
  if (!route.length) return [];
  const count = Math.min(7, Math.max(2, Math.floor(route.length / 20)));
  return Array.from({ length: count }).map((_, index) => {
    const at = Math.floor((index / Math.max(1, count - 1)) * (route.length - 1));
    const point = route[at];
    return { lng: point[0], lat: point[1] };
  });
};

const minDistanceToRoute = (point: { lat: number; lng: number }, route: [number, number][]) => {
  if (!route.length) return Number.POSITIVE_INFINITY;
  const step = route.length > 120 ? Math.ceil(route.length / 120) : 1;
  let min = Number.POSITIVE_INFINITY;
  for (let i = 0; i < route.length; i += step) {
    const coord = route[i];
    const distance = haversineMeters(point, { lng: coord[0], lat: coord[1] });
    if (distance < min) min = distance;
  }
  return min;
};

const bboxFromRoute = (route: [number, number][]): [number, number, number, number] | undefined => {
  if (!route.length) return undefined;
  const lngs = route.map((c) => c[0]);
  const lats = route.map((c) => c[1]);
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
};

const mapboxSource = async (
  term: string,
  anchor: { lat: number; lng: number },
  bbox: [number, number, number, number] | undefined,
  isCategory: boolean,
  deep: boolean
) => {
  const primaryLimit = deep ? 20 : 15;
  const fallbackLimit = deep ? 26 : 18;
  const secondaryLimit = deep ? 20 : 12;
  const [primary, fallback, secondary] = await Promise.all([
    api.searchPois(term, anchor, { limit: primaryLimit }),
    api.searchLocations(term, anchor, {
      limit: fallbackLimit,
      types: isCategory ? "poi,place" : "poi,address,place,locality",
      bbox,
    }),
    api.searchLocations(term, anchor, {
      limit: secondaryLimit,
      types: "poi",
      bbox,
    }),
  ]);
  return [...primary, ...fallback, ...secondary].map((item) => ({ ...item, provider: "mapbox" as const }));
};

const routeStrengthMultiplier = (scope: PoiScope) => (scope === "route" ? 1.25 : 1);

export async function searchPoisUnified(input: PoiSearchInput): Promise<RankedPoiResult[]> {
  const query = input.query.trim();
  if (!query) return [];
  const categoryConfig = input.category ? CATEGORY_CONFIG[input.category] : null;
  const terms = [...new Set([query, ...(categoryConfig?.terms ?? [])])];
  const routeCoords = input.routeCoords ?? [];
  const anchorsRoute = routeAnchorPoints(routeCoords);
  const hasRoute = routeCoords.length > 1;
  const nearbyAnchor = input.currentLocation
    ? { lng: input.currentLocation[0], lat: input.currentLocation[1] }
    : null;
  const anchorsNearby = nearbyAnchor ? [nearbyAnchor] : [];
  const routeBbox = bboxFromRoute(routeCoords);
  const aggregated: RankedPoiResult[] = [];

  const collectFromScope = async (scope: PoiScope, anchors: { lat: number; lng: number }[], deep: boolean) => {
    for (const term of terms) {
      const perAnchor = await Promise.all(
        anchors.map((anchor) =>
          mapboxSource(term, anchor, scope === "route" ? routeBbox : undefined, Boolean(input.category), deep).then(
            (results) => ({ anchor, results })
          )
        )
      );
      for (const { anchor, results } of perAnchor) {
        for (const place of results) {
          const distanceMeters =
            scope === "route"
              ? minDistanceToRoute({ lat: place.lat, lng: place.lng }, routeCoords)
              : haversineMeters(anchor, { lat: place.lat, lng: place.lng });
          const hay = `${place.name} ${place.fullName ?? ""}`.toLowerCase();
          const keywordHits = terms.reduce((acc, t) => acc + (hay.includes(t.toLowerCase()) ? 1 : 0), 0);
          const categoryHits =
            categoryConfig?.terms.reduce((acc, token) => acc + (hay.includes(token.toLowerCase()) ? 1 : 0), 0) ?? 0;
          const prominence = (place.rating ?? 0) * 8 + Math.log10((place.userRatingsTotal ?? 0) + 1) * 10;
          const proximityScore = Math.max(0, 140 - distanceMeters / 250);
          const scopeBoost = scope === "route" ? 12 : 8;
          const score =
            keywordHits * 62 + categoryHits * 26 + prominence + proximityScore * routeStrengthMultiplier(scope) + scopeBoost;
          aggregated.push({
            ...place,
            scope,
            provider: "mapbox",
            distanceMeters,
            score,
          });
        }
      }
      if (aggregated.length >= (deep ? 520 : 320)) return;
    }
  };

  if (hasRoute) await collectFromScope("route", anchorsRoute, false);
  if (anchorsNearby.length) await collectFromScope("nearby", anchorsNearby, false);
  if (!hasRoute && !anchorsNearby.length) return [];

  const thresholdMeters =
    input.category === "restaurants" ? 10000 : input.category === "fuel" ? 14000 : input.category === "parking" ? 11000 : 28000;
  let filtered = aggregated.filter((item) => item.distanceMeters <= thresholdMeters || item.scope === "route");
  const minStrongResults = categoryConfig?.minStrongResults ?? 12;

  if (filtered.length < minStrongResults) {
    if (hasRoute) await collectFromScope("route", anchorsRoute, true);
    if (anchorsNearby.length) await collectFromScope("nearby", anchorsNearby, true);
    filtered = aggregated.filter((item) => item.distanceMeters <= thresholdMeters * 1.5 || item.scope === "route");
  }

  const deduped = dedupeResultsByNameProximity(filtered.length ? filtered : aggregated);
  const sorted = deduped.sort((a, b) => b.score - a.score || a.distanceMeters - b.distanceMeters);
  return sorted.slice(0, input.maxResults ?? 35);
}
