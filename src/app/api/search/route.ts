import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "@/lib/randomUuid";
import { unstable_cache } from "next/cache";

const SUGGEST_REVALIDATE_SECONDS = 60 * 60;
const RETRIEVE_REVALIDATE_SECONDS = 24 * 60 * 60;

function normalizeSearchQuery(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeSuggestCacheKey(
  q: string,
  proximity: string | null,
  language: string,
  limit: string,
  context: string | null
): string[] {
  const trimmed = normalizeSearchQuery(q);
  const prox = proximity ? proximity.replace(/\s/g, "") : "";
  const ctx = context?.trim().toLowerCase() || "default";
  return ["search", "suggest", trimmed, prox, language.trim().toLowerCase(), limit, ctx];
}

function normalizeRetrieveCacheKey(mapboxId: string, language: string): string[] {
  return ["search", "retrieve", mapboxId, language.trim().toLowerCase()];
}

interface SearchSuggestionResult {
  id: string;
  name: string;
  fullName: string;
  featureType?: string;
}

interface RetrievedLocationResult extends SearchSuggestionResult {
  lng: number;
  lat: number;
}

type CountryHint = {
  countryName: string;
  countryCode?: string;
};

const countryHintCache = new Map<string, { expiresAt: number; value: CountryHint | null }>();
const COUNTRY_HINT_TTL_MS = 6 * 60 * 60 * 1000;

function normalizeText(v: string): string {
  return v.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function parseProximity(proximity: string | null): { lng: number; lat: number } | null {
  if (!proximity) return null;
  const [lngRaw, latRaw] = proximity.split(",");
  const lng = Number(lngRaw);
  const lat = Number(latRaw);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  return { lng, lat };
}

async function getCountryHintFromProximity(
  proximity: string | null,
  token: string,
  language: string
): Promise<CountryHint | null> {
  const parsed = parseProximity(proximity);
  if (!parsed) return null;
  const proxKey = `${Math.round(parsed.lng * 100) / 100},${Math.round(parsed.lat * 100) / 100},${language.toLowerCase()}`;
  const cached = countryHintCache.get(proxKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }
  try {
    const params = new URLSearchParams({
      access_token: token,
      language,
      limit: "1",
      types: "country",
    });
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${parsed.lng},${parsed.lat}.json?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) {
      countryHintCache.set(proxKey, { value: null, expiresAt: Date.now() + COUNTRY_HINT_TTL_MS });
      return null;
    }
    const data = await res.json().catch(() => null);
    const feature = Array.isArray(data?.features) ? data.features[0] : null;
    const rawText = typeof feature?.text === "string" ? feature.text : "";
    const shortCode =
      typeof feature?.properties?.short_code === "string"
        ? String(feature.properties.short_code).split("-")[0]
        : undefined;
    if (!rawText) {
      countryHintCache.set(proxKey, { value: null, expiresAt: Date.now() + COUNTRY_HINT_TTL_MS });
      return null;
    }
    const value: CountryHint = {
      countryName: rawText.trim(),
      countryCode: shortCode?.trim().toLowerCase() || undefined,
    };
    countryHintCache.set(proxKey, { value, expiresAt: Date.now() + COUNTRY_HINT_TTL_MS });
    return value;
  } catch {
    countryHintCache.set(proxKey, { value: null, expiresAt: Date.now() + COUNTRY_HINT_TTL_MS });
    return null;
  }
}

async function fetchMapboxSuggest(
  q: string,
  proximity: string | null,
  limit: string,
  language: string,
  token: string,
  sessionToken: string,
  context: string | null
) {
  const isGenerateContext = context === "generate";
  const typeGroups = {
    poiLike: new Set(["poi", "landmark", "attraction", "establishment"]),
    areaLike: new Set(["country", "region", "district", "place", "locality", "neighborhood"]),
    addressLike: new Set(["address", "street", "postcode"]),
  };
  const roadLike = /\b(street|st|road|rd|avenue|ave|lane|ln|highway|hwy|boulevard|blvd|drive|dr)\b/i;
  const featureWeight = (t?: string) => {
    switch ((t || "").toLowerCase()) {
      case "poi":
      case "landmark":
      case "attraction":
      case "establishment":
        return 78;
      case "place":
      case "locality":
        return 80;
      case "region":
      case "country":
        return 72;
      case "district":
        return 62;
      case "neighborhood":
        return 50;
      case "address":
      case "street":
        return 46;
      case "postcode":
        return 38;
      default:
        return 30;
    }
  };
  const qNorm = normalizeText(q);
  const qTokens = qNorm.split(" ").filter(Boolean);
  const isGenericGeoQuery = qTokens.length <= 1 && qNorm.length <= 12;
  const isSpecificPoiQuery = qTokens.length >= 2;
  const countryHint = await getCountryHintFromProximity(proximity, token, language);
  const countryNorm = countryHint ? normalizeText(countryHint.countryName) : "";
  const params = new URLSearchParams({
    q,
    access_token: token,
    session_token: sessionToken,
    limit,
    language,
    types: isGenerateContext
      ? "country,region,district,place,locality,neighborhood,poi"
      : "poi,address,street,postcode,neighborhood,locality,district,place,region,country",
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
    .filter(
      (s: { mapbox_id?: string; feature_type?: string; name?: string }) => {
        if (!s.mapbox_id || typeof s.name !== "string" || s.name.trim().length === 0) {
          return false;
        }
        if (!isGenerateContext) return true;
        const featureType = (s.feature_type || "").toLowerCase();
        return (
          typeGroups.areaLike.has(featureType) ||
          typeGroups.poiLike.has(featureType)
        );
      }
    )
    .map(
      (s: {
        mapbox_id: string;
        name: string;
        full_address?: string;
        place_formatted?: string;
        feature_type?: string;
      }) => {
        const name = s.name.trim();
        const fullName = (s.full_address || s.place_formatted || s.name).trim();
        const nameNorm = normalizeText(name);
        const fullNorm = normalizeText(fullName);
        const featureType = (s.feature_type || "").toLowerCase();

        let score = featureWeight(featureType);
        if (nameNorm === qNorm) score += 70;
        if (nameNorm.startsWith(qNorm)) score += 45;
        if (fullNorm.startsWith(qNorm)) score += 24;
        const tokenMatches = qTokens.filter((t) => nameNorm.includes(t) || fullNorm.includes(t)).length;
        score += tokenMatches * 8;
        if (typeGroups.areaLike.has(featureType) && isGenericGeoQuery) score += 16;
        if (typeGroups.poiLike.has(featureType) && isSpecificPoiQuery) score += 22;
        if (typeGroups.addressLike.has(featureType) && isGenericGeoQuery) score -= 18;
        if (isGenerateContext && typeGroups.areaLike.has(featureType)) score += 34;
        if (isGenerateContext && typeGroups.poiLike.has(featureType)) score += 6;
        if (isGenerateContext && typeGroups.addressLike.has(featureType)) score -= 80;
        if ((/\d/.test(name) || roadLike.test(name)) && typeGroups.addressLike.has(featureType)) score -= 24;
        if (countryNorm && (fullNorm.includes(countryNorm) || nameNorm.includes(countryNorm))) {
          score += 36;
        } else if (countryNorm && fullNorm.length > 0) {
          score -= 8;
        }
        if (
          countryHint?.countryCode &&
          (fullNorm.includes(` ${countryHint.countryCode} `) ||
            fullNorm.endsWith(` ${countryHint.countryCode}`))
        ) {
          score += 12;
        }

        return {
          id: s.mapbox_id,
          name,
          fullName,
          featureType: s.feature_type,
          _score: score,
        } as SearchSuggestionResult & { _score: number };
      }
    );
  const deduped: Array<SearchSuggestionResult & { _score: number }> = [];
  const seen = new Set<string>();
  for (const s of suggestions.sort(
    (a: SearchSuggestionResult & { _score: number }, b: SearchSuggestionResult & { _score: number }) =>
      b._score - a._score
  )) {
    const key = normalizeText(`${s.name}|${s.fullName}`);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(s);
    if (deduped.length >= Number(limit)) break;
  }
  return deduped.map((item) => ({
    id: item.id,
    name: item.name,
    fullName: item.fullName,
    featureType: item.featureType,
  }));
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
  const cacheKey = normalizeRetrieveCacheKey(mapboxId, language);
  const cachedRetrieve = unstable_cache(
    () => fetchMapboxRetrieve(mapboxId, language, token, sessionToken),
    cacheKey,
    { revalidate: RETRIEVE_REVALIDATE_SECONDS }
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
  const context = searchParams.get("context");
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
  const normalizedQuery = normalizeSearchQuery(q);
  if (normalizedQuery.length < 3) {
    return NextResponse.json([], { status: 200 });
  }

  const cacheKey = normalizeSuggestCacheKey(normalizedQuery, proximity, language, limit, context);

  const getCachedSearch = unstable_cache(
    () => fetchMapboxSuggest(normalizedQuery, proximity, limit, language, token, sessionToken, context),
    cacheKey,
    { revalidate: SUGGEST_REVALIDATE_SECONDS }
  );

  try {
    const results = await getCachedSearch();
    return NextResponse.json(results, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=3600",
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
