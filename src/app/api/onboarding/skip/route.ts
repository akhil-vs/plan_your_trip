import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const authUser = await getApiUser(request);
  if (!authUser?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: { onboardingComplete: true },
  });
  if (user?.onboardingComplete) {
    return NextResponse.json({ ok: true });
  }

  await prisma.user.update({
    where: { id: authUser.id },
    data: { onboardingComplete: true },
  });

  return NextResponse.json({ ok: true });
}
