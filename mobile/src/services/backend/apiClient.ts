import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiBase } from "../../lib/apiBase";

export const TOKEN_KEY = "viazo_auth_token";

function networkHelpMessage(base: string): string {
  const isLocalhost = base.includes("localhost") || base.includes("127.0.0.1") || base.includes("10.0.2.2");
  if (isLocalhost) {
    return `Could not reach ${base}. Emulator: use 10.0.2.2 with your Next.js port. Phone: set API_BASE_URL in .env to http://YOUR_LAN_IP:PORT. Start Next from repo root (npm run dev / dev:lan).`;
  }
  return `Could not reach the API at ${base}.`;
}

export async function getStoredToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setStoredToken(token: string | null): Promise<void> {
  if (token) {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  } else {
    await AsyncStorage.removeItem(TOKEN_KEY);
  }
}

export async function apiFetch(
  path: string,
  options: RequestInit & { skipAuth?: boolean } = {},
): Promise<Response> {
  const { skipAuth, ...init } = options;
  const base = getApiBase();
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
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
  if (!text) {
    return {} as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}
