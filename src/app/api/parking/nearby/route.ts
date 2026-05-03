import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";

export async function GET(req: NextRequest) {
  const lat = req.nextUrl.searchParams.get("lat");
  const lng = req.nextUrl.searchParams.get("lng");
  const radius = req.nextUrl.searchParams.get("radius") || "3500";
  if (!lat || !lng) {
    return NextResponse.json({ error: "lat and lng are required" }, { status: 400 });
  }

  const apiKey = process.env.GEOAPIFY_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Geoapify API key not configured" }, { status: 500 });
  }

  const cacheKey = ["parking-nearby", lat, lng, radius];
  const getCached = unstable_cache(
    async () => {
      const params = new URLSearchParams({
        categories: "parking,service.vehicle.parking",
        filter: `circle:${lng},${lat},${radius}`,
        bias: `proximity:${lng},${lat}`,
        limit: "12",
        apiKey,
      });
      const res = await fetch(`https://api.geoapify.com/v2/places?${params.toString()}`);
      if (!res.ok) return [];
      const payload = await res.json();
      const features = Array.isArray(payload?.features) ? payload.features : [];
      return features.map((feature: { properties?: Record<string, unknown> }) => {
        const p = feature.properties || {};
        const confidence = typeof p.rank === "object" && p.rank && "confidence" in p.rank
          ? Number((p.rank as { confidence?: number }).confidence || 0)
          : 0;
        return {
          id: String(p.place_id || ""),
          name: String(p.name || p.address_line1 || "Parking"),
          lat: Number(p.lat || 0),
          lng: Number(p.lon || 0),
          address: String(p.address_line2 || p.address_line1 || ""),
          confidenceScore: Math.round(confidence * 100),
        };
      });
    },
    cacheKey,
    { revalidate: 900 }
  );

  const rows = await getCached();
  return NextResponse.json(rows);
}
