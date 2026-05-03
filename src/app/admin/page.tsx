"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useAdminAccess } from "@/contexts/AdminAccessContext";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import {
  ArrowLeft,
  BarChart3,
  Compass,
  Download,
  ExternalLink,
  FileDown,
  Filter,
  Globe,
  HelpCircle,
  LayoutDashboard,
  LayoutGrid,
  Menu,
  Plus,
  Route,
  Settings,
  Users,
} from "lucide-react";

type Plan = "FREE" | "PRO" | "TEAM";
type AdminSection = "dashboard" | "trips" | "users" | "analytics";
type RangeDays = 30 | 90;

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

const PLAN_BAR: Record<Plan, string> = {
  FREE: "bg-blue-600",
  PRO: "bg-violet-600",
  TEAM: "bg-emerald-600",
};

function formatMonthLabel(month: string) {
  const d = new Date(`${month}-01T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return month;
  return d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
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

const navItems: Array<{ id: AdminSection; label: string; icon: typeof LayoutDashboard }> = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "trips", label: "Trips", icon: Compass },
  { id: "users", label: "Users", icon: Users },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
];

export default function AdminPage() {
  const { data: session, status } = useSession();
  const { isAdmin, ready: adminReady } = useAdminAccess();
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [statsData, setStatsData] = useState<AdminStats | null>(null);
  const [rangeDays, setRangeDays] = useState<RangeDays>(30);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [section, setSection] = useState<AdminSection>("dashboard");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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

  const sectionTitle =
    section === "dashboard"
      ? "Dashboard"
      : section === "trips"
        ? "Trips"
        : section === "users"
          ? "Users"
          : "Analytics";

  const initials = useMemo(() => {
    const n = session?.user?.name || session?.user?.email || "A";
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return n.slice(0, 2).toUpperCase();
  }, [session?.user?.name, session?.user?.email]);

  const NavBody = ({ onNavigate }: { onNavigate?: () => void }) => (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-6 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
            <LayoutGrid className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="text-base font-bold text-blue-700 leading-tight tracking-tight">Viazo Admin</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Executive oversight</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5" aria-label="Admin">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = section === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setSection(item.id);
                onNavigate?.();
              }}
              className={cn(
                "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-left",
                active
                  ? "bg-blue-50 text-blue-800 shadow-sm"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <Icon className={cn("h-5 w-5 shrink-0", active ? "text-blue-600" : "text-slate-400")} aria-hidden />
              {item.label}
            </button>
          );
        })}
      </nav>
      <div className="p-3 mt-auto border-t border-slate-100">
        <a
          href="mailto:hello@viazo.app?subject=Viazo%20Admin%20support"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
        >
          <HelpCircle className="h-5 w-5 text-slate-400" aria-hidden />
          Support
        </a>
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "w-full justify-start gap-2 mt-1 text-slate-600"
          )}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Exit admin
        </Link>
      </div>
    </div>
  );

  if (status === "loading" || (status === "authenticated" && !adminReady) || loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-sm text-slate-500">Loading admin…</div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-slate-50 flex text-slate-900">
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white sticky top-0 h-screen">
        <NavBody />
      </aside>

      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        <header className="sticky top-0 z-40 flex h-14 sm:h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white/95 backdrop-blur px-4 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="lg:hidden shrink-0" aria-label="Open menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[min(100%,280px)] p-0">
                <SheetHeader className="sr-only">
                  <SheetTitle>Admin navigation</SheetTitle>
                </SheetHeader>
                <NavBody onNavigate={() => setMobileNavOpen(false)} />
              </SheetContent>
            </Sheet>
            <h1 className="text-sm sm:text-base font-semibold text-slate-800 truncate">{sectionTitle}</h1>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <NotificationBell className="rounded-full text-slate-600 hover:bg-slate-100" />
            <Link href="/profile">
              <Button variant="ghost" size="icon" className="rounded-full text-slate-600" aria-label="Settings">
                <Settings className="h-5 w-5" />
              </Button>
            </Link>
            <div className="hidden sm:block h-8 w-px bg-slate-200 mx-1" aria-hidden />
            <div className="flex items-center gap-2 pl-1">
              <div className="text-right hidden sm:block leading-tight">
                <p className="text-sm font-semibold text-slate-900 truncate max-w-[140px]">
                  {session?.user?.name || "Admin"}
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Executive</p>
              </div>
              <div
                className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-600 to-slate-700 text-white text-xs font-bold flex items-center justify-center shadow-sm border border-white ring-2 ring-slate-100"
                aria-hidden
              >
                {initials}
              </div>
            </div>
          </div>
        </header>

        <main id="main" className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8">
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
                <CardHeader>
                  <CardTitle className="text-base">Growth detail</CardTitle>
                  <CardDescription>By month from selected window</CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-slate-500">
                        <th className="py-2 pr-4 font-medium">Month</th>
                        <th className="py-2 pr-4 font-medium tabular-nums">Users</th>
                        <th className="py-2 font-medium tabular-nums">Trips</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statsData.growth.map((point) => (
                        <tr key={point.month} className="border-b border-slate-100 last:border-0">
                          <td className="py-2 pr-4 text-slate-800">{formatMonthLabel(point.month)}</td>
                          <td className="py-2 pr-4 tabular-nums">{point.users}</td>
                          <td className="py-2 tabular-nums">{point.trips}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>
          )}

          {section === "dashboard" && !statsData && (
            <p className="text-sm text-slate-500">No analytics loaded yet.</p>
          )}
        </main>
      </div>

      <Link
        href="/planner"
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/30 hover:bg-blue-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        aria-label="New itinerary"
      >
        <Plus className="h-7 w-7" strokeWidth={2.5} aria-hidden />
      </Link>
    </div>
  );
}
