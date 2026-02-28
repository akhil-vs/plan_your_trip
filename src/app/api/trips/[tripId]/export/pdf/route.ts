import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewTrip, getTripAccess } from "@/lib/tripAccess";
import { buildTripItineraryPdf } from "@/lib/pdf";

export const runtime = "nodejs";

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
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (access.trip.status !== "FINALIZED") {
    return NextResponse.json(
      { error: "Itinerary must be finalized before PDF export" },
      { status: 400 }
    );
  }

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      user: { select: { name: true, email: true } },
      members: { include: { user: { select: { name: true, email: true } } } },
      waypoints: { orderBy: { order: "asc" } },
      dayPlans: { orderBy: { day: "asc" } },
    },
  });
  if (!trip) {
    return NextResponse.json({ error: "Itinerary not found" }, { status: 404 });
  }

  const waypointById = new Map(trip.waypoints.map((wp) => [wp.id, wp]));
  const pdfBuffer = buildTripItineraryPdf({
    tripName: trip.name,
    status: trip.status,
    isPublic: trip.isPublic,
    ownerName: trip.user.name,
    ownerEmail: trip.user.email,
    createdAtIso: trip.createdAt.toISOString(),
    updatedAtIso: trip.updatedAt.toISOString(),
    collaborators: trip.members.map((member) => ({
      name: member.user.name,
      email: member.user.email,
      role: member.role,
    })),
    waypoints: trip.waypoints.map((wp) => ({
      id: wp.id,
      name: wp.name,
      notes: wp.notes,
      visitMinutes: wp.visitMinutes,
      openMinutes: wp.openMinutes,
      closeMinutes: wp.closeMinutes,
    })),
    dayPlans: trip.dayPlans.map((day) => ({
      day: day.day,
      estimatedTravelMinutes: day.estimatedTravelMinutes,
      // Use index-based mapping as primary source since saved waypointIds can
      // become stale after waypoint recreation on trip updates.
      waypointIds: (() => {
        const idsFromIndexes = day.waypointIndexes
          .map((idx) => trip.waypoints[idx]?.id)
          .filter((id): id is string => Boolean(id && waypointById.has(id)));
        if (idsFromIndexes.length > 0) return idsFromIndexes;
        return day.waypointIds.filter((id) => waypointById.has(id));
      })(),
    })),
  });
  return new Response(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${trip.name
        .replace(/[^a-z0-9]+/gi, "-")
        .toLowerCase()}-itinerary.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
