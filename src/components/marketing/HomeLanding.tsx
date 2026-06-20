"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { HeroProductPreview } from "@/components/marketing/HeroProductPreview";
import { StatCounter } from "@/components/marketing/StatCounter";
import { FadeIn } from "@/components/ui/FadeIn";
import { Logo } from "@/components/ui/Logo";
import {
  Route,
  Search,
  Utensils,
  Ticket,
  CalendarDays,
  MessagesSquare,
  Check,
  ChevronRight,
  Quote,
  Smartphone,
} from "lucide-react";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: Route,
    title: "Multi-stop route builder",
    description:
      "Chain stops and watch distances and drive times refresh as you edit—your map stays the single source of truth.",
    iconWrap: "bg-blue-100 text-blue-700",
  },
  {
    icon: Search,
    title: "On-the-route place search",
    description:
      "Find cafés, viewpoints, and stops by name or category and drop them straight onto the path you are shaping.",
    iconWrap: "bg-sky-100 text-sky-700",
  },
  {
    icon: Utensils,
    title: "Food & dining discovery",
    description:
      "Layer restaurants and local picks between sights so meals sit naturally in the day—not in a separate doc.",
    iconWrap: "bg-amber-100 text-amber-800",
  },
  {
    icon: Ticket,
    title: "Attractions nearby",
    description:
      "Surface landmarks, museums, and viewpoints near your route and widen the radius when you want to wander farther.",
    iconWrap: "bg-violet-100 text-violet-700",
  },
  {
    icon: CalendarDays,
    title: "Day-by-day planner",
    description:
      "Draft each day with notes and timing so the group sees how the trip unfolds—not just a flat list of pins.",
    iconWrap: "bg-emerald-100 text-emerald-800",
  },
  {
    icon: MessagesSquare,
    title: "Live collaboration",
    description:
      "Invite editors, see activity as saves land, and keep one itinerary everyone trusts—no more “which version is latest?”",
    iconWrap: "bg-rose-100 text-rose-700",
  },
];

const otherApps = [
  "Static lists and long descriptions",
  "Hard sign-in flows and pricey one-off apps",
  "Plans that drift across chats and screenshots",
  "Exports that look nothing like your map",
];

const viazoWins = [
  "Live map + route that updates as you edit",
  "Support for multi-day trips and detours",
  "Single source of truth with sync and share",
  "Premium PDF export you can hand to the group",
  "A collaborative builder that feels safe to share",
];

const pricingTiers = [
  {
    name: "Free",
    price: "£0",
    subtitle: "For focused solo planning",
    cta: "Start free",
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
    price: "£9",
    period: "/mo",
    subtitle: "Per planner · billed monthly",
    cta: "Start Pro",
    href: "/auth/register",
    highlight: true,
    features: [
      "Everything in Free",
      "Live collaboration, invites, and sync",
      "Activity timeline with attribution",
      "Premium PDF layout and branding",
      "Advanced itinerary optimization controls",
    ],
  },
  {
    name: "Team",
    price: "£29",
    period: "/mo",
    subtitle: "Up to 5 planners · workspace billing",
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

/** Three columns: tall left card, two stacked center, two stacked right (masonry-style). */
const testimonialColumns: Array<
  Array<{
    quote: string;
    name: string;
    role: string;
    avatarClass: string;
  }>
> = [
  [
    {
      quote:
        "We saved hours planning our Japan loop. The route stayed in sync while we reshuffled stops—and the PDF was the doc everyone actually opened.",
      name: "James Eastman",
      role: "Photographer · multi-city trips",
      avatarClass: "bg-blue-700 text-white",
    },
  ],
  [
    {
      quote:
        "Inviting my partner meant we edited the same plan without stepping on each other. The timeline made decisions obvious.",
      name: "Maya Chen",
      role: "Product designer",
      avatarClass: "bg-sky-300 text-slate-900",
    },
    {
      quote:
        "Search along the route is the feature I didn't know I needed. Cafés and viewpoints landed exactly between drives.",
      name: "Luke Taylor",
      role: "Weekend road-tripper",
      avatarClass: "bg-slate-600 text-white",
    },
  ],
  [
    {
      quote:
        "Our family finally stopped asking which spreadsheet was current. One link, one map, one plan.",
      name: "Amber Ellis",
      role: "Trip organizer",
      avatarClass: "bg-slate-900 text-white",
    },
    {
      quote:
        "Exporting the PDF before we left meant everyone had stops and notes even when signal dropped in the Alps.",
      name: "Sarah Jenkins",
      role: "Adventure traveler",
      avatarClass: "bg-blue-600 text-white",
    },
  ],
];

export function HomeLanding() {
  const { status } = useSession();
  const isAuthed = status === "authenticated";
  const androidAppUrl =
    process.env.NEXT_PUBLIC_ANDROID_APP_URL ??
    "https://play.google.com/store/apps/details?id=com.viazo.app";

  return (
    <div className="min-h-screen font-sans bg-white text-slate-900">
      <MarketingNav context="home" />

      <main id="main">
        {/* Hero */}
        <section
          className="pt-20 sm:pt-24 lg:pt-28 pb-14 sm:pb-16 lg:pb-20 px-4 sm:px-6 bg-gradient-to-b from-sky-50/80 via-white to-white"
          aria-labelledby="hero-heading"
        >
          <div className="max-w-7xl mx-auto lg:grid lg:grid-cols-2 lg:gap-12 xl:gap-16 lg:items-center">
            <div className="max-w-2xl mx-auto text-center lg:text-left lg:mx-0">
              <FadeIn delay={0}>
                <Link
                  href="/#features"
                  className="inline-flex items-center gap-2 rounded-full border border-sky-200/80 bg-sky-50/90 px-4 py-1.5 text-sm font-medium text-sky-900 shadow-sm hover:bg-sky-100/90 transition-colors mb-6"
                >
                  Road trip or city break? We&apos;ve got you.
                  <ChevronRight className="h-4 w-4 shrink-0 text-sky-600" aria-hidden />
                </Link>
              </FadeIn>
              <FadeIn delay={0.05}>
                <h1
                  id="hero-heading"
                  className="text-[clamp(2rem,5vw+0.5rem,3.5rem)] font-bold tracking-tight text-slate-900 mb-5 leading-[1.12] text-balance font-display"
                >
                  Turn every stop into{" "}
                  <span
                    className="font-semibold text-[1.15em] sm:text-[1.2em] text-blue-600 leading-none"
                    style={{ fontFamily: "var(--font-caveat), ui-serif, Georgia, serif" }}
                  >
                    a memory.
                  </span>
                </h1>
              </FadeIn>
              <FadeIn delay={0.1}>
                <p className="text-base sm:text-lg text-slate-600 max-w-xl mx-auto lg:mx-0 mb-8 text-pretty leading-relaxed">
                  Lay out sights, meals, and stops along the route. Invite people who travel with you. Keep the plan in
                  sync. It&apos;s that easy.
                </p>
              </FadeIn>
              <FadeIn delay={0.15}>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center lg:justify-start gap-3 sm:gap-5 w-full max-w-md sm:max-w-none mx-auto lg:mx-0">
                  {status === "loading" ? (
                    <div className="h-12 w-full max-w-xs rounded-full bg-slate-200/60 animate-pulse sm:max-w-[14rem]" />
                  ) : isAuthed ? (
                    <>
                      <Link href="/dashboard" className="w-full sm:w-auto">
                        <Button
                          size="lg"
                          className="w-full sm:w-auto rounded-full text-base px-8 py-6 min-h-12 shadow-lg shadow-blue-600/25"
                        >
                          Go to dashboard
                        </Button>
                      </Link>
                      <Link
                        href="/#features"
                        className="text-base font-semibold text-blue-700 hover:text-blue-800 underline-offset-4 hover:underline py-2 text-center sm:text-left"
                      >
                        View features
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link href="/auth/register" className="w-full sm:w-auto">
                        <Button
                          size="lg"
                          className="w-full sm:w-auto rounded-full text-base px-8 py-6 min-h-12 shadow-lg shadow-blue-600/25"
                        >
                          Start planning
                        </Button>
                      </Link>
                      <Link
                        href="/#features"
                        className="text-base font-semibold text-blue-700 hover:text-blue-800 underline-offset-4 hover:underline py-2 text-center sm:text-left"
                      >
                        View features
                      </Link>
                    </>
                  )}
                </div>
                <p className="mt-5 text-sm text-slate-500">
                  No credit card needed to start your first road trip.
                </p>
              </FadeIn>
            </div>
            <FadeIn delay={0.12}>
              <HeroProductPreview />
            </FadeIn>
          </div>
        </section>

        {/* Stats */}
        <section className="py-12 sm:py-14 px-4 border-y border-slate-100 bg-white" aria-labelledby="stats-heading">
          <div className="max-w-7xl mx-auto">
            <h2 id="stats-heading" className="sr-only">
              Viazo at a glance
            </h2>
            <FadeIn>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 sm:gap-8 text-center">
                <StatCounter end={50} suffix="+" label="Countries on the map" />
                <StatCounter end={6} label="Core planning tools" />
                <StatCounter end={3} label="Plans for every trip" />
              </div>
            </FadeIn>
          </div>
        </section>

        {/* Features */}
        <section
          id="features"
          className="py-16 sm:py-20 px-4 scroll-mt-24 bg-slate-50/60"
          aria-labelledby="features-heading"
        >
          <div className="max-w-7xl mx-auto">
            <FadeIn>
              <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 mb-3">
                A better way to organize
              </p>
              <h2
                id="features-heading"
                className="text-center text-3xl sm:text-4xl lg:text-[2.65rem] font-bold text-slate-900 font-display text-balance max-w-3xl mx-auto leading-tight"
              >
                Built for trips — not slide decks.
              </h2>
              <p className="text-center text-slate-600 mt-4 max-w-2xl mx-auto text-pretty text-base sm:text-lg">
                Stop juggling maps, notes, and five different apps. Viazo keeps the route, the days, and the share link
                aligned so your crew always sees the same plan.
              </p>
            </FadeIn>
            <div className="mt-14 grid gap-5 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature, index) => (
                <FadeIn key={feature.title} delay={index * 0.06}>
                  <div className="h-full rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-7 shadow-sm hover:shadow-md hover:border-blue-200/70 transition-all duration-200">
                    <div
                      className={cn(
                        "inline-flex h-12 w-12 items-center justify-center rounded-xl mb-4",
                        feature.iconWrap
                      )}
                    >
                      <feature.icon className="h-6 w-6" strokeWidth={2} aria-hidden />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">{feature.title}</h3>
                    <p className="text-slate-600 text-[15px] leading-relaxed">{feature.description}</p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* Why Viazo */}
        <section
          className="py-16 sm:py-20 px-4 bg-slate-950 text-white"
          aria-labelledby="why-heading"
        >
          <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
            <FadeIn>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400 mb-4">Why Viazo</p>
              <h2
                id="why-heading"
                className="text-3xl sm:text-4xl font-bold font-display text-balance leading-tight text-white"
              >
                Trips are routes through time and space — not a pile of bookmarks.
              </h2>
              <p className="mt-5 text-slate-300 text-pretty leading-relaxed max-w-xl">
                Viazo is built around the map and the days: move a stop, see the ripple, share the same live plan with
                the people who are actually traveling with you.
              </p>
              <Link href="/#features" className="inline-block mt-8">
                <Button
                  size="lg"
                  className="rounded-full px-7 bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/40"
                >
                  See all features
                  <ChevronRight className="ml-1 h-4 w-4" aria-hidden />
                </Button>
              </Link>
            </FadeIn>
            <FadeIn delay={0.1}>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 sm:p-8 backdrop-blur-sm">
                <div className="grid sm:grid-cols-2 gap-8">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-4">
                      Other apps
                    </p>
                    <ul className="space-y-3.5 text-sm text-slate-400">
                      {otherApps.map((line) => (
                        <li key={line} className="leading-snug border-l-2 border-slate-700 pl-3">
                          {line}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-400 mb-4">Viazo</p>
                    <ul className="space-y-3.5 text-sm text-slate-100">
                      {viazoWins.map((line) => (
                        <li key={line} className="flex gap-2.5 leading-snug">
                          <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" strokeWidth={2.5} aria-hidden />
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* Testimonials — three-column masonry */}
        <section
          className="py-16 sm:py-20 px-4 sm:px-6 bg-[#f8faff]"
          aria-labelledby="testimonials-heading"
        >
          <div className="max-w-7xl mx-auto">
            <FadeIn>
              <p className="text-center text-xs font-semibold uppercase tracking-[0.22em] text-blue-500 mb-3">
                They planned it, too
              </p>
              <h2
                id="testimonials-heading"
                className="text-center text-3xl sm:text-4xl font-bold text-[#0f172a] font-display text-balance tracking-tight"
              >
                The plan everyone trusts.
              </h2>
            </FadeIn>
            <div className="mt-12 md:mt-14 grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 items-start">
              {testimonialColumns.map((column, colIndex) => (
                <div
                  key={colIndex}
                  className="flex flex-col gap-6 md:gap-8"
                >
                  {column.map((t, rowIndex) => {
                    const stagger = colIndex * 0.06 + rowIndex * 0.07;
                    return (
                      <FadeIn key={t.name} delay={stagger}>
                        <figure className="h-full rounded-xl border border-slate-200/90 bg-white p-6 sm:p-7 shadow-[0_1px_3px_rgba(15,23,42,0.06),0_8px_24px_-6px_rgba(15,23,42,0.08)] hover:shadow-[0_2px_6px_rgba(15,23,42,0.08),0_12px_32px_-8px_rgba(15,23,42,0.1)] transition-shadow duration-200">
                          <Quote
                            className="h-10 w-10 sm:h-11 sm:w-11 mb-5 text-[#dbeafe]"
                            strokeWidth={1.25}
                            aria-hidden
                          />
                          <blockquote className="text-[15px] sm:text-base text-slate-800 leading-relaxed">
                            “{t.quote}”
                          </blockquote>
                          <figcaption className="mt-6 flex items-center gap-3 pt-1">
                            <span
                              className={cn(
                                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                                t.avatarClass
                              )}
                              aria-hidden
                            >
                              {t.name.charAt(0)}
                            </span>
                            <div className="min-w-0">
                              <p className="font-semibold text-[#0f172a] leading-tight">{t.name}</p>
                              <p className="text-sm text-[#64748b] mt-0.5">{t.role}</p>
                            </div>
                          </figcaption>
                        </figure>
                      </FadeIn>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section
          className="py-16 sm:py-20 px-4 bg-slate-50 border-y border-slate-100"
          aria-labelledby="pricing-heading"
        >
          <div className="max-w-7xl mx-auto">
            <FadeIn>
              <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 mb-3">
                Simple pricing
              </p>
              <h2
                id="pricing-heading"
                className="text-center text-3xl sm:text-4xl font-bold text-slate-900 font-display text-balance max-w-3xl mx-auto"
              >
                Free for solo depth, Pro when the group grows.
              </h2>
              <p className="text-center text-slate-600 mt-4 max-w-2xl mx-auto text-pretty">
                Start on Free, invite collaborators when you need them, and upgrade for premium exports and workspace
                controls.
              </p>
            </FadeIn>
            <div className="mt-12 grid gap-6 lg:gap-8 lg:grid-cols-3 items-stretch">
              {pricingTiers.map((tier, i) => (
                <FadeIn key={tier.name} delay={i * 0.08}>
                  <div
                    className={cn(
                      "relative flex h-full flex-col rounded-2xl border bg-white p-6 sm:p-8 shadow-sm transition-shadow",
                      tier.highlight
                        ? "border-2 border-blue-600 shadow-xl shadow-blue-500/15 ring-4 ring-blue-500/[0.08] lg:scale-[1.02] z-[1]"
                        : "border-slate-200 hover:shadow-md"
                    )}
                  >
                    {tier.highlight && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-4 py-0.5 text-xs font-semibold text-white shadow-md">
                        Most popular
                      </span>
                    )}
                    <div className={cn(tier.highlight && "pt-2")}>
                      <p
                        className={cn(
                          "text-sm font-semibold",
                          tier.highlight ? "text-blue-800" : "text-slate-900"
                        )}
                      >
                        {tier.name}
                      </p>
                      <p className="mt-2 flex items-baseline gap-0.5">
                        <span className="text-4xl font-bold tracking-tight text-slate-900">{tier.price}</span>
                        {"period" in tier && tier.period ? (
                          <span className="text-slate-600 font-medium">{tier.period}</span>
                        ) : null}
                      </p>
                      <p className="text-sm text-slate-500 mt-1">{tier.subtitle}</p>
                    </div>
                    <ul className="mt-6 flex-1 space-y-2.5">
                      {tier.features.map((f) => (
                        <li key={f} className="flex gap-2 text-sm text-slate-700">
                          <Check className="h-4 w-4 mt-0.5 shrink-0 text-emerald-600" strokeWidth={2.5} aria-hidden />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-8">
                      {tier.href.startsWith("mailto:") ? (
                        <a href={tier.href} className="block">
                          <Button
                            variant={tier.highlight ? "default" : "outline"}
                            size="lg"
                            className={cn(
                              "w-full rounded-full h-12 text-base",
                              tier.highlight && "shadow-md shadow-blue-600/25"
                            )}
                          >
                            {tier.cta}
                          </Button>
                        </a>
                      ) : (
                        <Link href={tier.href} className="block">
                          <Button
                            variant={tier.highlight ? "default" : "outline"}
                            size="lg"
                            className={cn(
                              "w-full rounded-full h-12 text-base",
                              tier.highlight && "shadow-md shadow-blue-600/25"
                            )}
                          >
                            {tier.cta}
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
            <FadeIn delay={0.15}>
              <p className="text-center mt-10">
                <Link
                  href="/pricing"
                  className="text-sm font-semibold text-blue-700 hover:text-blue-800 underline-offset-4 hover:underline"
                >
                  Compare plans in detail
                </Link>
              </p>
            </FadeIn>
          </div>
        </section>

        {/* Primary CTA */}
        <section
          className="py-16 sm:py-20 px-4 bg-gradient-to-br from-blue-600 via-blue-600 to-sky-500"
          aria-labelledby="cta-heading"
        >
          <div className="max-w-4xl mx-auto text-center">
            <FadeIn>
              <h2
                id="cta-heading"
                className="text-3xl sm:text-4xl font-bold text-white font-display text-balance"
              >
                Your next trip starts here.
              </h2>
              <p className="mt-4 text-lg text-white/95 text-pretty">
                {isAuthed
                  ? "Jump back into the planner or open your dashboard—your routes are waiting."
                  : "Sketch your first route, invite your crew when you are ready, and keep everyone on the same map."}
              </p>
              <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
                {status === "loading" ? (
                  <div className="h-12 w-48 rounded-full bg-white/30 animate-pulse" />
                ) : isAuthed ? (
                  <>
                    <Link href="/planner">
                      <Button
                        size="lg"
                        className="rounded-full px-8 h-12 min-w-[200px] bg-white text-blue-700 hover:bg-slate-50 shadow-lg"
                      >
                        Open planner
                      </Button>
                    </Link>
                    <Link href="/dashboard">
                      <Button
                        size="lg"
                        variant="outline"
                        className="rounded-full px-8 h-12 min-w-[200px] border-white/70 bg-transparent text-white hover:bg-white/10"
                      >
                        Dashboard
                      </Button>
                    </Link>
                  </>
                ) : (
                  <>
                    <Link href="/auth/register">
                      <Button
                        size="lg"
                        className="rounded-full px-8 h-12 min-w-[200px] bg-white text-blue-700 hover:bg-slate-50 shadow-lg"
                      >
                        Start for free now
                      </Button>
                    </Link>
                    <Link href="/auth/login">
                      <Button
                        size="lg"
                        variant="outline"
                        className="rounded-full px-8 h-12 min-w-[200px] border-white/70 bg-transparent text-white hover:bg-white/10"
                      >
                        Sign in
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            </FadeIn>
          </div>
        </section>

        {/* Android */}
        <section
          id="android-app"
          className="py-14 sm:py-16 px-4 bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500"
          aria-labelledby="android-heading"
        >
          <div className="max-w-7xl mx-auto">
            <FadeIn>
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
                <div className="max-w-xl">
                  <h2 id="android-heading" className="text-2xl sm:text-3xl font-bold text-white font-display text-balance">
                    Plan on web. Continue on Android.
                  </h2>
                  <p className="mt-3 text-emerald-50/95 text-pretty leading-relaxed">
                    Install the Android app to pull up the same trips, routes, and collaborators on the go—synced with
                    your Viazo account.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 shrink-0">
                  <a href={androidAppUrl} target="_blank" rel="noreferrer">
                    <Button
                      size="lg"
                      className="w-full sm:w-auto min-w-[200px] rounded-full bg-white text-emerald-800 hover:bg-emerald-50 h-12"
                    >
                      <Smartphone className="h-4 w-4 mr-2" aria-hidden />
                      Get it on Android
                    </Button>
                  </a>
                  <Link href="/auth/register">
                    <Button
                      size="lg"
                      variant="outline"
                      className="w-full sm:w-auto min-w-[200px] rounded-full border-white/80 bg-transparent text-white hover:bg-white/10 h-12"
                    >
                      Create free account
                    </Button>
                  </Link>
                </div>
              </div>
            </FadeIn>
          </div>
        </section>
      </main>

      <footer className="bg-slate-950 text-slate-400 pt-14 pb-10 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto grid gap-12 lg:grid-cols-[minmax(0,1.2fr)_2fr] lg:gap-16">
          <div>
            <Logo size="md" variant="white" />
            <p className="mt-4 text-sm leading-relaxed text-slate-400 max-w-sm">
              Viazo helps you plan routes, days, and stops in one place—then share the itinerary everyone will actually
              follow.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 text-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Product</p>
              <ul className="space-y-2.5">
                <li>
                  <Link href="/#features" className="hover:text-white transition-colors">
                    Features
                  </Link>
                </li>
                <li>
                  <Link href="/pricing" className="hover:text-white transition-colors">
                    Pricing
                  </Link>
                </li>
                <li>
                  <a href={androidAppUrl} className="hover:text-white transition-colors" target="_blank" rel="noreferrer">
                    Android app
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Support</p>
              <ul className="space-y-2.5">
                <li>
                  <a href="mailto:hello@viazo.app" className="hover:text-white transition-colors">
                    hello@viazo.app
                  </a>
                </li>
                <li>
                  <Link href="/auth/login" className="hover:text-white transition-colors">
                    Sign in
                  </Link>
                </li>
              </ul>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Legal</p>
              <ul className="space-y-2.5">
                <li>
                  <Link href="/legal/privacy" className="hover:text-white transition-colors">
                    Privacy policy
                  </Link>
                </li>
                <li>
                  <Link href="/legal/terms" className="hover:text-white transition-colors">
                    Terms of service
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} Viazo. Built for people who live out of a carry-on.
          </p>
        </div>
      </footer>
    </div>
  );
}
