import Constants from "expo-constants";
import { DEV_API_URL_OVERRIDE } from "../constants/devApiUrlOverride";

type Extra = { apiUrl?: string };

function normalizeBase(url: string): string {
  return url.trim().replace(/\/$/, "");
}

function readApiUrlFromExtra(extra: unknown): string | undefined {
  if (!extra || typeof extra !== "object") return undefined;
  const v = (extra as Extra).apiUrl;
  return typeof v === "string" && v.trim() ? normalizeBase(v) : undefined;
}

/** `extra` can live on `expoConfig`, classic `manifest`, or manifest2 `expoClient` (Expo Go dev). */
function apiUrlFromExpoManifests(): string | undefined {
  const fromExpoConfig = readApiUrlFromExtra(Constants.expoConfig?.extra);
  if (fromExpoConfig) return fromExpoConfig;

  const manifest = Constants.manifest as Record<string, unknown> | null | undefined;
  const fromManifest = readApiUrlFromExtra(manifest?.extra);
  if (fromManifest) return fromManifest;

  const m2 = Constants.manifest2 as
    | { extra?: { expoClient?: { extra?: unknown } } }
    | null
    | undefined;
  const fromM2 = readApiUrlFromExtra(m2?.extra?.expoClient?.extra);
  if (fromM2) return fromM2;

  return undefined;
}

/**
 * Expo sets `expoConfig.hostUri` in dev to how the device reached Metro, e.g. `192.168.1.12:8081`.
 * We use that host for the Next.js API when `.env` still says `localhost`, so physical devices work
 * without hand-editing the IP. Set `EXPO_PUBLIC_API_NO_REWRITE=1` to disable (e.g. tunnel / odd setups).
 */
function hostFromExpoHostUri(): string | null {
  const hostUri = Constants.expoConfig?.hostUri;
  if (!hostUri || typeof hostUri !== "string") return null;
  const host = hostUri.includes("]") ? hostUri : hostUri.split(":")[0];
  if (!host) return null;
  return host;
}

function isUsableLanHostForApi(host: string): boolean {
  if (host === "localhost" || host === "127.0.0.1") return false;
  if (host === "10.0.2.2") return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  if (/\.(exp\.direct|expo\.dev|ngrok|nip\.io)$/i.test(host)) return false;
  return false;
}

function rewriteLoopbackToLan(base: string, lanHost: string): string {
  try {
    const u = new URL(base);
    if (u.hostname !== "localhost" && u.hostname !== "127.0.0.1") return base;
    u.hostname = lanHost;
    return u.toString().replace(/\/$/, "");
  } catch {
    return base;
  }
}

/** Public API base (Next.js origin). */
export function getApiBase(): string {
  if (__DEV__) {
    const forced = DEV_API_URL_OVERRIDE.trim();
    if (forced) return normalizeBase(forced);
  }

  const noRewrite = process.env.EXPO_PUBLIC_API_NO_REWRITE === "1";
  let base =
    apiUrlFromExpoManifests() ||
    (process.env.EXPO_PUBLIC_API_URL && normalizeBase(process.env.EXPO_PUBLIC_API_URL)) ||
    "http://localhost:3000";
  base = normalizeBase(base);

  if (__DEV__ && !noRewrite) {
    const metroHost = hostFromExpoHostUri();
    if (metroHost && isUsableLanHostForApi(metroHost)) {
      base = rewriteLoopbackToLan(base, metroHost);
    }
  }

  return base;
}
