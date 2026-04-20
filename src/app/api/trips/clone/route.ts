import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const authUser = await getApiUser(req);
  if (!authUser?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { shareId } = await req.json();
  if (!shareId || typeof shareId !== "string") {
    return NextResponse.json({ error: "shareId is required" }, { status: 400 });
  }

  const source = await prisma.trip.findFirst({
    where: { shareId, isPublic: true },
    select: {
      name: true,
      description: true,
      status: true,
      waypoints: {
        orderBy: { order: "asc" },
        select: {
          name: true,
          notes: true,
          lat: true,
          lng: true,
          order: true,
          isLocked: true,
          visitMinutes: true,
          openMinutes: true,
          closeMinutes: true,
        },
      },
      dayPlans: {
        orderBy: { day: "asc" },
        select: {
          day: true,
          waypointIndexes: true,
          waypointIds: true,
          estimatedTravelMinutes: true,
        },
      },
    },
  });

  if (!source) {
    return NextResponse.json({ error: "Shared trip not found" }, { status: 404 });
  }

  const cloned = await prisma.trip.create({
    data: {
      name: `${source.name} (Copy)`,
      description: source.description,
      userId: authUser.id,
      status: source.status,
      members: {
        create: {
          userId: authUser.id,
          role: "OWNER",
        },
      },
      waypoints: {
        create: source.waypoints.map((wp) => ({
          name: wp.name,
          notes: wp.notes,
          lat: wp.lat,
          lng: wp.lng,
          order: wp.order,
          isLocked: wp.isLocked,
          visitMinutes: wp.visitMinutes,
          openMinutes: wp.openMinutes,
          closeMinutes: wp.closeMinutes,
        })),
      },
      dayPlans: {
        create: source.dayPlans.map((day) => ({
          day: day.day,
          waypointIndexes: day.waypointIndexes,
          waypointIds: day.waypointIds,
          estimatedTravelMinutes: day.estimatedTravelMinutes,
        })),
      },
    },
    select: {
      id: true,
      name: true,
    },
  });

  return NextResponse.json(cloned, { status: 201 });
}
