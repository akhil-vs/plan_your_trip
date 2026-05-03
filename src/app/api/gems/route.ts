import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import {
  GEM_CATEGORY_LABELS,
  GEM_CATEGORY_PROVIDER_MAP,
  REGION_PRESETS,
  type GemCategory,
  type RegionKey,
} from "@/lib/discovery";

const VALID_CATEGORIES = new Set(Object.keys(GEM_CATEGORY_PROVIDER_MAP));
const VALID_REGIONS = new Set(REGION_PRESETS.map((region) => region.key));

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const category = (searchParams.get("category") || "waterfalls") as GemCategory;
  const region = (searchParams.get("region") || "england") as RegionKey;
  const limit = Math.min(30, Math.max(5, Number(searchParams.get("limit") || "12")));

  if (!VALID_CATEGORIES.has(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }
  if (!VALID_REGIONS.has(region)) {
    return NextResponse.json({ error: "Invalid region" }, { status: 400 });
  }

  const regionPreset = REGION_PRESETS.find((preset) => preset.key === region) ?? REGION_PRESETS[0];
  const providerMap = GEM_CATEGORY_PROVIDER_MAP[category];
  const apiKey = process.env.OPENTRIPMAP_API_KEY;

  const cacheKey = ["gems", category, region, String(limit)];
  const getCachedGems = unstable_cache(
    async () => {
      if (!apiKey) {
        return [];
      }
      const params = new URLSearchParams({
        radius: "45000",
        lon: String(regionPreset.center.lng),
        lat: String(regionPreset.center.lat),
        kinds: providerMap.kinds,
        rate: "2",
        format: "json",
        limit: String(limit),
        apikey: apiKey,
      });
      const res = await fetch(`https://api.opentripmap.com/0.1/en/places/radius?${params.toString()}`);
      if (!res.ok) return [];
      const rows = (await res.json()) as Array<{
        xid: string;
        name: string;
        kinds: string;
        point: { lon: number; lat: number };
      }>;
      return rows
        .filter((item) => item?.name && item.name !== "Unnamed Place")
        .map((item) => ({
          id: item.xid,
          name: item.name,
          lat: item.point.lat,
          lng: item.point.lon,
          category,
          categoryLabel: GEM_CATEGORY_LABELS[category],
          region,
          regionLabel: regionPreset.label,
          kinds: item.kinds,
        }));
    },
    cacheKey,
    { revalidate: 900 }
  );

  const gems = await getCachedGems();
  return NextResponse.json({
    categories: Object.entries(GEM_CATEGORY_LABELS).map(([key, label]) => ({ key, label })),
    regions: REGION_PRESETS.map((preset) => ({ key: preset.key, label: preset.label })),
    gems,
  });
}
