import type { WaypointData } from "@/stores/tripStore";

type ApiWaypoint = {
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
};

export type ApiDayPlanRow = {
  day: number;
  waypointIndexes: number[];
  waypointIds?: string[];
  estimatedTravelMinutes: number;
  estimatedTravelMeters?: number;
};

export type TripApiPayload = {
  name?: string;
  waypoints?: ApiWaypoint[];
  dayPlans?: ApiDayPlanRow[];
  optimizerDayStartMinutes?: number;
  optimizerDayEndMinutes?: number;
  optimizerDefaultVisitMinutes?: number;
  status?: string;
  isPublic?: boolean;
  currentUserRole?: string;
  members?: unknown[];
  _count?: { members?: number };
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object";
}

/** Filter synthetic transit splits, sort by `order`, map to store waypoint rows. */
export function parseTripWaypointsForStore(
  data: TripApiPayload,
  isSyntheticTransitWaypoint: (wp: { isTransitSplit?: boolean; name?: string }) => boolean
): {
  tripName: string;
  waypoints: WaypointData[];
  loadedWaypointIdSet: Set<string>;
  dayPlansRaw: ApiDayPlanRow[];
  optimizerDayStartMinutes: number | undefined;
  optimizerDayEndMinutes: number | undefined;
  optimizerDefaultVisitMinutes: number | undefined;
} | null {
  if (!Array.isArray(data.waypoints)) return null;
  const loadedTripName = typeof data.name === "string" ? data.name : "";
  const loadedWaypoints = [...data.waypoints]
    .filter((wp) => !isSyntheticTransitWaypoint(wp))
    .sort((a, b) => a.order - b.order);
  const loadedWaypointIdSet = new Set(loadedWaypoints.map((wp) => wp.id));
  const waypoints: WaypointData[] = loadedWaypoints.map((wp) => ({
    id: wp.id,
    name: wp.name,
    notes: wp.notes,
    lat: wp.lat,
    lng: wp.lng,
    order: wp.order,
    isLocked: wp.isLocked ?? false,
    visitMinutes: wp.visitMinutes,
    openMinutes: wp.openMinutes,
    closeMinutes: wp.closeMinutes,
  }));
  return {
    tripName: loadedTripName,
    waypoints,
    loadedWaypointIdSet,
    dayPlansRaw: Array.isArray(data.dayPlans) ? data.dayPlans : [],
    optimizerDayStartMinutes: data.optimizerDayStartMinutes,
    optimizerDayEndMinutes: data.optimizerDayEndMinutes,
    optimizerDefaultVisitMinutes: data.optimizerDefaultVisitMinutes,
  };
}

export function tripPayloadFromJson(json: unknown): TripApiPayload | null {
  if (!isRecord(json)) return null;
  return json as TripApiPayload;
}
