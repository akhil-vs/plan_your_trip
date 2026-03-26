import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminEmail } from "@/lib/admin";

type Plan = "FREE" | "PRO" | "TEAM";
const VALID_PLANS: Plan[] = ["FREE", "PRO", "TEAM"];

async function guardAdmin() {
  const session = await auth();
  if (!session?.user?.id || !isAdminEmail(session.user.email)) {
    return null;
  }
  return session;
}

export async function GET() {
  const admin = await guardAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      plan: true,
      createdAt: true,
      _count: { select: { trips: true, tripMembers: true } },
    },
  });

  return NextResponse.json(users);
}

export async function PATCH(req: NextRequest) {
  const admin = await guardAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const userId = body?.userId as string | undefined;
  const plan = body?.plan as Plan | undefined;
  if (!userId || !plan || !VALID_PLANS.includes(plan)) {
    return NextResponse.json({ error: "userId and valid plan are required" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { plan },
    select: { id: true, name: true, email: true, plan: true },
  });
  return NextResponse.json(updated);
}

