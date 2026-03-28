import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createTripEvent } from "@/lib/tripEvents";
import { fetchNearbyAttractionStops } from "@/lib/nearbyAttractions";

const PREFS = ["solo", "couple", "family", "group"] as const;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const destinationName = (body?.destinationName as string | undefined)?.trim();
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  const travelPreference = (body?.travelPreference as string | undefined)?.toLowerCase();

  if (!destinationName || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json(
      { error: "destinationName, lat, and lng are required" },
      { status: 400 }
    );
  }

  if (!travelPreference || !PREFS.includes(travelPreference as (typeof PREFS)[number])) {
    return NextResponse.json({ error: "Invalid travelPreference" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { onboardingComplete: true },
  });
  if (user?.onboardingComplete) {
    return NextResponse.json({ error: "Onboarding already completed" }, { status: 400 });
  }

  const extras = await fetchNearbyAttractionStops(lat, lng, 2);
  const waypoints = [
    { name: destinationName, lat, lng, order: 0 },
    ...extras.map((wp, i) => ({
      name: wp.name,
      lat: wp.lat,
      lng: wp.lng,
      order: i + 1,
    })),
  ];

  const tripName = `${destinationName.split(",")[0].slice(0, 48)} trip`;

  try {
    const trip = await prisma.trip.create({
      data: {
        name: tripName,
        description: `Travel style: ${travelPreference}. Started from onboarding.`,
        userId: session.user.id,
        waypoints: {
          create: waypoints.map((wp) => ({
            name: wp.name,
            lat: wp.lat,
            lng: wp.lng,
            order: wp.order,
            visitMinutes: 60,
            openMinutes: 0,
            closeMinutes: 23 * 60 + 59,
          })),
        },
        dayPlans: {
          create: [
            {
              day: 1,
              waypointIndexes: waypoints.map((_, i) => i),
              waypointIds: [],
              estimatedTravelMinutes: 0,
            },
          ],
        },
        members: {
          create: { userId: session.user.id, role: "OWNER" },
        },
      },
      include: { waypoints: { orderBy: { order: "asc" } } },
    });

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        onboardingComplete: true,
        travelPreference,
      },
    });

    await createTripEvent(
      trip.id,
      "trip.created",
      { name: trip.name, waypointCount: trip.waypoints.length, source: "onboarding" },
      session.user.id,
      session.user.name ?? null
    );

    return NextResponse.json({ tripId: trip.id }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create trip";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
