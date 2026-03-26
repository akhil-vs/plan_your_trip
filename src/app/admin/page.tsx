"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";

type Plan = "FREE" | "PRO" | "TEAM";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  plan: Plan;
  createdAt: string;
  _count: { trips: number; tripMembers: number };
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/auth/login");
  }, [status, router]);

  useEffect(() => {
    if (!session?.user) return;
    if (!session.user.isAdmin) {
      router.replace("/dashboard");
      return;
    }
    fetch("/api/admin/users")
      .then(async (res) => {
        if (!res.ok) throw new Error("forbidden");
        return res.json();
      })
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, [session, router]);

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
  };

  if (status === "loading" || loading) {
    return <div className="min-h-screen bg-gray-50 p-6">Loading admin panel...</div>;
  }

  if (!session?.user?.isAdmin) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-5">
        <div className="flex items-center justify-between">
          <Button asChild variant="ghost" size="sm" className="gap-2">
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4" />
              Back to dashboard
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Admin Panel</CardTitle>
            <CardDescription>Manage membership plans and platform users.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Users: {stats.total}</Badge>
            <Badge variant="outline">Free: {stats.FREE}</Badge>
            <Badge variant="outline">Pro: {stats.PRO}</Badge>
            <Badge variant="outline">Team: {stats.TEAM}</Badge>
          </CardContent>
        </Card>

        <div className="space-y-3">
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
      </div>
    </div>
  );
}

