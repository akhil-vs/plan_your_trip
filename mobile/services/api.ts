import * as SecureStore from "expo-secure-store";
import { getApiBase } from "../utils/apiBase";

export const TOKEN_KEY = "viazo_auth_token";

function networkHelpMessage(base: string): string {
  const isLocalhost =
    base.includes("localhost") || base.includes("127.0.0.1");
  if (isLocalhost) {
    return "Still using localhost for the API. Use LAN mode (npx expo start --lan), turn off tunnel, or set EXPO_PUBLIC_API_URL to http://YOUR_IP:3000. Repo root: npm run dev (Next.js) must be running.";
  }
  try {
    const port = new URL(base).port || "(default)";
    return `Could not reach the API at ${base}. Same Wi‑Fi as the phone, firewall allows port ${port}, Next.js running (repo root: npm run dev:lan).`;
  } catch {
    return `Could not reach the API at ${base}. Check Wi‑Fi, firewall, and that Next.js is running.`;
  }
}

export type ApiErrorBody = { error?: string };

export async function getStoredToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setStoredToken(token: string | null): Promise<void> {
  if (token) {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } else {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
}

export async function apiFetch(
  path: string,
  options: RequestInit & { skipAuth?: boolean } = {}
): Promise<Response> {
  const { skipAuth, ...init } = options;
  const url = `${getApiBase()}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body != null) {
    headers.set("Content-Type", "application/json");
  }
  if (!skipAuth) {
    const token = await getStoredToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }
  const base = getApiBase();
  try {
    return await fetch(url, { ...init, headers });
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message === "Network request failed"
        ? networkHelpMessage(base)
        : e instanceof Error
          ? e.message
          : "Network error";
    throw new Error(msg);
  }
}

export async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}
