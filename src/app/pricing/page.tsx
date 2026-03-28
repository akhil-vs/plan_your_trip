"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Quote } from "lucide-react";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { cn } from "@/lib/utils";

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
    href: "mailto:hello@viazo.app",
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
      <MarketingNav context="pricing" />

      <main id="main" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 sm:pt-24 pb-12 sm:pb-16">
        <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10">
          <h1 className="text-[clamp(1.75rem,4.5vw+0.5rem,2.75rem)] font-bold tracking-tight text-gray-900 text-balance leading-tight">
            Pay for depth when your trip needs it
          </h1>
          <p className="text-gray-600 mt-3 text-pretty text-base sm:text-lg">
            Free covers solo planning on the map; Pro and Team add collaboration, exports, and controls when your
            group—or your standards—grow.
          </p>
        </div>

        <figure className="rounded-xl border bg-white/80 p-6 sm:p-8 mb-10 shadow-sm max-w-4xl mx-auto">
          <Quote className="h-7 w-7 text-blue-200 mb-2" aria-hidden />
          <blockquote className="text-gray-700 text-sm sm:text-base leading-relaxed">
            “We upgraded to Pro for PDFs and invites — the whole team finally stopped asking which version of the
            itinerary was current.”
          </blockquote>
          <figcaption className="mt-3 text-xs sm:text-sm font-medium text-gray-900">
            Jordan Ellis · Operations lead, retreat planning
          </figcaption>
        </figure>

        <div className="grid gap-6 lg:gap-8 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))] items-stretch">
          {tiers.map((tier) => (
            <Card
              key={tier.name}
              className={cn(
                "relative flex flex-col bg-white border-gray-200 shadow-sm transition-all duration-200",
                tier.highlight
                  ? "border-2 border-blue-600 z-[1] bg-gradient-to-b from-blue-50/95 via-white to-white shadow-xl shadow-blue-500/15 ring-4 ring-blue-500/[0.12] md:scale-[1.03] hover:shadow-2xl"
                  : "hover:shadow-md hover:border-gray-300"
              )}
            >
              {tier.highlight && (
                <>
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <Badge className="rounded-full px-4 py-1 text-xs font-semibold shadow-md bg-blue-600 hover:bg-blue-600 text-white border-0">
                      Most popular
                    </Badge>
                  </div>
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-blue-100/50 to-transparent rounded-t-xl" />
                </>
              )}
              <CardHeader className={cn("space-y-2 pb-2", tier.highlight && "pt-8")}>
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "text-lg font-semibold",
                      tier.highlight ? "text-blue-900" : "text-gray-900"
                    )}
                  >
                    {tier.name}
                  </span>
                </div>
                <p className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">{tier.price}</p>
                <p className="text-sm text-muted-foreground">{tier.subtitle}</p>
              </CardHeader>
              <CardContent className="flex flex-col flex-1 space-y-4 pt-0">
                <ul className="space-y-2.5 flex-1">
                  {tier.features.map((feature) => (
                    <li key={feature} className="text-sm text-gray-700 flex items-start gap-2">
                      <Check className="h-4 w-4 mt-0.5 text-emerald-600 shrink-0" strokeWidth={2.5} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link href={tier.href} className="block mt-auto">
                  <Button
                    className={cn("w-full h-11 text-base", tier.highlight && "shadow-md shadow-blue-600/25")}
                    variant={tier.highlight ? "default" : "outline"}
                    size="lg"
                  >
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
