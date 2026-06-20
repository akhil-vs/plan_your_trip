import { describe, expect, it } from "vitest";
import { bboxSpanKm, computeOtmSamplingParams } from "./nearbyAttractions";

/** Approximate Mapbox bbox for Edinburgh locality. */
const edinburghBbox: [number, number, number, number] = [
  -3.32,
  55.9,
  -3.05,
  55.98,
];

describe("bboxSpanKm", () => {
  it("returns span for a compact city bbox", () => {
    const span = bboxSpanKm(edinburghBbox);
    expect(span).not.toBeNull();
    expect(span!).toBeGreaterThan(5);
    expect(span!).toBeLessThan(35);
  });

  it("returns null when bbox missing", () => {
    expect(bboxSpanKm(undefined)).toBeNull();
  });
});

describe("computeOtmSamplingParams", () => {
  it("uses inner ring and modest outer ring for compact destinations", () => {
    const p = computeOtmSamplingParams(3, edinburghBbox);
    expect(p.ringKmInner).toBe(1.2);
    expect(p.ringKmOuter).toBeLessThanOrEqual(6);
    expect(p.ringKmOuter).toBeGreaterThan(2);
    expect(p.radiusPrimaryMeters).toBeLessThanOrEqual(22000);
  });

  it("uses wider rings for sprawling destinations", () => {
    const wideBbox: [number, number, number, number] = [-6, 49.5, 2, 51.5];
    const p = computeOtmSamplingParams(3, wideBbox);
    expect(p.ringKmInner).toBeNull();
    expect(p.ringKmOuter).toBeGreaterThan(15);
    expect(p.radiusPrimaryMeters).toBeGreaterThan(20000);
  });
});
