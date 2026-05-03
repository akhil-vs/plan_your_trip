import type { DayPlan, Trip, Waypoint } from "@/types/domain";

/** Matches web `PlannerSidebar` `DEFAULT_SAVE_NAME`. */
export const DEFAULT_TRIP_NAME = "Untitled";

/** Matches web save payload defaults (`PlannerSidebar` + `/api/trips` POST). */
export const DEFAULT_OPTIMIZATION = {
  dayStartMinutes: 9 * 60,
  dayEndMinutes: 20 * 60,
  defaultVisitMinutes: 60,
} as const;

export type StarterTemplate = {
  id: string;
  title: string;
  subtitle: string;
  waypoints: { name: string; lat: number; lng: number }[];
};

/** Same starters as web `STARTER_TEMPLATES` (trimmed for mobile). */
export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: "city-weekend",
    title: "Weekend city",
    subtitle: "Tokyo highlights",
    waypoints: [
      { name: "Senso-ji Temple, Tokyo", lat: 35.7148, lng: 139.7967 },
      { name: "Shibuya Crossing, Tokyo", lat: 35.6595, lng: 139.7005 },
      { name: "Meiji Shrine, Tokyo", lat: 35.6764, lng: 139.6993 },
    ],
  },
  {
    id: "europe-loop",
    title: "Europe loop",
    subtitle: "Paris · Rome · Barcelona",
    waypoints: [
      { name: "Eiffel Tower, Paris", lat: 48.8584, lng: 2.2945 },
      { name: "Colosseum, Rome", lat: 41.8902, lng: 12.4922 },
      { name: "Sagrada Familia, Barcelona", lat: 41.4036, lng: 2.1744 },
    ],
  },
];

const END_OF_DAY = 23 * 60 + 59;

function sortedWaypoints(waypoints: Waypoint[]): Waypoint[] {
  return [...waypoints].sort((a, b) => a.order - b.order);
}

/** One day containing all stops — mirrors web `normalizeDayPlans` when plans are empty but stops exist. */
export function defaultDayPlansFromWaypoints(waypoints: Waypoint[]): DayPlan[] {
  if (waypoints.length === 0) return [];
  const n = sortedWaypoints(waypoints).length;
  return [
    {
      day: 1,
      waypointIndexes: Array.from({ length: n }, (_, i) => i),
      waypointIds: [],
      estimatedTravelMinutes: 0,
    },
  ];
}

function waypointRow(wp: Waypoint, order: number, includeId: boolean) {
  const row: Record<string, unknown> = {
    name: wp.name,
    notes: typeof wp.notes === "string" ? wp.notes : "",
    lat: wp.lat,
    lng: wp.lng,
    order,
    isLocked: wp.isLocked === true,
    visitMinutes:
      typeof wp.visitMinutes === "number" && Number.isFinite(wp.visitMinutes)
        ? Math.max(5, Math.round(wp.visitMinutes))
        : 60,
    openMinutes:
      typeof wp.openMinutes === "number" && Number.isFinite(wp.openMinutes)
        ? Math.max(0, Math.min(END_OF_DAY, Math.round(wp.openMinutes)))
        : 0,
    closeMinutes:
      typeof wp.closeMinutes === "number" && Number.isFinite(wp.closeMinutes)
        ? Math.max(0, Math.min(END_OF_DAY, Math.round(wp.closeMinutes)))
        : END_OF_DAY,
  };
  if (includeId && wp.id) row.id = wp.id;
  return row;
}

export function waypointsForCreateApi(waypoints: Waypoint[]) {
  return sortedWaypoints(waypoints).map((wp, i) => waypointRow(wp, i, false));
}

export function waypointsForPutApi(waypoints: Waypoint[]) {
  return sortedWaypoints(waypoints).map((wp, i) => waypointRow(wp, i, true));
}

function dayPlansForApi(dayPlans: DayPlan[]) {
  return dayPlans.map((dp) => ({
    day: dp.day,
    waypointIndexes: dp.waypointIndexes ?? [],
    waypointIds: dp.waypointIds ?? [],
    estimatedTravelMinutes: dp.estimatedTravelMinutes ?? 0,
  }));
}

export function buildCreateTripBody(input: {
  name?: string;
  description?: string | null;
  waypoints?: Waypoint[];
  dayPlans?: DayPlan[];
}): Record<string, unknown> {
  const waypoints = input.waypoints ?? [];
  const name = input.name?.trim() || DEFAULT_TRIP_NAME;
  const dayPlans = input.dayPlans ?? defaultDayPlansFromWaypoints(waypoints);
  return {
    name,
    description: input.description,
    waypoints: waypointsForCreateApi(waypoints),
    dayPlans: dayPlansForApi(dayPlans),
    optimizationSettings: { ...DEFAULT_OPTIMIZATION },
  };
}

export function templateToWaypoints(template: StarterTemplate): Waypoint[] {
  return template.waypoints.map((w, order) => ({
    name: w.name,
    lat: w.lat,
    lng: w.lng,
    order,
    visitMinutes: 60,
    openMinutes: 0,
    closeMinutes: END_OF_DAY,
  }));
}

/**
 * Full PUT body for `/api/trips/[tripId]`. Always sends `dayPlans` so the server does not wipe them
 * when the client only intended to change waypoints (mobile previously sent partial JSON).
 */
export function buildTripUpdateBody(
  trip: Trip,
  patch: {
    waypoints?: Waypoint[];
    dayPlans?: DayPlan[];
    name?: string;
    description?: string | null;
    optimizationSettings?: {
      dayStartMinutes?: number;
      dayEndMinutes?: number;
      defaultVisitMinutes?: number;
    };
  }
): Record<string, unknown> {
  const waypoints = patch.waypoints ?? trip.waypoints ?? [];
  const dayPlans = patch.dayPlans ?? defaultDayPlansFromWaypoints(waypoints);
  return {
    name: patch.name ?? trip.name,
    description: patch.description !== undefined ? patch.description : trip.description,
    waypoints: waypointsForPutApi(waypoints),
    dayPlans: dayPlansForApi(dayPlans),
    optimizationSettings: {
      dayStartMinutes:
        patch.optimizationSettings?.dayStartMinutes ??
        trip.optimizerDayStartMinutes ??
        DEFAULT_OPTIMIZATION.dayStartMinutes,
      dayEndMinutes:
        patch.optimizationSettings?.dayEndMinutes ??
        trip.optimizerDayEndMinutes ??
        DEFAULT_OPTIMIZATION.dayEndMinutes,
      defaultVisitMinutes:
        patch.optimizationSettings?.defaultVisitMinutes ??
        trip.optimizerDefaultVisitMinutes ??
        DEFAULT_OPTIMIZATION.defaultVisitMinutes,
    },
  };
}
