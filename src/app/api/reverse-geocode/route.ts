import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function fallbackName(lat: number, lng: number) {
  return `Selected location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const latRaw = searchParams.get("lat");
  const lngRaw = searchParams.get("lng");
  const lat = Number(latRaw);
  const lng = Number(lngRaw);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  }

  const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN;
  if (mapboxToken) {
    try {
      const endpoint = `https://api.mapbox.com/search/geocode/v6/reverse?longitude=${encodeURIComponent(
        String(lng)
      )}&latitude=${encodeURIComponent(
        String(lat)
      )}&types=address,street,place,locality,neighborhood,district,region,country&limit=1&access_token=${encodeURIComponent(
        mapboxToken
      )}`;
      const res = await fetch(endpoint);
      if (res.ok) {
        const data = await res.json();
        const feature = data?.features?.[0];
        const properties = feature?.properties;
        const context = properties?.context;
        const address = properties?.full_address;
        const placeName =
          address ||
          context?.place?.name ||
          context?.locality?.name ||
          context?.district?.name ||
          context?.region?.name ||
          feature?.properties?.name ||
          null;
        if (typeof placeName === "string" && placeName.trim()) {
          return NextResponse.json({ name: placeName.trim() });
        }
      }
    } catch {
      // fall through to geoapify/fallback
    }
  }

  const geoapifyKey = process.env.GEOAPIFY_API_KEY;
  if (geoapifyKey) {
    try {
      const endpoint = `https://api.geoapify.com/v1/geocode/reverse?lat=${encodeURIComponent(
        String(lat)
      )}&lon=${encodeURIComponent(
        String(lng)
      )}&apiKey=${encodeURIComponent(geoapifyKey)}`;
      const res = await fetch(endpoint);
      if (res.ok) {
        const data = await res.json();
        const label = data?.features?.[0]?.properties?.formatted;
        if (typeof label === "string" && label.trim()) {
          return NextResponse.json({ name: label.trim() });
        }
      }
    } catch {
      // fallback below
    }
  }

  return NextResponse.json({ name: fallbackName(lat, lng) });
}

