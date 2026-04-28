export type DiscoverCategory = {
  id: string;
};

const make = (id: string): DiscoverCategory => ({ id });

/**
 * SDK-aligned category constants mirroring DiscoverQuery.Category usage.
 * In this React Native codepath, we map them to category identifiers used by Mapbox APIs.
 */
export const DiscoverCategories = {
  RESTAURANTS: make("restaurant"),
  COFFEE_SHOP_CAFE: make("coffee_shop_cafe"),
  BARS: make("bar"),
  PARKING: make("parking"),
  HOTEL: make("hotel"),
  MUSEUMS: make("museum"),
  PARKS: make("park"),
  GAS_STATION: make("gas_station"),
  create: (raw: string) => make(raw),
} as const;
