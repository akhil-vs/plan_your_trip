import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";

const normalizeCoord = (value: string) => Number.parseFloat(value).toFixed(4);
const normalizeNumberLike = (value: string, fallback: string) => {
  const numeric = Number.parseFloat(value);
  return Number.isFinite(numeric) ? String(numeric) : fallback;
};

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const radius = searchParams.get("radius") || "10000";
  const categories = searchParams.get("categories") || "accommodation";
  const limit = searchParams.get("limit") || "40";

  if (!lat || !lng) {
    return NextResponse.json(
      { error: "lat and lng are required" },
      { status: 400 }
    );
  }

  const apiKey = process.env.GEOAPIFY_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Geoapify API key not configured" },
      { status: 500 }
    );
  }

  try {
    const normalizedLat = normalizeCoord(lat);
    const normalizedLng = normalizeCoord(lng);
    const normalizedRadius = normalizeNumberLike(radius, "10000");
    const normalizedLimit = normalizeNumberLike(limit, "40");
    const normalizedCategories = categories.trim().toLowerCase();
    const cacheKey = ["places", normalizedLat, normalizedLng, normalizedRadius, normalizedCategories, normalizedLimit];

    const getCachedPlaces = unstable_cache(
      async () => {
        const params = new URLSearchParams({
          categories,
          filter: `circle:${lng},${lat},${radius}`,
          bias: `proximity:${lng},${lat}`,
          limit,
          apiKey,
        });

        const res = await fetch(`https://api.geoapify.com/v2/places?${params}`);
        if (!res.ok) throw new Error(`Geoapify request failed (${res.status})`);
        const data = await res.json();
        return (data.features || [])
          .map((f: {
            properties: {
              place_id: string;
              name?: string;
              lat: number;
              lon: number;
              categories?: string[];
              address_line1?: string;
              address_line2?: string;
              datasource?: {
                raw?: {
                  cuisine?: string;
                  stars?: number;
                  rating?: number;
                  image?: string;
                  website?: string;
                  opening_hours?: string;
                };
              };
              opening_hours?: string;
            };
          }) => {
            const p = f.properties;
            const raw = p.datasource?.raw;
            const categoryParts = (p.categories || [])[0]?.split(".") || [];
            return {
              id: p.place_id,
              name: p.name || p.address_line1 || "Unnamed Place",
              lat: p.lat,
              lng: p.lon,
              category: categoryParts[0] || categories.split(".")[0],
              subcategory: categoryParts.slice(1).join(" ") || "",
              address: p.address_line2 || p.address_line1 || "",
              rating: raw?.stars || raw?.rating || 0,
              url: raw?.website || "",
              openingHours: p.opening_hours || raw?.opening_hours || "",
              source: "geoapify" as const,
            };
          })
          .filter((p: { name: string }) => p.name && p.name !== "Unnamed Place");
      },
      cacheKey,
      { revalidate: 900 }
    );

    const pois = await getCachedPlaces();
    return NextResponse.json(pois, {
      headers: {
        "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch places" },
      { status: 500 }
    );
  }
}
