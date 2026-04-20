import { apiFetch, parseJson } from "./api";

export async function skipOnboarding() {
  const res = await apiFetch("/api/onboarding/skip", { method: "POST" });
  if (!res.ok) {
    const e = await parseJson<{ error?: string }>(res);
    throw new Error(e.error || "Skip failed");
  }
}

export async function completeOnboarding(body: {
  destinationName: string;
  lat: number;
  lng: number;
  travelPreference: string;
}) {
  const res = await apiFetch("/api/onboarding/complete", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const data = await parseJson<{ tripId?: string; error?: string }>(res);
  if (!res.ok) {
    throw new Error(data.error || "Onboarding failed");
  }
  return data;
}
