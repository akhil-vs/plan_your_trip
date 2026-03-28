import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewTrip, getTripAccess } from "@/lib/tripAccess";
import { canUseCollaboration } from "@/lib/subscription";

const MAX_BODY_LEN = 4000;
const MAX_IMAGE_URL_LEN = 750_000;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canUseCollaboration(session.user.plan)) {
    return NextResponse.json(
      { error: "Upgrade to Pro for trip chat and collaborators" },
      { status: 402 }
    );
  }
  const { tripId } = await params;
  const access = await getTripAccess(tripId, session.user.id);
  if (!access || !canViewTrip(access.role)) {
    return NextResponse.json({ error: "Itinerary not found" }, { status: 404 });
  }

  const messages = await prisma.tripChatMessage.findMany({
    where: { tripId },
    orderBy: { createdAt: "asc" },
    take: 200,
    include: {
      user: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(messages);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canUseCollaboration(session.user.plan)) {
    return NextResponse.json(
      { error: "Upgrade to Pro for trip chat and collaborators" },
      { status: 402 }
    );
  }
  const { tripId } = await params;
  const access = await getTripAccess(tripId, session.user.id);
  if (!access || !canViewTrip(access.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const raw = await req.json().catch(() => null);
  const body =
    typeof raw?.body === "string" ? raw.body.trim().slice(0, MAX_BODY_LEN) : "";
  let imageUrl =
    typeof raw?.imageUrl === "string" ? raw.imageUrl.trim() : "";

  if (imageUrl.length > MAX_IMAGE_URL_LEN) {
    return NextResponse.json({ error: "Image is too large" }, { status: 400 });
  }

  if (imageUrl && !imageUrl.startsWith("data:image/") && !/^https:\/\//i.test(imageUrl)) {
    return NextResponse.json(
      { error: "Images must be uploaded or use an https:// link" },
      { status: 400 }
    );
  }

  if (!body && !imageUrl) {
    return NextResponse.json(
      { error: "Add a message or an image" },
      { status: 400 }
    );
  }

  const message = await prisma.tripChatMessage.create({
    data: {
      tripId,
      userId: session.user.id,
      body: body || null,
      imageUrl: imageUrl || null,
    },
    include: {
      user: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(message, { status: 201 });
}
