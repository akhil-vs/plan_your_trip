import { apiFetch, setStoredToken } from "./api";

async function readJsonRecord(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {
      _nonJson: true,
      _snippet: text.replace(/\s+/g, " ").trim().slice(0, 160),
    };
  }
}

function messageFromRecord(data: Record<string, unknown>, status: number): string {
  const err = data.error;
  const msg = data.message;
  const detail = data.detail;
  if (typeof err === "string" && err.length > 0) return err;
  if (typeof msg === "string" && msg.length > 0) return msg;
  if (typeof detail === "string" && detail.length > 0) return detail;
  if (Array.isArray(detail)) {
    const parts = detail
      .map((d) =>
        d && typeof d === "object" && typeof (d as { msg?: unknown }).msg === "string"
          ? (d as { msg: string }).msg
          : null
      )
      .filter((s): s is string => typeof s === "string" && s.length > 0);
    if (parts.length > 0) return parts.join("; ");
  }
  if (data._nonJson === true && typeof data._snippet === "string") {
    return `HTTP ${status}: ${data._snippet}`;
  }
  return `HTTP ${status}`;
}

/** Non-JSON bodies often come from proxies or the wrong port (e.g. nginx on :3000). */
function authEndpointHint(status: number): string {
  if (status !== 404) return "";
  return (
    " Confirm EXPO_PUBLIC_API_URL uses the same host and port as Next.js (see dev terminal “Local:” URL). " +
    "Another service on that port will return 404 for /api/auth/…."
  );
}

export type Plan = "FREE" | "PRO" | "TEAM";

export type AuthUser = {
  id: string;
  name: string | null;
  email: string;
  plan: Plan;
  isAdmin: boolean;
};

export type AccountMe = AuthUser & {
  onboardingComplete?: boolean;
  travelPreference?: string | null;
};

export async function loginMobile(email: string, password: string) {
  const res = await apiFetch("/api/auth/mobile/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
    skipAuth: true,
  });
  const data = await readJsonRecord(res);

  if (!res.ok) {
    throw new Error(messageFromRecord(data, res.status) + authEndpointHint(res.status));
  }

  const accessToken =
    typeof data.accessToken === "string" ? data.accessToken : undefined;
  const user = data.user;

  if (
    !accessToken ||
    !user ||
    typeof user !== "object" ||
    typeof (user as AuthUser).id !== "string" ||
    typeof (user as AuthUser).email !== "string"
  ) {
    throw new Error(
      `Unexpected sign-in response (HTTP ${res.status}). ` +
        `Confirm Next.js is running and POST /api/auth/mobile/login exists.`
    );
  }

  try {
    await setStoredToken(accessToken);
  } catch (storeErr) {
    throw new Error(
      storeErr instanceof Error
        ? `Could not save session: ${storeErr.message}`
        : "Could not save session on device"
    );
  }

  return { accessToken, user: user as AuthUser };
}

export async function registerAccount(
  name: string,
  email: string,
  password: string
) {
  const res = await apiFetch("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
    skipAuth: true,
  });
  const data = await readJsonRecord(res);
  if (!res.ok) {
    throw new Error(messageFromRecord(data, res.status) + authEndpointHint(res.status));
  }
  try {
    return await loginMobile(email, password);
  } catch (e) {
    const signInMsg = e instanceof Error ? e.message : "Sign-in failed";
    throw new Error(
      `Account may be created, but sign-in failed: ${signInMsg}`
    );
  }
}

export async function fetchAccountMe(): Promise<AccountMe> {
  const res = await apiFetch("/api/account/me");
  const data = await readJsonRecord(res);
  if (!res.ok) {
    throw new Error(messageFromRecord(data, res.status) + authEndpointHint(res.status));
  }
  return data as AccountMe;
}

export async function signOutLocal() {
  await setStoredToken(null);
}
