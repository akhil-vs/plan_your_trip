import { MAPBOX_ACCESS_TOKEN } from "@env";
import { MAPBOX_BASE_URL, MAPBOX_GEOCODING_PATH } from "../constants/mapbox";
import { LngLat, MapboxGeocodeResponse, PlaceSuggestion } from "../types/place.types";
import { MapboxDirectionsResponse, TravelMode } from "../types/route.types";

export async function geocodePlace(query: string, proximity?: LngLat): Promise<PlaceSuggestion[]> {
  const proximityQuery = proximity ? `&proximity=${proximity.join(",")}` : "";
  const url =
    `${MAPBOX_BASE_URL}${MAPBOX_GEOCODING_PATH}/${encodeURIComponent(query)}.json` +
    `?access_token=${MAPBOX_ACCESS_TOKEN}&limit=5${proximityQuery}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Geocoding request failed: ${response.status}`);
  }

  const data = (await response.json()) as MapboxGeocodeResponse;
  return data.features
    .filter((feature) => Array.isArray(feature.center) && feature.center.length === 2)
    .map((feature) => ({
      id: feature.id,
      name: feature.text,
      secondaryText: feature.place_name,
      coords: [feature.center![0], feature.center![1]],
    }));
}

export async function getDirections(
  coords: LngLat[],
  profile: TravelMode,
): Promise<MapboxDirectionsResponse> {
  const coordStr = coords.map((coord) => coord.join(",")).join(";");
  const url =
    `${MAPBOX_BASE_URL}/directions/v5/mapbox/${profile}/${coordStr}` +
    `?geometries=geojson&overview=full&steps=true&language=en&access_token=${MAPBOX_ACCESS_TOKEN}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Directions request failed: ${response.status}`);
  }

  return (await response.json()) as MapboxDirectionsResponse;
}
