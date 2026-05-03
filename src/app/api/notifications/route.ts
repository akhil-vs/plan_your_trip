import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/api-auth";
import { listNotificationsForUser } from "@/lib/inAppNotifications";

export async function GET(req: NextRequest) {
  const user = await getApiUser(req);
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const takeParam = req.nextUrl.searchParams.get("take");
  const take = takeParam ? Number.parseInt(takeParam, 10) : undefined;
  const result = await listNotificationsForUser(user.id, {
    take: Number.isFinite(take) ? take : undefined,
  });

  return NextResponse.json(result);
}
