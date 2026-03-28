"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useAdminAccess } from "@/contexts/AdminAccessContext";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  BarChart3,
  Users,
  Route,
  Globe,
  CalendarClock,
  Download,
  ExternalLink,
} from "lucide-react";

type Plan = "FREE" | "PRO" | "TEAM";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  plan: Plan;
  createdAt: string;
  _count: { trips: number; tripMembers: number };
}

interface AdminStats {
  kpis: {
    totalUsers: number;
    totalTrips: number;
    publicTrips: number;
    finalizedTrips: number;
    pendingInvites: number;
    collaborators: number;
    newUsers7d: number;
    newTrips7d: number;
    windowDays: number;
  };
  planDistribution: Array<{ plan: Plan; count: number }>;
  growth: Array<{ month: string; users: number; trips: number }>;
  funnel: { draftTrips: number; finalizedTrips: number; publicTrips: number };
  topCreators: Array<{
    id: string;
    name: string;
    email: string;
    plan: Plan;
    _count: { trips: number; tripMembers: number };
  }>;
  recentUsers: Array<{
    id: string;
    name: string;
    email: string;
    plan: Plan;
    createdAt: string;
  }>;
  recentTrips: Array<{
    id: string;
    name: string;
    isPublic: boolean;
    status: "DRAFT" | "FINALIZED";
    updatedAt: string;
    user: { name: string; email: string };
    _count: { waypoints: number; members: number };
  }>;
  topPublicTrips: Array<{
    id: string;
    name: string;
    shareId: string;
    updatedAt: string;
    _count: { waypoints: number; members: number };
  }>;
  topCollaborativeTrips: Array<{
    id: string;
    name: string;
    isPublic: boolean;
    updatedAt: string;
    _count: { waypoints: number; members: number };
  }>;
}

export default function AdminPage() {
  const { status } = useSession();
  const { isAdmin, ready: adminReady } = useAdminAccess();
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [statsData, setStatsData] = useState<AdminStats | null>(null);
  const [rangeDays, setRangeDays] = useState<7 | 30 | 90>(30);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/auth/login");
  }, [status, router]);

  const loadAdminData = async (days: 7 | 30 | 90) => {
    const [usersRes, statsRes] = await Promise.all([
      fetch("/api/admin/users").then(async (res) => {
        if (!res.ok) throw new Error("forbidden");
        return res.json();
      }),
      fetch(`/api/admin/stats?days=${days}`).then(async (res) => {
        if (!res.ok) throw new Error("forbidden");
        return res.json();
      }),
    ]);
    setUsers(Array.isArray(usersRes) ? usersRes : []);
    setStatsData(statsRes as AdminStats);
  };

  useEffect(() => {
    if (!adminReady || status !== "authenticated") return;
    if (!isAdmin) {
      router.replace("/dashboard");
      return;
    }
    loadAdminData(rangeDays)
      .catch(() => {
        setUsers([]);
        setStatsData(null);
      })
      .finally(() => setLoading(false));
  }, [adminReady, isAdmin, status, router, rangeDays]);

  const stats = useMemo(() => {
    return users.reduce(
      (acc, user) => {
        acc.total += 1;
        acc[user.plan] += 1;
        return acc;
      },
      { total: 0, FREE: 0, PRO: 0, TEAM: 0 } as Record<"total" | Plan, number>
    );
  }, [users]);

  const updateUserPlan = async (userId: string, plan: Plan) => {
    setMessage("");
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, plan }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setMessage(data?.error || "Failed to update user plan");
      return;
    }
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, plan } : u)));
    setMessage(`Updated ${data?.email || "user"} to ${plan}.`);
    const refreshedStats = await fetch(`/api/admin/stats?days=${rangeDays}`)
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null);
    if (refreshedStats) setStatsData(refreshedStats as AdminStats);
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const exportAnalyticsCsv = () => {
    if (!statsData) return;
    const lines: string[] = [];
    lines.push("section,key,value");
    lines.push(`kpi,total_users,${statsData.kpis.totalUsers}`);
    lines.push(`kpi,total_trips,${statsData.kpis.totalTrips}`);
    lines.push(`kpi,public_trips,${statsData.kpis.publicTrips}`);
    lines.push(`kpi,finalized_trips,${statsData.kpis.finalizedTrips}`);
    lines.push(`kpi,pending_invites,${statsData.kpis.pendingInvites}`);
    lines.push(`kpi,collaborators,${statsData.kpis.collaborators}`);
    lines.push(`kpi,new_users_${statsData.kpis.windowDays}d,${statsData.kpis.newUsers7d}`);
    lines.push(`kpi,new_trips_${statsData.kpis.windowDays}d,${statsData.kpis.newTrips7d}`);
    statsData.planDistribution.forEach((item) => {
      lines.push(`plan_distribution,${item.plan},${item.count}`);
    });
    statsData.growth.forEach((point) => {
      lines.push(`growth_users,${point.month},${point.users}`);
      lines.push(`growth_trips,${point.month},${point.trips}`);
    });
    lines.push(`funnel,draft_trips,${statsData.funnel.draftTrips}`);
    lines.push(`funnel,finalized_trips,${statsData.funnel.finalizedTrips}`);
    lines.push(`funnel,public_trips,${statsData.funnel.publicTrips}`);
    statsData.topPublicTrips.forEach((trip) => {
      lines.push(`top_public_trip,${trip.name},${trip._count.members}`);
    });
    statsData.topCollaborativeTrips.forEach((trip) => {
      lines.push(`top_collab_trip,${trip.name},${trip._count.members}`);
    });
    users.forEach((user) => {
      lines.push(`user_plan,${user.email},${user.plan}`);
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `admin-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (status === "loading" || (status === "authenticated" && !adminReady) || loading) {
    return <div className="min-h-screen bg-gray-50 p-6">Loading admin panel...</div>;
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <main id="main" className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-5">
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-2 inline-flex")}
          >
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
            Back to dashboard
          </Link>
          <div className="flex items-center gap-2">
            {[7, 30, 90].map((days) => (
              <Button
                key={days}
                size="sm"
                variant={rangeDays === days ? "default" : "outline"}
                onClick={() => setRangeDays(days as 7 | 30 | 90)}
              >
                {days}d
              </Button>
            ))}
            <Button size="sm" variant="outline" className="gap-1.5" onClick={exportAnalyticsCsv}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Admin Analytics
            </CardTitle>
            <CardDescription>Track growth, engagement, and membership health.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Users: {stats.total}</Badge>
            <Badge variant="outline">Free: {stats.FREE}</Badge>
            <Badge variant="outline">Pro: {stats.PRO}</Badge>
            <Badge variant="outline">Team: {stats.TEAM}</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
              Vercel Web Analytics &amp; Speed Insights
            </CardTitle>
            <CardDescription>
              Traffic and Core Web Vitals are collected when the app runs on Vercel with Analytics and Speed Insights
              enabled for the project.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <p>
              Product KPIs below come from your database. Page views, visitors, and real user performance metrics live
              in the Vercel dashboard for this deployment.
            </p>
            <p className="flex flex-wrap gap-x-3 gap-y-1">
              <a
                href="https://vercel.com/docs/analytics"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary font-medium underline underline-offset-2"
              >
                Web Analytics docs
              </a>
              <span aria-hidden className="text-border">
                ·
              </span>
              <a
                href="https://vercel.com/docs/speed-insights"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary font-medium underline underline-offset-2"
              >
                Speed Insights docs
              </a>
            </p>
          </CardContent>
        </Card>

        {statsData && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Card>
                <CardContent className="pt-5">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    Total users
                  </p>
                  <p className="text-2xl font-semibold mt-1">{statsData.kpis.totalUsers}</p>
                  <p className="text-xs text-emerald-700 mt-1">
                    +{statsData.kpis.newUsers7d} in {statsData.kpis.windowDays} days
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Route className="h-3.5 w-3.5" />
                    Total trips
                  </p>
                  <p className="text-2xl font-semibold mt-1">{statsData.kpis.totalTrips}</p>
                  <p className="text-xs text-emerald-700 mt-1">
                    +{statsData.kpis.newTrips7d} in {statsData.kpis.windowDays} days
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Globe className="h-3.5 w-3.5" />
                    Public trips
                  </p>
                  <p className="text-2xl font-semibold mt-1">{statsData.kpis.publicTrips}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Finalized: {statsData.kpis.finalizedTrips}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <CalendarClock className="h-3.5 w-3.5" />
                    Collaboration
                  </p>
                  <p className="text-2xl font-semibold mt-1">{statsData.kpis.collaborators}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Pending invites: {statsData.kpis.pendingInvites}
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Plan distribution</CardTitle>
                  <CardDescription>How memberships are split across tiers</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {statsData.planDistribution.map((entry) => {
                    const pct =
                      statsData.kpis.totalUsers === 0
                        ? 0
                        : Math.round((entry.count / statsData.kpis.totalUsers) * 100);
                    return (
                      <div key={entry.plan}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span>{entry.plan}</span>
                          <span>
                            {entry.count} ({pct}%)
                          </span>
                        </div>
                        <div className="h-2 rounded bg-gray-200 overflow-hidden">
                          <div className="h-full bg-blue-600" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Growth trend ({statsData.kpis.windowDays}d)</CardTitle>
                  <CardDescription>Daily new users and created trips</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {statsData.growth.map((point) => (
                    <div key={point.month} className="grid grid-cols-[70px_1fr_auto] items-center gap-2 text-xs">
                      <span className="text-muted-foreground">{point.month}</span>
                      <div className="space-y-1">
                        <div className="h-1.5 rounded bg-gray-200 overflow-hidden">
                          <div
                            className="h-full bg-emerald-600"
                            style={{ width: `${Math.min(100, point.users * 15)}%` }}
                          />
                        </div>
                        <div className="h-1.5 rounded bg-gray-200 overflow-hidden">
                          <div
                            className="h-full bg-violet-600"
                            style={{ width: `${Math.min(100, point.trips * 8)}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-muted-foreground">
                        U:{point.users} T:{point.trips}
                      </span>
                    </div>
                  ))}
                  <div className="text-[11px] text-muted-foreground">
                    Colors: green = users, purple = trips
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Trip conversion funnel</CardTitle>
                  <CardDescription>How trips move from draft to public</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {[
                    { label: "Draft", value: statsData.funnel.draftTrips, color: "bg-slate-500" },
                    {
                      label: "Finalized",
                      value: statsData.funnel.finalizedTrips,
                      color: "bg-emerald-600",
                    },
                    { label: "Public", value: statsData.funnel.publicTrips, color: "bg-blue-600" },
                  ].map((step) => {
                    const pct =
                      statsData.kpis.totalTrips === 0
                        ? 0
                        : Math.round((step.value / statsData.kpis.totalTrips) * 100);
                    return (
                      <div key={step.label}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span>{step.label}</span>
                          <span>
                            {step.value} ({pct}%)
                          </span>
                        </div>
                        <div className="h-2 rounded bg-gray-200 overflow-hidden">
                          <div className={`h-full ${step.color}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Top creators</CardTitle>
                  <CardDescription>Users with the most itineraries</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {statsData.topCreators.map((creator) => (
                    <div key={creator.id} className="rounded border p-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{creator.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{creator.email}</p>
                        </div>
                        <Badge variant="outline">{creator.plan}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Trips: {creator._count.trips} · Collaborations: {creator._count.tripMembers}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Top shared trips</CardTitle>
                  <CardDescription>Public routes with highest collaboration depth</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {statsData.topPublicTrips.map((trip) => (
                    <div key={trip.id} className="rounded border p-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium truncate">{trip.name}</p>
                        <Badge variant="outline">Public</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Members: {trip._count.members} · Stops: {trip._count.waypoints}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Top collaborative trips</CardTitle>
                  <CardDescription>Trips with most collaborators across all visibility states</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {statsData.topCollaborativeTrips.map((trip) => (
                    <div key={trip.id} className="rounded border p-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium truncate">{trip.name}</p>
                        <Badge variant={trip.isPublic ? "default" : "secondary"}>
                          {trip.isPublic ? "Public" : "Private"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Members: {trip._count.members} · Stops: {trip._count.waypoints}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent activity</CardTitle>
                <CardDescription>Newest users and recently updated trips</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium mb-1">Recent users</p>
                  <div className="space-y-1.5">
                    {statsData.recentUsers.map((user) => (
                      <div key={user.id} className="text-xs flex items-center justify-between gap-2">
                        <span className="truncate">{user.email}</span>
                        <span className="text-muted-foreground">{formatDate(user.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium mb-1">Recent trips</p>
                  <div className="space-y-1.5">
                    {statsData.recentTrips.map((trip) => (
                      <div key={trip.id} className="text-xs flex items-center justify-between gap-2">
                        <span className="truncate">{trip.name}</span>
                        <span className="text-muted-foreground">
                          {trip._count.waypoints} stops · {formatDate(trip.updatedAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        <div className="space-y-3">
          <p className="text-sm font-medium">Membership management</p>
          {users.map((user) => (
            <Card key={user.id}>
              <CardContent className="pt-6 flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(["FREE", "PRO", "TEAM"] as Plan[]).map((plan) => (
                      <Button
                        key={plan}
                        size="sm"
                        variant={user.plan === plan ? "default" : "outline"}
                        onClick={() => updateUserPlan(user.id, plan)}
                      >
                        {plan}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Trips: {user._count.trips} · Collaborations: {user._count.tripMembers}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {message && <p className="text-sm text-emerald-700">{message}</p>}
      </main>
    </div>
  );
}

