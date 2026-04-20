import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

type Plan = "FREE" | "PRO" | "TEAM";

const VALID_PLANS: Plan[] = ["FREE", "PRO", "TEAM"];

export async function GET(request: NextRequest) {
  const authUser = await getApiUser(request);
  if (!authUser?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: { id: true, email: true, name: true, plan: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  return NextResponse.json(user);
}

export async function PUT(req: NextRequest) {
  const authUser = await getApiUser(req);
  if (!authUser?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const plan = body?.plan as Plan | undefined;
  if (!plan || !VALID_PLANS.includes(plan)) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: authUser.id },
    data: { plan },
    select: { id: true, email: true, name: true, plan: true },
  });

  return NextResponse.json(updated);
}

