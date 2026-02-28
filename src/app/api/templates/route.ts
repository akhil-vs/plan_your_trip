import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const templates = await prisma.tripTemplate.findMany({
    where: { userId: session.user.id },
    include: { waypoints: { orderBy: { order: "asc" } } },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(templates);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tripId, name } = await req.json();
  if (!tripId || typeof tripId !== "string") {
    return NextResponse.json({ error: "tripId is required" }, { status: 400 });
  }

  const trip = await prisma.trip.findFirst({
    where: { id: tripId, userId: session.user.id },
    include: { waypoints: { orderBy: { order: "asc" } } },
  });

  if (!trip) {
    return NextResponse.json({ error: "Itinerary not found" }, { status: 404 });
  }

  const template = await prisma.tripTemplate.create({
    data: {
      name: typeof name === "string" && name.trim() ? name.trim() : `${trip.name} Template`,
      description: trip.description,
      userId: session.user.id,
      waypoints: {
        create: trip.waypoints.map((wp) => ({
          name: wp.name,
          lat: wp.lat,
          lng: wp.lng,
          order: wp.order,
        })),
      },
    },
    include: { waypoints: { orderBy: { order: "asc" } } },
  });

  return NextResponse.json(template, { status: 201 });
}
