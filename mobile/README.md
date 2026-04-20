# Viazo (mobile)

React Native (Expo) client for the PlanYourTrip / Viazo Next.js API.

## Setup

1. Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL` (no trailing slash).
   - The **port must be Next.js’s port** (see the repo root dev terminal line `Local: http://…`). If something else already uses `:3000` (Docker, nginx, etc.), Next may be on `:3001` or another port—match that in `EXPO_PUBLIC_API_URL`.
   - **Simulator on the same computer:** `http://localhost:3000` is often fine (or whatever port Next uses).
   - **Physical phone/tablet:** use your computer’s **LAN IP** (same Wi‑Fi), e.g. `http://192.168.1.12:3000`. Never use `localhost` on the device—it refers to the phone, not your PC.
   - From the **repo root**, start Next so it accepts LAN connections: `npm run dev:lan` (not plain `npm run dev` if the server only listens on 127.0.0.1).
   - After changing `.env`, restart Metro: `npx expo start -c`.

2. Install dependencies:

```bash
npm install
```

3. Start Expo (from **`mobile/`**):

```bash
npm run dev
```

or `npm start` / `npx expo start --lan`. Scripts default to **`--lan`** so Expo reports your machine’s LAN IP; the app then rewrites `localhost` in `EXPO_PUBLIC_API_URL` to that IP for API calls (physical devices). To start the **Next.js API** (separate terminal, **repo root**): `npm run dev`.

Then press `i` for iOS Simulator, `a` for Android emulator, or scan the QR code with Expo Go.

## Auth

The app signs in via `POST /api/auth/mobile/login` and sends `Authorization: Bearer <token>` on subsequent requests. The token is stored with `expo-secure-store`.

## Map

The planner uses `react-native-maps` (Apple Maps on iOS; configure Google Maps keys for Android if needed). Routing data comes from your backend `GET /api/directions` (Mapbox on the server).
