import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  MapPin,
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
    title: "Multi-Stop Routes",
    description:
      "Plan routes with unlimited stops. Visualize your entire journey on an interactive map with distance and duration estimates.",
  },
  {
    icon: Compass,
    title: "Discover Attractions",
    description:
      "Find must-visit attractions, historical landmarks, and hidden gems near your route with adjustable search radius.",
  },
  {
    icon: Utensils,
    title: "Food & Dining",
    description:
      "Get restaurant recommendations, local cuisine suggestions, and must-try food and beverages at every destination.",
  },
  {
    icon: Hotel,
    title: "Find Stays",
    description:
      "Search hotels, hostels, apartments, and more with filters for type, rating, and proximity to your route.",
  },
  {
    icon: Globe,
    title: "Worldwide Search",
    description:
      "Search almost any location globally. From major cities to remote villages, plan trips anywhere in the world.",
  },
  {
    icon: Star,
    title: "Save & Collaborate",
    description:
      "Create an account to save itineraries, collaborate with others, and keep every travel plan organized.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <MapPin className="h-7 w-7 text-blue-600" />
            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-emerald-600 bg-clip-text text-transparent">
              PlanYourTrip
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/pricing">
              <Button variant="ghost">Pricing</Button>
            </Link>
            <Link href="/auth/login">
              <Button variant="ghost">Sign in</Button>
            </Link>
            <Link href="/auth/register">
              <Button>Get started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-24 sm:pt-32 pb-16 sm:pb-20 px-4 sm:px-6 bg-gradient-to-br from-blue-50 via-white to-emerald-50">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
            <Search className="h-4 w-4" />
            Plan with clarity and confidence
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 mb-6">
            Plan Your Perfect
            <span className="bg-gradient-to-r from-blue-600 to-emerald-500 bg-clip-text text-transparent">
              {" "}
              Travel Itinerary
            </span>
          </h1>
          <p className="text-base sm:text-lg lg:text-xl text-gray-600 max-w-2xl mx-auto mb-8 sm:mb-10 px-1">
            Build polished itineraries on an interactive map. Discover attractions,
            coordinate with collaborators, and export plans that are ready to share.
          </p>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4 w-full sm:w-auto max-w-sm sm:max-w-none mx-auto">
            <Link href="/auth/register" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto text-base sm:text-lg px-6 sm:px-8 py-6 min-h-12 touch-manipulation">
                Start planning
              </Button>
            </Link>
            <Link href="/auth/login" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:w-auto text-base sm:text-lg px-6 sm:px-8 py-6 min-h-12 touch-manipulation">
                Sign in
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
              Everything you need for premium trip planning
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              From route design to collaboration and export, every step is built
              for a professional planning experience.
            </p>
          </div>
          <div className="grid gap-6 sm:gap-8 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="p-6 rounded-xl border bg-gradient-to-b from-white to-gray-50/50 hover:shadow-lg transition-shadow"
              >
                <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center mb-4">
                  <feature.icon className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing preview */}
      <section className="py-16 px-4 bg-gray-50 border-y">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
              Plans that scale with your planning depth
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Start free for solo planning, then upgrade when you need deeper collaboration,
              richer exports, and advanced optimization controls.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            <div className="rounded-xl border bg-white p-5">
              <p className="text-sm font-semibold text-gray-900">Free</p>
              <p className="text-2xl font-bold mt-1">$0</p>
              <p className="text-sm text-muted-foreground mt-2">
                Core itinerary planning for solo travelers.
              </p>
            </div>
            <div className="rounded-xl border-2 border-blue-500 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-blue-700">Pro</p>
              <p className="text-2xl font-bold mt-1">$9/mo</p>
              <p className="text-sm text-muted-foreground mt-2">
                Collaboration, activity timeline, premium PDF, and advanced optimization.
              </p>
            </div>
            <div className="rounded-xl border bg-white p-5">
              <p className="text-sm font-semibold text-gray-900">Team</p>
              <p className="text-2xl font-bold mt-1">$29/mo</p>
              <p className="text-sm text-muted-foreground mt-2">
                Shared workspace, role controls, and team support.
              </p>
            </div>
          </div>
          <div className="text-center mt-8">
            <Link href="/pricing">
              <Button variant="outline" size="lg">
                View full pricing
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-gradient-to-r from-blue-600 to-emerald-600">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
            Ready to plan with confidence?
          </h2>
          <p className="text-lg text-blue-100 mb-8">
            Join travelers who plan with clarity, collaborate smoothly, and share
            polished itineraries.
          </p>
          <Link href="/auth/register">
            <Button
              size="lg"
              variant="secondary"
              className="text-lg px-8 py-6"
            >
              Create free account
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 bg-gray-900 text-gray-400 text-center text-sm">
        <p>&copy; {new Date().getFullYear()} PlanYourTrip. Built for travelers, by travelers.</p>
      </footer>
    </div>
  );
}
