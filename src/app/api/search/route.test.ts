import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

describe("/api/search suggest ranking", () => {
  beforeEach(() => {
    process.env.MAPBOX_ACCESS_TOKEN = "test-token";
    vi.restoreAllMocks();
  });

  it("returns landmark POIs for specific queries", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          suggestions: [
            {
              mapbox_id: "poi.1",
              feature_type: "poi",
              name: "Edinburgh Castle",
              full_address: "Edinburgh Castle, Edinburgh, Scotland",
            },
          ],
        }),
      }))
    );

    const req = new NextRequest("http://localhost/api/search?q=Edinburgh%20Castle&limit=6");
    const res = await GET(req);
    const body = (await res.json()) as Array<{ name?: string; id?: string }>;

    expect(res.status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body[0]?.name).toBe("Edinburgh Castle");
    expect(body[0]?.id).toBe("poi.1");
  });

  it("keeps place-like matches above POIs for generic city queries", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          suggestions: [
            {
              mapbox_id: "poi.1",
              feature_type: "poi",
              name: "Edinburgh Castle",
              full_address: "Edinburgh Castle, Edinburgh, Scotland",
            },
            {
              mapbox_id: "place.1",
              feature_type: "place",
              name: "Edinburgh",
              full_address: "Edinburgh, Scotland, United Kingdom",
            },
          ],
        }),
      }))
    );

    const req = new NextRequest("http://localhost/api/search?q=Edinburgh&limit=6");
    const res = await GET(req);
    const body = (await res.json()) as Array<{ name?: string; id?: string }>;

    expect(res.status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body[0]?.name).toBe("Edinburgh");
    expect(body[0]?.id).toBe("place.1");
  });

  it("prefers regions and cities over POIs when context=generate", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          suggestions: [
            {
              mapbox_id: "poi.1",
              feature_type: "poi",
              name: "Edinburgh Castle",
              full_address: "Edinburgh Castle, Edinburgh, Scotland",
            },
            {
              mapbox_id: "place.1",
              feature_type: "place",
              name: "Edinburgh",
              full_address: "Edinburgh, Scotland, United Kingdom",
            },
            {
              mapbox_id: "addr.1",
              feature_type: "address",
              name: "10 Royal Mile",
              full_address: "10 Royal Mile, Edinburgh",
            },
          ],
        }),
      }))
    );

    const req = new NextRequest(
      "http://localhost/api/search?q=Edinburgh&limit=6&context=generate"
    );
    const res = await GET(req);
    const body = (await res.json()) as Array<{ name?: string; id?: string }>;

    expect(res.status).toBe(200);
    expect(body[0]?.name).toBe("Edinburgh");
    expect(body.some((row) => row.name === "10 Royal Mile")).toBe(false);
  });
});

