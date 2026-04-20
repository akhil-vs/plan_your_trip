import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const authUser = await getApiUser(req);
  if (!authUser?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { templateId } = await params;

  const template = await prisma.tripTemplate.findFirst({
    where: { id: templateId, userId: authUser.id },
    include: { waypoints: { orderBy: { order: "asc" } } },
  });

  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const trip = await prisma.trip.create({
    data: {
      name: template.name.replace(/ Template$/, ""),
      description: template.description,
      userId: authUser.id,
      waypoints: {
        create: template.waypoints.map((wp) => ({
          name: wp.name,
          lat: wp.lat,
          lng: wp.lng,
          order: wp.order,
        })),
      },
    },
    select: {
      id: true,
      name: true,
    },
  });

  return NextResponse.json(trip, { status: 201 });
}
