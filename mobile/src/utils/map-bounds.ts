type LngLat = [number, number];

/**
 * Returns Mapbox camera bounds (ne/sw as [lng, lat]) from a list of coordinates.
 */
export function lngLatBoundsFromCoordinates(coords: LngLat[]): {
  ne: LngLat;
  sw: LngLat;
} | null {
  if (coords.length === 0) return null;
  let minLng = Number.POSITIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLng = Number.NEGATIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  for (const [lng, lat] of coords) {
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  if (
    !Number.isFinite(minLng) ||
    !Number.isFinite(minLat) ||
    !Number.isFinite(maxLng) ||
    !Number.isFinite(maxLat)
  ) {
    return null;
  }
  if (minLng === maxLng && minLat === maxLat) {
    const pad = 0.01;
    return {
      ne: [maxLng + pad, maxLat + pad],
      sw: [minLng - pad, minLat - pad],
    };
  }
  return { ne: [maxLng, maxLat], sw: [minLng, minLat] };
}
