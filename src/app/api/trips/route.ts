import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createTripEvent } from "@/lib/tripEvents";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const trips = await prisma.trip.findMany({
    where: {
      OR: [
        { userId: session.user.id },
        { members: { some: { userId: session.user.id } } },
      ],
    },
    include: {
      waypoints: { orderBy: { order: "asc" } },
      dayPlans: { orderBy: { day: "asc" } },
      _count: { select: { savedPlaces: true, members: true } },
      members: {
        where: { userId: session.user.id },
        select: { role: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(trips);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
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
        name: name || "Untitled Trip",
        description,
        userId: session.user.id,
        optimizerDayStartMinutes,
        optimizerDayEndMinutes,
        optimizerDefaultVisitMinutes,
        waypoints: {
          create: (waypoints || []).map(
            (wp: {
              name: string;
              notes?: string;
              lat: number;
              lng: number;
              order: number;
              isLocked?: boolean;
              visitMinutes?: number;
              openMinutes?: number;
              closeMinutes?: number;
            }) => ({
              name: wp.name,
              notes: typeof wp.notes === "string" ? wp.notes : null,
              lat: wp.lat,
              lng: wp.lng,
              order: wp.order,
              isLocked: wp.isLocked === true,
              visitMinutes:
                typeof wp.visitMinutes === "number" && Number.isFinite(wp.visitMinutes)
                  ? Math.max(5, Math.round(wp.visitMinutes))
                  : 60,
              openMinutes:
                typeof wp.openMinutes === "number" && Number.isFinite(wp.openMinutes)
                  ? Math.max(0, Math.min(23 * 60 + 59, Math.round(wp.openMinutes)))
                  : 0,
              closeMinutes:
                typeof wp.closeMinutes === "number" && Number.isFinite(wp.closeMinutes)
                  ? Math.max(0, Math.min(23 * 60 + 59, Math.round(wp.closeMinutes)))
                  : 23 * 60 + 59,
            })
          ),
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
            userId: session.user.id,
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
      { name: trip.name, waypointCount: trip.waypoints.length },
      session.user.id,
      session.user.name ?? null
    );

    return NextResponse.json(trip, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save itinerary";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
