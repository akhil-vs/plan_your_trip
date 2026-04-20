import { create } from "zustand";

export type MapStyle = "standard" | "satellite" | "terrain";

interface MapState {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
  mapStyle: MapStyle;
  pickPointsMode: boolean;
  followUserLocation: boolean;
  bottomSheetSnapIndex: number;
  mapPadding: { top: number; right: number; bottom: number; left: number };
  setRegion: (r: Partial<Pick<MapState, "latitude" | "longitude" | "latitudeDelta" | "longitudeDelta">>) => void;
  setMapStyle: (s: MapStyle) => void;
  setPickPointsMode: (v: boolean) => void;
  setFollowUserLocation: (v: boolean) => void;
  setBottomSheetSnapIndex: (i: number) => void;
  setMapPadding: (p: Partial<MapState["mapPadding"]>) => void;
}

export const useMapStore = create<MapState>((set) => ({
  latitude: 20,
  longitude: 0,
  latitudeDelta: 40,
  longitudeDelta: 40,
  mapStyle: "standard",
  pickPointsMode: false,
  followUserLocation: true,
  bottomSheetSnapIndex: 0,
  mapPadding: { top: 120, right: 24, bottom: 220, left: 24 },
  setRegion: (r) => set((s) => ({ ...s, ...r })),
  setMapStyle: (mapStyle) => set({ mapStyle }),
  setPickPointsMode: (pickPointsMode) => set({ pickPointsMode }),
  setFollowUserLocation: (followUserLocation) => set({ followUserLocation }),
  setBottomSheetSnapIndex: (bottomSheetSnapIndex) => set({ bottomSheetSnapIndex }),
  setMapPadding: (mapPadding) =>
    set((s) => {
      const next = { ...s.mapPadding, ...mapPadding };
      if (
        next.top === s.mapPadding.top &&
        next.right === s.mapPadding.right &&
        next.bottom === s.mapPadding.bottom &&
        next.left === s.mapPadding.left
      ) {
        return s;
      }
      return { mapPadding: next };
    }),
}));
