/**
 * Builds a Mapbox Static Images URL from itinerary waypoints (satellite + streets overlay).
 * Uses the public Mapbox token (same as the map client).
 */

const MAX_POINTS = 40;

function validPoint(w: { lat: number; lng: number }): boolean {
  return (
    Number.isFinite(w.lat) &&
    Number.isFinite(w.lng) &&
    Math.abs(w.lat) <= 90 &&
    Math.abs(w.lng) <= 180
  );
}

/** Downsample if there are many stops to keep URLs under Mapbox limits. */
function sampleWaypoints<T extends { lat: number; lng: number }>(wps: T[]): T[] {
  if (wps.length <= MAX_POINTS) return wps;
  const step = Math.ceil(wps.length / MAX_POINTS);
  const out: T[] = [];
  for (let i = 0; i < wps.length; i += step) {
    out.push(wps[i]!);
  }
  const lastWp = wps[wps.length - 1]!;
  const oLast = out[out.length - 1]!;
  if (oLast.lat !== lastWp.lat || oLast.lng !== lastWp.lng) {
    out.push(lastWp);
  }
  return out;
}

/**
 * Returns a Mapbox static map URL, or null if there is no token or no valid points.
 */
export function buildTripHeaderMapUrl(
  waypoints: { lat: number; lng: number }[],
  accessToken: string,
  width = 640,
  height = 220
): string | null {
  const token = accessToken.trim();
  if (!token) return null;

  const pts = sampleWaypoints(waypoints.filter(validPoint));
  if (pts.length === 0) return null;

  const style = "mapbox/satellite-streets-v12";

  const geometry =
    pts.length === 1
      ? ({
          type: "Point",
          coordinates: [pts[0]!.lng, pts[0]!.lat],
        } as const)
      : ({
          type: "LineString",
          coordinates: pts.map((p) => [p.lng, p.lat]),
        } as const);

  const feature = {
    type: "Feature" as const,
    properties: {},
    geometry,
  };

  let featureToUse = feature;
  let encoded = encodeURIComponent(JSON.stringify(featureToUse));
  let path = `geojson(${encoded})/auto/${width}x${height}@2x`;

  // Mapbox URLs have practical length limits; simplify route if needed.
  if (path.length > 3500 && pts.length > 3) {
    const simplified = [pts[0]!, pts[Math.floor(pts.length / 2)]!, pts[pts.length - 1]!];
    const g = {
      type: "LineString" as const,
      coordinates: simplified.map((p) => [p.lng, p.lat]),
    };
    featureToUse = { type: "Feature" as const, properties: {}, geometry: g };
    encoded = encodeURIComponent(JSON.stringify(featureToUse));
    path = `geojson(${encoded})/auto/${width}x${height}@2x`;
  }

  const params = new URLSearchParams({
    padding: "48",
    access_token: token,
  });

  return `https://api.mapbox.com/styles/v1/${style}/static/${path}?${params.toString()}`;
}
