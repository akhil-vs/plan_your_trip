import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { canManageTrip, getTripAccess } from "@/lib/tripAccess";
import { createTripEvent } from "@/lib/tripEvents";
import { notifyTripCollaborators } from "@/lib/inAppNotifications";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const authUser = await getApiUser(req);
  if (!authUser?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { tripId } = await params;
  const access = await getTripAccess(tripId, authUser.id);
  if (!access || !canManageTrip(access.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const before = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { name: true },
  });
  const trip = await prisma.trip.update({
    where: { id: tripId },
    data: { status: "FINALIZED" },
    select: { id: true, status: true, isPublic: true },
  });

  await createTripEvent(
    tripId,
    "trip.finalized",
    { status: "FINALIZED" },
    authUser.id,
    authUser.name ?? null
  );
  const who = authUser.name || authUser.email || "Someone";
  const tn = before?.name?.trim() || "An itinerary";
  try {
    await notifyTripCollaborators({
      tripId,
      exceptUserId: authUser.id,
      type: "TRIP_UPDATED",
      title: "Itinerary finalized",
      body: `${who} finalized “${tn}”.`,
    });
  } catch {
    // best-effort
  }
  return NextResponse.json(trip);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const authUser = await getApiUser(req);
  if (!authUser?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { tripId } = await params;
  const access = await getTripAccess(tripId, authUser.id);
  if (!access || !canManageTrip(access.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const before = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { name: true },
  });
  const trip = await prisma.trip.update({
    where: { id: tripId },
    data: { status: "DRAFT", isPublic: false },
    select: { id: true, status: true, isPublic: true },
  });

  await createTripEvent(
    tripId,
    "trip.unfinalized",
    { status: "DRAFT" },
    authUser.id,
    authUser.name ?? null
  );
  const who = authUser.name || authUser.email || "Someone";
  const tn = before?.name?.trim() || "An itinerary";
  try {
    await notifyTripCollaborators({
      tripId,
      exceptUserId: authUser.id,
      type: "TRIP_UPDATED",
      title: "Itinerary reopened",
      body: `${who} moved “${tn}” back to draft (now private).`,
    });
  } catch {
    // best-effort
  }
  return NextResponse.json(trip);
}
