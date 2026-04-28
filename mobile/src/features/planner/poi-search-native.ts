import { NativeModules, Platform } from "react-native";
import type { POIFeature } from "./poi-search-model";

type NativePoiRow = {
  mapboxId: string;
  name: string;
  lng: number;
  lat: number;
  category: string;
  address: string;
};

type MapboxDiscoverPoiNative = {
  searchNearby(accessToken: string, categories: string[], lng: number, lat: number): Promise<NativePoiRow[]>;
  searchAlongRoute(accessToken: string, categories: string[], routePoints: [number, number][]): Promise<NativePoiRow[]>;
};

const moduleRef = NativeModules.MapboxDiscoverPoi as MapboxDiscoverPoiNative | undefined;

const mapRow = (row: NativePoiRow): POIFeature => ({
  mapboxId: row.mapboxId,
  name: row.name,
  coordinates: [row.lng, row.lat],
  category: row.category,
  address: row.address,
  distanceMeters: 0,
  routeOffsetMeters: null,
  fullDetails: null,
});

export const nativePoiDiscover = {
  isAvailable(): boolean {
    return Platform.OS === "android" && Boolean(moduleRef);
  },
  async searchNearby(accessToken: string, categories: string[], location: [number, number]): Promise<POIFeature[]> {
    if (!moduleRef) return [];
    const rows = await moduleRef.searchNearby(accessToken, categories, location[0], location[1]);
    return rows.map(mapRow);
  },
  async searchAlongRoute(accessToken: string, categories: string[], routePoints: [number, number][]): Promise<POIFeature[]> {
    if (!moduleRef) return [];
    const rows = await moduleRef.searchAlongRoute(accessToken, categories, routePoints);
    return rows.map(mapRow);
  },
};

