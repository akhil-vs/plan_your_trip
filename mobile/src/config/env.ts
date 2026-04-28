import Constants from "expo-constants";

const trim = (value: string | undefined): string => (value ?? "").trim();

const stripTrailingSlash = (url: string): string => url.replace(/\/$/, "");

type Extra = { apiBaseUrl?: string; mapboxPublicToken?: string };

function extraConfig(): Extra | undefined {
  return Constants.expoConfig?.extra as Extra | undefined;
}

function apiBaseUrlFromExpoExtra(): string {
  return stripTrailingSlash(trim(extraConfig()?.apiBaseUrl));
}

function mapboxPublicTokenFromExpoExtra(): string {
  return trim(extraConfig()?.mapboxPublicToken);
}

export type AppEnv = {
  apiBaseUrl: string;
  mapboxPublicToken: string;
  sentryDsn: string;
};

let cached: AppEnv | null = null;

/**
 * Resolves env once per JS context. In development, missing API URL defaults to
 * `http://localhost:3000` so Expo Router can load without a `.env` file.
 * Missing Mapbox token in dev logs a warning and returns an empty string.
 */
export function getEnv(): AppEnv {
  if (cached) return cached;

  const isDev = process.env.NODE_ENV !== "production";

  // Prefer app.config.js `expo.extra.apiBaseUrl` — `EXPO_PUBLIC_*` is often inlined at
  // bundle time, so values set only in app.config (from root .env / NEXTAUTH_URL) would
  // otherwise stay empty in JS.
  let apiBaseUrl =
    apiBaseUrlFromExpoExtra() || stripTrailingSlash(trim(process.env.EXPO_PUBLIC_API_BASE_URL));
  if (!apiBaseUrl) {
    if (isDev) {
      apiBaseUrl = "http://localhost:3000";
      console.warn(
        "[PlanYourTrip] API base URL unset; using http://localhost:3000. Set EXPO_PUBLIC_API_BASE_URL or NEXTAUTH_URL to your PC's LAN origin (e.g. http://192.168.1.10:3000) in mobile/.env or repo root .env, then restart Metro with --clear. Run npm run dev:lan from the repo root."
      );
    } else {
      throw new Error(
        "Missing EXPO_PUBLIC_API_BASE_URL. Copy mobile/.env.example to mobile/.env and set your deployed or LAN API origin (no trailing slash)."
      );
    }
  }

  const mapboxPublicToken =
    mapboxPublicTokenFromExpoExtra() || trim(process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN);
  if (!mapboxPublicToken && isDev) {
    console.warn(
      "[PlanYourTrip] Mapbox public token unset; maps will not work. Set EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN in mobile/.env or NEXT_PUBLIC_MAPBOX_TOKEN in the repo root .env (same pk. token as the web app), then restart Metro with --clear."
    );
  }
  if (!mapboxPublicToken && !isDev) {
    throw new Error(
      "Missing Mapbox public token. Set EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN or NEXT_PUBLIC_MAPBOX_TOKEN (see mobile/app.config.js) or EAS secrets for production builds."
    );
  }

  cached = {
    apiBaseUrl,
    mapboxPublicToken,
    sentryDsn: trim(process.env.SENTRY_DSN),
  };
  return cached;
}

/** Lazy env; safe to import from any module without throwing in development. */
export const env = {
  get apiBaseUrl(): string {
    return getEnv().apiBaseUrl;
  },
  get mapboxPublicToken(): string {
    return getEnv().mapboxPublicToken;
  },
  get sentryDsn(): string {
    return getEnv().sentryDsn;
  },
};
