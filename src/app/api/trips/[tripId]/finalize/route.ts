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
  return NextResponse.json(trip);
}
