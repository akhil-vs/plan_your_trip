/**
 * Fetch up to `limit` attraction-like stops near a point for onboarding stubs.
 */
export async function fetchNearbyAttractionStops(
  lat: number,
  lng: number,
  limit: number
): Promise<Array<{ name: string; lat: number; lng: number }>> {
  const apiKey = process.env.OPENTRIPMAP_API_KEY;
  if (!apiKey || limit <= 0) {
    return fallbackStops(lat, lng, limit);
  }

  try {
    const params = new URLSearchParams({
      radius: "8000",
      lon: String(lng),
      lat: String(lat),
      kinds: "interesting_places",
      rate: "2",
      format: "json",
      limit: "12",
      apikey: apiKey,
    });
    const res = await fetch(
      `https://api.opentripmap.com/0.1/en/places/radius?${params}`,
      { next: { revalidate: 0 } }
    );
    if (!res.ok) return fallbackStops(lat, lng, limit);
    const data = (await res.json()) as Array<{
      name: string;
      point: { lon: number; lat: number };
    }>;
    const out: Array<{ name: string; lat: number; lng: number }> = [];
    for (const p of data || []) {
      if (!p?.point || !p.name) continue;
      const dLat = p.point.lat - lat;
      const dLng = p.point.lon - lng;
      if (Math.abs(dLat) < 1e-6 && Math.abs(dLng) < 1e-6) continue;
      out.push({ name: p.name, lat: p.point.lat, lng: p.point.lon });
      if (out.length >= limit) break;
    }
    if (out.length >= limit) return out.slice(0, limit);
    return [...out, ...fallbackStops(lat, lng, limit - out.length)];
  } catch {
    return fallbackStops(lat, lng, limit);
  }
}

function fallbackStops(lat: number, lng: number, count: number) {
  const delta = 0.04;
  const names = ["Scenic viewpoint", "Historic quarter", "Local park", "Waterfront walk"];
  const res: Array<{ name: string; lat: number; lng: number }> = [];
  for (let i = 0; i < count; i += 1) {
    res.push({
      name: names[i % names.length],
      lat: lat + (i % 2 === 0 ? delta : -delta * 0.8),
      lng: lng + (i % 2 === 1 ? delta : -delta * 0.6),
    });
  }
  return res;
}
