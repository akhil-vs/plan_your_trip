"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useAdminAccess } from "@/contexts/AdminAccessContext";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SiteLogoLink } from "@/components/ui/SiteLogoLink";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { openBillingPortal, startCheckout } from "@/lib/billing/checkoutClient";

type Plan = "FREE" | "PRO" | "TEAM";

const PLAN_FEATURES: Record<Plan, string[]> = {
  FREE: ["Basic route planning", "Save and edit itineraries", "Public trip browsing"],
  PRO: ["Collaboration members", "Activity timeline", "Premium PDF exports"],
  TEAM: ["Everything in Pro", "Best for teams and agencies", "Priority collaboration"],
};

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 p-6">Loading profile...</div>}>
      <ProfileContent />
    </Suspense>
  );
}

function ProfileContent() {
  const { data: session, status, update } = useSession();
  const { isAdmin: isAdminUser, ready: adminReady } = useAdminAccess();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [plan, setPlan] = useState<Plan>("FREE");
  const [billingLoading, setBillingLoading] = useState<"PRO" | "TEAM" | "portal" | null>(null);
  const [billingConfig, setBillingConfig] = useState({
    stripeEnabled: false,
    proCheckout: false,
    teamCheckout: false,
  });
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/auth/login");
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.plan) setPlan(session.user.plan);
  }, [session?.user?.plan]);

  useEffect(() => {
    fetch("/api/billing/config")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setBillingConfig(data);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const billing = searchParams.get("billing");
    if (billing === "success") {
      setMessage("Thanks — your subscription is updating. Refresh if your plan has not changed yet.");
      void update();
    }
  }, [searchParams, update]);

  const runCheckout = async (target: "PRO" | "TEAM") => {
    setBillingLoading(target);
    setMessage("");
    try {
      await startCheckout(target);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Checkout failed");
      setBillingLoading(null);
    }
  };

  const runPortal = async () => {
    setBillingLoading("portal");
    setMessage("");
    try {
      await openBillingPortal();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not open billing portal");
      setBillingLoading(null);
    }
  };

  if (status === "loading") {
    return <div className="min-h-screen bg-gray-50 p-6">Loading profile...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-y-3 gap-x-4">
          <SiteLogoLink />
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/dashboard"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-2 inline-flex")}
            >
              <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
              Back to dashboard
            </Link>
            <Badge variant="outline">Current plan: {plan}</Badge>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Membership</CardTitle>
            <CardDescription>
              {billingConfig.stripeEnabled
                ? "Upgrade through secure checkout. Manage or cancel anytime from the billing portal."
                : "Billing is not configured on this server. Contact hello@viazo.app for Pro or Team access."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(["FREE", "PRO", "TEAM"] as Plan[]).map((tier) => {
              const active = plan === tier;
              const isPaidTier = tier === "PRO" || tier === "TEAM";
              const checkoutReady =
                tier === "PRO" ? billingConfig.proCheckout : billingConfig.teamCheckout;

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
                  {tier === "FREE" ? (
                    <Button size="sm" className="w-full" variant="outline" disabled>
                      {active ? "Current plan" : "Included"}
                    </Button>
                  ) : tier === "TEAM" && !checkoutReady ? (
                    <Link
                      href="mailto:hello@viazo.app?subject=Viazo%20Team%20plan"
                      className={cn(buttonVariants({ size: "sm" }), "w-full")}
                    >
                      Contact sales
                    </Link>
                  ) : active ? (
                    <Button
                      size="sm"
                      className="w-full"
                      variant="outline"
                      disabled={!billingConfig.stripeEnabled || billingLoading !== null}
                      onClick={() => void runPortal()}
                    >
                      {billingLoading === "portal" ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Opening…
                        </>
                      ) : (
                        "Manage billing"
                      )}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="w-full"
                      disabled={!checkoutReady || billingLoading !== null}
                      onClick={() => void runCheckout(tier)}
                    >
                      {billingLoading === tier ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Redirecting…
                        </>
                      ) : (
                        `Upgrade to ${tier}`
                      )}
                    </Button>
                  )}
                  {isPaidTier && !checkoutReady && billingConfig.stripeEnabled && (
                    <p className="text-[11px] text-muted-foreground">
                      Stripe price not configured for {tier}.
                    </p>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>{session?.user?.email}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Link href="/auth/forgot-password" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              Change password
            </Link>
            <Link href="/legal/privacy" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
              Privacy
            </Link>
            <Link href="/legal/terms" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
              Terms
            </Link>
          </CardContent>
        </Card>

        {adminReady && isAdminUser && (
          <Card>
            <CardHeader>
              <CardTitle>Admin tools</CardTitle>
              <CardDescription>Manual plan overrides and platform oversight.</CardDescription>
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
