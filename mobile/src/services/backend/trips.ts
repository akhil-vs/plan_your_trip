import { apiFetch, parseJson } from "./apiClient";

export type TripListResponse = {
  myTrips: TripSummary[];
  publicTrips: TripSummary[];
};

export type TripSummary = {
  id: string;
  name: string;
  description: string | null;
  status: "DRAFT" | "FINALIZED";
  isPublic: boolean;
  shareId: string;
  createdAt: string;
  updatedAt?: string;
  waypoints?: TripWaypoint[];
  user?: { id: string; name: string | null };
  _count?: { members: number; savedPlaces: number };
};

export type TripWaypoint = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  order: number;
};

export async function fetchTrips(): Promise<TripListResponse> {
  const res = await apiFetch("/api/trips");
  return parseJson<TripListResponse>(res);
}

export async function fetchTrip(tripId: string): Promise<unknown> {
  const res = await apiFetch(`/api/trips/${tripId}`);
  const data = await parseJson<unknown>(res);
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || "Failed to load trip");
  }
  return data;
}

export async function createTrip(body: { name: string; description?: string | null }) {
  const res = await apiFetch("/api/trips", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const data = await parseJson<{ id?: string; error?: string }>(res);
  if (!res.ok) {
    throw new Error(data.error || "Create failed");
  }
  return data;
}

export async function updateTrip(tripId: string, body: unknown) {
  const res = await apiFetch(`/api/trips/${tripId}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  const data = await parseJson<{ error?: string }>(res);
  if (!res.ok) {
    throw new Error(data.error || "Save failed");
  }
  return data;
}

export async function deleteTripRemote(tripId: string): Promise<void> {
  const res = await apiFetch(`/api/trips/${tripId}`, { method: "DELETE" });
  if (!res.ok) {
    const data = await parseJson<{ error?: string }>(res);
    throw new Error(data.error || "Delete failed");
  }
}
