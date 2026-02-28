import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageTrip, getTripAccess } from "@/lib/tripAccess";
import { createTripEvent } from "@/lib/tripEvents";

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
  if (!access) {
    return NextResponse.json({ error: "Itinerary not found" }, { status: 404 });
  }

  const [members, owner] = await Promise.all([
    prisma.tripMember.findMany({
      where: { tripId },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.user.findUnique({
      where: { id: access.trip.userId },
      select: { id: true, name: true, email: true },
    }),
  ]);

  const nonOwnerMembers = members.filter((member) => member.user.id !== access.trip.userId);
  if (!owner) {
    return NextResponse.json(nonOwnerMembers);
  }

  const ownerMember = {
    id: `owner-${tripId}`,
    role: "OWNER" as const,
    user: owner,
  };

  return NextResponse.json([ownerMember, ...nonOwnerMembers]);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { tripId } = await params;
  const access = await getTripAccess(tripId, session.user.id);
  if (!access || !canManageTrip(access.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const email = (body?.email as string | undefined)?.trim().toLowerCase();
  const role = body?.role as "EDITOR" | "VIEWER" | undefined;
  if (!email || !role || !["EDITOR", "VIEWER"].includes(role)) {
    return NextResponse.json({ error: "email and valid role are required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (user.id === access.trip.userId) {
    return NextResponse.json({ error: "Owner already has access" }, { status: 400 });
  }

  const member = await prisma.tripMember.upsert({
    where: { tripId_userId: { tripId, userId: user.id } },
    update: { role },
    create: { tripId, userId: user.id, role },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  await createTripEvent(
    tripId,
    "trip.member.upserted",
    { userId: user.id, email: user.email, role },
    session.user.id,
    session.user.name ?? null
  );
  return NextResponse.json(member);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { tripId } = await params;
  const access = await getTripAccess(tripId, session.user.id);
  if (!access || !canManageTrip(access.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const userId = body?.userId as string | undefined;
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  await prisma.tripMember.deleteMany({
    where: { tripId, userId, role: { not: "OWNER" } },
  });
  await createTripEvent(
    tripId,
    "trip.member.removed",
    { userId },
    session.user.id,
    session.user.name ?? null
  );
  return NextResponse.json({ success: true });
}
