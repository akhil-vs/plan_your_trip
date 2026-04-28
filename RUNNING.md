# Running the application (web and mobile)

This repository contains:

- **Web app** — Next.js in the project root (`npm run dev`).
- **Mobile app** — Expo in the [`mobile/`](mobile/) folder (`npm run start` from `mobile/`).

The mobile client talks to the **same** Next.js server via HTTP (`EXPO_PUBLIC_API_BASE_URL`). For local development you usually run the web API first, then point the mobile app at that URL.

---

## Prerequisites

| Requirement | Web | Mobile |
|-------------|-----|--------|
| Node.js (LTS recommended, e.g. 20+) | Yes | Yes |
| npm | Yes | Yes |
| PostgreSQL database | Yes | No (uses API only) |
| Expo Go app on a phone (optional) | No | Optional for quick testing |
| Xcode (macOS) / Android Studio | No | Optional for simulators/emulators |

---

## 1. Web application (Next.js)

### 1.1 Install dependencies

From the **repository root**:

```bash
npm install
```

### 1.2 Environment variables

Copy the example env file and edit it:

```bash
cp .env.example .env
```

Fill in at least:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string (required) |
| `MAPBOX_ACCESS_TOKEN` | Server-side Mapbox (directions, matrix, etc.) |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Same Mapbox token for the browser map |
| `OPENTRIPMAP_API_KEY` | POI / attractions features |
| `GEOAPIFY_API_KEY` | Stays / food search features |
| `NEXTAUTH_SECRET` | Auth signing secret (use a long random string) |
| `NEXTAUTH_URL` | Base URL of the site, e.g. `http://localhost:3000` locally |

Optional but useful:

- `AUTH_SECRET` — If set, used for JWT encoding; otherwise `NEXTAUTH_SECRET` is used (see [`src/lib/api-auth.ts`](src/lib/api-auth.ts)).
- `ADMIN_EMAILS` — Comma-separated emails allowed to use `/admin` (see [`DEPLOYMENT.md`](DEPLOYMENT.md)).
- `RESEND_API_KEY` / `INVITE_EMAIL_FROM` — For sending invite emails.

### 1.3 Database

Apply the schema (from repo root):

```bash
npx prisma db push
```

Use any PostgreSQL you prefer (Docker, Neon, local install). SQLite is not suitable for production-style setups described in [`DEPLOYMENT.md`](DEPLOYMENT.md).

### 1.4 Run the development server

```bash
npm run dev
```

Open **http://localhost:3000** in your browser.

To allow other devices on your LAN to hit the same dev server (useful when testing the mobile app against your machine):

```bash
npm run dev:lan
```

Then use your computer’s LAN IP and port in the mobile app, e.g. `http://192.168.1.10:3000` (see mobile section below).

### 1.5 Production-style web run (local)

```bash
npm run build
npm run start
```

Use the URL and port shown in the terminal (often **http://localhost:3000**).

---

## 2. Mobile application (Expo)

The Expo app lives in [`mobile/`](mobile/). It expects a running Next.js backend at `EXPO_PUBLIC_API_BASE_URL`.

### Mapbox and Expo Go (read this first)

**`@rnmapbox/maps` does not run inside the Expo Go app.** The generic Expo Go binary does not include Mapbox native modules, which causes:

`@rnmapbox/maps native code not available …`

You must use a **development build** (or release build): run `npx expo prebuild` once, then `npx expo run:ios` / `npx expo run:android`, and day-to-day use **`npm run start:dev`** (`expo start --dev-client`) with that installed app. See [Mapbox + Expo rebuild docs](https://rnmapbox.github.io/docs/install?rebuild=expo#rebuild).

**React Native New Architecture** is **`newArchEnabled": true`** in [`mobile/app.json`](mobile/app.json). **Reanimated 4** (`react-native-reanimated`) fails iOS CocoaPods if New Architecture is off. After changing that flag, run **`npx expo prebuild --clean`** and rebuild.

Do **not** set **`RCT_NEW_ARCH_ENABLED=0`** in your shell or `.env` when building the mobile app; that forces the old architecture and breaks Reanimated.

[`mobile/package.json`](mobile/package.json) pins **`@rnmapbox/maps` to `~10.2.10`** (optional safety cap). With New Architecture enabled you may upgrade to **`@rnmapbox/maps` 10.3+** if you prefer their latest iOS line.

### 2.1 Install dependencies

```bash
cd mobile
npm install
```

### 2.2 Environment variables

```bash
cp .env.example .env
```

Edit **`mobile/.env`** (recommended). If you omit it in **development**, the app still starts: the API base URL defaults to `http://localhost:3000` and you will see console warnings until you add real values.

Expo loads **`mobile/.env`** first. [`mobile/app.config.js`](mobile/app.config.js) also loads the **repository root `.env`** (without overriding keys already set in `mobile/.env`). If **`EXPO_PUBLIC_API_BASE_URL`** is still empty, it falls back to **`NEXTAUTH_URL`**. The resolved URL is stored in **`expo.extra.apiBaseUrl`** (read at runtime) because plain **`process.env.EXPO_PUBLIC_*`** is often **inlined when Metro bundles**, so values set only in `app.config.js` would not reach your code otherwise. For a **physical phone**, use your PC’s **LAN** origin (e.g. `http://192.168.1.10:3000`), then restart Metro with **`npx expo start --dev-client --clear`**.

| Variable | Purpose |
|----------|---------|
| `EXPO_PUBLIC_API_BASE_URL` | Full origin of the Next app, **no trailing slash**, e.g. `http://localhost:3000` or `http://192.168.1.10:3000` (LAN) or your deployed `https://…` (optional if `NEXTAUTH_URL` is set to the same origin) |
| `EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN` | Mapbox **public** token (`pk.…`) for the native map (optional if **`NEXT_PUBLIC_MAPBOX_TOKEN`** is set in the repo root `.env` — same value as the web app) |
| `RNMAPBOX_MAPS_DOWNLOAD_TOKEN` | Mapbox **secret** token (`sk.…` with **DOWNLOADS:READ**) — must be present in the environment when you run **`expo prebuild`** / EAS so iOS/Android can download the SDK (see [Mapbox install](https://docs.mapbox.com/android/maps/guides/install/)) |
| `SENTRY_DSN` | Optional crash reporting |

**Important:** If you use a **physical phone**, `localhost` in `EXPO_PUBLIC_API_BASE_URL` refers to the phone itself, not your computer. Use your machine’s **LAN IP** and run the web app with `npm run dev:lan` from the repo root, then set e.g. `EXPO_PUBLIC_API_BASE_URL=http://192.168.1.10:3000`.

### 2.3 One-time native project (Mapbox)

From `mobile/`, with `mobile/.env` containing **`RNMAPBOX_MAPS_DOWNLOAD_TOKEN`** and Mapbox public token:

```bash
cd mobile
npx expo prebuild --clean
npx expo run:ios
# or
npx expo run:android
```

That installs a **development build** on the simulator or device (includes `@rnmapbox/maps` native code).

### 2.4 Daily development (after 2.3)

Start Metro for the dev client (not Expo Go):

```bash
cd mobile
npm run start:dev
```

Open the **same app you built in 2.3** (it will connect to Metro). Do not open Expo Go for this project if you need the map.

If Metro prints **`No development build (com.viazo.mobile) for this project is installed`**, the simulator or phone does not have your dev client yet (or it was deleted). From `mobile/`, install it once:

```bash
npx expo run:ios
# or: npx expo run:ios --device
# or: npx expo run:android
```

After the app launches from Xcode/Gradle, **`npm run start:dev`** will attach when you open that app again.

**Dev client shows “Failed to open the app” (physical device):** usually Metro is unreachable or the deep link to your session is wrong.

1. Start Metro **before** opening the dev build: `npm run start:dev` from `mobile/`.
2. Phone and computer on the **same Wi‑Fi**; disable VPN on both; allow **Local Network** on iOS if prompted.
3. If it still fails, use a tunnel (works across networks, slower): **`npm run start:dev:tunnel`**, then open the dev build again and connect using the URL / QR Metro shows.
4. **Android + USB:** from any terminal, `adb reverse tcp:8081 tcp:8081` so `localhost:8081` on the phone reaches Metro on the PC.
5. In the dev client’s launcher, try **Enter URL manually** (or clear a stale “recent” project) instead of an old QR code. Restart Metro with **`npx expo start --dev-client --clear`** once.

**Android + Wi‑Fi (no USB):**

1. In the Metro terminal, confirm the URL uses your PC’s **LAN IP** (e.g. `exp://192.168.x.x:8081`), not `127.0.0.1` or `localhost`. If it shows localhost, from `mobile/` run **`npm run start:dev:lan`** (same as `expo start --dev-client --lan`).
2. On the phone, open **Chrome** and visit **`http://<same-ip>:8081`** (same IP as Metro). If the page does not load, the phone cannot reach Metro: fix **macOS/Windows firewall** (allow **Node** on port **8081**), turn off **guest Wi‑Fi / client isolation / AP isolation** on the router, or try another network.
3. On Android: **Settings → Network → Private DNS** → try **Off** temporarily (some “automatic” providers block odd local traffic).
4. If LAN is painful on your network, use **`npm run start:dev:tunnel`** and connect again from the dev client (reliable on Android over Wi‑Fi).

### 2.5 Internal / store builds (EAS)

From `mobile/`:

```bash
npm run eas:ios:preview
npm run eas:android:preview
```

Requires [EAS CLI](https://docs.expo.dev/eas/) and an Expo account. See [`mobile/eas.json`](mobile/eas.json).

---

## 3. Typical local workflow (web + phone)

1. Start PostgreSQL and configure root `.env`.
2. From repo root: `npx prisma db push` then `npm run dev:lan`.
3. Note your computer’s IP (e.g. `192.168.1.10`) and port (default **3000**).
4. In `mobile/.env`, set `EXPO_PUBLIC_API_BASE_URL=http://192.168.1.10:3000`.
5. From `mobile/`: complete **section 2.3** once on your machine, then use **`npm run start:dev`** and open the **development build** on the phone (not Expo Go).

Sign in with a user that exists in your database (register via web or mobile register screen, then sign in on mobile).

---

## 4. Further reading

- [README.md](README.md) — Feature overview and web-focused setup.
- [DEPLOYMENT.md](DEPLOYMENT.md) — Vercel, env vars, database, admin email configuration.
- [mobile/README.md](mobile/README.md) — Mobile-specific notes and scripts.
