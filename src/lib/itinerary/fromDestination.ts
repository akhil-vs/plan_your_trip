import {
  fetchAttractionsAroundDestination,
  type AttractionStop,
} from "@/lib/nearbyAttractions";
import {
  fetchMapboxCategoryAttractions,
  MAPBOX_ATTRACTIONS_DEFAULT_LIMIT_PER_CATEGORY,
  MAPBOX_ATTRACTIONS_DEFAULT_RADIUS_METERS,
} from "@/lib/mapbox/categoryAttractions";
import { fetchMapboxAreaCandidates, type MapboxAreaCandidate } from "@/lib/mapbox/destinationResolve";
import { reorderWaypointsWithinDayPartitions } from "@/lib/optimize/partitionedWaypointOrder";
import { estimateLegMinutes, haversineKm } from "@/lib/optimize/travelAndOrder";
import { randomUUID } from "@/lib/randomUuid";
import type { ResolvedDestination } from "@/lib/mapbox/destinationResolve";

export type Pace = "relaxed" | "moderate" | "packed";
export type RankingStyle = "most_popular" | "best_spread" | "hidden_gems";

export function stopsPerDayForPace(pace: Pace): number {
  switch (pace) {
    case "relaxed":
      return 3;
    case "moderate":
      return 4;
    case "packed":
      return 6;
    default:
      return 4;
  }
}

export function normalizeStopName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9\s]/g, "");
}

/** Fallback disc when destination has no Mapbox bbox (generate discovery). */
export const GENERATE_FETCH_RADIUS_KM = 40;
/** Soft penalty in ranking — not a hard pool cutoff when bbox is available. */
export const GENERATE_STRICT_RADIUS_KM = 15;

export function distanceKmFromDestination(
  stop: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): number {
  return haversineKm(
    { name: "", lat: destination.lat, lng: destination.lng },
    { name: "", lat: stop.lat, lng: stop.lng }
  );
}

export function filterStopsNearDestination<T extends { lat: number; lng: number }>(
  stops: T[],
  destination: { lat: number; lng: number },
  maxKm = GENERATE_FETCH_RADIUS_KM
): T[] {
  return stops.filter((s) => distanceKmFromDestination(s, destination) <= maxKm);
}

/** Keep POIs inside the destination bbox (padded); avoids shrinking trips to a center disc. */
export function filterStopsForGenerate<T extends { lat: number; lng: number }>(
  stops: T[],
  destination: ResolvedDestination
): T[] {
  const bbox = destination.bbox;
  if (bbox && bbox.length === 4) {
    const [minLng, minLat, maxLng, maxLat] = bbox;
    const latPad = Math.max(0.025, (maxLat - minLat) * 0.15);
    const lngPad = Math.max(0.025, (maxLng - minLng) * 0.15);
    return stops.filter(
      (s) =>
        s.lat >= minLat - latPad &&
        s.lat <= maxLat + latPad &&
        s.lng >= minLng - lngPad &&
        s.lng <= maxLng + lngPad
    );
  }
  return filterStopsNearDestination(stops, destination, GENERATE_FETCH_RADIUS_KM);
}

/**
 * Split stops into exactly `numDays` non-empty groups (k-means + rebalance + round-robin fallback).
 */
export function partitionStopsAcrossDays<T extends LatLng>(
  stops: T[],
  numDays: number
): T[][] {
  if (numDays < 1) return [stops];
  if (stops.length < numDays) {
    throw new Error(
      "Not enough places found for this destination. Try fewer days or another area."
    );
  }

  const assignment = kMeansAssign(stops, numDays);
  const byCluster: T[][] = Array.from({ length: numDays }, () => []);
  stops.forEach((s, i) => {
    const c = assignment[i];
    if (c >= 0 && c < numDays) byCluster[c].push(s);
  });

  for (let c = 0; c < numDays; c += 1) {
    while (byCluster[c].length === 0) {
      let bestFrom = -1;
      let bestSize = 0;
      for (let j = 0; j < numDays; j += 1) {
        if (byCluster[j].length > bestSize) {
          bestSize = byCluster[j].length;
          bestFrom = j;
        }
      }
      if (bestFrom < 0 || byCluster[bestFrom].length === 0) break;
      const moved = byCluster[bestFrom].pop();
      if (moved) byCluster[c].push(moved);
    }
  }

  if (byCluster.some((g) => g.length === 0)) {
    const buckets: T[][] = Array.from({ length: numDays }, () => []);
    stops.forEach((s, i) => {
      buckets[i % numDays].push(s);
    });
    return buckets;
  }

  return byCluster;
}

const LOCALITY_CATEGORIES = new Set([
  "locality",
  "place",
  "town",
  "village",
  "neighborhood",
  "district",
]);

/** True when the stop is a visitable attraction (not a bare town name). */
export function isAttractionLike(stop: CandidateStop): boolean {
  const name = normalizeStopName(stop.name);
  if (name.length < 2 || name === "unnamed place") return false;

  const pop = stop.popularityScore ?? 0;
  if (pop >= 3) return true;

  const cat = (stop.category || "").toLowerCase();
  if (LOCALITY_CATEGORIES.has(cat)) return false;

  const attractionCategoryHints = [
    "museum",
    "historic",
    "landmark",
    "attraction",
    "castle",
    "monument",
    "cultural",
    "interesting",
    "entertainment",
    "view",
    "park",
    "poi",
    "architecture",
    "heritage",
    "gallery",
    "ruins",
    "fort",
    "sculpture",
    "art",
    "other_art",
    "industrial",
    "aqueduct",
    "water",
    "engineering",
    "memorial",
    "statue",
    "bridge",
    "visitor",
    "tourist",
  ];
  if (attractionCategoryHints.some((h) => cat.includes(h))) return true;

  if (pop >= 1.5) return true;

  const attractionNameHints = [
    "museum",
    "cathedral",
    "abbey",
    "castle",
    "gallery",
    "monument",
    "tower",
    "palace",
    "fort",
    "ruins",
    "park",
    "garden",
    "beach",
    "falls",
    "bridge",
    "temple",
    "shrine",
    "basilica",
    "chapel",
    "lighthouse",
    "harbour",
    "harbor",
    "viewpoint",
    "lookout",
    "aquarium",
    "zoo",
    "kelpie",
    "sculpture",
    "statue",
    "wheel",
    "aqueduct",
    "viaduct",
    "memorial",
    "arena",
    "stadium",
    "distillery",
    "brewery",
    "heritage",
    "visitor centre",
    "visitor center",
    "funicular",
    "cable car",
    "gondola",
    "pier",
  ];
  if (attractionNameHints.some((h) => name.includes(h))) return true;

  return false;
}

/** Dedupe by normalized name + proximity (meters). */
export function dedupeStops(
  stops: AttractionStop[],
  minSeparationMeters = 180
): AttractionStop[] {
  const out: AttractionStop[] = [];
  const genericTokens = ["viewpoint", "local park", "quarter", "transit stop"];
  for (const s of stops) {
    const key = normalizeStopName(s.name);
    let dupIndex = -1;
    for (let i = 0; i < out.length; i += 1) {
      const o = out[i];
      const dk = normalizeStopName(o.name);
      if (key.length >= 4 && dk.length >= 4 && key === dk) {
        dupIndex = i;
        break;
      }
      const a = { lat: s.lat, lng: s.lng, name: "" };
      const b = { lat: o.lat, lng: o.lng, name: "" };
      const km = haversineKm(a, b);
      if (km * 1000 < minSeparationMeters && (key === dk || key.includes(dk) || dk.includes(key))) {
        dupIndex = i;
        break;
      }
    }
    const thisPenalty = genericTokens.some((t) => key.includes(t)) ? 0.4 : 1;
    const thisScore = (s.popularityScore ?? 0) * thisPenalty;
    if (dupIndex >= 0) {
      const existing = out[dupIndex];
      const existingKey = normalizeStopName(existing.name);
      const existingPenalty = genericTokens.some((t) => existingKey.includes(t)) ? 0.4 : 1;
      const existingScore = (existing.popularityScore ?? 0) * existingPenalty;
      if (thisScore > existingScore) out[dupIndex] = s;
    } else {
      out.push(s);
    }
  }
  return out;
}

type LatLng = { lat: number; lng: number };

/** Lloyd k-means on lat/lng. Returns cluster index 0..k-1 per point. */
export function kMeansAssign(points: LatLng[], k: number, maxIter = 25): number[] {
  const n = points.length;
  const clusters = Math.min(Math.max(1, k), n);
  if (n === 0) return [];
  if (clusters === 1) return points.map(() => 0);

  const centroids: LatLng[] = [];
  for (let i = 0; i < clusters; i += 1) {
    const idx = Math.floor((i * (n - 1)) / Math.max(clusters - 1, 1));
    centroids.push({ ...points[Math.min(idx, n - 1)] });
  }

  let assignment = points.map(() => 0);

  for (let iter = 0; iter < maxIter; iter += 1) {
    assignment = points.map((p) => {
      let best = 0;
      let bestD = Number.POSITIVE_INFINITY;
      for (let c = 0; c < centroids.length; c += 1) {
        const d =
          (p.lat - centroids[c].lat) ** 2 + (p.lng - centroids[c].lng) ** 2;
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      return best;
    });

    const sums = Array.from({ length: clusters }, () => ({ lat: 0, lng: 0, count: 0 }));
    for (let i = 0; i < n; i += 1) {
      const a = assignment[i];
      sums[a].lat += points[i].lat;
      sums[a].lng += points[i].lng;
      sums[a].count += 1;
    }

    let moved = false;
    for (let c = 0; c < clusters; c += 1) {
      if (sums[c].count === 0) {
        let farthest = -1;
        let farthestD = -1;
        for (let i = 0; i < n; i += 1) {
          const cc = assignment[i];
          const cx = centroids[cc].lat;
          const cy = centroids[cc].lng;
          const d = (points[i].lat - cx) ** 2 + (points[i].lng - cy) ** 2;
          if (d > farthestD) {
            farthestD = d;
            farthest = i;
          }
        }
        if (farthest >= 0) {
          assignment[farthest] = c;
          moved = true;
        }
        continue;
      }
      const nl = sums[c].lat / sums[c].count;
      const ng = sums[c].lng / sums[c].count;
      if (Math.abs(nl - centroids[c].lat) > 1e-6 || Math.abs(ng - centroids[c].lng) > 1e-6) {
        moved = true;
      }
      centroids[c] = { lat: nl, lng: ng };
    }
    if (!moved && iter > 2) break;
  }

  const finalSizes = Array.from({ length: clusters }, (_, c) =>
    assignment.filter((a) => a === c).length
  );
  if (finalSizes.some((s) => s === 0)) {
    return points.map((_, i) => i % clusters);
  }

  return assignment;
}

function distanceSq(a: LatLng, b: LatLng) {
  return (a.lat - b.lat) ** 2 + (a.lng - b.lng) ** 2;
}

export function hotspotPriorityScore(stop: CandidateStop): number {
  const name = normalizeStopName(stop.name);
  const category = (stop.category || "").toLowerCase();
  let score = 0;

  const nameSignals = [
    "beach",
    "harbour",
    "harbor",
    "castle",
    "mount",
    "abbey",
    "cathedral",
    "head",
    "point",
    "cove",
    "bay",
    "island",
    "cliff",
    "garden",
    "wheel",
    "kelpie",
    "sculpture",
    "statue",
    "memorial",
    "aqueduct",
    "viaduct",
    "arena",
    "distillery",
  ];
  for (const token of nameSignals) {
    if (name.includes(token)) score += 0.35;
  }

  const categorySignals = [
    "historic",
    "architecture",
    "cultural",
    "beaches",
    "natural",
    "islands",
    "view_points",
    "attraction",
    "landmark",
    "museum",
    "castles",
    "fortifications",
    "sculpture",
    "other_art",
    "industrial",
    "engineering",
    "memorial",
    "aqueduct",
  ];
  for (const token of categorySignals) {
    if (category.includes(token)) score += 0.45;
  }
  return Math.min(score, 2.4);
}

export function scoreAttractionCandidate(
  stop: CandidateStop,
  destination: { lat: number; lng: number },
  rankingStyle: RankingStyle
): number {
  const distKm = distanceKmFromDestination(stop, destination);
  if (distKm > GENERATE_FETCH_RADIUS_KM) return -1;

  const distScore = 1 / (1 + distKm);
  const pop = stop.popularityScore ?? 0;
  const hotspot = hotspotPriorityScore(stop);
  const attraction = isAttractionLike(stop) ? 1 : 0;

  let score = pop * 0.45 + distScore * 0.3 + hotspot * 0.35 + attraction * 0.4;
  if (pop >= 6) score += 0.35;
  if (distKm > GENERATE_STRICT_RADIUS_KM) score *= 0.72;

  if (rankingStyle === "hidden_gems") {
    score += Math.max(0, 4 - pop) * 0.22;
  } else if (rankingStyle === "best_spread") {
    score += distScore * 0.35;
  } else {
    score += pop * 0.2;
  }

  return score;
}

/** Local hotspot / must-see: only within fetch radius of the destination. */
export function isLocalHotspot(
  stop: CandidateStop,
  destination: ResolvedDestination,
  regionalSeedNames: Set<string>
): boolean {
  const distKm = distanceKmFromDestination(stop, destination);
  const name = normalizeStopName(stop.name);
  /** Explicit regional seeds (e.g. Cornwall) may sit outside the usual fetch disc. */
  if (regionalSeedNames.has(name)) return distKm <= 55;

  if (distKm > GENERATE_FETCH_RADIUS_KM) return false;

  const pop = stop.popularityScore ?? 0;
  if (pop >= 3.2 && isAttractionLike(stop)) return true;

  if (hotspotPriorityScore(stop) >= 1.35 && isAttractionLike(stop)) return true;

  if (pop >= 2.5 && distKm <= GENERATE_STRICT_RADIUS_KM && isAttractionLike(stop)) return true;

  return false;
}

export function rankAttractionCandidates(
  pool: CandidateStop[],
  destination: ResolvedDestination,
  rankingStyle: RankingStyle
): CandidateStop[] {
  const near = filterStopsForGenerate(pool, destination);
  return [...near].sort(
    (a, b) =>
      scoreAttractionCandidate(b, destination, rankingStyle) -
      scoreAttractionCandidate(a, destination, rankingStyle)
  );
}

function mergeUniqueStops(first: CandidateStop[], second: CandidateStop[], limit: number): CandidateStop[] {
  const out: CandidateStop[] = [];
  const pushUnique = (s: CandidateStop) => {
    if (out.length >= limit) return;
    if (out.some((x) => x.name === s.name && x.lat === s.lat && x.lng === s.lng)) return;
    out.push(s);
  };
  for (const s of first) pushUnique(s);
  for (const s of second) pushUnique(s);
  return out.slice(0, limit);
}

function regionalHotspotSeeds(destination: ResolvedDestination): CandidateStop[] {
  const key = normalizeStopName(`${destination.name} ${destination.fullName || ""}`);
  if (key.includes("edinburgh")) {
    return [
      {
        name: "Edinburgh Castle",
        lat: 55.94869,
        lng: -3.20042,
        category: "castles",
        popularityScore: 7,
      },
      {
        name: "Arthur's Seat",
        lat: 55.9445,
        lng: -3.1619,
        category: "natural",
        popularityScore: 6,
      },
      {
        name: "National Museum of Scotland",
        lat: 55.947,
        lng: -3.1903,
        category: "museum",
        popularityScore: 6,
      },
      {
        name: "St Giles' Cathedral",
        lat: 55.9495,
        lng: -3.1908,
        category: "historic",
        popularityScore: 5,
      },
    ];
  }
  if (key.includes("falkirk") || key.includes("grangemouth")) {
    return [
      {
        name: "The Kelpies",
        lat: 56.0198,
        lng: -3.7785,
        category: "sculpture",
        popularityScore: 6,
      },
      {
        name: "Falkirk Wheel",
        lat: 56.0016,
        lng: -3.8355,
        category: "attraction",
        popularityScore: 6,
      },
      {
        name: "Callendar House",
        lat: 55.9994,
        lng: -3.7811,
        category: "historic",
        popularityScore: 4.5,
      },
      {
        name: "Rough Castle Fort",
        lat: 55.9989,
        lng: -3.8324,
        category: "historic",
        popularityScore: 4,
      },
    ];
  }
  if (
    key.includes("cornwall") ||
    key.includes("penzance") ||
    key.includes("st ives") ||
    key.includes("lands end")
  ) {
    return [
      { name: "Land's End", lat: 50.0669, lng: -5.7147, category: "landmark", popularityScore: 5 },
      { name: "St Ives", lat: 50.2138, lng: -5.4786, category: "landmark", popularityScore: 5 },
      { name: "St Michael's Mount", lat: 50.1163, lng: -5.4777, category: "landmark", popularityScore: 5 },
      { name: "Penzance", lat: 50.1186, lng: -5.5371, category: "landmark", popularityScore: 4.6 },
    ];
  }
  return [];
}

function regionalSeedNameSet(destination: ResolvedDestination): Set<string> {
  return new Set(regionalHotspotSeeds(destination).map((s) => normalizeStopName(s.name)));
}

/** Merge Mapbox area hits with OTM rows; exported for tests. */
export function mergeAndRerankCandidates(
  mapboxRows: MapboxAreaCandidate[],
  popularityRows: AttractionStop[],
  destination: ResolvedDestination,
  rankingStyle: RankingStyle
): CandidateStop[] {
  const merged: CandidateStop[] = [];
  const popUsed = new Array(popularityRows.length).fill(false);

  for (const m of mapboxRows) {
    const mk = normalizeStopName(m.name);
    let bestIdx = -1;
    let bestDist = Number.POSITIVE_INFINITY;
    for (let i = 0; i < popularityRows.length; i += 1) {
      const p = popularityRows[i];
      const pk = normalizeStopName(p.name);
      const dist = haversineKm(
        { name: m.name, lat: m.lat, lng: m.lng },
        { name: p.name, lat: p.lat, lng: p.lng }
      );
      const near = dist <= 1.2;
      const nameMatch = mk && pk && (mk === pk || mk.includes(pk) || pk.includes(mk));
      if ((nameMatch && dist <= 3.5) || near) {
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      }
    }
    if (bestIdx >= 0) {
      popUsed[bestIdx] = true;
      const p = popularityRows[bestIdx];
      // OTM pins attraction centroids; Mapbox often resolves to street/entrance coords.
      merged.push({
        name: m.name || p.name,
        lat: p.lat,
        lng: p.lng,
        popularityScore: p.popularityScore,
        category: p.category || m.category,
      });
    } else {
      merged.push({
        name: m.name,
        lat: m.lat,
        lng: m.lng,
        popularityScore: 0,
        category: m.category,
      });
    }
  }

  for (let i = 0; i < popularityRows.length; i += 1) {
    if (popUsed[i]) continue;
    const p = popularityRows[i];
    merged.push({
      name: p.name,
      lat: p.lat,
      lng: p.lng,
      popularityScore: p.popularityScore,
      category: p.category,
    });
  }

  const deduped = dedupeStops(merged);
  deduped.sort((a, b) => {
    const pa = a.popularityScore ?? 0;
    const pb = b.popularityScore ?? 0;
    const da = Math.sqrt((a.lat - destination.lat) ** 2 + (a.lng - destination.lng) ** 2);
    const db = Math.sqrt((b.lat - destination.lat) ** 2 + (b.lng - destination.lng) ** 2);
    const ha = hotspotPriorityScore(a);
    const hb = hotspotPriorityScore(b);
    let scoreA = pa * 0.75 + (1 / (1 + da)) * 0.25;
    let scoreB = pb * 0.75 + (1 / (1 + db)) * 0.25;
    if (rankingStyle === "hidden_gems") {
      scoreA = (Math.min(pa, 3.2) * 0.45 + (1 / (1 + da)) * 0.2) + (Math.max(0, 3.8 - pa) * 0.35);
      scoreB = (Math.min(pb, 3.2) * 0.45 + (1 / (1 + db)) * 0.2) + (Math.max(0, 3.8 - pb) * 0.35);
    } else if (rankingStyle === "best_spread") {
      scoreA = pa * 0.55 + (1 / (1 + da)) * 0.45;
      scoreB = pb * 0.55 + (1 / (1 + db)) * 0.45;
    }
    scoreA += ha;
    scoreB += hb;
    return scoreB - scoreA;
  });
  return deduped;
}

/** Order cluster members: nearest-neighbor walk starting from point nearest global `seed`. */
export function orderClusterStops(
  stops: AttractionStop[],
  seed: LatLng
): AttractionStop[] {
  if (stops.length <= 1) return [...stops];
  const remaining = [...stops];
  const out: AttractionStop[] = [];
  let current = seed;
  while (remaining.length > 0) {
    let bi = 0;
    let bd = Number.POSITIVE_INFINITY;
    for (let i = 0; i < remaining.length; i += 1) {
      const d = distanceSq(current, remaining[i]);
      if (d < bd) {
        bd = d;
        bi = i;
      }
    }
    const next = remaining.splice(bi, 1)[0];
    out.push(next);
    current = next;
  }
  return out;
}

/** Greedy chain cluster indices starting from the centroid nearest `seed`. */
export function orderClustersByProximity(
  clusterCentroids: LatLng[],
  seed: LatLng
): number[] {
  const k = clusterCentroids.length;
  if (k <= 1) return [0];
  let start = 0;
  let bestD = Number.POSITIVE_INFINITY;
  for (let i = 0; i < k; i += 1) {
    const d = distanceSq(clusterCentroids[i], seed);
    if (d < bestD) {
      bestD = d;
      start = i;
    }
  }
  const remaining = new Set<number>();
  for (let i = 0; i < k; i += 1) remaining.add(i);
  const order: number[] = [start];
  remaining.delete(start);
  let last = start;
  while (remaining.size > 0) {
    let best = -1;
    let bd = Number.POSITIVE_INFINITY;
    for (const j of remaining) {
      const d = distanceSq(clusterCentroids[last], clusterCentroids[j]);
      if (d < bd) {
        bd = d;
        best = j;
      }
    }
    if (best >= 0) {
      order.push(best);
      remaining.delete(best);
      last = best;
    } else break;
  }
  return order;
}

function centroidOf(stops: AttractionStop[]): LatLng {
  if (stops.length === 0) return { lat: 0, lng: 0 };
  let lat = 0;
  let lng = 0;
  for (const s of stops) {
    lat += s.lat;
    lng += s.lng;
  }
  return { lat: lat / stops.length, lng: lng / stops.length };
}

export type GeneratedWaypointInput = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  order: number;
  visitMinutes: number;
};

export type CandidateStop = {
  name: string;
  lat: number;
  lng: number;
  popularityScore?: number;
  category?: string;
};

export type GeneratedDayPlanInput = {
  day: number;
  waypointIndexes: number[];
  waypointIds: string[];
  estimatedTravelMinutes: number;
};

function estimateDayTravelMinutes(
  waypoints: GeneratedWaypointInput[],
  indexes: number[],
  travelMode: "driving" | "walking" | "cycling"
): number {
  if (indexes.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < indexes.length - 1; i += 1) {
    const a = waypoints[indexes[i]];
    const b = waypoints[indexes[i + 1]];
    if (!a || !b) continue;
    const aW = { lat: a.lat, lng: a.lng, name: a.name };
    const bW = { lat: b.lat, lng: b.lng, name: b.name };
    total += estimateLegMinutes(aW, bW, travelMode);
  }
  return total;
}

export async function buildGeneratedItineraryFromDestination(input: {
  destination: ResolvedDestination;
  days: number;
  pace: Pace;
  rankingStyle?: RankingStyle;
  defaultVisitMinutes: number;
  travelMode?: "driving" | "walking" | "cycling";
  selectedOverrideStops?: CandidateStop[];
}): Promise<{
  tripName: string;
  waypoints: GeneratedWaypointInput[];
  dayPlans: GeneratedDayPlanInput[];
  placesByDay: string[][];
  selectedStops: CandidateStop[];
  alternativeStops: CandidateStop[];
}> {
  const {
    destination,
    days: numDays,
    pace,
    rankingStyle = "most_popular",
    defaultVisitMinutes,
    travelMode = "driving",
    selectedOverrideStops,
  } = input;

  if (numDays < 1 || numDays > 14) {
    throw new Error("days must be between 1 and 14");
  }

  const spd = stopsPerDayForPace(pace);
  const targetCount = Math.min(60, Math.max(numDays, numDays * spd));
  const poolDiscoveryTarget = Math.max(100, numDays * spd * 8);

  const popularityPool = await fetchAttractionsAroundDestination(
    destination.lat,
    destination.lng,
    poolDiscoveryTarget,
    numDays,
    destination.bbox
  );
  const mapboxPool = await fetchMapboxAreaCandidates({
    lat: destination.lat,
    lng: destination.lng,
    days: numDays,
    limit: Math.max(targetCount * 3, 24),
    bbox: destination.bbox,
    destinationLabel: destination.fullName || destination.name,
  });
  const fallbackMapbox = await fetchMapboxAreaCandidates({
    lat: destination.lat + 0.02,
    lng: destination.lng + 0.02,
    days: numDays,
    limit: Math.max(16, targetCount * 2),
    bbox: destination.bbox,
    destinationLabel: destination.fullName || destination.name,
  });
  const fallbackPool = mergeAndRerankCandidates(
    [...mapboxPool, ...fallbackMapbox],
    popularityPool,
    destination,
    rankingStyle
  );
  const mapboxCategoryStops = process.env.MAPBOX_ACCESS_TOKEN
    ? (
        await fetchMapboxCategoryAttractions({
          lat: destination.lat,
          lng: destination.lng,
          bbox: destination.bbox,
          radiusMeters: MAPBOX_ATTRACTIONS_DEFAULT_RADIUS_METERS,
          limitPerCategory: MAPBOX_ATTRACTIONS_DEFAULT_LIMIT_PER_CATEGORY,
          accessToken: process.env.MAPBOX_ACCESS_TOKEN,
        }).catch(() => [])
      ).map((item) => ({
        name: item.name,
        lat: item.lat,
        lng: item.lng,
        popularityScore: item.popularityScore * 5,
        category: item.category,
      }))
    : [];
  const rawCandidatePool = dedupeStops([
    ...regionalHotspotSeeds(destination),
    ...fallbackPool,
    ...mapboxCategoryStops,
  ]);
  const candidatePool = filterStopsForGenerate(rawCandidatePool, destination);
  const rankedPool = rankAttractionCandidates(candidatePool, destination, rankingStyle);
  const attractionLike = rankedPool.filter((s) => isAttractionLike(s));
  const attractionPool =
    attractionLike.length >= Math.max(numDays * 2, 6) ? attractionLike : rankedPool;
  const regionalNames = regionalSeedNameSet(destination);

  const selectAreaCoverageStops = (pool: CandidateStop[], count: number): CandidateStop[] => {
    if (pool.length <= count) return [...pool];
    const sectors = 8;
    const bins: CandidateStop[][] = Array.from({ length: sectors }, () => []);
    for (const stop of pool) {
      const angle = Math.atan2(stop.lat - destination.lat, stop.lng - destination.lng);
      const normalized = (angle + Math.PI) / (2 * Math.PI);
      const idx = Math.min(sectors - 1, Math.max(0, Math.floor(normalized * sectors)));
      bins[idx].push(stop);
    }
    for (const bin of bins) {
      bin.sort((a, b) => {
        const pa = a.popularityScore ?? 0;
        const pb = b.popularityScore ?? 0;
        if (rankingStyle === "most_popular") {
          const ha = hotspotPriorityScore(a);
          const hb = hotspotPriorityScore(b);
          if (hb !== ha) return hb - ha;
          if (pb !== pa) return pb - pa;
        } else if (rankingStyle === "hidden_gems") {
          const ga = Math.max(0, 3.8 - pa);
          const gb = Math.max(0, 3.8 - pb);
          if (gb !== ga) return gb - ga;
          const ha = hotspotPriorityScore(a);
          const hb = hotspotPriorityScore(b);
          if (hb !== ha) return hb - ha;
        }
        const da = (a.lat - destination.lat) ** 2 + (a.lng - destination.lng) ** 2;
        const db = (b.lat - destination.lat) ** 2 + (b.lng - destination.lng) ** 2;
        return rankingStyle === "best_spread" ? db - da : da - db;
      });
    }
    const out: CandidateStop[] = [];
    let cursor = 0;
    while (out.length < count) {
      let progressed = false;
      for (let s = 0; s < sectors && out.length < count; s += 1) {
        const row = bins[s];
        if (cursor < row.length) {
          out.push(row[cursor]);
          progressed = true;
        }
      }
      if (!progressed) break;
      cursor += 1;
    }
    if (out.length < count) {
      for (const stop of pool) {
        if (out.length >= count) break;
        if (!out.some((x) => x.name === stop.name && x.lat === stop.lat && x.lng === stop.lng)) {
          out.push(stop);
        }
      }
    }
    return out.slice(0, count);
  };

  const selectedFromCoverage =
    rankingStyle === "most_popular"
      ? attractionPool.slice(0, targetCount)
      : selectAreaCoverageStops(attractionPool, targetCount);
  const localHotspots = attractionPool
    .filter((s) => isLocalHotspot(s, destination, regionalNames))
    .slice(0, Math.max(4, numDays + 2));
  const selectedWithHotspots = mergeUniqueStops(localHotspots, selectedFromCoverage, targetCount);
  const selected = (selectedOverrideStops && selectedOverrideStops.length > 0)
    ? filterStopsForGenerate(dedupeStops(selectedOverrideStops), destination).slice(0, targetCount)
    : selectedWithHotspots;

  let padIdx = 0;
  while (selected.length < targetCount && padIdx < rankedPool.length) {
    const s = rankedPool[padIdx++];
    if (!selected.some((x) => x.name === s.name && x.lat === s.lat)) {
      selected.push(s);
    }
  }

  if (selected.length < numDays) {
    throw new Error(
      "Not enough places found for this destination. Try fewer days or another area."
    );
  }

  const rankedAlternatives = attractionPool.filter(
    (s) => !selected.some((x) => x.name === s.name && x.lat === s.lat && x.lng === s.lng)
  );
  const localAlternatives = rankedAlternatives
    .filter((s) => isLocalHotspot(s, destination, regionalNames))
    .slice(0, Math.max(4, numDays));
  const alternativeStops = mergeUniqueStops(
    localAlternatives,
    rankedAlternatives,
    Math.max(30, numDays * 12)
  );

  const byCluster = partitionStopsAcrossDays(selected, numDays);

  const seed: LatLng = {
    lat: destination.lat,
    lng: destination.lng,
  };

  const centroids = byCluster.map((g) => centroidOf(g));
  const clusterVisitOrder = orderClustersByProximity(centroids, seed);

  const orderedStops: AttractionStop[] = [];
  /** Sequential itinerary day 0..K-1 (visit order), not raw cluster id. */
  const sequentialDayPerStop: number[] = [];
  const chunkSizes: number[] = [];

  let prevExit: LatLng = seed;
  let seqDay = 0;
  for (const clusterIdx of clusterVisitOrder) {
    const group = byCluster[clusterIdx];
    const ordered = orderClusterStops(group, prevExit);
    chunkSizes.push(ordered.length);
    for (const s of ordered) {
      orderedStops.push(s);
      sequentialDayPerStop.push(seqDay);
    }
    if (ordered.length > 0) {
      prevExit = ordered[ordered.length - 1];
    }
    seqDay += 1;
  }

  if (orderedStops.length < 1 || seqDay !== numDays) {
    throw new Error("Could not assign stops to days.");
  }

  const withIds = orderedStops.map((s) => ({
    id: randomUUID(),
    name: s.name,
    lat: s.lat,
    lng: s.lng,
  }));

  const optimized = await reorderWaypointsWithinDayPartitions(
    withIds,
    sequentialDayPerStop,
    travelMode
  );

  const waypoints: GeneratedWaypointInput[] = optimized.map((w, order) => ({
    id: w.id,
    name: w.name,
    lat: w.lat,
    lng: w.lng,
    order,
    visitMinutes: Math.max(5, Math.round(defaultVisitMinutes)),
  }));

  const dayPartitionAfterReorder: number[] = [];
  chunkSizes.forEach((sz, d) => {
    for (let i = 0; i < sz; i += 1) {
      dayPartitionAfterReorder.push(d);
    }
  });

  const dayPlans: GeneratedDayPlanInput[] = [];
  const placesByDay: string[][] = Array.from({ length: numDays }, () => []);

  for (let d = 0; d < numDays; d += 1) {
    const indexes: number[] = [];
    const ids: string[] = [];
    waypoints.forEach((w, globalIdx) => {
      if (dayPartitionAfterReorder[globalIdx] === d) {
        indexes.push(globalIdx);
        ids.push(w.id);
        placesByDay[d].push(w.name);
      }
    });
    dayPlans.push({
      day: d + 1,
      waypointIndexes: indexes,
      waypointIds: ids,
      estimatedTravelMinutes: estimateDayTravelMinutes(waypoints, indexes, travelMode),
    });
  }

  const tripName = `${destination.name} · ${numDays} day${numDays === 1 ? "" : "s"}`;

  return { tripName, waypoints, dayPlans, placesByDay, selectedStops: selected, alternativeStops };
}
