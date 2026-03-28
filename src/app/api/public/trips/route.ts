import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Unauthenticated catalog of published itineraries for the community.
 * Only trips with isPublic: true are returned; private drafts stay user-scoped via other APIs.
 */
export async function GET() {
  const trips = await prisma.trip.findMany({
    where: { isPublic: true },
    orderBy: { updatedAt: "desc" },
    take: 36,
    select: {
      id: true,
      name: true,
      description: true,
      shareId: true,
      updatedAt: true,
      user: { select: { name: true } },
      _count: { select: { waypoints: true, members: true } },
    },
  });

  return NextResponse.json({ trips });
}
