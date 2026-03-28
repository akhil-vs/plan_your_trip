"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { HeroProductPreview } from "@/components/marketing/HeroProductPreview";
import { StatCounter } from "@/components/marketing/StatCounter";
import { TestimonialsStrip } from "@/components/marketing/TestimonialsStrip";
import { FadeIn } from "@/components/ui/FadeIn";
import {
  Route,
  Search,
  Utensils,
  Hotel,
  Compass,
  Globe,
  Star,
} from "lucide-react";

const features = [
  {
    icon: Route,
    title: "Multi-stop routes",
    description:
      "Chain as many stops as you need and see the full path on the map—distances and drive times update as you edit.",
  },
  {
    icon: Compass,
    title: "Attractions along the way",
    description:
      "Surface landmarks, museums, and viewpoints near your route and adjust the radius when you want to wander farther.",
  },
  {
    icon: Utensils,
    title: "Food that fits the day",
    description:
      "Layer in restaurants and local picks so meals sit naturally between sights—not as a separate spreadsheet.",
  },
  {
    icon: Hotel,
    title: "Stays near the plan",
    description:
      "Compare hotels and guesthouses with an eye on how close they sit to your route and next-day starts.",
  },
  {
    icon: Globe,
    title: "Search almost anywhere",
    description:
      "From capital cities to smaller towns—pick places by name and drop them straight onto the map.",
  },
  {
    icon: Star,
    title: "Save, share, collaborate",
    description:
      "Keep one itinerary as the source of truth: invite editors, track changes, and export when you are ready to go.",
  },
];

export function HomeLanding() {
  const { status } = useSession();
  const isAuthed = status === "authenticated";

  return (
    <div className="min-h-screen font-sans">
      <MarketingNav context="home" />

      <main id="main">
        {/* Hero */}
        <section
          className="pt-20 sm:pt-24 lg:pt-28 pb-12 sm:pb-16 lg:pb-20 px-4 sm:px-6 bg-gradient-to-br from-blue-50 via-white to-emerald-50"
          aria-labelledby="hero-heading"
        >
          <div className="max-w-7xl mx-auto lg:grid lg:grid-cols-2 lg:gap-10 xl:gap-14 lg:items-center">
            <div className="max-w-4xl mx-auto text-center lg:text-left lg:mx-0 lg:max-w-none">
              <FadeIn delay={0}>
                <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
                  <Search className="h-4 w-4 shrink-0" aria-hidden />
                  Maps, days, and stops in one workspace
                </div>
              </FadeIn>
              <FadeIn delay={0.05}>
                <h1
                  id="hero-heading"
                  className="text-[clamp(1.875rem,5vw+0.75rem,3.75rem)] font-bold tracking-tight text-gray-900 mb-6 leading-[1.15] text-balance font-display"
                >
                  Itineraries that stay
                  <span className="bg-gradient-to-r from-blue-600 to-emerald-500 bg-clip-text text-transparent">
                    {" "}
                    clear on the map
                  </span>
                </h1>
              </FadeIn>
              <FadeIn delay={0.1}>
                <p className="text-base sm:text-lg text-gray-600 max-w-2xl lg:max-w-none mx-auto lg:mx-0 mb-8 sm:mb-10 text-pretty">
                  Sketch routes, layer in sights and meals, invite people who actually travel with you, then share or
                  export a plan everyone can follow—without a dozen tabs.
                </p>
              </FadeIn>
              <FadeIn delay={0.2}>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center lg:justify-start gap-3 sm:gap-4 w-full sm:w-auto max-w-sm sm:max-w-none mx-auto lg:mx-0">
                  {status === "loading" ? (
                    <div className="h-12 w-full max-w-xs rounded-lg bg-white/50 animate-pulse sm:max-w-[20rem]" />
                  ) : isAuthed ? (
                    <>
                      <Link href="/dashboard" className="w-full sm:w-auto">
                        <Button
                          size="lg"
                          className="w-full sm:w-auto text-base sm:text-lg px-6 sm:px-8 py-6 min-h-12 touch-manipulation shadow-md shadow-blue-600/20"
                        >
                          Go to dashboard
                        </Button>
                      </Link>
                      <Link href="/planner" className="w-full sm:w-auto">
                        <Button
                          size="lg"
                          variant="outline"
                          className="w-full sm:w-auto text-base sm:text-lg px-6 sm:px-8 py-6 min-h-12 touch-manipulation border-gray-300 bg-white/80"
                        >
                          Open planner
                        </Button>
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link href="/auth/register" className="w-full sm:w-auto">
                        <Button
                          size="lg"
                          className="w-full sm:w-auto text-base sm:text-lg px-6 sm:px-8 py-6 min-h-12 touch-manipulation shadow-md shadow-blue-600/20"
                        >
                          Start planning
                        </Button>
                      </Link>
                      <Link href="/auth/login" className="w-full sm:w-auto">
                        <Button
                          size="lg"
                          variant="outline"
                          className="w-full sm:w-auto text-base sm:text-lg px-6 sm:px-8 py-6 min-h-12 touch-manipulation border-gray-300 bg-white/80"
                        >
                          Sign in
                        </Button>
                      </Link>
                    </>
                  )}
                </div>
              </FadeIn>
            </div>
            <FadeIn delay={0.15}>
              <HeroProductPreview />
            </FadeIn>
          </div>
        </section>

        {/* Social proof */}
        <section
          className="py-10 sm:py-12 px-4 border-y border-gray-100 bg-white"
          aria-labelledby="proof-heading"
        >
          <div className="max-w-7xl mx-auto">
            <FadeIn>
              <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-12">
                <h2
                  id="proof-heading"
                  className="text-xl sm:text-2xl font-bold text-gray-900 font-display text-balance"
                >
                  Built for trips—not slide decks
                </h2>
                <p className="text-slate-600 mt-2 text-pretty text-sm sm:text-base">
                  Planners use Viazo when the route, the days, and the share link all need to match.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-10">
                <StatCounter
                  end={12000}
                  suffix="+"
                  label="routes planned by travelers worldwide"
                />
                <StatCounter
                  end={195}
                  suffix="+"
                  label="countries and regions you can search"
                />
                <StatCounter
                  end={4.9}
                  decimals={1}
                  suffix=" / 5"
                  label="average rating from early planners"
                />
              </div>
            </FadeIn>
            <FadeIn delay={0.12}>
              <div className="mt-12 sm:mt-14">
                <h3 className="text-center text-base sm:text-lg font-semibold text-gray-900 font-display mb-6">
                  What planners say
                </h3>
                <TestimonialsStrip />
              </div>
            </FadeIn>
          </div>
        </section>

        {/* Features */}
        <section
          className="py-16 sm:py-20 px-4 bg-white"
          aria-labelledby="features-heading"
        >
          <div className="max-w-7xl mx-auto">
            <FadeIn>
              <div className="text-center mb-12 sm:mb-16 max-w-3xl mx-auto">
                <h2
                  id="features-heading"
                  className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-4 text-balance font-display"
                >
                  From first idea to handoff
                </h2>
                <p className="text-base sm:text-lg text-slate-600 text-pretty">
                  Route building, discovery, collaboration, and export—so the plan you share is the plan you meant.
                </p>
              </div>
            </FadeIn>
            <div className="grid gap-6 sm:gap-8 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
              {features.map((feature, index) => (
                <FadeIn key={feature.title} delay={index * 0.08}>
                  <div className="group h-full p-6 rounded-xl border border-gray-200/90 bg-gradient-to-b from-white to-gray-50/60 shadow-sm hover:shadow-lg hover:border-blue-200/80 hover:-translate-y-0.5 transition-all duration-200">
                    <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center mb-4 group-hover:bg-blue-600/10 transition-colors">
                      <feature.icon
                        className="h-6 w-6 text-brand-primary group-hover:scale-105 transition-transform"
                        strokeWidth={2}
                        aria-hidden
                      />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                    <p className="text-slate-600 text-[15px] leading-relaxed">{feature.description}</p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing preview */}
        <section
          className="py-16 px-4 bg-gray-50 border-y"
          aria-labelledby="pricing-preview-heading"
        >
          <div className="max-w-7xl mx-auto">
            <FadeIn>
              <div className="text-center mb-10 max-w-2xl mx-auto">
                <h2
                  id="pricing-preview-heading"
                  className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3 text-balance font-display"
                >
                  Start free, upgrade when the trip gets serious
                </h2>
                <p className="text-slate-600 text-pretty">
                  Solo planning stays on Free; add collaboration, richer PDFs, and finer optimization when your group
                  or your standards grow.
                </p>
              </div>
            </FadeIn>
            <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
              {[
                {
                  name: "Free",
                  price: "$0",
                  desc: "Solo planning, map + routes, drafts, and basic export.",
                  highlight: false,
                },
                {
                  name: "Pro",
                  price: "$9/mo",
                  desc: "Invites, timeline, premium PDF, and deeper optimization controls.",
                  highlight: true,
                },
                {
                  name: "Team",
                  price: "$29/mo",
                  desc: "Shared workspace, roles, and priority help for groups.",
                  highlight: false,
                },
              ].map((tier, i) => (
                <FadeIn key={tier.name} delay={i * 0.1}>
                  {tier.highlight ? (
                    <div className="relative rounded-xl border-2 border-blue-600 bg-gradient-to-b from-blue-50/90 to-white p-5 shadow-lg shadow-blue-500/10 ring-4 ring-blue-500/[0.08] scale-[1.02] z-[1] hover:shadow-xl transition-shadow h-full">
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 text-white text-xs font-semibold px-3 py-0.5 shadow-md">
                        Most popular
                      </span>
                      <p className="text-sm font-semibold text-blue-800 pt-1">{tier.name}</p>
                      <p className="text-2xl font-bold mt-1">{tier.price}</p>
                      <p className="text-sm text-slate-600 mt-2">{tier.desc}</p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow h-full">
                      <p className="text-sm font-semibold text-gray-900">{tier.name}</p>
                      <p className="text-2xl font-bold mt-1">{tier.price}</p>
                      <p className="text-sm text-slate-600 mt-2">{tier.desc}</p>
                    </div>
                  )}
                </FadeIn>
              ))}
            </div>
            <FadeIn delay={0.2}>
              <div className="text-center mt-8">
                <Link href="/pricing">
                  <Button variant="outline" size="lg" className="min-w-[200px] border-gray-300">
                    View full pricing
                  </Button>
                </Link>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* CTA */}
        <section
          className="py-16 sm:py-20 px-4 bg-gradient-to-r from-blue-600 to-emerald-600"
          aria-labelledby="cta-heading"
        >
          <div className="max-w-7xl mx-auto">
            <FadeIn>
              <div className="max-w-3xl mx-auto text-center">
                <h2
                  id="cta-heading"
                  className="text-2xl sm:text-3xl font-bold text-white mb-4 text-balance font-display"
                >
                  {isAuthed ? "Pick up where you left off" : "Ready when you are"}
                </h2>
                <p className="text-base sm:text-lg text-white/95 mb-8 text-pretty">
                  {isAuthed
                    ? "Jump back to your trips or start routing a new plan on the map."
                    : "Create an account in a minute—no credit card to sketch your first route and see it on the map."}
                </p>
                {status === "loading" ? (
                  <div className="mx-auto h-14 max-w-xs rounded-lg bg-white/30 animate-pulse sm:max-w-sm" />
                ) : isAuthed ? (
                  <div className="flex flex-col sm:flex-row items-stretch justify-center gap-3 sm:gap-4 w-full sm:w-auto">
                    <Link href="/dashboard" className="inline-block w-full sm:w-auto">
                      <Button
                        size="lg"
                        className="w-full sm:w-auto text-lg px-8 py-6 bg-white text-blue-700 hover:bg-gray-50 shadow-lg"
                      >
                        Open dashboard
                      </Button>
                    </Link>
                    <Link href="/planner" className="inline-block w-full sm:w-auto">
                      <Button
                        size="lg"
                        variant="outline"
                        className="w-full sm:w-auto text-lg px-8 py-6 border-white/80 bg-transparent text-white hover:bg-white/10"
                      >
                        New itinerary
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <Link href="/auth/register" className="inline-block w-full sm:w-auto">
                    <Button
                      size="lg"
                      className="w-full sm:w-auto text-lg px-8 py-6 bg-white text-blue-700 hover:bg-gray-50 shadow-lg"
                    >
                      Create free account
                    </Button>
                  </Link>
                )}
              </div>
            </FadeIn>
          </div>
        </section>
      </main>

      <footer className="py-8 px-4 bg-gray-900 text-gray-300 text-center text-sm max-w-none">
        <p>&copy; {new Date().getFullYear()} Viazo. Built for people who live out of a carry-on.</p>
      </footer>
    </div>
  );
}
