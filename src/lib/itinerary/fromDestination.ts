import { fetchAttractionsAroundDestination, type AttractionStop } from "@/lib/nearbyAttractions";
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

  return assignment;
}

function distanceSq(a: LatLng, b: LatLng) {
  return (a.lat - b.lat) ** 2 + (a.lng - b.lng) ** 2;
}

function hotspotPriorityScore(stop: CandidateStop): number {
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
    "locality",
    "must_see",
  ];
  for (const token of categorySignals) {
    if (category.includes(token)) score += 0.45;
  }
  return Math.min(score, 2.4);
}

function isMustSeeHotspot(stop: CandidateStop): boolean {
  const name = normalizeStopName(stop.name);
  const category = (stop.category || "").toLowerCase();
  if (category.includes("must_see")) return true;
  return (
    name.includes("lands end") ||
    name.includes("land s end") ||
    name.includes("st ives") ||
    name.includes("st michaels mount") ||
    name.includes("st michael s mount") ||
    hotspotPriorityScore(stop) >= 1.35
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
  if (key.includes("cornwall")) {
    return [
      { name: "Land's End", lat: 50.0669, lng: -5.7147, category: "must_see", popularityScore: 5 },
      { name: "St Ives", lat: 50.2138, lng: -5.4786, category: "must_see", popularityScore: 5 },
      { name: "St Michael's Mount", lat: 50.1163, lng: -5.4777, category: "must_see", popularityScore: 5 },
      { name: "Penzance", lat: 50.1186, lng: -5.5371, category: "must_see", popularityScore: 4.6 },
    ];
  }
  return [];
}

function mergeAndRerankCandidates(
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
      const mapboxMustSee = (m.category || "").toLowerCase().includes("must_see");
      merged.push({
        name: mapboxMustSee ? m.name : p.name || m.name,
        lat: mapboxMustSee ? m.lat : p.lat,
        lng: mapboxMustSee ? m.lng : p.lng,
        popularityScore: p.popularityScore,
        category: mapboxMustSee ? "must_see" : p.category || m.category,
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

  const popularityPool = await fetchAttractionsAroundDestination(
    destination.lat,
    destination.lng,
    Math.max(targetCount * 3, 24),
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
  const fallbackPopularity = await fetchAttractionsAroundDestination(
      destination.lat + 0.02,
      destination.lng + 0.02,
      Math.max(16, targetCount * 2),
      numDays,
      destination.bbox
    );
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
    [...popularityPool, ...fallbackPopularity],
    destination,
    rankingStyle
  );
  const candidatePool = dedupeStops([...regionalHotspotSeeds(destination), ...fallbackPool]);

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
      ? candidatePool.slice(0, targetCount)
      : selectAreaCoverageStops(candidatePool, targetCount);
  const mustSeeFromPool = candidatePool.filter((s) => isMustSeeHotspot(s)).slice(0, Math.max(4, numDays + 2));
  const selectedWithMustSee = mergeUniqueStops(mustSeeFromPool, selectedFromCoverage, targetCount);
  const selected = (selectedOverrideStops && selectedOverrideStops.length > 0)
    ? dedupeStops(selectedOverrideStops).slice(0, targetCount)
    : selectedWithMustSee;

  let padIdx = 0;
  while (selected.length < targetCount && padIdx < candidatePool.length) {
    const s = candidatePool[padIdx++];
    if (!selected.some((x) => x.name === s.name && x.lat === s.lat)) {
      selected.push(s);
    }
  }

  if (selected.length < numDays) {
    throw new Error(
      "Not enough places found for this destination. Try fewer days or another area."
    );
  }

  const rankedAlternatives = candidatePool
    .filter((s) => !selected.some((x) => x.name === s.name && x.lat === s.lat && x.lng === s.lng))
    .sort((a, b) => {
      const pa = a.popularityScore ?? 0;
      const pb = b.popularityScore ?? 0;
      const ha = hotspotPriorityScore(a);
      const hb = hotspotPriorityScore(b);
      if (rankingStyle === "hidden_gems") {
        const gems = Math.max(0, 3.8 - pb) - Math.max(0, 3.8 - pa);
        if (gems !== 0) return gems;
        return hb - ha;
      }
      if (hb !== ha) return hb - ha;
      return pb - pa;
    });
  const mustSeeAlternatives = rankedAlternatives.filter((s) => isMustSeeHotspot(s)).slice(0, Math.max(4, numDays));
  const alternativeStops = mergeUniqueStops(
    mustSeeAlternatives,
    rankedAlternatives,
    Math.max(12, numDays * 6)
  );

  const assignment = kMeansAssign(selected, numDays);
  const byCluster: AttractionStop[][] = Array.from({ length: numDays }, () => []);
  selected.forEach((s, i) => {
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
      if (bestFrom < 0 || bestSize < 2) break;
      const moved = byCluster[bestFrom].pop();
      if (moved) byCluster[c].push(moved);
    }
  }

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
    if (group.length === 0) continue;
    const ordered = orderClusterStops(group, prevExit);
    chunkSizes.push(ordered.length);
    for (const s of ordered) {
      orderedStops.push(s);
      sequentialDayPerStop.push(seqDay);
    }
    prevExit = ordered[ordered.length - 1];
    seqDay += 1;
  }

  const itineraryDayCount = seqDay;
  if (itineraryDayCount < 1) {
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
  const placesByDay: string[][] = Array.from({ length: itineraryDayCount }, () => []);

  for (let d = 0; d < itineraryDayCount; d += 1) {
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

  const tripName = `${destination.name} · ${itineraryDayCount} day${itineraryDayCount === 1 ? "" : "s"}`;

  return { tripName, waypoints, dayPlans, placesByDay, selectedStops: selected, alternativeStops };
}
