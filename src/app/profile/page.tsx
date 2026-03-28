"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useAdminAccess } from "@/contexts/AdminAccessContext";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check } from "lucide-react";

type Plan = "FREE" | "PRO" | "TEAM";

const PLAN_FEATURES: Record<Plan, string[]> = {
  FREE: ["Basic route planning", "Save and edit itineraries", "Public trip browsing"],
  PRO: ["Collaboration members", "Activity timeline", "Premium PDF exports"],
  TEAM: ["Everything in Pro", "Best for teams and agencies", "Priority collaboration"],
};

export default function ProfilePage() {
  const { data: session, status, update } = useSession();
  const { isAdmin: isAdminUser, ready: adminReady } = useAdminAccess();
  const router = useRouter();
  const [plan, setPlan] = useState<Plan>("FREE");
  const [savingPlan, setSavingPlan] = useState<Plan | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/auth/login");
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.plan) setPlan(session.user.plan);
  }, [session?.user?.plan]);

  const updatePlan = async (nextPlan: Plan) => {
    setSavingPlan(nextPlan);
    setMessage("");
    try {
      const res = await fetch("/api/account/plan", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: nextPlan }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMessage(data?.error || "Failed to update membership");
        return;
      }
      setPlan(data.plan);
      await update({ plan: data.plan });
      setMessage(`Membership updated to ${data.plan}.`);
    } finally {
      setSavingPlan(null);
    }
  };

  if (status === "loading") {
    return <div className="min-h-screen bg-gray-50 p-6">Loading profile...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 space-y-5">
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-2 inline-flex")}
          >
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
            Back to dashboard
          </Link>
          <Badge variant="outline">Current plan: {plan}</Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Membership</CardTitle>
            <CardDescription>
              Manage your plan and unlock collaboration and premium export features.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(["FREE", "PRO", "TEAM"] as Plan[]).map((tier) => {
              const active = plan === tier;
              return (
                <div key={tier} className="rounded-lg border bg-white p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{tier}</p>
                    {active && (
                      <Badge className="gap-1">
                        <Check className="h-3 w-3" />
                        Active
                      </Badge>
                    )}
                  </div>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {PLAN_FEATURES[tier].map((feature) => (
                      <li key={feature}>- {feature}</li>
                    ))}
                  </ul>
                  <Button
                    size="sm"
                    className="w-full"
                    variant={active ? "outline" : "default"}
                    disabled={active || savingPlan !== null}
                    onClick={() => updatePlan(tier)}
                  >
                    {savingPlan === tier ? "Updating..." : active ? "Current plan" : `Switch to ${tier}`}
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {adminReady && isAdminUser && (
          <Card>
            <CardHeader>
              <CardTitle>Admin tools</CardTitle>
              <CardDescription>
                Manage user memberships and platform-level options.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin" className={cn(buttonVariants(), "inline-flex")}>
                Open admin panel
              </Link>
            </CardContent>
          </Card>
        )}

        {message && <p className="text-sm text-emerald-700">{message}</p>}
      </div>
    </div>
  );
}

