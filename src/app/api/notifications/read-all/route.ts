import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/api-auth";
import { markAllNotificationsRead } from "@/lib/inAppNotifications";

export async function POST(_req: NextRequest) {
  const user = await getApiUser(_req);
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { count } = await markAllNotificationsRead(user.id);
  return NextResponse.json({ success: true, count });
}
