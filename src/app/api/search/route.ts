import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { unstable_cache } from "next/cache";

function normalizeCacheKey(q: string, proximity: string | null): string[] {
  const trimmed = q.trim().toLowerCase();
  const prox = proximity ? proximity.replace(/\s/g, "") : "";
  return ["search", trimmed, prox];
}

async function fetchMapboxSearch(
  q: string,
  proximity: string | null,
  limit: string,
  language: string
) {
  const token = process.env.MAPBOX_ACCESS_TOKEN;
  if (!token) throw new Error("Mapbox token not configured");

  const sessionToken = crypto.randomUUID();

  const params = new URLSearchParams({
    q,
    access_token: token,
    session_token: sessionToken,
    limit,
    language,
  });
  if (proximity) params.set("proximity", proximity);

  const url = `https://api.mapbox.com/search/searchbox/v1/suggest?${params}`;
  const res = await fetch(url);

  if (!res.ok) {
    const errorBody = await res.text();
    console.error("Mapbox suggest failed:", res.status, errorBody);
    throw new Error(`Search failed: ${res.status}`);
  }

  const data = await res.json();

  const results = await Promise.all(
    (data.suggestions || [])
      .filter((s: { mapbox_id?: string }) => s.mapbox_id)
      .slice(0, 8)
      .map(
        async (s: {
          mapbox_id: string;
          name: string;
          full_address?: string;
          place_formatted?: string;
        }) => {
          const retrieveRes = await fetch(
            `https://api.mapbox.com/search/searchbox/v1/retrieve/${s.mapbox_id}?access_token=${token}&session_token=${sessionToken}`
          );
          if (!retrieveRes.ok) return null;
          const retrieveData = await retrieveRes.json();
          const feature = retrieveData.features?.[0];
          if (!feature) return null;

          return {
            id: s.mapbox_id,
            name: s.name,
            fullName: s.full_address || s.place_formatted || s.name,
            lng: feature.geometry.coordinates[0],
            lat: feature.geometry.coordinates[1],
          };
        }
      )
  );

  return results.filter(Boolean);
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q");
  if (!q) {
    return NextResponse.json([], { status: 200 });
  }

  const token = process.env.MAPBOX_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "Mapbox token not configured" },
      { status: 500 }
    );
  }

  const limit = searchParams.get("limit") || "8";
  const language = searchParams.get("language") || "en";
  const proximity = searchParams.get("proximity");

  const cacheKey = normalizeCacheKey(q, proximity);

  const getCachedSearch = unstable_cache(
    () => fetchMapboxSearch(q, proximity, limit, language),
    cacheKey,
    { revalidate: 86400 }
  );

  try {
    const results = await getCachedSearch();
    return NextResponse.json(results);
  } catch (err) {
    console.error("Search error:", err);
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    );
  }
}
