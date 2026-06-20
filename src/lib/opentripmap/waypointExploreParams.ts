/**
 * OpenTripMap parameters aligned with planner waypoint "Explore → Attractions"
 * and GET /api/attractions defaults.
 *
 * Keep in sync with:
 * - `searchRadius` default in `src/stores/mapStore.ts` (km; client sends `radius * 1000` to `/api/attractions`)
 * - `WaypointExplorePanel` attractions branch (`kinds: "interesting_places"`)
 * - `src/app/api/attractions/route.ts` (`rate: "2"`, `limit: "50"`)
 */
export const WAYPOINT_EXPLORE_RADIUS_KM = 10;
export const WAYPOINT_EXPLORE_RADIUS_METERS = WAYPOINT_EXPLORE_RADIUS_KM * 1000;
export const WAYPOINT_EXPLORE_ATTRACTIONS_KINDS = "interesting_places";
/** Matches OTM `rate` query param used by `/api/attractions` (string "2"). */
export const WAYPOINT_EXPLORE_ATTRACTIONS_MIN_RATE = 2;
export const WAYPOINT_EXPLORE_ATTRACTIONS_LIMIT = 50;
