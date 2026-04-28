# Mobile Feature Parity Checklist

This checklist maps current web surfaces to Expo React Native screens and backend dependencies.

## Auth and Session

- Web route: `src/app/auth/login/page.tsx`
- Web route: `src/app/auth/register/page.tsx`
- API dependencies:
  - `src/app/api/auth/register/route.ts`
  - `src/app/api/account/me/route.ts`
  - `src/lib/api-auth.ts`
- Mobile target:
  - `Auth/LoginScreen`
  - `Auth/RegisterScreen`
  - Session restore on cold boot

## Dashboard and Trips

- Web route: `src/app/dashboard/page.tsx`
- API dependencies:
  - `src/app/api/trips/route.ts`
  - `src/app/api/trips/[tripId]/route.ts`
  - `src/app/api/trips/clone/route.ts`
- Mobile target:
  - `Trips/ListScreen`
  - `Trips/DetailScreen`
  - `Trips/CreateEditScreen`
- **Create / update parity:** Mobile uses `mobile/src/lib/trip-payload.ts` so POST matches web defaults (`optimizationSettings`, `Untitled` name) and PUT always includes **`dayPlans`** (otherwise the API wipes day plans when only `waypoints` are sent). New itinerary UI: name + starter templates like web `STARTER_TEMPLATES`.

## Planner and Map

- Web route: `src/app/planner/[tripId]/page.tsx`
- Web components:
  - `src/components/map/MapView.tsx`
  - `src/components/map/RouteLayer.tsx`
  - `src/components/map/WaypointMarkers.tsx`
  - `src/components/map/POIMarkers.tsx`
  - `src/components/map/MapStyleToggle.tsx`
  - `src/components/sidebar/PlannerSidebar.tsx`
- API dependencies:
  - `src/app/api/trips/[tripId]/route.ts`
  - `src/app/api/optimize/route.ts`
  - `src/app/api/places/route.ts`
  - `src/app/api/directions/route.ts`
  - `src/app/api/reverse-geocode/route.ts`
- Mobile target:
  - `Planner/TripPlannerScreen`
  - Mapbox map with style toggle
  - Tap-to-add waypoint and fit-route behavior
  - Bottom sheet planner controls

## Collaboration and Sharing

- Web routes:
  - `src/app/invite/[token]/page.tsx`
  - `src/app/share/[shareId]/page.tsx`
- API dependencies:
  - `src/app/api/trips/[tripId]/invites/route.ts`
  - `src/app/api/trips/invites/[token]/accept/route.ts`
  - `src/app/api/trips/[tripId]/share/route.ts`
  - `src/app/api/public/trips/[shareId]/route.ts`
- Mobile target:
  - Invite accept deep link flow
  - Share view deep link flow
  - Members panel and basic chat entry points

## Profile and Onboarding

- Web routes:
  - `src/app/profile/page.tsx`
  - `src/app/onboarding/page.tsx`
- API dependencies:
  - `src/app/api/onboarding/complete/route.ts`
  - `src/app/api/onboarding/skip/route.ts`
  - `src/app/api/account/plan/route.ts`
- Mobile target:
  - Onboarding preference flow
  - Profile and plan screen

## Release Priority

1. Auth + session restore
2. Trips list/detail + create
3. Planner map read/write
4. Collaboration/share
5. Onboarding/profile polish

## UI / UX (mobile)

- Shared **theme** in `mobile/src/theme/tokens.ts` (brand + neutrals aligned with web `globals.css`).
- Reusable **AppScreen**, **SurfaceCard**, **TextField**, **PrimaryButton**, **EmptyState** under `mobile/src/components/ui/`.
- **Trips**: public trips block (same API as web dashboard), draft/final badges, confirm sign-out, loading state.
- **Profile / Account**: stack header + sections for billing, plan, admin.
- **Onboarding**: travel preference chips (solo / couple / family / group) wired to API.

### Still web-first (not fully ported to native)

- Rich dashboard actions (share menu, export, clone, delete, templates).
- In-planner **places search** / POI picker parity with web sidebar.
- Dedicated **pricing** screen (mobile opens web pricing in browser).
