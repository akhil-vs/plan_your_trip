import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/api-auth";
import { isAdminEmail } from "@/lib/admin";
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

/** Admin-only manual plan override (e.g. comp accounts). Subscribers use Stripe checkout. */
export async function PUT(req: NextRequest) {
  const authUser = await getApiUser(req);
  if (!authUser?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminEmail(authUser.email)) {
    return NextResponse.json(
      { error: "Plan changes require billing checkout or an admin" },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const plan = body?.plan as Plan | undefined;
  const targetUserId = (body?.userId as string | undefined) || authUser.id;
  if (!plan || !VALID_PLANS.includes(plan)) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: targetUserId },
    data: { plan },
    select: { id: true, email: true, name: true, plan: true },
  });

  return NextResponse.json(updated);
}
