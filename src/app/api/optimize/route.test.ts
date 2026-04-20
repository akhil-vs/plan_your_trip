import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  POST,
  optimizeWaypointOrderByDurationMatrix,
} from "./route";

vi.mock("@/lib/api-auth", () => ({
  getApiUser: vi.fn(async () => ({ id: "test-user", plan: "PRO" })),
}));

vi.mock("@/lib/subscription", () => ({
  canUseAdvancedOptimization: vi.fn(() => true),
}));

describe("optimizeWaypointOrderByDurationMatrix", () => {
  it("optimizes multi-stop order by matrix travel time", () => {
    const ids = optimizeWaypointOrderByDurationMatrix({
      waypoints: [
        { id: "A", name: "A", lat: 0, lng: 0 },
        { id: "B", name: "B", lat: 0, lng: 1 },
        { id: "C", name: "C", lat: 0, lng: 2 },
        { id: "D", name: "D", lat: 0, lng: 3 },
      ],
      fixedStart: true,
      fixedEnd: true,
      durations: [
        [0, 10, 40, 80],
        [10, 0, 30, 20],
        [40, 30, 0, 10],
        [80, 20, 10, 0],
      ],
    });
    expect(ids).toEqual(["A", "B", "C", "D"]);
  });

  it("respects locked waypoints between anchors", () => {
    const ids = optimizeWaypointOrderByDurationMatrix({
      waypoints: [
        { id: "A", name: "A", lat: 0, lng: 0 },
        { id: "B", name: "B", lat: 0, lng: 1 },
        { id: "C", name: "C", lat: 0, lng: 2 },
        { id: "D", name: "D", lat: 0, lng: 3 },
        { id: "E", name: "E", lat: 0, lng: 4 },
      ],
      fixedStart: true,
      fixedEnd: true,
      lockedWaypointIds: ["C"],
      durations: [
        [0, 10, 60, 20, 80],
        [10, 0, 70, 20, 90],
        [60, 70, 0, 70, 20],
        [20, 20, 70, 0, 10],
        [80, 90, 20, 10, 0],
      ],
    });
    expect(ids.indexOf("C")).toBe(2);
    expect(ids[0]).toBe("A");
    expect(ids[ids.length - 1]).toBe("E");
  });

  it("handles medium-size stop sets within a bounded runtime", () => {
    const size = 15;
    const waypoints = Array.from({ length: size }, (_, idx) => ({
      id: `W${idx}`,
      name: `W${idx}`,
      lat: 0,
      lng: idx,
    }));
    const durations = Array.from({ length: size }, (_, i) =>
      Array.from({ length: size }, (_, j) => (i === j ? 0 : Math.abs(i - j) * 60))
    );
    const start = Date.now();
    const ids = optimizeWaypointOrderByDurationMatrix({
      waypoints,
      durations,
      fixedStart: true,
      fixedEnd: true,
    });
    const elapsedMs = Date.now() - start;
    expect(ids).toHaveLength(size);
    expect(elapsedMs).toBeLessThan(300);
  });
});

describe("optimize route API", () => {
  it("reports conflicts for narrow time windows", async () => {
    const req = new NextRequest("http://localhost/api/optimize", {
      method: "POST",
      body: JSON.stringify({
        waypoints: [
          { id: "A", name: "A", lat: 40.7128, lng: -74.006 },
          { id: "B", name: "B", lat: 34.0522, lng: -118.2437 },
          { id: "C", name: "C", lat: 37.7749, lng: -122.4194 },
        ],
        fixedStart: true,
        fixedEnd: true,
        dayStartMinutes: 9 * 60,
        dayEndMinutes: 10 * 60,
        defaultVisitMinutes: 45,
        timeWindowsByWaypointId: {
          B: { openMinutes: 9 * 60, closeMinutes: 9 * 60 + 10 },
        },
      }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    const body = (await res.json()) as { conflicts?: Array<{ message: string }> };
    expect(Array.isArray(body.conflicts)).toBe(true);
    expect((body.conflicts || []).length).toBeGreaterThan(0);
  });
});
