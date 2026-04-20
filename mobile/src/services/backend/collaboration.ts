import { apiFetch, parseJson } from "./apiClient";

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
