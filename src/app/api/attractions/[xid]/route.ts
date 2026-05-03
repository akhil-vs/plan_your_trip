import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ xid: string }> }
) {
  const { xid } = await params;
  const apiKey = process.env.OPENTRIPMAP_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "OpenTripMap API key not configured" },
      { status: 500 }
    );
  }

  try {
    const getCachedDetails = unstable_cache(
      async () => {
        const res = await fetch(`https://api.opentripmap.com/0.1/en/places/xid/${xid}?apikey=${apiKey}`);
        if (!res.ok) throw new Error(`OpenTripMap details failed (${res.status})`);
        const data = await res.json();
        return {
          id: data.xid,
          name: data.name || "Unnamed Place",
          description: data.wikipedia_extracts?.text || data.info?.descr || "",
          image: data.preview?.source || data.image || "",
          url: data.wikipedia || data.url || "",
          address: [
            data.address?.road,
            data.address?.city || data.address?.town || data.address?.village,
            data.address?.state,
            data.address?.country,
          ]
            .filter(Boolean)
            .join(", "),
          lat: data.point?.lat,
          lng: data.point?.lon,
          kinds: data.kinds || "",
          rating: data.rate || 0,
          openingHours:
            typeof data.opening_hours === "string"
              ? data.opening_hours
              : data.opening_hours?.hours || "",
        };
      },
      ["attraction-detail", xid],
      { revalidate: 86400 }
    );

    const detail = await getCachedDetails();
    return NextResponse.json(detail, {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch details" },
      { status: 500 }
    );
  }
}
