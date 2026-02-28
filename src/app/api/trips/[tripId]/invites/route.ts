import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageTrip, getTripAccess } from "@/lib/tripAccess";
import { createTripEvent } from "@/lib/tripEvents";
import { sendTripInviteEmail } from "@/lib/email";

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
  if (!access || !canManageTrip(access.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const invites = await prisma.tripInvite.findMany({
    where: { tripId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(invites);
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

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
  const existingPending = await prisma.tripInvite.findFirst({
    where: { tripId, email, status: "PENDING", expiresAt: { gt: new Date() } },
    select: { id: true },
  });
  if (existingPending) {
    return NextResponse.json(
      { error: "Active invite already exists for this email" },
      { status: 409 }
    );
  }

  const invite = await prisma.tripInvite.create({
    data: {
      tripId,
      email,
      role,
      token,
      senderId: session.user.id,
      expiresAt,
    },
  });

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { name: true },
  });

  const acceptUrl = `${req.nextUrl.origin}/invite/${invite.token}`;
  const emailResult = await sendTripInviteEmail({
    inviteeEmail: email,
    inviterName: session.user.name || session.user.email || "A collaborator",
    tripName: trip?.name || "Untitled Itinerary",
    role,
    acceptUrl,
  });

  await createTripEvent(
    tripId,
    "trip.invite.created",
    { email, role, inviteId: invite.id },
    session.user.id,
    session.user.name ?? null
  );

  return NextResponse.json({
    ...invite,
    acceptUrl,
    emailDelivered: emailResult.delivered,
    emailWarning: emailResult.delivered ? null : emailResult.reason,
  });
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
  const inviteId = body?.inviteId as string | undefined;
  if (!inviteId) {
    return NextResponse.json({ error: "inviteId is required" }, { status: 400 });
  }

  const invite = await prisma.tripInvite.update({
    where: { id: inviteId },
    data: { status: "REVOKED" },
  });
  await createTripEvent(
    tripId,
    "trip.invite.revoked",
    { inviteId },
    session.user.id,
    session.user.name ?? null
  );
  return NextResponse.json(invite);
}
