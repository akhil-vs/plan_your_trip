import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";

export const dynamic = "force-dynamic";
const REVERSE_GEOCODE_REVALIDATE_SECONDS = 60 * 60;

function fallbackName(lat: number, lng: number) {
  return `Selected location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
}

async function fetchReverseGeocodeName(lat: number, lng: number) {
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
          return placeName.trim();
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
          return label.trim();
        }
      }
    } catch {
      // fallback below
    }
  }

  return fallbackName(lat, lng);
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

  const roundedLat = Number(lat.toFixed(5));
  const roundedLng = Number(lng.toFixed(5));
  const providerKey = process.env.MAPBOX_ACCESS_TOKEN ? "mapbox" : process.env.GEOAPIFY_API_KEY ? "geoapify" : "fallback";
  const getCachedName = unstable_cache(
    () => fetchReverseGeocodeName(roundedLat, roundedLng),
    ["reverse-geocode", providerKey, String(roundedLat), String(roundedLng)],
    { revalidate: REVERSE_GEOCODE_REVALIDATE_SECONDS }
  );
  const name = await getCachedName();
  return NextResponse.json(
    { name },
    {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=3600",
      },
    }
  );
}

