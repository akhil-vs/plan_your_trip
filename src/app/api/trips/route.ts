import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { createTripEvent } from "@/lib/tripEvents";
import { buildTripCreatedActivityLines } from "@/lib/tripUpdateActivitySummary";

export async function GET(request: NextRequest) {
  const authUser = await getApiUser(request);
  if (!authUser?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Itineraries this user owns or is invited to (never includes other users' private trips).
  const myTrips = await prisma.trip.findMany({
    where: {
      OR: [
        { userId: authUser.id },
        { members: { some: { userId: authUser.id } } },
      ],
    },
    include: {
      waypoints: { orderBy: { order: "asc" } },
      dayPlans: { orderBy: { day: "asc" } },
      _count: { select: { savedPlaces: true, members: true } },
      members: {
        where: { userId: authUser.id },
        select: { role: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const myTripIds = myTrips.map((t) => t.id);

  // Community published feed: all public itineraries except ones already listed above (no duplicate cards).
  const publicTrips = await prisma.trip.findMany({
    where: {
      isPublic: true,
      ...(myTripIds.length > 0 ? { id: { notIn: myTripIds } } : {}),
    },
    include: {
      waypoints: { orderBy: { order: "asc" } },
      _count: { select: { members: true, savedPlaces: true } },
      user: { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 48,
  });

  return NextResponse.json({ myTrips, publicTrips });
}

export async function POST(req: NextRequest) {
  const authUser = await getApiUser(req);
  if (!authUser?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, description, waypoints, dayPlans, optimizationSettings } =
    await req.json();

  const optimizerDayStartMinutes =
    typeof optimizationSettings?.dayStartMinutes === "number" &&
    Number.isFinite(optimizationSettings.dayStartMinutes)
      ? Math.max(0, Math.min(23 * 60 + 59, Math.round(optimizationSettings.dayStartMinutes)))
      : 9 * 60;
  const optimizerDayEndMinutes =
    typeof optimizationSettings?.dayEndMinutes === "number" &&
    Number.isFinite(optimizationSettings.dayEndMinutes)
      ? Math.max(0, Math.min(23 * 60 + 59, Math.round(optimizationSettings.dayEndMinutes)))
      : 20 * 60;
  const optimizerDefaultVisitMinutes =
    typeof optimizationSettings?.defaultVisitMinutes === "number" &&
    Number.isFinite(optimizationSettings.defaultVisitMinutes)
      ? Math.max(5, Math.round(optimizationSettings.defaultVisitMinutes))
      : 60;

  try {
    const trip = await prisma.trip.create({
      data: {
        name:
          typeof name === "string" && name.trim().length > 0 ? name.trim() : "Untitled",
        description,
        userId: authUser.id,
        optimizerDayStartMinutes,
        optimizerDayEndMinutes,
        optimizerDefaultVisitMinutes,
        waypoints: {
          create: (Array.isArray(waypoints) ? waypoints : []).map((wp: Record<string, unknown>) => {
            const id =
              typeof wp?.id === "string" &&
              wp.id.trim().length >= 3 &&
              wp.id.trim().length <= 128
                ? wp.id.trim()
                : undefined;
            return {
              ...(id ? { id } : {}),
              name: typeof wp?.name === "string" ? wp.name : "Stop",
              notes: typeof wp?.notes === "string" ? wp.notes : null,
              lat: typeof wp?.lat === "number" && Number.isFinite(wp.lat) ? wp.lat : 0,
              lng: typeof wp?.lng === "number" && Number.isFinite(wp.lng) ? wp.lng : 0,
              order: typeof wp?.order === "number" && Number.isFinite(wp.order) ? wp.order : 0,
              isLocked: wp?.isLocked === true,
              visitMinutes:
                typeof wp?.visitMinutes === "number" && Number.isFinite(wp.visitMinutes)
                  ? Math.max(5, Math.round(wp.visitMinutes))
                  : 60,
              openMinutes:
                typeof wp?.openMinutes === "number" && Number.isFinite(wp.openMinutes)
                  ? Math.max(0, Math.min(23 * 60 + 59, Math.round(wp.openMinutes)))
                  : 0,
              closeMinutes:
                typeof wp?.closeMinutes === "number" && Number.isFinite(wp.closeMinutes)
                  ? Math.max(0, Math.min(23 * 60 + 59, Math.round(wp.closeMinutes)))
                  : 23 * 60 + 59,
            };
          }),
        },
        dayPlans: {
          create: (dayPlans || []).map(
            (dp: {
              day: number;
              waypointIndexes: number[];
              waypointIds?: string[];
              estimatedTravelMinutes: number;
            }) => ({
              day: dp.day,
              waypointIndexes: dp.waypointIndexes || [],
              waypointIds: dp.waypointIds || [],
              estimatedTravelMinutes: dp.estimatedTravelMinutes || 0,
            })
          ),
        },
        members: {
          create: {
            userId: authUser.id,
            role: "OWNER",
          },
        },
      },
      include: {
        waypoints: { orderBy: { order: "asc" } },
        dayPlans: { orderBy: { day: "asc" } },
        members: true,
      },
    });

    await createTripEvent(
      trip.id,
      "trip.created",
      {
        name: trip.name,
        waypointCount: trip.waypoints.length,
        activityLines: buildTripCreatedActivityLines(
          authUser.name ?? "Someone",
          trip.name,
          trip.waypoints.map((w) => ({ name: w.name, order: w.order }))
        ),
      },
      authUser.id,
      authUser.name ?? null
    );

    return NextResponse.json(trip, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save itinerary";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
