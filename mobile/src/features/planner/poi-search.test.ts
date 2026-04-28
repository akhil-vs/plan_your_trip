import { describe, expect, it } from "vitest";
import { dedupeResultsByNameProximity, type RankedPoiLike } from "./poi-search-utils";

const base = (overrides: Partial<RankedPoiLike>): RankedPoiLike => ({
  id: "id-1",
  name: "Bakery Court",
  fullName: "Bakery Court, Sample Street",
  lat: 53.48,
  lng: -2.24,
  distanceMeters: 1200,
  score: 90,
  ...overrides,
});

describe("poi-search dedupe", () => {
  it("drops same-name nearby duplicates", () => {
    const input: RankedPoiLike[] = [
      base({ id: "a", name: "Bakery Court", lat: 53.48, lng: -2.24 }),
      base({ id: "b", name: "Bakery Court", lat: 53.4808, lng: -2.241 }),
      base({ id: "c", name: "Another Cafe", lat: 53.49, lng: -2.23 }),
    ];
    const output = dedupeResultsByNameProximity(input);
    expect(output).toHaveLength(2);
    expect(output.map((item) => item.id)).toEqual(["a", "c"]);
  });
});
