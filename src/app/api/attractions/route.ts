import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import {
  WAYPOINT_EXPLORE_ATTRACTIONS_KINDS,
  WAYPOINT_EXPLORE_ATTRACTIONS_LIMIT,
  WAYPOINT_EXPLORE_ATTRACTIONS_MIN_RATE,
  WAYPOINT_EXPLORE_RADIUS_METERS,
} from "@/lib/opentripmap/waypointExploreParams";

const normalizeCoord = (value: string) => Number.parseFloat(value).toFixed(4);
const normalizeNumberLike = (value: string, fallback: string) => {
  const numeric = Number.parseFloat(value);
  return Number.isFinite(numeric) ? String(numeric) : fallback;
};

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const defaultRadius = String(WAYPOINT_EXPLORE_RADIUS_METERS);
  const radius = searchParams.get("radius") || defaultRadius;
  const kinds = searchParams.get("kinds") || WAYPOINT_EXPLORE_ATTRACTIONS_KINDS;

  if (!lat || !lng) {
    return NextResponse.json(
      { error: "lat and lng are required" },
      { status: 400 }
    );
  }

  const apiKey = process.env.OPENTRIPMAP_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OpenTripMap API key not configured" },
      { status: 500 }
    );
  }

  try {
    const normalizedLat = normalizeCoord(lat);
    const normalizedLng = normalizeCoord(lng);
    const normalizedRadius = normalizeNumberLike(radius, defaultRadius);
    const normalizedKinds = kinds.trim().toLowerCase();
    const cacheKey = ["attractions", normalizedLat, normalizedLng, normalizedRadius, normalizedKinds];

    const getCachedAttractions = unstable_cache(
      async () => {
        const params = new URLSearchParams({
          radius,
          lon: lng,
          lat,
          kinds,
          rate: String(WAYPOINT_EXPLORE_ATTRACTIONS_MIN_RATE),
          format: "json",
          limit: String(WAYPOINT_EXPLORE_ATTRACTIONS_LIMIT),
          apikey: apiKey,
        });

        const res = await fetch(`https://api.opentripmap.com/0.1/en/places/radius?${params}`);
        if (!res.ok) throw new Error(`OpenTripMap request failed (${res.status})`);
        const data = await res.json();
        return (data || [])
          .map((p: {
            xid: string;
            name: string;
            point: { lon: number; lat: number };
            kinds: string;
            rate: number;
          }) => ({
            id: p.xid,
            name: p.name || "Unnamed Place",
            lat: p.point.lat,
            lng: p.point.lon,
            category: "attraction",
            subcategory: p.kinds?.split(",")[0] || "",
            rating: p.rate || 0,
            source: "opentripmap",
          }))
          .filter((p: { name: string }) => p.name && p.name !== "Unnamed Place");
      },
      cacheKey,
      { revalidate: 900 }
    );

    const pois = await getCachedAttractions();
    return NextResponse.json(pois, {
      headers: {
        "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch attractions" },
      { status: 500 }
    );
  }
}
