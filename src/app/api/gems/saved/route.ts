import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { canViewTrip, getTripAccess } from "@/lib/tripAccess";

export async function GET(req: NextRequest) {
  const authUser = await getApiUser(req);
  if (!authUser?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const tripId = req.nextUrl.searchParams.get("tripId");
  if (!tripId) {
    return NextResponse.json({ error: "tripId is required" }, { status: 400 });
  }
  const access = await getTripAccess(tripId, authUser.id);
  if (!access || !canViewTrip(access.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const saved = await prisma.savedPlace.findMany({
    where: { tripId },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(saved);
}
