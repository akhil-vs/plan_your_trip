import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { canEditTrip, getTripAccess } from "@/lib/tripAccess";

type SaveBody = {
  tripId?: string;
  name?: string;
  category?: string;
  lat?: number;
  lng?: number;
  notes?: string;
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getApiUser(req);
  if (!authUser?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = (await req.json()) as SaveBody;
  if (!body.tripId || !body.name || typeof body.lat !== "number" || typeof body.lng !== "number") {
    return NextResponse.json({ error: "tripId, name, lat, lng are required" }, { status: 400 });
  }

  const access = await getTripAccess(body.tripId, authUser.id);
  if (!access || !canEditTrip(access.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await prisma.savedPlace.findFirst({
    where: { tripId: body.tripId, externalId: id },
  });
  if (existing) {
    return NextResponse.json(existing);
  }

  const created = await prisma.savedPlace.create({
    data: {
      tripId: body.tripId,
      externalId: id,
      name: body.name,
      category: body.category || "gem",
      lat: body.lat,
      lng: body.lng,
      notes: body.notes || null,
    },
  });
  return NextResponse.json(created, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getApiUser(req);
  if (!authUser?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const tripId = req.nextUrl.searchParams.get("tripId");
  if (!tripId) {
    return NextResponse.json({ error: "tripId is required" }, { status: 400 });
  }

  const access = await getTripAccess(tripId, authUser.id);
  if (!access || !canEditTrip(access.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.savedPlace.deleteMany({
    where: { tripId, externalId: id },
  });
  return NextResponse.json({ success: true });
}
