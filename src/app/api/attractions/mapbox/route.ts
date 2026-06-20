import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import {
  fetchMapboxCategoryAttractions,
  MAPBOX_ATTRACTION_CATEGORIES,
  MAPBOX_ATTRACTIONS_DEFAULT_LIMIT_PER_CATEGORY,
  MAPBOX_ATTRACTIONS_DEFAULT_RADIUS_METERS,
  MAPBOX_ATTRACTIONS_MAX_LIMIT_PER_CATEGORY,
  MAPBOX_ATTRACTIONS_MAX_RADIUS_METERS,
} from "@/lib/mapbox/categoryAttractions";
const MAPBOX_ATTRACTIONS_REVALIDATE_SECONDS = 60 * 15;

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}


export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lng = Number(req.nextUrl.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat and lng are required" }, { status: 400 });
  }
  const bboxRaw = req.nextUrl.searchParams.get("bbox");
  const bbox =
    bboxRaw
      ?.split(",")
      .map((v) => Number(v.trim()))
      .filter((v) => Number.isFinite(v)) ?? [];
  const parsedBbox =
    bbox.length === 4
      ? ([bbox[0], bbox[1], bbox[2], bbox[3]] as [number, number, number, number])
      : undefined;

  const radiusMeters = clampNumber(
    Number(
      req.nextUrl.searchParams.get("radius") ||
        MAPBOX_ATTRACTIONS_DEFAULT_RADIUS_METERS
    ),
    500,
    MAPBOX_ATTRACTIONS_MAX_RADIUS_METERS
  );
  const limitPerCategory = clampNumber(
    Number(
      req.nextUrl.searchParams.get("limit") ||
        MAPBOX_ATTRACTIONS_DEFAULT_LIMIT_PER_CATEGORY
    ),
    1,
    MAPBOX_ATTRACTIONS_MAX_LIMIT_PER_CATEGORY
  );

  const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN;
  if (!mapboxToken) {
    return NextResponse.json(
      { error: "Mapbox token not configured" },
      { status: 500 }
    );
  }

  const key = [
    "mapbox-attractions",
    lat.toFixed(5),
    lng.toFixed(5),
    String(radiusMeters),
    String(limitPerCategory),
  ];
  const getCached = unstable_cache(
    () =>
      fetchMapboxCategoryAttractions({
        lat,
        lng,
        bbox: parsedBbox,
        radiusMeters,
        limitPerCategory,
        accessToken: mapboxToken,
      }),
    key,
    { revalidate: MAPBOX_ATTRACTIONS_REVALIDATE_SECONDS }
  );

  const features = await getCached();
  return NextResponse.json(
    {
      features,
      categories: MAPBOX_ATTRACTION_CATEGORIES,
      meta: { radiusMeters, limitPerCategory },
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800",
      },
    }
  );
}

