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
    title: "Multi - Stop Routes",
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
    title: "Save & Revisit",
    description:
      "Create an account to save your trip plans, edit them later, and keep all your travel ideas organized.",
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
            <Link href="/auth/login">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/auth/register">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-24 sm:pt-32 pb-16 sm:pb-20 px-4 sm:px-6 bg-gradient-to-br from-blue-50 via-white to-emerald-50">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
            <Search className="h-4 w-4" />
            Explore the world, your way
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 mb-6">
            Plan Your Perfect
            <span className="bg-gradient-to-r from-blue-600 to-emerald-500 bg-clip-text text-transparent">
              {" "}
              Trip Route
            </span>
          </h1>
          <p className="text-base sm:text-lg lg:text-xl text-gray-600 max-w-2xl mx-auto mb-8 sm:mb-10 px-1">
            Create detailed travel routes on an interactive map. Discover
            attractions, find restaurants, book stays, and plan every detail of
            your journey.
          </p>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4 w-full sm:w-auto max-w-sm sm:max-w-none mx-auto">
            <Link href="/auth/register" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto text-base sm:text-lg px-6 sm:px-8 py-6 min-h-12 touch-manipulation">
                Start Planning
              </Button>
            </Link>
            <Link href="/auth/login" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:w-auto text-base sm:text-lg px-6 sm:px-8 py-6 min-h-12 touch-manipulation">
                Sign In
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
              Everything you need to plan your trip
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              From route planning to discovering local gems, we&apos;ve got all
              the tools you need.
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

      {/* CTA */}
      <section className="py-20 px-4 bg-gradient-to-r from-blue-600 to-emerald-600">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
            Ready to explore?
          </h2>
          <p className="text-lg text-blue-100 mb-8">
            Join thousands of travelers who plan their trips with us. It&apos;s
            free to get started.
          </p>
          <Link href="/auth/register">
            <Button
              size="lg"
              variant="secondary"
              className="text-lg px-8 py-6"
            >
              Create Free Account
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
