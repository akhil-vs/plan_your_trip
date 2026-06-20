/**
 * Stable key for ordered stop coordinates (matches server normalization in /api/directions).
 */
export function buildDirectionsCoordKeyFromCoords(coords: [number, number][]): string {
  return coords
    .map(([lng, lat]) => `${Number(lng.toFixed(6))},${Number(lat.toFixed(6))}`)
    .join(";");
}

export function buildDirectionsCoordKeyFromWaypoints(
  waypoints: Array<{ lat: number; lng: number }>
): string {
  const coords: [number, number][] = waypoints.map((w) => [w.lng, w.lat]);
  return buildDirectionsCoordKeyFromCoords(coords);
}
