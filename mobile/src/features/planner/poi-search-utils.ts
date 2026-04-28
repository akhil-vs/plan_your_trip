import type { LocationSearchResult } from "@/types/domain";

export type RankedPoiLike = LocationSearchResult & {
  distanceMeters: number;
  score: number;
};

const EARTH_RADIUS_M = 6371000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

export const haversineMeters = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
};

const normalizeName = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const dedupeResultsByNameProximity = <T extends RankedPoiLike>(items: T[]) => {
  const output: T[] = [];
  for (const item of items) {
    const normalized = normalizeName(item.name);
    const hasNearbyDuplicate = output.some((existing) => {
      if (normalizeName(existing.name) !== normalized) return false;
      const d = haversineMeters({ lat: existing.lat, lng: existing.lng }, { lat: item.lat, lng: item.lng });
      // Keep different branches/franchises; only collapse near-identical duplicates.
      return d <= 650;
    });
    if (!hasNearbyDuplicate) output.push(item);
  }
  return output;
};
