import { describe, expect, it } from "vitest";
import {
  dedupeStops,
  distanceKmFromDestination,
  filterStopsForGenerate,
  filterStopsNearDestination,
  GENERATE_FETCH_RADIUS_KM,
  GENERATE_STRICT_RADIUS_KM,
  isAttractionLike,
  isLocalHotspot,
  kMeansAssign,
  normalizeStopName,
  orderClusterStops,
  orderClustersByProximity,
  mergeAndRerankCandidates,
  partitionStopsAcrossDays,
  scoreAttractionCandidate,
  stopsPerDayForPace,
} from "./fromDestination";
import type { ResolvedDestination } from "@/lib/mapbox/destinationResolve";

describe("normalizeStopName", () => {
  it("lowercases and strips punctuation", () => {
    expect(normalizeStopName("  Louvre, Museum! ")).toBe("louvre museum");
  });
});

describe("dedupeStops", () => {
  it("removes duplicate names", () => {
    const out = dedupeStops(
      [
        { name: "Park A", lat: 1, lng: 1 },
        { name: "park a", lat: 1.0001, lng: 1.0001 },
        { name: "Museum B", lat: 2, lng: 2 },
      ],
      50
    );
    expect(out).toHaveLength(2);
    expect(out.map((s) => s.name)).toContain("Museum B");
  });
});

describe("kMeansAssign", () => {
  it("falls back to round-robin when a cluster would be empty", () => {
    const points = [
      { lat: 55.95, lng: -3.19 },
      { lat: 55.951, lng: -3.191 },
      { lat: 55.952, lng: -3.192 },
      { lat: 55.88, lng: -3.25 },
      { lat: 55.881, lng: -3.251 },
    ];
    const assignment = kMeansAssign(points, 3);
    const sizes = [0, 1, 2].map((c) => assignment.filter((a) => a === c).length);
    expect(sizes.every((s) => s > 0)).toBe(true);
  });

  it("assigns two separated blobs to two clusters", () => {
    const points = [
      { lat: 0, lng: 0 },
      { lat: 0.001, lng: 0 },
      { lat: 10, lng: 10 },
      { lat: 10.001, lng: 10 },
    ];
    const a = kMeansAssign(points, 2, 30);
    expect(a).toHaveLength(4);
    expect(a[0]).toBe(a[1]);
    expect(a[2]).toBe(a[3]);
    expect(a[0]).not.toBe(a[2]);
  });
});

describe("orderClusterStops", () => {
  it("chains nearest-neighbor from seed", () => {
    const ordered = orderClusterStops(
      [
        { name: "far", lat: 2, lng: 0 },
        { name: "near", lat: 0.1, lng: 0 },
      ],
      { lat: 0, lng: 0 }
    );
    expect(ordered[0].name).toBe("near");
  });
});

describe("orderClustersByProximity", () => {
  it("starts from centroid nearest seed", () => {
    const centroids = [
      { lat: 10, lng: 10 },
      { lat: 0.5, lng: 0.5 },
      { lat: 5, lng: 5 },
    ];
    const seed = { lat: 0, lng: 0 };
    const order = orderClustersByProximity(centroids, seed);
    expect(order[0]).toBe(1);
  });
});

describe("stopsPerDayForPace", () => {
  it("returns expected caps", () => {
    expect(stopsPerDayForPace("relaxed")).toBe(3);
    expect(stopsPerDayForPace("moderate")).toBe(4);
    expect(stopsPerDayForPace("packed")).toBe(6);
  });
});

const parisDestination: ResolvedDestination = {
  mapboxId: "paris",
  name: "Paris",
  fullName: "Paris, France",
  lat: 48.8566,
  lng: 2.3522,
};

const edinburghDestination: ResolvedDestination = {
  mapboxId: "edinburgh",
  name: "Edinburgh",
  fullName: "Edinburgh, Scotland",
  lat: 55.9533,
  lng: -3.1883,
  bbox: [-3.32, 55.9, -3.05, 55.98],
};

describe("attraction selection guards", () => {
  it("excludes Cornwall St Michael's Mount from Paris local hotspots", () => {
    const mount = {
      name: "St Michael's Mount",
      lat: 50.1163,
      lng: -5.4777,
      category: "must_see",
      popularityScore: 5,
    };
    expect(distanceKmFromDestination(mount, parisDestination)).toBeGreaterThan(400);
    expect(
      isLocalHotspot(mount, parisDestination, new Set())
    ).toBe(false);
  });

  it("drops far-away candidates from Paris pool", () => {
    const pool = [
      { name: "Louvre Museum", lat: 48.8606, lng: 2.3376, category: "museum", popularityScore: 4 },
      { name: "St Michael's Mount", lat: 50.1163, lng: -5.4777, category: "landmark", popularityScore: 5 },
    ];
    const near = filterStopsNearDestination(pool, parisDestination);
    expect(near.map((s) => s.name)).toEqual(["Louvre Museum"]);
  });

  it("treats high OTM rate stops as attractions regardless of category", () => {
    expect(
      isAttractionLike({
        name: "The Kelpies",
        lat: 56.0198,
        lng: -3.7785,
        category: "other",
        popularityScore: 3,
      })
    ).toBe(true);
  });

  it("treats modern landmark names as attractions", () => {
    expect(
      isAttractionLike({
        name: "Falkirk Wheel",
        lat: 56.0016,
        lng: -3.8355,
        category: "industrial_facilities",
        popularityScore: 2,
      })
    ).toBe(true);
  });

  it("treats museums as attractions", () => {
    expect(
      isAttractionLike({
        name: "Musée d'Orsay",
        lat: 48.86,
        lng: 2.3266,
        category: "museum",
        popularityScore: 3,
      })
    ).toBe(true);
    expect(
      isAttractionLike({
        name: "Some Village",
        lat: 48.86,
        lng: 2.3266,
        category: "locality",
      })
    ).toBe(false);
  });

  it("scores Edinburgh Castle highly when within strict radius", () => {
    const castle = {
      name: "Edinburgh Castle",
      lat: 55.94869,
      lng: -3.20042,
      category: "castles",
      popularityScore: 7,
    };
    expect(distanceKmFromDestination(castle, edinburghDestination)).toBeLessThan(
      GENERATE_STRICT_RADIUS_KM
    );
    const score = scoreAttractionCandidate(castle, edinburghDestination, "most_popular");
    expect(score).toBeGreaterThan(3);
  });

  it("uses bbox-inclusive generate filtering when bbox present", () => {
    const castle = {
      name: "Edinburgh Castle",
      lat: 55.94869,
      lng: -3.20042,
    };
    const kept = filterStopsForGenerate([castle], edinburghDestination);
    expect(kept.map((s) => s.name)).toContain("Edinburgh Castle");
  });

  it("uses generous fallback fetch radius without bbox", () => {
    expect(GENERATE_FETCH_RADIUS_KM).toBeGreaterThanOrEqual(35);
    expect(GENERATE_STRICT_RADIUS_KM).toBeGreaterThanOrEqual(12);
  });

  it("mergeAndRerankCandidates keeps OTM centroid when paired with Mapbox street coords", () => {
    const otmCastle = {
      name: "Edinburgh Castle",
      lat: 55.94869,
      lng: -3.20042,
      popularityScore: 7,
      category: "castles",
    };
    const mapboxStreet = {
      name: "Edinburgh Castle",
      lat: 55.9496,
      lng: -3.1994,
      category: "landmark",
    };
    const merged = mergeAndRerankCandidates(
      [mapboxStreet],
      [otmCastle],
      edinburghDestination,
      "most_popular"
    );
    const castle = merged.find((s) => s.name.toLowerCase().includes("edinburgh castle"));
    expect(castle).toBeDefined();
    expect(castle?.lat).toBeCloseTo(55.94869, 3);
    expect(castle?.lng).toBeCloseTo(-3.20042, 3);
    expect(castle?.popularityScore).toBe(7);
  });

  it("partitionStopsAcrossDays yields exactly numDays non-empty groups", () => {
    const stops = [
      { name: "A", lat: 55.95, lng: -3.19 },
      { name: "B", lat: 55.951, lng: -3.191 },
      { name: "C", lat: 55.952, lng: -3.192 },
      { name: "D", lat: 55.88, lng: -3.25 },
      { name: "E", lat: 55.881, lng: -3.251 },
    ];
    const groups = partitionStopsAcrossDays(stops, 3);
    expect(groups).toHaveLength(3);
    expect(groups.every((g) => g.length >= 1)).toBe(true);
    expect(groups.flat()).toHaveLength(5);
  });

  it("keeps Falkirk seeds as local hotspots near Falkirk", () => {
    const kelpies = {
      name: "The Kelpies",
      lat: 56.0198,
      lng: -3.7785,
      category: "sculpture",
      popularityScore: 6,
    };
    const falkirk: ResolvedDestination = {
      mapboxId: "falkirk",
      name: "Falkirk",
      fullName: "Falkirk, Scotland",
      lat: 56.001,
      lng: -3.783,
    };
    const seeds = new Set([normalizeStopName("The Kelpies")]);
    expect(isLocalHotspot(kelpies, falkirk, seeds)).toBe(true);
    expect(isLocalHotspot(kelpies, parisDestination, seeds)).toBe(false);
  });

  it("keeps Cornwall seeds as local hotspots only near Cornwall", () => {
    const mount = {
      name: "St Michael's Mount",
      lat: 50.1163,
      lng: -5.4777,
      category: "landmark",
      popularityScore: 5,
    };
    const cornwall: ResolvedDestination = {
      mapboxId: "cornwall",
      name: "Cornwall",
      fullName: "Cornwall, England",
      lat: 50.266,
      lng: -5.052,
    };
    const seeds = new Set([normalizeStopName("St Michael's Mount")]);
    expect(isLocalHotspot(mount, cornwall, seeds)).toBe(true);
    expect(isLocalHotspot(mount, parisDestination, seeds)).toBe(false);
  });
});
