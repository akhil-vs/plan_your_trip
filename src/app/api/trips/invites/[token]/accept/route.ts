import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { createTripEvent } from "@/lib/tripEvents";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const authUser = await getApiUser(req);
  if (!authUser?.id || !authUser.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { token } = await params;
  const invite = await prisma.tripInvite.findUnique({
    where: { token },
  });
  if (!invite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }
  if (invite.status !== "PENDING") {
    return NextResponse.json({ error: "Invite is no longer valid" }, { status: 400 });
  }
  if (invite.expiresAt < new Date()) {
    await prisma.tripInvite.update({
      where: { id: invite.id },
      data: { status: "EXPIRED" },
    });
    return NextResponse.json({ error: "Invite expired" }, { status: 400 });
  }
  if (invite.email.toLowerCase() !== authUser.email.toLowerCase()) {
    return NextResponse.json({ error: "Invite email mismatch" }, { status: 403 });
  }

  await prisma.tripMember.upsert({
    where: { tripId_userId: { tripId: invite.tripId, userId: authUser.id } },
    update: { role: invite.role },
    create: { tripId: invite.tripId, userId: authUser.id, role: invite.role },
  });
  await prisma.tripInvite.update({
    where: { id: invite.id },
    data: { status: "ACCEPTED", acceptedAt: new Date() },
  });
  await createTripEvent(
    invite.tripId,
    "trip.invite.accepted",
    { inviteId: invite.id, userId: authUser.id, role: invite.role },
    authUser.id,
    authUser.name ?? null
  );

  return NextResponse.json({ success: true, tripId: invite.tripId, role: invite.role });
}
