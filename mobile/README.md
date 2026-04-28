# PlanYourTrip Mobile (Expo)

## Setup

1. Copy **`mobile/.env.example`** to **`mobile/.env`**. Set `EXPO_PUBLIC_API_BASE_URL` (LAN IP on a real phone, e.g. `http://192.168.1.10:3000`), `EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN`, and **`RNMAPBOX_MAPS_DOWNLOAD_TOKEN`** (secret `sk.` with DOWNLOADS:READ for prebuild). Do not rely on the repo root `.env` for `EXPO_PUBLIC_*` — Expo reads **`mobile/.env`** only.
2. If you skip `.env`, development still defaults the API to `http://localhost:3000`; Mapbox stays empty until you add tokens.
3. Install dependencies: `npm install`
4. **Mapbox does not work in Expo Go.** Run once: `npx expo prebuild --clean` then `npx expo run:ios` or `npx expo run:android`. After adding native modules (e.g. **`expo-keep-awake`**), run **`prebuild --clean`** and **`run:android` / `run:ios`** again so **“Unable to activate keep awake”** goes away.
5. Daily: `npm run start:dev` (Metro for the **development client**). If the phone says **Failed to open the app**, see **section 2.4b** in [`RUNNING.md`](../RUNNING.md) (often Wi‑Fi / firewall — try **`npm run start:dev:tunnel`**).

```bash
npm install
npm run start:dev
```

## Notes

- Auth uses bearer tokens from `POST /api/auth/mobile/login`.
- Protected endpoints reuse the same backend auth parser in `src/lib/api-auth.ts`.
- Planner map uses `@rnmapbox/maps` (requires native rebuild). **`newArchEnabled` is true** — required by Reanimated 4 and supported by `@rnmapbox/maps` 10.2.x+.
- Internal distribution is configured with `eas.json`.
- Incomplete onboarding redirects to `/onboarding` from the app root.
- Admin users see **Admin dashboard** in Profile; it calls `/api/admin/stats` and `/api/admin/users`.
- **View pricing** opens the deployed web `/pricing` in the system browser.
