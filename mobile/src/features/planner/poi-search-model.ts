import { DiscoverCategories, type DiscoverCategory } from "./mapbox-discover-categories";

export type SearchMode = "NEARBY" | "ALONG_ROUTE";

export type ChipType = "FOOD" | "PARKING" | "STAY" | "ATTRACTIONS" | "FUEL";

export type POIDetail = {
  phone?: string;
  website?: string;
  hours?: string[];
};

export type POIFeature = {
  mapboxId: string;
  name: string;
  coordinates: [number, number];
  category: string;
  address: string;
  distanceMeters: number;
  routeOffsetMeters: number | null;
  fullDetails: POIDetail | null;
};

export const CHIP_DEFINITIONS: Record<
  ChipType,
  {
    label: string;
    emoji: string;
    color: string;
    categories: DiscoverCategory[];
  }
> = {
  FOOD: {
    label: "Food",
    emoji: "🍽",
    color: "#FF6B35",
    categories: [
      DiscoverCategories.RESTAURANTS,
      DiscoverCategories.COFFEE_SHOP_CAFE,
      DiscoverCategories.BARS,
    ],
  },
  PARKING: {
    label: "Parking",
    emoji: "🅿",
    color: "#1A73E8",
    categories: [DiscoverCategories.PARKING],
  },
  STAY: {
    label: "Stay",
    emoji: "🏨",
    color: "#9C27B0",
    categories: [DiscoverCategories.HOTEL],
  },
  ATTRACTIONS: {
    label: "Attractions",
    emoji: "🏛",
    color: "#2E7D32",
    categories: [
      DiscoverCategories.MUSEUMS,
      DiscoverCategories.PARKS,
      DiscoverCategories.create("scenic_viewpoint"),
      DiscoverCategories.create("historic"),
      DiscoverCategories.create("amusement_park"),
      DiscoverCategories.create("zoo"),
      DiscoverCategories.create("aquarium"),
      DiscoverCategories.create("art_gallery"),
    ],
  },
  FUEL: {
    label: "Fuel",
    emoji: "⛽",
    color: "#F9A825",
    categories: [DiscoverCategories.GAS_STATION],
  },
};
