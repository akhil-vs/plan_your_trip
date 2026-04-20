import { API_BASE_URL } from "@env";

function normalizeBase(url: string): string {
  return url.trim().replace(/\/$/, "");
}

/**
 * Next.js API origin. Set `API_BASE_URL` in repo root `.env` for physical devices
 * (e.g. http://192.168.1.10:3000). Android emulator: http://10.0.2.2:PORT maps to host localhost.
 */
export function getApiBase(): string {
  const raw = typeof API_BASE_URL === "string" ? API_BASE_URL.trim() : "";
  if (raw.length > 0) {
    return normalizeBase(raw);
  }
  if (__DEV__) {
    return "http://10.0.2.2:3000";
  }
  throw new Error("API_BASE_URL is not set in .env");
}
