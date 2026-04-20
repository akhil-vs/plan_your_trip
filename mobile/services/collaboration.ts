import { apiFetch, parseJson } from "./api";

export async function fetchTripMembers(tripId: string) {
  const res = await apiFetch(`/api/trips/${tripId}/members`);
  if (!res.ok) {
    const e = await parseJson<{ error?: string }>(res);
    throw new Error(e.error || "Failed to load members");
  }
  return parseJson<unknown[]>(res);
}

export async function fetchTripInvites(tripId: string) {
  const res = await apiFetch(`/api/trips/${tripId}/invites`);
  if (!res.ok) {
    const e = await parseJson<{ error?: string }>(res);
    throw new Error(e.error || "Failed to load invites");
  }
  return parseJson<unknown[]>(res);
}

export async function fetchTripChat(tripId: string) {
  const res = await apiFetch(`/api/trips/${tripId}/chat`);
  if (!res.ok) {
    const e = await parseJson<{ error?: string }>(res);
    throw new Error(e.error || "Failed to load chat");
  }
  return parseJson<unknown[]>(res);
}

export async function postTripChat(
  tripId: string,
  body: { body?: string; imageUrl?: string }
) {
  const res = await apiFetch(`/api/trips/${tripId}/chat`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  const data = await parseJson<unknown>(res);
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || "Send failed");
  }
  return data;
}

export async function postFinalize(tripId: string) {
  const res = await apiFetch(`/api/trips/${tripId}/finalize`, { method: "POST" });
  const data = await parseJson<unknown>(res);
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || "Finalize failed");
  }
  return data;
}

export async function deleteUnfinalize(tripId: string) {
  const res = await apiFetch(`/api/trips/${tripId}/finalize`, { method: "DELETE" });
  const data = await parseJson<unknown>(res);
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || "Reopen failed");
  }
  return data;
}

export async function postPublish(tripId: string) {
  const res = await apiFetch(`/api/trips/${tripId}/publish`, { method: "POST" });
  const data = await parseJson<unknown>(res);
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || "Publish failed");
  }
  return data;
}

export async function deleteUnpublish(tripId: string) {
  const res = await apiFetch(`/api/trips/${tripId}/publish`, { method: "DELETE" });
  const data = await parseJson<unknown>(res);
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || "Unpublish failed");
  }
  return data;
}

export async function acceptInvite(token: string) {
  const res = await apiFetch(`/api/trips/invites/${token}/accept`, {
    method: "POST",
  });
  const data = await parseJson<unknown>(res);
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || "Invite failed");
  }
  return data as { tripId?: string };
}

export async function fetchAdminStats() {
  const res = await apiFetch("/api/admin/stats");
  return parseJson<unknown>(res);
}

export async function fetchAdminUsers() {
  const res = await apiFetch("/api/admin/users");
  return parseJson<unknown[]>(res);
}
