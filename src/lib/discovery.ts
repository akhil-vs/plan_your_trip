export type GemCategory =
  | "waterfalls"
  | "beaches"
  | "wild_swimming"
  | "family_friendly"
  | "accessible"
  | "castles";

export type RegionKey =
  | "england"
  | "scotland"
  | "wales"
  | "northern_ireland";

export type RegionPreset = {
  key: RegionKey;
  label: string;
  center: { lat: number; lng: number };
};

export const REGION_PRESETS: RegionPreset[] = [
  { key: "england", label: "England", center: { lat: 52.3555, lng: -1.1743 } },
  { key: "scotland", label: "Scotland", center: { lat: 56.4907, lng: -4.2026 } },
  { key: "wales", label: "Wales", center: { lat: 52.1307, lng: -3.7837 } },
  { key: "northern_ireland", label: "Northern Ireland", center: { lat: 54.7877, lng: -6.4923 } },
];

export const GEM_CATEGORY_LABELS: Record<GemCategory, string> = {
  waterfalls: "Waterfalls",
  beaches: "Beaches",
  wild_swimming: "Wild Swimming",
  family_friendly: "Family Friendly",
  accessible: "Accessible",
  castles: "Castles",
};

export const GEM_CATEGORY_PROVIDER_MAP: Record<
  GemCategory,
  { kinds: string; placesCategory: string }
> = {
  waterfalls: {
    kinds: "waterfalls,natural",
    placesCategory: "natural.waterfall",
  },
  beaches: {
    kinds: "beaches,natural",
    placesCategory: "beach",
  },
  wild_swimming: {
    kinds: "beaches,lakes,natural",
    placesCategory: "natural",
  },
  family_friendly: {
    kinds: "amusements,interesting_places",
    placesCategory: "entertainment",
  },
  accessible: {
    kinds: "interesting_places",
    placesCategory: "tourism.attraction",
  },
  castles: {
    kinds: "fortifications,architecture,historic",
    placesCategory: "heritage",
  },
};

export type GuideArticle = {
  slug: string;
  title: string;
  summary: string;
  region: RegionKey;
  category: GemCategory;
  readMinutes: number;
};

export const GUIDE_ARTICLES: GuideArticle[] = [
  {
    slug: "highland-waterfalls-weekend",
    title: "3-Day Highland Waterfalls Loop",
    summary: "A scenic loop covering falls, viewpoints, and short hikes with low driving stress.",
    region: "scotland",
    category: "waterfalls",
    readMinutes: 6,
  },
  {
    slug: "cornwall-hidden-beaches",
    title: "Cornwall Hidden Beaches You Can Actually Park Near",
    summary: "Quiet coves with practical parking tips and best-time windows for crowd avoidance.",
    region: "england",
    category: "beaches",
    readMinutes: 7,
  },
  {
    slug: "snowdonia-family-swims",
    title: "Family-Friendly Swim Spots in Snowdonia",
    summary: "Low-risk swim spots, picnic stops, and nearby facilities for easy day plans.",
    region: "wales",
    category: "family_friendly",
    readMinutes: 5,
  },
];

export type StaycationListing = {
  id: string;
  name: string;
  region: RegionKey;
  tags: string[];
  budgetBand: "budget" | "mid" | "premium";
  priceFrom: number;
};

export const STAYCATION_LISTINGS: StaycationListing[] = [
  {
    id: "stay-1",
    name: "Lochview Cabin Retreat",
    region: "scotland",
    tags: ["petFriendly", "hotTub", "couples", "cabins"],
    budgetBand: "mid",
    priceFrom: 145,
  },
  {
    id: "stay-2",
    name: "Peninsula Cliff Cottages",
    region: "england",
    tags: ["petFriendly", "family", "cottages"],
    budgetBand: "budget",
    priceFrom: 95,
  },
  {
    id: "stay-3",
    name: "Eryri Glamping Domes",
    region: "wales",
    tags: ["glamping", "couples", "under100"],
    budgetBand: "budget",
    priceFrom: 88,
  },
  {
    id: "stay-4",
    name: "Causeway Coast Hideout",
    region: "northern_ireland",
    tags: ["hotTub", "luxury", "couples"],
    budgetBand: "premium",
    priceFrom: 220,
  },
];
