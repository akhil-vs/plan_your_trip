import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { canManageTrip, getTripAccess } from "@/lib/tripAccess";
import { createTripEvent } from "@/lib/tripEvents";

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

  const trip = await prisma.trip.update({
    where: { id: tripId },
    data: { isPublic: true },
    select: { id: true, status: true, isPublic: true, shareId: true },
  });

  await createTripEvent(
    tripId,
    "trip.published",
    { isPublic: true },
    authUser.id,
    authUser.name ?? null
  );
  return NextResponse.json({
    ...trip,
    shareUrl: `${req.nextUrl.origin}/share/${trip.shareId}`,
  });
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

  const trip = await prisma.trip.update({
    where: { id: tripId },
    data: { isPublic: false },
    select: { id: true, status: true, isPublic: true, shareId: true },
  });
  await createTripEvent(
    tripId,
    "trip.unpublished",
    { isPublic: false },
    authUser.id,
    authUser.name ?? null
  );
  return NextResponse.json(trip);
}
