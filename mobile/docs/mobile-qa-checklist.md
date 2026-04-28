# Mobile QA Checklist

## Auth and Session

- Login succeeds with valid credentials from `/api/auth/mobile/login`.
- Invalid credentials show non-crashing error state.
- App relaunch restores session and user from `/api/account/me`.
- Sign out clears secure token and returns to login.
- Users with `onboardingComplete: false` land on `/onboarding` until complete or skip.

## Trips and Planner

- Trips list loads from `/api/trips` with pull-to-refresh.
- Create trip opens planner for newly created trip.
- Planner map renders and centers on first waypoint.
- Tap-to-add waypoint creates stop and persists via `/api/trips/[tripId]`.
- Optimize updates waypoint order and day plans via `/api/optimize`.
- Directions route draws when at least two waypoints exist.
- Map camera fits route or stops with bottom padding for the sheet; **Recenter** restores framing.

## Map UX and Styling

- Style toggle cycles light/dark/terrain.
- Marker hierarchy remains readable on all styles.
- Bottom sheet interaction does not block essential map gestures.
- Route line remains legible in daylight and dark mode.

## Profile, pricing, admin

- Profile loads `/api/account/me`; plan changes call `PUT /api/account/plan` and refresh session user.
- **View pricing** opens `{API_BASE_URL}/pricing` in the browser.
- Admin accounts see admin link; stats load for 7/30/90 day windows; user plan PATCH works.

## Performance and Stability

- Planner screen first render under 2.5s on mid-range device.
- No frame drops during pan/zoom with 50 markers.
- No crashes across auth, trip create, planner edit, optimize.
- Sentry captures test error in preview builds.

## Release Build Validation

- `eas build --profile preview --platform ios` succeeds.
- `eas build --profile preview --platform android` succeeds.
- Deep links open invite/share screens when configured.
