import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { apiFetch } from "./api";

export async function shareTripPdf(tripId: string, filenameBase: string) {
  const res = await apiFetch(`/api/trips/${tripId}/export/pdf`);
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || "PDF export failed");
  }
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  // eslint-disable-next-line no-undef
  const b64 = btoa(binary);
  const safe = filenameBase.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "trip";
  const base = FileSystem.cacheDirectory;
  if (!base) throw new Error("Cache directory unavailable");
  const path = `${base}${safe}-itinerary.pdf`;
  await FileSystem.writeAsStringAsync(path, b64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  await Sharing.shareAsync(path, {
    mimeType: "application/pdf",
    dialogTitle: "Share itinerary PDF",
  });
}
