import { describe, expect, it } from "vitest";
import {
  dedupeStops,
  kMeansAssign,
  normalizeStopName,
  orderClusterStops,
  orderClustersByProximity,
  stopsPerDayForPace,
} from "./fromDestination";

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
