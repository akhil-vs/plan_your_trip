export type LngLat = [number, number];

export type PlaceSuggestion = {
  id: string;
  name: string;
  secondaryText: string;
  coords: LngLat;
};

export type MapboxGeocodeFeature = {
  id: string;
  place_name: string;
  text: string;
  center?: [number, number];
};

export type MapboxGeocodeResponse = {
  features: MapboxGeocodeFeature[];
};
