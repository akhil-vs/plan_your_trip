import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditTrip, canManageTrip, canViewTrip, getTripAccess } from "@/lib/tripAccess";
import { createTripEvent } from "@/lib/tripEvents";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tripId } = await params;
  const access = await getTripAccess(tripId, session.user.id);
  if (!access || !canViewTrip(access.role)) {
    return NextResponse.json({ error: "Itinerary not found" }, { status: 404 });
  }
  const trip = await prisma.trip.findFirst({
    where: { id: tripId },
    include: {
      waypoints: { orderBy: { order: "asc" } },
      dayPlans: { orderBy: { day: "asc" } },
      savedPlaces: true,
      members: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      invites: {
        where: { status: "PENDING" },
        select: { id: true, email: true, role: true, status: true, expiresAt: true },
      },
    },
  });

  if (!trip) {
    return NextResponse.json({ error: "Itinerary not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...trip,
    currentUserRole: access.role,
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tripId } = await params;
  const { name, description, waypoints, dayPlans, optimizationSettings } =
    await req.json();

  const access = await getTripAccess(tripId, session.user.id);
  if (!access || !canEditTrip(access.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const existing = await prisma.trip.findUnique({ where: { id: tripId } });

  if (!existing) {
    return NextResponse.json({ error: "Itinerary not found" }, { status: 404 });
  }
  if (existing.status === "FINALIZED") {
    return NextResponse.json(
      { error: "Itinerary is finalized. Reopen it before editing." },
      { status: 400 }
    );
  }

  // Delete existing waypoints and recreate
  await prisma.waypoint.deleteMany({ where: { tripId } });
  await prisma.tripDayPlan.deleteMany({ where: { tripId } });

  try {
    const trip = await prisma.trip.update({
      where: { id: tripId },
      data: {
        name: name || existing.name,
        description: description !== undefined ? description : existing.description,
        optimizerDayStartMinutes:
          typeof optimizationSettings?.dayStartMinutes === "number" &&
          Number.isFinite(optimizationSettings.dayStartMinutes)
            ? Math.max(
                0,
                Math.min(23 * 60 + 59, Math.round(optimizationSettings.dayStartMinutes))
              )
            : existing.optimizerDayStartMinutes,
        optimizerDayEndMinutes:
          typeof optimizationSettings?.dayEndMinutes === "number" &&
          Number.isFinite(optimizationSettings.dayEndMinutes)
            ? Math.max(
                0,
                Math.min(23 * 60 + 59, Math.round(optimizationSettings.dayEndMinutes))
              )
            : existing.optimizerDayEndMinutes,
        optimizerDefaultVisitMinutes:
          typeof optimizationSettings?.defaultVisitMinutes === "number" &&
          Number.isFinite(optimizationSettings.defaultVisitMinutes)
            ? Math.max(5, Math.round(optimizationSettings.defaultVisitMinutes))
            : existing.optimizerDefaultVisitMinutes,
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
      },
      include: {
        waypoints: { orderBy: { order: "asc" } },
        dayPlans: { orderBy: { day: "asc" } },
      },
    });

    await createTripEvent(
      tripId,
      "trip.updated",
      {
        name: trip.name,
        waypointCount: trip.waypoints.length,
        dayCount: trip.dayPlans.length,
      },
      session.user.id,
      session.user.name ?? null
    );

    return NextResponse.json(trip);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save itinerary";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tripId } = await params;
  const access = await getTripAccess(tripId, session.user.id);
  if (!access || !canManageTrip(access.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.trip.delete({ where: { id: tripId } });

  return NextResponse.json({ success: true });
}
