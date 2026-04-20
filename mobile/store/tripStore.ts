import { create } from "zustand";

/** Aligned with web [`src/stores/tripStore.ts`](../../src/stores/tripStore.ts). */
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
  role?: "start" | "stop" | "destination";
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
  geometry: { type: "LineString"; coordinates: [number, number][] } | null;
  legs: { distance: number; duration: number }[];
}

export type TransportMode = "car" | "bike" | "walking" | "transit";

export interface RoutePreviewMetric {
  etaMinutes: number;
  distanceKm: number;
}

export const MAX_INTERMEDIATE_STOPS = 8;

interface TripState {
  tripId: string | null;
  tripName: string;
  waypoints: WaypointData[];
  route: RouteInfo | null;
  transportMode: TransportMode;
  routePreviewByMode: Partial<Record<TransportMode, RoutePreviewMetric>>;
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
  setTransportMode: (mode: TransportMode) => void;
  setRoutePreviewMetric: (mode: TransportMode, metric: RoutePreviewMetric) => void;
  setWaypointsFromRoutePlan: (points: Omit<WaypointData, "order">[]) => void;
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
  transportMode: "car" as TransportMode,
  routePreviewByMode: {},
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
    const currentStops = waypoints.filter((point) => (point.role ?? "stop") === "stop").length;
    if (currentStops >= MAX_INTERMEDIATE_STOPS) return;
    const newWp: WaypointData = {
      ...wp,
      id: `wp-${++waypointCounter}-${Date.now()}`,
      order: waypoints.length,
      isLocked: wp.isLocked ?? false,
      role: wp.role ?? "stop",
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
      return { ...w, id, role: w.role ?? "stop", order: i };
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
  setTransportMode: (transportMode) => set({ transportMode }),
  setRoutePreviewMetric: (mode, metric) =>
    set((s) => ({
      routePreviewByMode: { ...s.routePreviewByMode, [mode]: metric },
    })),
  setWaypointsFromRoutePlan: (points) => {
    const normalized = points.map((point, index) => ({
      ...point,
      role:
        point.role ??
        (index === 0 ? "start" : index === points.length - 1 ? "destination" : "stop"),
      order: index,
    }));
    const stopsCount = normalized.filter((point) => point.role === "stop").length;
    const capped =
      stopsCount <= MAX_INTERMEDIATE_STOPS
        ? normalized
        : normalized.filter((point, index) => {
            if (point.role !== "stop") return true;
            const stopIdx = normalized
              .slice(0, index + 1)
              .filter((candidate) => candidate.role === "stop").length;
            return stopIdx <= MAX_INTERMEDIATE_STOPS;
          });
    set({ waypoints: capped.map((point, idx) => ({ ...point, order: idx })) });
  },
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
