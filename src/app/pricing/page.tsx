"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Quote, X, HelpCircle } from "lucide-react";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { cn } from "@/lib/utils";

type Cell = boolean | "partial";

const tiers = [
  {
    name: "Free",
    price: "£0",
    priceSuffix: "",
    billingNote: "No card required",
    subtitle: "For focused solo planning",
    idealFor:
      "Solo travellers sketching one trip at a time, or trying Viazo before inviting anyone.",
    cta: "Start for free",
    href: "/auth/register",
    highlight: false,
    features: [
      "Solo trip planning (one primary planner)",
      "Core route builder, map, and place search",
      "Day-by-day drafts with notes and times",
      "Draft → finalize workflow for a clear “we’re going” version",
      "Basic PDF export (standard layout)",
      "Web + Android access with the same account",
    ],
  },
  {
    name: "Pro",
    price: "£9",
    priceSuffix: "/month",
    billingNote: "Per planner · cancel anytime",
    subtitle: "Billed monthly in GBP",
    idealFor:
      "Couples, friends, or small groups who need invites, a shared timeline, and polished exports.",
    cta: "Upgrade to Pro",
    href: "/auth/register",
    highlight: true,
    features: [
      "Everything in Free",
      "Invite editors and viewers with email",
      "Real-time collaboration on the same itinerary",
      "Activity timeline with who changed what",
      "Premium PDF: branding, cleaner sections, print-ready layout",
      "Deeper route and day optimisation controls",
    ],
  },
  {
    name: "Team",
    price: "£29",
    priceSuffix: "/month",
    billingNote: "Up to 5 billed planners · invoice-friendly",
    subtitle: "Workspace for recurring trip planning",
    idealFor:
      "Clubs, retreat operators, or teams that need roles, a shared workspace, and priority help.",
    cta: "Contact sales",
    href: "mailto:hello@viazo.app?subject=Viazo%20Team%20plan",
    highlight: false,
    features: [
      "Everything in Pro",
      "Shared planning workspace for your organisation",
      "Role-based access (who can edit vs view)",
      "Priority support with faster first response",
      "Dedicated onboarding for your first workspace",
      "Annual invoicing available on request",
    ],
  },
] as const;

const comparisonRows: Array<{ label: string; free: Cell; pro: Cell; team: Cell; hint?: string }> = [
  { label: "Solo planning & maps", free: true, pro: true, team: true },
  { label: "Invite collaborators", free: false, pro: true, team: true },
  { label: "Real-time co-editing", free: false, pro: true, team: true },
  { label: "Activity timeline & attribution", free: false, pro: true, team: true },
  {
    label: "PDF export",
    free: "partial",
    pro: true,
    team: true,
    hint: "Basic layout on Free; premium layout on Pro and Team.",
  },
  { label: "Advanced route & day optimisation", free: false, pro: true, team: true },
  { label: "Shared workspace & roles", free: false, pro: false, team: true },
  { label: "Priority support & onboarding", free: false, pro: false, team: true },
];

function ComparisonCell({ value }: { value: Cell }) {
  if (value === true) {
    return (
      <td className="px-3 py-3.5 text-center align-middle">
        <span className="inline-flex justify-center">
          <Check className="h-5 w-5 text-emerald-600 mx-auto" strokeWidth={2.5} aria-label="Included" />
        </span>
      </td>
    );
  }
  if (value === "partial") {
    return (
      <td className="px-3 py-3.5 text-center align-middle text-xs font-medium text-amber-800 bg-amber-50/80">
        Partial
      </td>
    );
  }
  return (
    <td className="px-3 py-3.5 text-center align-middle">
      <span className="inline-flex justify-center text-slate-300">
        <X className="h-5 w-5 mx-auto" strokeWidth={2} aria-label="Not included" />
      </span>
    </td>
  );
}

export default function PricingPage() {
  const androidAppUrl =
    process.env.NEXT_PUBLIC_ANDROID_APP_URL ??
    "https://play.google.com/store/apps/details?id=com.viazo.app";

  return (
    <div className="min-h-screen bg-slate-50">
      <MarketingNav context="pricing" />

      <main id="main" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 sm:pt-24 pb-14 sm:pb-20">
        {/* Hero */}
        <header className="text-center max-w-3xl mx-auto mb-10 sm:mb-12">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 mb-3">Pricing</p>
          <h1 className="text-[clamp(1.85rem,4.5vw+0.5rem,2.85rem)] font-bold tracking-tight text-slate-900 text-balance leading-tight font-display">
            Plans that scale with how you travel
          </h1>
          <p className="text-slate-600 mt-4 text-pretty text-base sm:text-lg leading-relaxed">
            Free is a full solo planner on web and Android. Pro adds collaboration, richer exports, and finer control
            when other people depend on your itinerary. Team wraps it for organisations that live in trips year-round.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-sm">
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-700 shadow-sm">
              All prices in <strong className="font-semibold">GBP</strong>
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-700 shadow-sm">
              VAT at checkout where applicable
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-700 shadow-sm">
              Google, Apple, or email sign-in
            </span>
          </div>
        </header>

        <figure className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 mb-10 sm:mb-12 shadow-sm max-w-4xl mx-auto">
          <Quote className="h-8 w-8 text-blue-100 mb-3" aria-hidden />
          <blockquote className="text-slate-700 text-sm sm:text-base leading-relaxed">
            “We upgraded to Pro for PDFs and invites — the whole team finally stopped asking which version of the
            itinerary was current.”
          </blockquote>
          <figcaption className="mt-4 text-sm font-medium text-slate-900">
            Jordan Ellis · Operations lead, retreat planning
          </figcaption>
        </figure>

        {/* Tier cards */}
        <div className="grid gap-6 lg:gap-8 lg:grid-cols-3 items-stretch">
          {tiers.map((tier) => (
            <Card
              key={tier.name}
              className={cn(
                "relative flex flex-col bg-white border-slate-200 shadow-sm transition-all duration-200 overflow-hidden",
                tier.highlight
                  ? "border-2 border-blue-600 z-[1] bg-gradient-to-b from-blue-50/90 via-white to-white shadow-xl shadow-blue-500/12 ring-4 ring-blue-500/[0.1] lg:scale-[1.02] hover:shadow-2xl"
                  : "hover:shadow-md hover:border-slate-300"
              )}
            >
              {tier.highlight && (
                <>
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <Badge className="rounded-full px-4 py-1 text-xs font-semibold shadow-md bg-blue-600 hover:bg-blue-600 text-white border-0">
                      Most popular
                    </Badge>
                  </div>
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-blue-100/40 to-transparent rounded-t-xl" />
                </>
              )}
              <CardHeader className={cn("space-y-3 pb-2 border-b border-slate-100/80", tier.highlight && "pt-9")}>
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={cn(
                      "text-lg font-semibold font-display",
                      tier.highlight ? "text-blue-950" : "text-slate-900"
                    )}
                  >
                    {tier.name}
                  </span>
                </div>
                <div>
                  <p className="flex flex-wrap items-baseline gap-1">
                    <span className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">{tier.price}</span>
                    {tier.priceSuffix ? (
                      <span className="text-base font-semibold text-slate-600">{tier.priceSuffix}</span>
                    ) : null}
                  </p>
                  <p className="text-xs font-medium text-blue-700 mt-1">{tier.billingNote}</p>
                  <p className="text-sm text-slate-500 mt-2">{tier.subtitle}</p>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed pt-1">{tier.idealFor}</p>
              </CardHeader>
              <CardContent className="flex flex-col flex-1 space-y-4 pt-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2.5">Included</p>
                  <ul className="space-y-2.5">
                    {tier.features.map((feature) => (
                      <li key={feature} className="text-sm text-slate-700 flex items-start gap-2.5 leading-snug">
                        <Check className="h-4 w-4 mt-0.5 text-emerald-600 shrink-0" strokeWidth={2.5} />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                {tier.href.startsWith("mailto:") ? (
                  <a href={tier.href} className="block mt-auto">
                    <Button
                      className={cn("w-full h-11 text-base rounded-full", tier.highlight && "shadow-md shadow-blue-600/25")}
                      variant={tier.highlight ? "default" : "outline"}
                      size="lg"
                    >
                      {tier.cta}
                    </Button>
                  </a>
                ) : (
                  <Link href={tier.href} className="block mt-auto">
                    <Button
                      className={cn("w-full h-11 text-base rounded-full", tier.highlight && "shadow-md shadow-blue-600/25")}
                      variant={tier.highlight ? "default" : "outline"}
                      size="lg"
                    >
                      {tier.cta}
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Comparison table */}
        <section className="mt-14 sm:mt-16" aria-labelledby="compare-heading">
          <div className="text-center max-w-2xl mx-auto mb-8">
            <h2 id="compare-heading" className="text-2xl sm:text-3xl font-bold text-slate-900 font-display">
              Compare plans in detail
            </h2>
            <p className="text-slate-600 mt-2 text-sm sm:text-base text-pretty">
              A quick matrix of what changes when you move from solo planning to group workflows and workspace billing.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th scope="col" className="text-left px-4 py-4 font-semibold text-slate-900 w-[40%]">
                      Capability
                    </th>
                    <th scope="col" className="px-3 py-4 font-semibold text-slate-900 text-center">
                      Free
                    </th>
                    <th scope="col" className="px-3 py-4 font-semibold text-blue-900 text-center bg-blue-50/50">
                      Pro
                    </th>
                    <th scope="col" className="px-3 py-4 font-semibold text-slate-900 text-center">
                      Team
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {comparisonRows.map((row) => (
                    <tr key={row.label} className="hover:bg-slate-50/50">
                      <th
                        scope="row"
                        className="text-left px-4 py-3.5 font-medium text-slate-800 align-top max-w-[220px]"
                      >
                        <span className="block">{row.label}</span>
                        {row.hint ? (
                          <span className="block text-xs font-normal text-slate-500 mt-1 leading-snug">{row.hint}</span>
                        ) : null}
                      </th>
                      <ComparisonCell value={row.free} />
                      <ComparisonCell value={row.pro} />
                      <ComparisonCell value={row.team} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500 px-4 py-3 border-t border-slate-100 bg-slate-50/50">
              <HelpCircle className="inline h-3.5 w-3.5 -mt-0.5 mr-1 text-slate-400" aria-hidden />
              Exact seat limits and export presets can vary as we ship updates—this page reflects the intended contract
              between plans. Questions?{" "}
              <a href="mailto:hello@viazo.app" className="font-medium text-blue-700 hover:underline">
                hello@viazo.app
              </a>
              .
            </p>
          </div>
        </section>

        {/* Bottom CTAs */}
        <div className="mt-14 sm:mt-16 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4">
          <Link href="/auth/register">
            <Button size="lg" className="w-full sm:w-auto min-w-[200px] h-12 rounded-full px-8">
              Create free account
            </Button>
          </Link>
          <Link href="/">
            <Button size="lg" variant="outline" className="w-full sm:w-auto min-w-[200px] h-12 rounded-full border-slate-300">
              Back to home
            </Button>
          </Link>
        </div>

        <div className="mt-10 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50/80 to-white p-5 sm:p-7 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 shadow-sm">
          <div className="max-w-xl">
            <h2 className="text-lg sm:text-xl font-semibold text-slate-900 font-display">Also on Android</h2>
            <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
              Install the app to review routes and stops on the go. Your plan applies across web and mobile with the
              same login.
            </p>
          </div>
          <a href={androidAppUrl} target="_blank" rel="noreferrer">
            <Button size="lg" className="w-full sm:w-auto min-w-[220px] rounded-full h-12">
              Get the Android app
            </Button>
          </a>
        </div>
      </main>
    </div>
  );
}
