import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminEmail } from "@/lib/admin";

async function guardAdmin() {
  const session = await auth();
  if (!session?.user?.id || !isAdminEmail(session.user.email)) {
    return null;
  }
  return session;
}

function dayKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(
    date.getUTCDate()
  ).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  const admin = await guardAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const requestedWindow = Number(req.nextUrl.searchParams.get("days") || 7);
  const windowDays = [7, 30, 90].includes(requestedWindow) ? requestedWindow : 7;
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
  const sixMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));

  const [
    totalUsers,
    totalTrips,
    publicTrips,
    finalizedTrips,
    pendingInvites,
    collaborators,
    planDistributionRaw,
    newUsersWindow,
    newTripsWindow,
    recentUsers,
    recentTrips,
    topCreators,
    usersForGrowth,
    tripsForGrowth,
    topPublicTrips,
    topCollaborativeTrips,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.trip.count(),
    prisma.trip.count({ where: { isPublic: true } }),
    prisma.trip.count({ where: { status: "FINALIZED" } }),
    prisma.tripInvite.count({ where: { status: "PENDING" } }),
    prisma.tripMember.count(),
    prisma.user.groupBy({ by: ["plan"], _count: { _all: true } }),
    prisma.user.count({ where: { createdAt: { gte: windowStart } } }),
    prisma.trip.count({ where: { createdAt: { gte: windowStart } } }),
    prisma.user.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, email: true, plan: true, createdAt: true },
    }),
    prisma.trip.findMany({
      take: 5,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        isPublic: true,
        status: true,
        updatedAt: true,
        user: { select: { name: true, email: true } },
        _count: { select: { waypoints: true, members: true } },
      },
    }),
    prisma.user.findMany({
      take: 5,
      orderBy: { trips: { _count: "desc" } },
      select: {
        id: true,
        name: true,
        email: true,
        plan: true,
        _count: { select: { trips: true, tripMembers: true } },
      },
    }),
    prisma.user.findMany({
      where: { createdAt: { gte: sixMonthsAgo } },
      select: { createdAt: true },
    }),
    prisma.trip.findMany({
      where: { createdAt: { gte: sixMonthsAgo } },
      select: { createdAt: true },
    }),
    prisma.trip.findMany({
      where: { isPublic: true },
      take: 5,
      orderBy: [{ members: { _count: "desc" } }, { updatedAt: "desc" }],
      select: {
        id: true,
        name: true,
        shareId: true,
        updatedAt: true,
        _count: { select: { waypoints: true, members: true } },
      },
    }),
    prisma.trip.findMany({
      take: 5,
      orderBy: [{ members: { _count: "desc" } }, { updatedAt: "desc" }],
      select: {
        id: true,
        name: true,
        isPublic: true,
        updatedAt: true,
        _count: { select: { waypoints: true, members: true } },
      },
    }),
  ]);

  const planDistribution = ["FREE", "PRO", "TEAM"].map((plan) => ({
    plan,
    count: planDistributionRaw.find((entry) => entry.plan === plan)?._count._all || 0,
  }));

  const growthOrder: string[] = [];
  for (let i = windowDays - 1; i >= 0; i -= 1) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    growthOrder.push(dayKey(d));
  }
  const userByDay = new Map<string, number>();
  const tripByDay = new Map<string, number>();
  growthOrder.forEach((d) => {
    userByDay.set(d, 0);
    tripByDay.set(d, 0);
  });
  usersForGrowth.forEach((u) => {
    const key = dayKey(u.createdAt);
    if (!userByDay.has(key)) return;
    userByDay.set(key, (userByDay.get(key) || 0) + 1);
  });
  tripsForGrowth.forEach((t) => {
    const key = dayKey(t.createdAt);
    if (!tripByDay.has(key)) return;
    tripByDay.set(key, (tripByDay.get(key) || 0) + 1);
  });

  const growth = growthOrder.map((key) => ({
    month: key,
    users: userByDay.get(key) || 0,
    trips: tripByDay.get(key) || 0,
  }));

  const draftTrips = Math.max(0, totalTrips - finalizedTrips);
  const funnel = {
    draftTrips,
    finalizedTrips,
    publicTrips,
  };

  return NextResponse.json({
    kpis: {
      totalUsers,
      totalTrips,
      publicTrips,
      finalizedTrips,
      pendingInvites,
      collaborators,
      newUsers7d: newUsersWindow,
      newTrips7d: newTripsWindow,
      windowDays,
    },
    planDistribution,
    growth,
    funnel,
    topCreators,
    recentUsers,
    recentTrips,
    topPublicTrips,
    topCollaborativeTrips,
  });
}

