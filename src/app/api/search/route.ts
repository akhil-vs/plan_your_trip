import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "@/lib/randomUuid";
import { unstable_cache } from "next/cache";

function normalizeSuggestCacheKey(
  q: string,
  proximity: string | null,
  language: string,
  limit: string
): string[] {
  const trimmed = q.trim().toLowerCase();
  const prox = proximity ? proximity.replace(/\s/g, "") : "";
  return ["search", "suggest", trimmed, prox, language, limit];
}

function normalizeRetrieveCacheKey(mapboxId: string, language: string, sessionToken: string): string[] {
  return ["search", "retrieve", mapboxId, language.toLowerCase(), sessionToken];
}

interface SearchSuggestionResult {
  id: string;
  name: string;
  fullName: string;
}

interface RetrievedLocationResult extends SearchSuggestionResult {
  lng: number;
  lat: number;
}

async function fetchMapboxSuggest(
  q: string,
  proximity: string | null,
  limit: string,
  language: string,
  token: string,
  sessionToken: string
) {
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
  const suggestions = (data.suggestions || [])
    .filter((s: { mapbox_id?: string }) => s.mapbox_id)
    .slice(0, Number(limit))
    .map(
      (s: {
        mapbox_id: string;
        name: string;
        full_address?: string;
        place_formatted?: string;
      }): SearchSuggestionResult => ({
        id: s.mapbox_id,
        name: s.name,
        fullName: s.full_address || s.place_formatted || s.name,
      })
    );
  return suggestions;
}

async function fetchMapboxRetrieve(
  mapboxId: string,
  language: string,
  token: string,
  sessionToken: string
): Promise<RetrievedLocationResult | null> {
  const params = new URLSearchParams({
    access_token: token,
    language,
    session_token: sessionToken,
  });
  const url = `https://api.mapbox.com/search/searchbox/v1/retrieve/${mapboxId}?${params}`;
  const res = await fetch(url);
  if (!res.ok) {
    const errorBody = await res.text();
    console.error("Mapbox retrieve failed:", res.status, errorBody);
    return null;
  }
  const data = await res.json();
  const feature = data.features?.[0];
  if (!feature) return null;
  const props = feature.properties || {};
  return {
    id: mapboxId,
    name: props.name || props.place_formatted || "Selected location",
    fullName: props.full_address || props.place_formatted || props.name || "Selected location",
    lng: feature.geometry.coordinates[0],
    lat: feature.geometry.coordinates[1],
  };
}

async function getCachedRetrieve(
  mapboxId: string,
  language: string,
  token: string,
  sessionToken: string
) {
  const cacheKey = normalizeRetrieveCacheKey(mapboxId, language, sessionToken);
  const cachedRetrieve = unstable_cache(
    () => fetchMapboxRetrieve(mapboxId, language, token, sessionToken),
    cacheKey,
    { revalidate: 86400 }
  );
  return cachedRetrieve();
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q");
  const mapboxId = searchParams.get("mapbox_id");

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
  const sessionToken = searchParams.get("session_token") || randomUUID();

  if (mapboxId) {
    const retrieved = await getCachedRetrieve(mapboxId, language, token, sessionToken);
    if (!retrieved) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }
    return NextResponse.json(retrieved, {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400",
      },
    });
  }

  if (!q) {
    return NextResponse.json([], { status: 200 });
  }
  if (q.trim().length < 3) {
    return NextResponse.json([], { status: 200 });
  }

  const cacheKey = normalizeSuggestCacheKey(q, proximity, language, limit);

  const getCachedSearch = unstable_cache(
    () => fetchMapboxSuggest(q, proximity, limit, language, token, sessionToken),
    cacheKey,
    { revalidate: 900 }
  );

  try {
    const results = await getCachedSearch();
    return NextResponse.json(results, {
      headers: {
        "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800",
      },
    });
  } catch (err) {
    console.error("Search error:", err);
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    );
  }
}
