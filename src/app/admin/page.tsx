"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useAdminAccess } from "@/contexts/AdminAccessContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileDown,
  Filter,
  Globe,
  Route,
  Users,
} from "lucide-react";

type Plan = "FREE" | "PRO" | "TEAM";
type AdminSection = "dashboard" | "trips" | "users" | "analytics";
type RangeDays = 30 | 90;
type GrowthPoint = { month: string; users: number; trips: number };

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
  growth: GrowthPoint[];
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

const PLAN_BAR: Record<Plan, string> = {
  FREE: "bg-blue-600",
  PRO: "bg-violet-600",
  TEAM: "bg-emerald-600",
};

function formatMonthLabel(month: string) {
  const dateValue = /^\d{4}-\d{2}$/.test(month) ? `${month}-01` : month;
  const d = new Date(`${dateValue}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return month;
  return d.toLocaleDateString("en-GB", {
    day: /^\d{4}-\d{2}-\d{2}$/.test(month) ? "numeric" : undefined,
    month: "short",
    year: "2-digit",
  });
}

function formatCalendarMonth(month: string) {
  const d = new Date(`${month}-01T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return month;
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function dateKey(year: number, monthIndex: number, day: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function buildCalendarDays(month: string, countsByDate: Map<string, GrowthPoint>) {
  const firstDay = new Date(`${month}-01T12:00:00Z`);
  if (Number.isNaN(firstDay.getTime())) return [];

  const year = firstDay.getUTCFullYear();
  const monthIndex = firstDay.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const leadingBlanks = firstDay.getUTCDay();
  const cells: Array<{ key: string; day: number | null; users: number; trips: number }> = [];

  for (let i = 0; i < leadingBlanks; i += 1) {
    cells.push({ key: `blank-${i}`, day: null, users: 0, trips: 0 });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = dateKey(year, monthIndex, day);
    const counts = countsByDate.get(key);
    cells.push({
      key,
      day,
      users: counts?.users ?? 0,
      trips: counts?.trips ?? 0,
    });
  }

  return cells;
}

function GrowthStackedChart({ growth }: { growth: AdminStats["growth"] }) {
  if (!growth.length) {
    return <p className="text-sm text-slate-500 py-8 text-center">No growth data for this window.</p>;
  }
  const w = 520;
  const h = 200;
  const padL = 36;
  const padR = 12;
  const padT = 12;
  const padB = 36;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const n = growth.length;
  const barGap = innerW / n;
  const barW = Math.min(barGap * 0.55, 48);
  const maxStack = Math.max(
    ...growth.map((g) => g.users + g.trips),
    1
  );

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full h-auto max-h-[220px] text-slate-700"
      role="img"
      aria-label="Growth trend stacked bar chart"
    >
      {[0, 0.25, 0.5, 0.75, 1].map((t) => {
        const y = padT + innerH * (1 - t);
        return (
          <line
            key={t}
            x1={padL}
            x2={w - padR}
            y1={y}
            y2={y}
            className="stroke-slate-200"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
        );
      })}
      {growth.map((point, i) => {
        const cx = padL + barGap * i + barGap / 2;
        const x = cx - barW / 2;
        const tripH = (point.trips / maxStack) * innerH;
        const userH = (point.users / maxStack) * innerH;
        const baseY = padT + innerH;
        return (
          <g key={point.month}>
            <rect
              x={x}
              y={baseY - tripH - userH}
              width={barW}
              height={tripH}
              rx={4}
              className="fill-sky-300"
            />
            <rect
              x={x}
              y={baseY - userH}
              width={barW}
              height={userH}
              rx={4}
              className="fill-blue-700"
            />
            <text
              x={cx}
              y={h - 10}
              textAnchor="middle"
              className="fill-slate-500 text-[10px] font-medium"
            >
              {formatMonthLabel(point.month)}
            </text>
          </g>
        );
      })}
      <text x={padL} y={h - 2} className="fill-slate-400 text-[9px]">
        Dark = new users · Light = trips
      </text>
    </svg>
  );
}

function planInsight(stats: AdminStats) {
  const total = stats.kpis.totalUsers || 1;
  const free = stats.planDistribution.find((p) => p.plan === "FREE")?.count ?? 0;
  const freePct = Math.round((free / total) * 100);
  if (freePct >= 45) {
    return `Majority of your user base is on the Free tier (${freePct}%). Consider conversion nudges and ${stats.kpis.windowDays}-day retention for cohorts approaching limits.`;
  }
  const pro = stats.planDistribution.find((p) => p.plan === "PRO")?.count ?? 0;
  const team = stats.planDistribution.find((p) => p.plan === "TEAM")?.count ?? 0;
  if (pro + team > free) {
    return `Paid plans (Pro + Team) represent a strong share of accounts. Keep collaboration and export quality high to defend upgrades.`;
  }
  return `Plan mix is balanced across tiers. Watch pending invites (${stats.kpis.pendingInvites}) and collaboration depth to spot engagement gaps.`;
}

function getAdminSection(value: string | null): AdminSection {
  return value === "trips" || value === "users" || value === "analytics" ? value : "dashboard";
}

export default function AdminPage() {
  const { status } = useSession();
  const { isAdmin, ready: adminReady } = useAdminAccess();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [statsData, setStatsData] = useState<AdminStats | null>(null);
  const [rangeDays, setRangeDays] = useState<RangeDays>(30);
  const [requestedGrowthMonth, setRequestedGrowthMonth] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const section = getAdminSection(searchParams.get("section"));

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/auth/login");
  }, [status, router]);

  const loadAdminData = useCallback(async (days: RangeDays) => {
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
  }, []);

  useEffect(() => {
    if (!adminReady || status !== "authenticated") return;
    if (!isAdmin) {
      router.replace("/dashboard");
      return;
    }
    let cancelled = false;
    queueMicrotask(() => {
      void loadAdminData(rangeDays)
        .catch(() => {
          if (cancelled) return;
          setUsers([]);
          setStatsData(null);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    });
    return () => {
      cancelled = true;
    };
  }, [adminReady, isAdmin, status, router, rangeDays, loadAdminData]);

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

  const growthMonths = useMemo(() => {
    if (!statsData) return [];
    return Array.from(new Set(statsData.growth.map((point) => point.month.slice(0, 7)))).sort();
  }, [statsData]);

  const selectedGrowthMonth = growthMonths.includes(requestedGrowthMonth)
    ? requestedGrowthMonth
    : growthMonths[growthMonths.length - 1] ?? "";

  const growthCalendar = useMemo(() => {
    if (!statsData || !selectedGrowthMonth) return [];
    const countsByDate = new Map(statsData.growth.map((point) => [point.month, point]));
    return buildCalendarDays(selectedGrowthMonth, countsByDate);
  }, [selectedGrowthMonth, statsData]);

  const selectedMonthIndex = selectedGrowthMonth ? growthMonths.indexOf(selectedGrowthMonth) : -1;
  const canShowPreviousGrowthMonth = selectedMonthIndex > 0;
  const canShowNextGrowthMonth = selectedMonthIndex >= 0 && selectedMonthIndex < growthMonths.length - 1;

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
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-sm text-slate-500">Loading admin…</div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="space-y-6 p-4 text-slate-900 sm:p-6 lg:space-y-8 lg:p-8">
          {message && (
            <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
              {message}
            </p>
          )}

          {section === "dashboard" && statsData && (
            <>
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Dashboard overview</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Product health for the last {statsData.kpis.windowDays} days
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
                    {([30, 90] as const).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setRangeDays(d)}
                        className={cn(
                          "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                          rangeDays === d
                            ? "bg-blue-600 text-white shadow-sm"
                            : "text-slate-600 hover:text-slate-900"
                        )}
                      >
                        {d}d
                      </button>
                    ))}
                  </div>
                  <Button variant="outline" size="sm" className="gap-1.5 border-slate-200 bg-white shadow-sm">
                    <Filter className="h-4 w-4 text-slate-500" aria-hidden />
                    Filter
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1.5 shadow-md shadow-blue-600/15 bg-blue-600 hover:bg-blue-700"
                    onClick={exportAnalyticsCsv}
                  >
                    <FileDown className="h-4 w-4" aria-hidden />
                    Export CSV
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <Card className="border-slate-200/80 shadow-sm overflow-hidden">
                  <CardContent className="p-5 relative">
                    <div className="absolute top-4 right-4 h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
                      <Users className="h-5 w-5 text-blue-600" aria-hidden />
                    </div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total users</p>
                    <p className="text-3xl font-bold tabular-nums mt-2 text-slate-900">{statsData.kpis.totalUsers}</p>
                    <p className="text-xs font-semibold text-emerald-600 mt-2">
                      +{statsData.kpis.newUsers7d} last {statsData.kpis.windowDays}d
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-slate-200/80 shadow-sm overflow-hidden">
                  <CardContent className="p-5 relative">
                    <div className="absolute top-4 right-4 h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
                      <Route className="h-5 w-5 text-blue-600 -rotate-45" aria-hidden />
                    </div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total trips</p>
                    <p className="text-3xl font-bold tabular-nums mt-2 text-slate-900">{statsData.kpis.totalTrips}</p>
                    <p className="text-xs font-semibold text-emerald-600 mt-2">
                      +{statsData.kpis.newTrips7d} last {statsData.kpis.windowDays}d
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-slate-200/80 shadow-sm overflow-hidden">
                  <CardContent className="p-5 relative">
                    <div className="absolute top-4 right-4 h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
                      <Globe className="h-5 w-5 text-blue-600" aria-hidden />
                    </div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Public trips</p>
                    <p className="text-3xl font-bold tabular-nums mt-2 text-slate-900">{statsData.kpis.publicTrips}</p>
                    <div className="mt-3 space-y-1">
                      <div className="flex justify-between text-[11px] text-slate-500">
                        <span>Finalized</span>
                        <span className="font-medium text-slate-700">{statsData.kpis.finalizedTrips}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-500 transition-all"
                          style={{
                            width: `${
                              statsData.kpis.totalTrips
                                ? Math.min(100, (statsData.kpis.finalizedTrips / statsData.kpis.totalTrips) * 100)
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-slate-200/80 shadow-sm overflow-hidden">
                  <CardContent className="p-5 relative">
                    <div className="absolute top-4 right-4 h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
                      <Users className="h-5 w-5 text-blue-600" aria-hidden />
                    </div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Collaboration</p>
                    <p className="text-3xl font-bold tabular-nums mt-2 text-slate-900">
                      {statsData.kpis.collaborators}
                    </p>
                    <p
                      className={cn(
                        "text-xs font-semibold mt-2",
                        statsData.kpis.pendingInvites > 0 ? "text-amber-600" : "text-slate-500"
                      )}
                    >
                      Pending: {statsData.kpis.pendingInvites}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                <Card className="border-slate-200/80 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-semibold">Plan distribution</CardTitle>
                    <CardDescription>Membership mix across tiers</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {statsData.planDistribution.map((entry) => {
                      const pct =
                        statsData.kpis.totalUsers === 0
                          ? 0
                          : Math.round((entry.count / statsData.kpis.totalUsers) * 100);
                      const label = entry.plan === "FREE" ? "Free" : entry.plan === "PRO" ? "Pro" : "Team";
                      return (
                        <div key={entry.plan}>
                          <div className="flex items-center justify-between text-sm mb-1.5">
                            <span className="font-medium text-slate-800">{label}</span>
                            <span className="text-slate-500 tabular-nums">
                              {entry.count} users · {pct}%
                            </span>
                          </div>
                          <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className={cn("h-full rounded-full transition-all", PLAN_BAR[entry.plan])}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                    <div className="rounded-xl bg-sky-50 border border-sky-100 px-4 py-3 text-sm text-sky-950 leading-relaxed">
                      {planInsight(statsData)}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-slate-200/80 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-semibold">Growth trend ({statsData.kpis.windowDays}d)</CardTitle>
                    <CardDescription>Monthly new users vs trip creations</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <GrowthStackedChart growth={statsData.growth} />
                  </CardContent>
                </Card>
              </div>

              <Card className="border-slate-200/80 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">Recent activity</CardTitle>
                  <CardDescription>Newest users and recently updated trips</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Recent users</p>
                    <ul className="space-y-2">
                      {statsData.recentUsers.map((user) => (
                        <li
                          key={user.id}
                          className="flex items-center justify-between gap-2 text-sm border-b border-slate-100 pb-2 last:border-0"
                        >
                          <span className="truncate text-slate-800">{user.email}</span>
                          <span className="text-xs text-slate-400 shrink-0">{formatDate(user.createdAt)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Recent trips</p>
                    <ul className="space-y-2">
                      {statsData.recentTrips.map((trip) => (
                        <li
                          key={trip.id}
                          className="flex items-center justify-between gap-2 text-sm border-b border-slate-100 pb-2 last:border-0"
                        >
                          <span className="truncate text-slate-800">{trip.name}</span>
                          <span className="text-xs text-slate-400 shrink-0 tabular-nums">
                            {trip._count.waypoints} stops · {formatDate(trip.updatedAt)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {section === "trips" && statsData && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-slate-900">Trips</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="border-slate-200/80 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base">Top shared trips</CardTitle>
                    <CardDescription>Public itineraries with collaboration depth</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {statsData.topPublicTrips.map((trip) => (
                      <div key={trip.id} className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-slate-900 truncate">{trip.name}</p>
                          <Badge variant="outline" className="shrink-0">
                            Public
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Members: {trip._count.members} · Stops: {trip._count.waypoints}
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Card className="border-slate-200/80 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base">Top collaborative trips</CardTitle>
                    <CardDescription>Across visibility states</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {statsData.topCollaborativeTrips.map((trip) => (
                      <div key={trip.id} className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-slate-900 truncate">{trip.name}</p>
                          <Badge variant={trip.isPublic ? "default" : "secondary"} className="shrink-0">
                            {trip.isPublic ? "Public" : "Private"}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Members: {trip._count.members} · Stops: {trip._count.waypoints}
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {section === "users" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
                <h2 className="text-2xl font-bold text-slate-900">Users</h2>
                <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                  <Badge variant="outline">Total: {stats.total}</Badge>
                  <Badge variant="outline">Free: {stats.FREE}</Badge>
                  <Badge variant="outline">Pro: {stats.PRO}</Badge>
                  <Badge variant="outline">Team: {stats.TEAM}</Badge>
                </div>
              </div>
              <div className="space-y-3">
                {users.map((user) => (
                  <Card key={user.id} className="border-slate-200/80 shadow-sm">
                    <CardContent className="p-5 flex flex-col gap-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{user.name}</p>
                          <p className="text-xs text-slate-500">{user.email}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {(["FREE", "PRO", "TEAM"] as Plan[]).map((plan) => (
                            <Button
                              key={plan}
                              size="sm"
                              variant={user.plan === plan ? "default" : "outline"}
                              className={cn(user.plan === plan && "bg-blue-600 hover:bg-blue-700")}
                              onClick={() => updateUserPlan(user.id, plan)}
                            >
                              {plan}
                            </Button>
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-slate-500">
                        Trips: {user._count.trips} · Collaborations: {user._count.tripMembers}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {section === "analytics" && statsData && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h2 className="text-2xl font-bold text-slate-900">Analytics</h2>
                <Button
                  size="sm"
                  className="gap-1.5 bg-blue-600 hover:bg-blue-700 shadow-md w-fit"
                  onClick={exportAnalyticsCsv}
                >
                  <Download className="h-4 w-4" aria-hidden />
                  Export CSV
                </Button>
              </div>

              <Card className="border-slate-200/80 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
                    Vercel Web Analytics &amp; Speed Insights
                  </CardTitle>
                  <CardDescription>
                    Traffic and Core Web Vitals when the app runs on Vercel with Analytics and Speed Insights enabled.
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-slate-600 space-y-3">
                  <p>
                    KPIs on the dashboard come from your database. Page views, visitors, and real user performance
                    metrics live in the Vercel project dashboard.
                  </p>
                  <p className="flex flex-wrap gap-x-3 gap-y-1">
                    <a
                      href="https://vercel.com/docs/analytics"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 font-medium underline underline-offset-2"
                    >
                      Web Analytics docs
                    </a>
                    <span aria-hidden className="text-slate-300">
                      ·
                    </span>
                    <a
                      href="https://vercel.com/docs/speed-insights"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 font-medium underline underline-offset-2"
                    >
                      Speed Insights docs
                    </a>
                  </p>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="border-slate-200/80 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base">Trip conversion funnel</CardTitle>
                    <CardDescription>Draft → finalized → public</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {[
                      { label: "Draft", value: statsData.funnel.draftTrips, color: "bg-slate-500" },
                      { label: "Finalized", value: statsData.funnel.finalizedTrips, color: "bg-emerald-600" },
                      { label: "Public", value: statsData.funnel.publicTrips, color: "bg-blue-600" },
                    ].map((step) => {
                      const pct =
                        statsData.kpis.totalTrips === 0
                          ? 0
                          : Math.round((step.value / statsData.kpis.totalTrips) * 100);
                      return (
                        <div key={step.label}>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-medium text-slate-700">{step.label}</span>
                            <span className="text-slate-500 tabular-nums">
                              {step.value} ({pct}%)
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div className={cn("h-full rounded-full", step.color)} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>

                <Card className="border-slate-200/80 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base">Top creators</CardTitle>
                    <CardDescription>Most itineraries owned</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {statsData.topCreators.map((creator) => (
                      <div key={creator.id} className="rounded-lg border border-slate-100 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">{creator.name}</p>
                            <p className="text-xs text-slate-500 truncate">{creator.email}</p>
                          </div>
                          <Badge variant="outline">{creator.plan}</Badge>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Trips: {creator._count.trips} · Collaborations: {creator._count.tripMembers}
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              <Card className="border-slate-200/80 shadow-sm">
                <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle className="text-base">Growth detail</CardTitle>
                    <CardDescription>Daily users and trips for the selected month</CardDescription>
                  </div>
                  {growthMonths.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        disabled={!canShowPreviousGrowthMonth}
                        onClick={() => {
                          if (canShowPreviousGrowthMonth) {
                            setRequestedGrowthMonth(growthMonths[selectedMonthIndex - 1]);
                          }
                        }}
                        aria-label="Show previous month"
                      >
                        <ChevronLeft className="h-4 w-4" aria-hidden />
                      </Button>
                      <select
                        value={selectedGrowthMonth}
                        onChange={(event) => setRequestedGrowthMonth(event.target.value)}
                        className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm font-medium text-slate-700 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                        aria-label="Select growth month"
                      >
                        {growthMonths.map((month) => (
                          <option key={month} value={month}>
                            {formatCalendarMonth(month)}
                          </option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        disabled={!canShowNextGrowthMonth}
                        onClick={() => {
                          if (canShowNextGrowthMonth) {
                            setRequestedGrowthMonth(growthMonths[selectedMonthIndex + 1]);
                          }
                        }}
                        aria-label="Show next month"
                      >
                        <ChevronRight className="h-4 w-4" aria-hidden />
                      </Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  {growthMonths.length === 0 ? (
                    <p className="text-sm text-slate-500">No growth data for the selected window.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <div className="min-w-[640px] sm:min-w-0">
                        <div className="grid grid-cols-7 gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                            <div key={day} className="px-2">
                              {day}
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 grid grid-cols-7 gap-2">
                          {growthCalendar.map((day) => {
                            const hasActivity = day.users > 0 || day.trips > 0;
                            return (
                              <div
                                key={day.key}
                                className={cn(
                                  "min-h-28 rounded-xl border p-2",
                                  day.day
                                    ? "border-slate-200 bg-white shadow-sm"
                                    : "border-transparent bg-transparent"
                                )}
                              >
                                {day.day && (
                                  <>
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm font-semibold tabular-nums text-slate-700">
                                        {day.day}
                                      </span>
                                    </div>
                                    {hasActivity && (
                                      <div className="mt-3 flex flex-col gap-1.5">
                                        {day.users > 0 && (
                                          <span className="w-fit rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                                            {day.users} {day.users === 1 ? "user" : "users"}
                                          </span>
                                        )}
                                        {day.trips > 0 && (
                                          <span className="w-fit rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                                            {day.trips} {day.trips === 1 ? "trip" : "trips"}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {section === "dashboard" && !statsData && (
            <p className="text-sm text-slate-500">No analytics loaded yet.</p>
          )}
    </div>
  );
}
