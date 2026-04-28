export const mapStyles = {
  light: "mapbox://styles/mapbox/streets-v12",
  dark: "mapbox://styles/mapbox/dark-v11",
  terrain: "mapbox://styles/mapbox/outdoors-v12",
} as const;

export type MapStyleId = keyof typeof mapStyles;

export const mapUiTokens = {
  markerSize: {
    poi: 10,
    stop: 14,
    active: 18,
  },
  route: {
    primary: "#1d4ed8",
    halo: "#bfdbfe",
    width: 4,
  },
  control: {
    background: "#ffffff",
    shadow: "#0000001f",
  },
};
