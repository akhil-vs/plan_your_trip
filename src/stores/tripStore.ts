import { create } from "zustand";

export interface WaypointData {
  id: string;
  name: string;
  notes?: string;
  lat: number;
  lng: number;
  order: number;
  isLocked?: boolean;
  isTransitSplit?: boolean;
  visitMinutes?: number;
  openMinutes?: number;
  closeMinutes?: number;
}

export interface POI {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: string;
  subcategory?: string;
  description?: string;
  image?: string;
  url?: string;
  address?: string;
  rating?: number;
  openingHours?: string;
  source: "opentripmap" | "geoapify";
}

export interface RouteInfo {
  distance: number;
  duration: number;
  geometry: GeoJSON.LineString | null;
  legs: { distance: number; duration: number }[];
}

interface TripState {
  tripId: string | null;
  tripName: string;
  waypoints: WaypointData[];
  route: RouteInfo | null;
  attractions: POI[];
  stays: POI[];
  food: POI[];
  parking: POI[];
  selectedPOI: POI | null;
  hoveredPOIId: string | null;
  loading: {
    route: boolean;
    attractions: boolean;
    stays: boolean;
    food: boolean;
    parking: boolean;
  };

  setTripId: (id: string | null) => void;
  setTripName: (name: string) => void;
  addWaypoint: (
    wp: Omit<WaypointData, "id" | "order"> & {
      isLocked?: boolean;
      visitMinutes?: number;
      openMinutes?: number;
      closeMinutes?: number;
    }
  ) => void;
  removeWaypoint: (id: string) => void;
  reorderWaypoints: (waypoints: WaypointData[]) => void;
  updateWaypoint: (id: string, data: Partial<WaypointData>) => void;
  insertWaypointNear: (
    wp: Omit<WaypointData, "id" | "order"> & {
      isLocked?: boolean;
      visitMinutes?: number;
      openMinutes?: number;
      closeMinutes?: number;
    }
  ) => void;
  clearWaypoints: () => void;
  setRoute: (route: RouteInfo | null) => void;
  setAttractions: (pois: POI[]) => void;
  setStays: (pois: POI[]) => void;
  setFood: (pois: POI[]) => void;
  setParking: (pois: POI[]) => void;
  setSelectedPOI: (poi: POI | null) => void;
  setHoveredPOIId: (poiId: string | null) => void;
  setLoading: (key: keyof TripState["loading"], val: boolean) => void;
  resetTrip: () => void;
}

let waypointCounter = 0;

const initialState = {
  tripId: null,
  tripName: "",
  waypoints: [] as WaypointData[],
  route: null,
  attractions: [] as POI[],
  stays: [] as POI[],
  food: [] as POI[],
  parking: [] as POI[],
  selectedPOI: null,
  hoveredPOIId: null,
  loading: {
    route: false,
    attractions: false,
    stays: false,
    food: false,
    parking: false,
  },
};

export const useTripStore = create<TripState>((set, get) => ({
  ...initialState,

  setTripId: (id) => set({ tripId: id }),
  setTripName: (name) => set({ tripName: name }),

  addWaypoint: (wp) => {
    const waypoints = get().waypoints;
    const newWp: WaypointData = {
      ...wp,
      id: `wp-${++waypointCounter}-${Date.now()}`,
      order: waypoints.length,
      isLocked: wp.isLocked ?? false,
      visitMinutes: wp.visitMinutes ?? 60,
      openMinutes: wp.openMinutes ?? 0,
      closeMinutes: wp.closeMinutes ?? 23 * 60 + 59,
    };
    set({ waypoints: [...waypoints, newWp] });
  },

  removeWaypoint: (id) => {
    const waypoints = get()
      .waypoints.filter((w) => w.id !== id)
      .map((w, i) => ({ ...w, order: i }));
    set({ waypoints });
  },

  reorderWaypoints: (waypoints) => {
    const usedIds = new Set<string>();
    const normalized = waypoints.map((w, i) => {
      let id = w.id;
      let suffix = 1;
      while (usedIds.has(id)) {
        id = `${w.id}-dup-${suffix}`;
        suffix += 1;
      }
      usedIds.add(id);
      return { ...w, id, order: i };
    });
    set({ waypoints: normalized });
  },

  updateWaypoint: (id, data) => {
    set({
      waypoints: get().waypoints.map((w) =>
        w.id === id ? { ...w, ...data } : w
      ),
    });
  },

  insertWaypointNear: (wp) => {
    const waypoints = get().waypoints;
    if (waypoints.length === 0) {
      get().addWaypoint(wp);
      return;
    }

    let nearestIdx = 0;
    let minDist = Infinity;
    waypoints.forEach((w, i) => {
      const d = Math.hypot(w.lat - wp.lat, w.lng - wp.lng);
      if (d < minDist) {
        minDist = d;
        nearestIdx = i;
      }
    });

    const insertIdx = nearestIdx + 1;
    const newWp: WaypointData = {
      ...wp,
      id: `wp-${++waypointCounter}-${Date.now()}`,
      order: insertIdx,
      isLocked: wp.isLocked ?? false,
      visitMinutes: wp.visitMinutes ?? 60,
      openMinutes: wp.openMinutes ?? 0,
      closeMinutes: wp.closeMinutes ?? 23 * 60 + 59,
    };
    const updated = [...waypoints];
    updated.splice(insertIdx, 0, newWp);
    set({ waypoints: updated.map((w, i) => ({ ...w, order: i })) });
  },

  clearWaypoints: () => set({ waypoints: [], route: null }),

  setRoute: (route) => set({ route }),
  setAttractions: (pois) => set({ attractions: pois }),
  setStays: (pois) => set({ stays: pois }),
  setFood: (pois) => set({ food: pois }),
  setParking: (pois) => set({ parking: pois }),
  setSelectedPOI: (poi) => set({ selectedPOI: poi }),
  setHoveredPOIId: (hoveredPOIId) => set({ hoveredPOIId }),

  setLoading: (key, val) =>
    set((s) => ({ loading: { ...s.loading, [key]: val } })),

  resetTrip: () => {
    waypointCounter = 0;
    set(initialState);
  },
}));
