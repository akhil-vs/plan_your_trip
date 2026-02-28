"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, MapPin } from "lucide-react";

const tiers = [
  {
    name: "Free",
    price: "$0",
    subtitle: "For focused solo planning",
    cta: "Start for free",
    href: "/auth/register",
    highlight: false,
    features: [
      "Solo trip planning",
      "Core route builder + map search",
      "Basic day-wise planning",
      "Draft-to-finalized workflow",
      "Basic PDF export",
    ],
  },
  {
    name: "Pro",
    price: "$9",
    subtitle: "Per planner / month",
    cta: "Upgrade to Pro",
    href: "/auth/register",
    highlight: true,
    features: [
      "Everything in Free",
      "Real-time collaboration and invites",
      "Activity timeline with attribution",
      "Premium PDF layout and branding",
      "Advanced itinerary optimization controls",
    ],
  },
  {
    name: "Team",
    price: "$29",
    subtitle: "Up to 5 planners / month",
    cta: "Contact sales",
    href: "mailto:hello@planyourtrip.app",
    highlight: false,
    features: [
      "Everything in Pro",
      "Shared planning workspace",
      "Role-based access controls",
      "Priority support",
      "Dedicated onboarding assistance",
    ],
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <MapPin className="h-6 w-6 text-blue-600" />
            <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-emerald-600 bg-clip-text text-transparent">
              PlanYourTrip
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/auth/login">
              <Button variant="ghost">Sign in</Button>
            </Link>
            <Link href="/auth/register">
              <Button>Get started</Button>
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
            Simple pricing for every planning stage
          </h1>
          <p className="text-gray-600 mt-3">
            Choose the plan that matches your collaboration needs, export quality, and optimization depth.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {tiers.map((tier) => (
            <Card
              key={tier.name}
              className={tier.highlight ? "border-blue-500 shadow-lg bg-white" : "bg-white"}
            >
              <CardHeader className="space-y-2">
                <div className="flex items-center justify-between">
                  <CardTitle>{tier.name}</CardTitle>
                  {tier.highlight && <Badge>Most Popular</Badge>}
                </div>
                <p className="text-3xl font-bold text-gray-900">{tier.price}</p>
                <p className="text-sm text-muted-foreground">{tier.subtitle}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {tier.features.map((feature) => (
                    <li key={feature} className="text-sm text-gray-700 flex items-start gap-2">
                      <Check className="h-4 w-4 mt-0.5 text-emerald-600 shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link href={tier.href} className="block">
                  <Button className="w-full" variant={tier.highlight ? "default" : "outline"}>
                    {tier.cta}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
