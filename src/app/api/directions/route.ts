import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";

export const dynamic = "force-dynamic";

const MAPBOX_MAX_WAYPOINTS = 25;
const DIRECTIONS_CACHE_REVALIDATE = 2592000; // 30 days

function parseCoordinates(coordsStr: string): [number, number][] {
  return coordsStr.split(";").map((pair) => {
    const [lng, lat] = pair.split(",").map(Number);
    return [lng, lat];
  });
}

function formatCoordinates(coords: [number, number][]): string {
  return coords.map((c) => c.join(",")).join(";");
}

async function fetchMapboxRouteDirect(
  coordinates: string,
  profile: string,
  token: string
) {
  const params = new URLSearchParams({
    access_token: token,
    geometries: "geojson",
    overview: "full",
    steps: "false",
  });
  const res = await fetch(
    `https://api.mapbox.com/directions/v5/${profile}/${coordinates}?${params}`
  );
  if (!res.ok) throw new Error("Directions request failed");
  const data = await res.json();
  const route = data.routes?.[0];
  if (!route) throw new Error("No route found");
  return route;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const coordinatesParam = searchParams.get("coordinates");
  const profile = searchParams.get("profile") || "driving";

  if (!coordinatesParam) {
    return NextResponse.json(
      { error: "Coordinates required" },
      { status: 400 }
    );
  }

  const token = process.env.MAPBOX_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "Mapbox token not configured" },
      { status: 500 }
    );
  }

  const mapboxProfile =
    profile === "cycling"
      ? "mapbox/cycling"
      : profile === "walking"
        ? "mapbox/walking"
        : "mapbox/driving";

  const allCoords = parseCoordinates(coordinatesParam);
  if (allCoords.length < 2) {
    return NextResponse.json(
      { error: "At least 2 coordinates required" },
      { status: 400 }
    );
  }

  if (allCoords.length <= MAPBOX_MAX_WAYPOINTS) {
    const getCachedRoute = unstable_cache(
      () => fetchMapboxRouteDirect(coordinatesParam, mapboxProfile, token),
      ["directions", coordinatesParam, mapboxProfile],
      { revalidate: DIRECTIONS_CACHE_REVALIDATE }
    );

    const route = await getCachedRoute().catch(() => null);
    if (!route) {
      return NextResponse.json(
        { error: "No route found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      {
        distance: route.distance,
        duration: route.duration,
        geometry: route.geometry,
        legs: route.legs.map((leg: { distance: number; duration: number }) => ({
          distance: leg.distance,
          duration: leg.duration,
        })),
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=2592000, stale-while-revalidate",
        },
      }
    );
  }

  // Chunk coordinates for Mapbox 25-waypoint limit (overlap by 1 for continuity)
  const chunks: [number, number][][] = [];
  let offset = 0;
  while (offset < allCoords.length) {
    const chunk = allCoords.slice(offset, offset + MAPBOX_MAX_WAYPOINTS);
    if (chunk.length >= 2) chunks.push(chunk);
    if (chunk.length < MAPBOX_MAX_WAYPOINTS) break;
    offset += MAPBOX_MAX_WAYPOINTS - 1;
  }

  let totalDistance = 0;
  let totalDuration = 0;
  const allLegs: { distance: number; duration: number }[] = [];
  const allGeometryCoords: [number, number][] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunkCoordsStr = formatCoordinates(chunks[i]);
    const getCachedChunk = unstable_cache(
      () => fetchMapboxRouteDirect(chunkCoordsStr, mapboxProfile, token),
      ["directions", chunkCoordsStr, mapboxProfile],
      { revalidate: DIRECTIONS_CACHE_REVALIDATE }
    );
    const route = await getCachedChunk().catch(() => null);
    if (!route) {
      return NextResponse.json(
        { error: "No route found" },
        { status: 404 }
      );
    }

    totalDistance += route.distance;
    totalDuration += route.duration;

    for (const leg of route.legs) {
      allLegs.push({ distance: leg.distance, duration: leg.duration });
    }

    const coords = route.geometry?.coordinates ?? [];
    if (i === 0) {
      allGeometryCoords.push(...coords);
    } else {
      allGeometryCoords.push(...coords.slice(1));
    }
  }

  const mergedGeometry: GeoJSON.LineString = {
    type: "LineString",
    coordinates: allGeometryCoords,
  };

  return NextResponse.json(
    {
      distance: totalDistance,
      duration: totalDuration,
      geometry: mergedGeometry,
      legs: allLegs,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=2592000, stale-while-revalidate",
      },
    }
  );
}
