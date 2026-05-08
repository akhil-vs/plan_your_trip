"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { TripCardHeaderImage } from "@/components/dashboard/TripCardHeaderImage";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import {
  Building2,
  Camera,
  MapPin,
  Route,
  Trash2,
  Clock,
  MoreVertical,
  Share2,
  FileDown,
  Users2,
  Globe,
  Heart,
  Landmark,
  Leaf,
  Loader2,
  Mountain,
  PartyPopper,
  Plane,
  Snowflake,
  Sparkles,
  Star,
  Sun,
  Utensils,
  Wallet,
} from "lucide-react";

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      width={16}
      height={16}
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      width={16}
      height={16}
    >
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

interface Trip {
  id: string;
  name: string;
  description: string | null;
  status: "DRAFT" | "FINALIZED";
  isPublic: boolean;
  shareId: string;
  createdAt: string;
  updatedAt: string;
  members?: { role: "OWNER" | "EDITOR" | "VIEWER" }[];
  user?: { id?: string; name: string | null };
  waypoints: { id: string; name: string; lat: number; lng: number; order: number }[];
  _count: { savedPlaces: number; members?: number };
}

interface TripTemplate {
  id: string;
  name: string;
  description: string | null;
  updatedAt: string;
  waypoints: { id: string; name: string; lat: number; lng: number; order: number }[];
}

type DashboardView = "itineraries" | "published" | "collaborators" | "shared" | "archive" | "explore";

const travelVibes = [
  { label: "Beach Escapes", description: "Slow mornings, blue water, and sunset dinners.", icon: Sun },
  { label: "Adventure Trips", description: "Road trips, hikes, viewpoints, and bold detours.", icon: Mountain },
  { label: "Food & Culture", description: "Markets, local kitchens, art, and neighborhood walks.", icon: Utensils },
  { label: "City Breaks", description: "Design hotels, museums, shopping, and nightlife.", icon: Building2 },
  { label: "Romantic Getaways", description: "Scenic stays, intimate restaurants, and golden-hour plans.", icon: Heart },
  { label: "Nightlife & Social", description: "Rooftops, live music, festivals, and late-night energy.", icon: PartyPopper },
  { label: "Nature & Wellness", description: "Forests, spas, quiet trails, and restorative escapes.", icon: Leaf },
  { label: "Budget Backpacking", description: "Hostels, street food, trains, and flexible routes.", icon: Wallet },
  { label: "Historical Journeys", description: "Ancient streets, temples, ruins, and layered stories.", icon: Landmark },
  { label: "Winter Escapes", description: "Snow towns, northern lights, hot springs, and ski days.", icon: Snowflake },
];

const trendingDestinations = [
  {
    name: "Tokyo, Japan",
    tagline: "Neon nights, quiet temples, and one of the world’s best food scenes.",
    budget: "Premium",
    budgetDetails: "Hotels and restaurants can run high, but trains, convenience meals, and neighborhood stays keep it flexible.",
    season: "Mar-May",
    seasonDetails: "Spring brings mild walking weather and cherry blossoms. Autumn is a strong alternative for clear skies and color.",
    duration: "7 days",
    durationDetails: "A week gives you time for Tokyo highlights, deeper neighborhoods, and a day trip to Hakone or Nikko.",
    activities: ["Food", "Temples", "Nightlife", "Shopping"],
    categories: ["Food", "Culture", "City"],
    bestFor: ["First-time Asia travelers", "Food lovers", "Culture seekers"],
    route: "Tokyo -> Hakone -> Kyoto",
    dailySpend: "$180-300/day",
    whyNow: "High demand for spring and autumn Japan trips makes it a strong inspiration pick.",
    planDays: [
      {
        title: "Tokyo icons and neon",
        summary: "Start with classic Tokyo views, old temples, and Shibuya energy.",
        stops: [
          { name: "Senso-ji Temple", lat: 35.7148, lng: 139.7967, category: "temple" },
          { name: "Tokyo Skytree", lat: 35.71, lng: 139.8107, category: "viewpoint" },
          { name: "Shibuya Crossing", lat: 35.6595, lng: 139.7005, category: "neighborhood" },
        ],
      },
      {
        title: "Food, gardens, and nightlife",
        summary: "Mix market bites, calm gardens, and an atmospheric evening in Shinjuku.",
        stops: [
          { name: "Tsukiji Outer Market", lat: 35.6655, lng: 139.7707, category: "food" },
          { name: "Hamarikyu Gardens", lat: 35.6606, lng: 139.7634, category: "park" },
          { name: "Golden Gai", lat: 35.6938, lng: 139.7046, category: "nightlife" },
        ],
      },
      {
        title: "Hakone mountain escape",
        summary: "Leave the city for lake views, hot springs, and Mount Fuji scenery.",
        stops: [
          { name: "Hakone Shrine", lat: 35.2049, lng: 139.0251, category: "shrine" },
          { name: "Lake Ashi", lat: 35.2087, lng: 139.0016, category: "nature" },
          { name: "Owakudani Valley", lat: 35.2445, lng: 139.0198, category: "viewpoint" },
        ],
      },
      {
        title: "Kyoto temples and lanes",
        summary: "Begin Kyoto with orange gates, historic streets, and evening alleys.",
        stops: [
          { name: "Fushimi Inari Taisha", lat: 34.9671, lng: 135.7727, category: "shrine" },
          { name: "Kiyomizu-dera", lat: 34.9949, lng: 135.785, category: "temple" },
          { name: "Pontocho Alley", lat: 35.0062, lng: 135.7706, category: "food" },
        ],
      },
      {
        title: "Arashiyama and zen Kyoto",
        summary: "Spend the day around bamboo paths, river views, and zen gardens.",
        stops: [
          { name: "Arashiyama Bamboo Grove", lat: 35.017, lng: 135.671, category: "nature" },
          { name: "Tenryu-ji Temple", lat: 35.0159, lng: 135.6742, category: "temple" },
          { name: "Kinkaku-ji", lat: 35.0394, lng: 135.7292, category: "temple" },
        ],
      },
      {
        title: "Osaka food night",
        summary: "Move to Osaka for castle history and a street-food evening.",
        stops: [
          { name: "Osaka Castle", lat: 34.6873, lng: 135.5262, category: "historic" },
          { name: "Kuromon Ichiba Market", lat: 34.6653, lng: 135.5062, category: "food" },
          { name: "Dotonbori", lat: 34.6687, lng: 135.5013, category: "nightlife" },
        ],
      },
      {
        title: "Modern Osaka finale",
        summary: "Close with skyline views, shopping, and a relaxed final meal.",
        stops: [
          { name: "Umeda Sky Building", lat: 34.7053, lng: 135.4896, category: "viewpoint" },
          { name: "Shinsaibashi", lat: 34.6747, lng: 135.501, category: "shopping" },
          { name: "Namba Yasaka Shrine", lat: 34.6619, lng: 135.4964, category: "shrine" },
        ],
      },
    ],
  },
  {
    name: "Bali, Indonesia",
    tagline: "Beach clubs, rice terraces, wellness retreats, and slow island mornings.",
    budget: "Mid-range",
    budgetDetails: "Great value across villas, cafes, drivers, and spa experiences, with luxury upgrades easy to add.",
    season: "May-Sep",
    seasonDetails: "Dry season is best for beaches, surfing, sunrise hikes, and outdoor temples.",
    duration: "5 days",
    durationDetails: "Five days is enough to pair Ubud with Canggu, Seminyak, Uluwatu, or Nusa Penida.",
    activities: ["Beaches", "Wellness", "Surf", "Cafes"],
    categories: ["Beach", "Wellness", "Budget"],
    bestFor: ["Couples", "Remote workers", "Wellness travelers"],
    route: "Ubud -> Canggu -> Uluwatu",
    dailySpend: "$70-160/day",
    whyNow: "Bali continues to trend for relaxed, affordable, experience-heavy trips.",
    planDays: [
      {
        title: "Ubud culture and rice terraces",
        summary: "Ease into Bali with temples, terraces, and Ubud’s creative center.",
        stops: [
          { name: "Ubud Monkey Forest", lat: -8.5193, lng: 115.2606, category: "nature" },
          { name: "Tegallalang Rice Terrace", lat: -8.4317, lng: 115.2793, category: "viewpoint" },
          { name: "Ubud Palace", lat: -8.5069, lng: 115.2625, category: "culture" },
        ],
      },
      {
        title: "Waterfalls and wellness",
        summary: "Pair a waterfall morning with temple water rituals and a restorative afternoon.",
        stops: [
          { name: "Tegenungan Waterfall", lat: -8.5755, lng: 115.2897, category: "nature" },
          { name: "Tirta Empul Temple", lat: -8.415, lng: 115.3152, category: "temple" },
          { name: "Campuhan Ridge Walk", lat: -8.5042, lng: 115.2552, category: "walk" },
        ],
      },
      {
        title: "Canggu surf and cafes",
        summary: "Move west for surf culture, cafes, beach clubs, and sunset energy.",
        stops: [
          { name: "Batu Bolong Beach", lat: -8.6582, lng: 115.1306, category: "beach" },
          { name: "Echo Beach", lat: -8.6558, lng: 115.1269, category: "beach" },
          { name: "Tanah Lot Temple", lat: -8.6212, lng: 115.0868, category: "temple" },
        ],
      },
      {
        title: "Uluwatu cliffs",
        summary: "Follow the south coast for cliff views, surf beaches, and a sunset temple.",
        stops: [
          { name: "Padang Padang Beach", lat: -8.811, lng: 115.1026, category: "beach" },
          { name: "Uluwatu Temple", lat: -8.8291, lng: 115.0849, category: "temple" },
          { name: "Jimbaran Bay", lat: -8.7907, lng: 115.1593, category: "food" },
        ],
      },
      {
        title: "Nusa Penida day trip",
        summary: "End with dramatic island viewpoints and blue-water stops.",
        stops: [
          { name: "Kelingking Beach", lat: -8.7516, lng: 115.4737, category: "viewpoint" },
          { name: "Angel's Billabong", lat: -8.7338, lng: 115.4489, category: "nature" },
          { name: "Crystal Bay", lat: -8.7157, lng: 115.4541, category: "beach" },
        ],
      },
    ],
  },
  {
    name: "Amalfi Coast, Italy",
    tagline: "Cliffside villages, lemon groves, boat days, and long Italian dinners.",
    budget: "Luxury",
    budgetDetails: "Expect premium lodging and transport costs, especially in Positano and during peak summer.",
    season: "May-Jun",
    seasonDetails: "Early summer has warm weather and sea views before July and August crowds peak.",
    duration: "5 days",
    durationDetails: "Five days lets you enjoy Positano, Amalfi, Ravello, Capri, and slower coastal meals.",
    activities: ["Coast drives", "Dining", "Views", "Boats"],
    categories: ["Romantic", "Luxury", "Beach"],
    bestFor: ["Couples", "Luxury travelers", "Slow scenic trips"],
    route: "Naples -> Positano -> Ravello -> Capri",
    dailySpend: "$250-500/day",
    whyNow: "It is a dream-trip classic with strong appeal for romantic and premium itineraries.",
    planDays: [
      {
        title: "Naples arrival and Pompeii",
        summary: "Start with southern Italian flavor and one of the world’s most famous ruins.",
        stops: [
          { name: "Naples Historic Center", lat: 40.8518, lng: 14.2681, category: "historic" },
          { name: "Pompeii Archaeological Park", lat: 40.7484, lng: 14.4849, category: "historic" },
          { name: "Sorrento", lat: 40.6263, lng: 14.3758, category: "town" },
        ],
      },
      {
        title: "Positano coast day",
        summary: "Slow down in Positano with beach time, viewpoints, and coastal lanes.",
        stops: [
          { name: "Positano", lat: 40.6281, lng: 14.4849, category: "town" },
          { name: "Spiaggia Grande", lat: 40.626, lng: 14.488, category: "beach" },
          { name: "Fornillo Beach", lat: 40.6274, lng: 14.4819, category: "beach" },
        ],
      },
      {
        title: "Amalfi and Ravello",
        summary: "Explore cathedral history, gardens, and the coast’s grandest views.",
        stops: [
          { name: "Amalfi Cathedral", lat: 40.634, lng: 14.6027, category: "landmark" },
          { name: "Villa Rufolo", lat: 40.6495, lng: 14.6117, category: "garden" },
          { name: "Villa Cimbrone", lat: 40.6486, lng: 14.6128, category: "viewpoint" },
        ],
      },
      {
        title: "Capri by boat",
        summary: "Cross to Capri for sea caves, island lanes, and high viewpoints.",
        stops: [
          { name: "Marina Grande, Capri", lat: 40.5569, lng: 14.2429, category: "harbor" },
          { name: "Gardens of Augustus", lat: 40.5494, lng: 14.2442, category: "garden" },
          { name: "Anacapri", lat: 40.5557, lng: 14.2213, category: "town" },
        ],
      },
      {
        title: "Coastal finale",
        summary: "Close with a scenic hike, ceramics town, and a final sunset dinner.",
        stops: [
          { name: "Path of the Gods Trailhead", lat: 40.6236, lng: 14.5391, category: "hike" },
          { name: "Praiano", lat: 40.6129, lng: 14.5249, category: "town" },
          { name: "Vietri sul Mare", lat: 40.6728, lng: 14.7286, category: "town" },
        ],
      },
    ],
  },
  {
    name: "Dubai, UAE",
    tagline: "Skyline views, desert evenings, beach clubs, malls, and polished city energy.",
    budget: "Premium",
    budgetDetails: "Costs vary widely: luxury experiences are abundant, but taxis, metro, and casual food keep options open.",
    season: "Nov-Mar",
    seasonDetails: "Cooler months make desert trips, walking districts, beaches, and rooftop evenings comfortable.",
    duration: "4 days",
    durationDetails: "Four days covers modern Dubai, Old Dubai, a desert safari, and a beach or marina day.",
    activities: ["Skyline", "Desert", "Shopping", "Beach clubs"],
    categories: ["City", "Luxury", "Nightlife"],
    bestFor: ["Luxury travelers", "Stopovers", "Social trips"],
    route: "Downtown -> Old Dubai -> Desert -> Marina",
    dailySpend: "$160-350/day",
    whyNow: "Dubai works especially well as a compact premium escape or long stopover.",
    planDays: [
      {
        title: "Downtown skyline",
        summary: "Begin with Dubai’s signature towers, fountains, and city scale.",
        stops: [
          { name: "Burj Khalifa", lat: 25.1972, lng: 55.2744, category: "landmark" },
          { name: "Dubai Mall", lat: 25.1975, lng: 55.2796, category: "shopping" },
          { name: "Dubai Fountain", lat: 25.1952, lng: 55.2755, category: "show" },
        ],
      },
      {
        title: "Old Dubai and creek",
        summary: "Balance the modern skyline with markets, heritage lanes, and the creek.",
        stops: [
          { name: "Al Fahidi Historical Neighbourhood", lat: 25.2635, lng: 55.3003, category: "historic" },
          { name: "Dubai Gold Souk", lat: 25.2711, lng: 55.2973, category: "market" },
          { name: "Dubai Creek", lat: 25.2578, lng: 55.3117, category: "waterfront" },
        ],
      },
      {
        title: "Desert evening",
        summary: "Head out for dunes, desert viewpoints, and a golden-hour camp experience.",
        stops: [
          { name: "Dubai Desert Conservation Reserve", lat: 24.8195, lng: 55.6624, category: "desert" },
          { name: "Al Qudra Lakes", lat: 24.8352, lng: 55.3608, category: "nature" },
          { name: "Bab Al Shams Desert Resort", lat: 24.8212, lng: 55.2386, category: "dining" },
        ],
      },
      {
        title: "Marina and beach clubs",
        summary: "Finish with waterfront walks, palm views, and a polished beach evening.",
        stops: [
          { name: "Dubai Marina Walk", lat: 25.0802, lng: 55.1402, category: "waterfront" },
          { name: "Palm Jumeirah", lat: 25.1124, lng: 55.139, category: "landmark" },
          { name: "Jumeirah Beach Residence", lat: 25.075, lng: 55.1332, category: "beach" },
        ],
      },
    ],
  },
  {
    name: "Iceland Ring Road",
    tagline: "Waterfalls, black-sand beaches, glaciers, hot springs, and cinematic road days.",
    budget: "Premium",
    budgetDetails: "Car rental, fuel, food, and remote lodging make Iceland expensive, but nature access is unmatched.",
    season: "Jun-Sep",
    seasonDetails: "Long daylight and better road conditions make summer the easiest time for a full route.",
    duration: "7 days",
    durationDetails: "Seven days is a fast but workable loop. Ten days is more relaxed if you want deeper stops.",
    activities: ["Road trip", "Waterfalls", "Glaciers", "Hot springs"],
    categories: ["Adventure", "Nature", "Road trip"],
    bestFor: ["Adventure travelers", "Photographers", "Nature lovers"],
    route: "Reykjavik -> Vik -> Hofn -> Myvatn -> Akureyri",
    dailySpend: "$220-420/day",
    whyNow: "It is one of the strongest visual road-trip ideas for inspiration-led planning.",
    planDays: [
      {
        title: "Reykjavik and Blue Lagoon",
        summary: "Arrive, reset in geothermal water, and ease into Iceland’s capital.",
        stops: [
          { name: "Hallgrimskirkja", lat: 64.1417, lng: -21.9266, category: "landmark" },
          { name: "Harpa Concert Hall", lat: 64.1503, lng: -21.9328, category: "architecture" },
          { name: "Blue Lagoon", lat: 63.8804, lng: -22.4495, category: "hot spring" },
        ],
      },
      {
        title: "Golden Circle",
        summary: "Trace Iceland’s classic inland loop of rift valleys, geysers, and falls.",
        stops: [
          { name: "Thingvellir National Park", lat: 64.2559, lng: -21.1295, category: "nature" },
          { name: "Geysir Geothermal Area", lat: 64.3137, lng: -20.3009, category: "geothermal" },
          { name: "Gullfoss Falls", lat: 64.3271, lng: -20.1211, category: "waterfall" },
        ],
      },
      {
        title: "South Coast waterfalls",
        summary: "Follow the ring road past waterfalls, cliffs, and black-sand beaches.",
        stops: [
          { name: "Seljalandsfoss", lat: 63.6156, lng: -19.9886, category: "waterfall" },
          { name: "Skogafoss", lat: 63.5321, lng: -19.5114, category: "waterfall" },
          { name: "Reynisfjara Black Sand Beach", lat: 63.4043, lng: -19.0446, category: "beach" },
        ],
      },
      {
        title: "Glacier lagoon",
        summary: "Head east for icebergs, glacier views, and a dramatic coastal drive.",
        stops: [
          { name: "Fjadrargljufur Canyon", lat: 63.7712, lng: -18.1725, category: "canyon" },
          { name: "Jokulsarlon Glacier Lagoon", lat: 64.0481, lng: -16.1791, category: "glacier" },
          { name: "Diamond Beach", lat: 64.0444, lng: -16.1777, category: "beach" },
        ],
      },
      {
        title: "Eastfjords road",
        summary: "Drive through quiet fjords, fishing towns, and mountain-backed coastal views.",
        stops: [
          { name: "Hofn", lat: 64.2539, lng: -15.2082, category: "town" },
          { name: "Djupivogur", lat: 64.6578, lng: -14.2856, category: "town" },
          { name: "Seydisfjordur", lat: 65.2609, lng: -14.0098, category: "town" },
        ],
      },
      {
        title: "Myvatn geothermal region",
        summary: "Explore lava fields, geothermal vents, and northern hot springs.",
        stops: [
          { name: "Lake Myvatn", lat: 65.6049, lng: -16.9961, category: "lake" },
          { name: "Hverir", lat: 65.6419, lng: -16.8089, category: "geothermal" },
          { name: "Myvatn Nature Baths", lat: 65.6314, lng: -16.8472, category: "hot spring" },
        ],
      },
      {
        title: "Akureyri and return",
        summary: "Close the loop through the north with waterfalls and a relaxed city stop.",
        stops: [
          { name: "Godafoss", lat: 65.6828, lng: -17.5502, category: "waterfall" },
          { name: "Akureyri Botanical Garden", lat: 65.6752, lng: -18.0983, category: "garden" },
          { name: "Akureyri Church", lat: 65.6809, lng: -18.0905, category: "landmark" },
        ],
      },
    ],
  },
  {
    name: "Kerala Backwaters",
    tagline: "Houseboats, coconut groves, tea hills, coastal food, and calm water routes.",
    budget: "Mid-range",
    budgetDetails: "Strong value for stays, food, drivers, and wellness, with premium resorts available.",
    season: "Oct-Mar",
    seasonDetails: "Cooler, drier months are best for houseboats, beaches, tea estates, and walking around towns.",
    duration: "5 days",
    durationDetails: "Five days can combine Kochi, Alleppey, and Munnar without feeling too rushed.",
    activities: ["Houseboats", "Food", "Wellness", "Tea hills"],
    categories: ["Wellness", "Nature", "Culture"],
    bestFor: ["Slow travelers", "Couples", "Wellness trips"],
    route: "Kochi -> Alleppey -> Munnar",
    dailySpend: "$60-150/day",
    whyNow: "Kerala is ideal for travelers looking beyond obvious beach or city breaks.",
    planDays: [
      {
        title: "Fort Kochi heritage",
        summary: "Start with colonial lanes, seaside nets, galleries, and coastal food.",
        stops: [
          { name: "Chinese Fishing Nets", lat: 9.9656, lng: 76.2422, category: "landmark" },
          { name: "Mattancherry Palace", lat: 9.9577, lng: 76.2591, category: "historic" },
          { name: "Jew Town", lat: 9.9572, lng: 76.2597, category: "neighborhood" },
        ],
      },
      {
        title: "Alleppey backwaters",
        summary: "Move into the backwaters for canals, houseboats, and slow village scenery.",
        stops: [
          { name: "Alappuzha Beach", lat: 9.4981, lng: 76.3177, category: "beach" },
          { name: "Punnamada Lake", lat: 9.5696, lng: 76.3832, category: "lake" },
          { name: "Kuttanad Backwaters", lat: 9.4077, lng: 76.4126, category: "backwaters" },
        ],
      },
      {
        title: "Houseboat and village life",
        summary: "Dedicate a calmer day to houseboat views, local food, and water villages.",
        stops: [
          { name: "Kumarakom Backwaters", lat: 9.6175, lng: 76.4301, category: "backwaters" },
          { name: "Pathiramanal Island", lat: 9.6158, lng: 76.3864, category: "nature" },
          { name: "Marari Beach", lat: 9.601, lng: 76.2961, category: "beach" },
        ],
      },
      {
        title: "Munnar tea hills",
        summary: "Climb into the hills for tea estates, viewpoints, and cooler air.",
        stops: [
          { name: "Munnar Tea Museum", lat: 10.0889, lng: 77.0595, category: "museum" },
          { name: "Pothamedu View Point", lat: 10.0657, lng: 77.0414, category: "viewpoint" },
          { name: "Attukad Waterfalls", lat: 10.0654, lng: 77.0173, category: "waterfall" },
        ],
      },
      {
        title: "Munnar nature finale",
        summary: "End with lake views, high viewpoints, and the region’s most scenic landscapes.",
        stops: [
          { name: "Mattupetty Dam", lat: 10.106, lng: 77.1236, category: "lake" },
          { name: "Top Station", lat: 10.1211, lng: 77.2469, category: "viewpoint" },
          { name: "Eravikulam National Park", lat: 10.1974, lng: 77.0078, category: "nature" },
        ],
      },
    ],
  },
];

const trendingFilters = ["All", "Beach", "Culture", "Food", "Adventure", "Luxury", "Wellness", "Budget"];

function parseDurationDays(duration: string) {
  const match = duration.match(/\d+/);
  return match ? Number.parseInt(match[0], 10) : 3;
}

const featuredItineraries = [
  {
    title: "7 Days in Japan",
    route: "Tokyo -> Kyoto -> Osaka",
    summary: "Food, temples, nightlife, and culture for a first Japan trip.",
  },
  {
    title: "European Summer Escape",
    route: "Paris -> Amsterdam -> Prague",
    summary: "A classic first-time Europe route with beautiful city contrasts.",
  },
  {
    title: "Himalayan Adventure",
    route: "Leh -> Nubra -> Pangong",
    summary: "High-altitude road trips, mountain stays, camping, and clear skies.",
  },
];

const travelMoods = [
  "Relaxed & peaceful",
  "Adventurous & wild",
  "Inspired & creative",
  "Luxurious & exclusive",
  "Social & energetic",
  "Offbeat & explorative",
];

const hiddenGems = [
  "Chefchaouen, Morocco",
  "Hallstatt, Austria",
  "Gokarna, India",
  "Faroe Islands",
  "Luang Prabang, Laos",
];

const seasonalPicks = [
  { title: "Summer Escapes", places: "Greek Islands, Bali, Maldives" },
  { title: "Winter Adventures", places: "Lapland, Switzerland, Iceland" },
  { title: "Monsoon Retreats", places: "Kerala, Vietnam, Bali" },
];

export default function DashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [myTrips, setMyTrips] = useState<Trip[]>([]);
  const [publicTrips, setPublicTrips] = useState<Trip[]>([]);
  const [templates, setTemplates] = useState<TripTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [templateLoadingId, setTemplateLoadingId] = useState<string | null>(null);
  const [trendingFilter, setTrendingFilter] = useState("All");
  const [selectedTrendingName, setSelectedTrendingName] = useState(trendingDestinations[0]?.name ?? "");
  const [generatingTrendingName, setGeneratingTrendingName] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user) return;

    let cancelled = false;

    fetch("/api/account/me")
      .then((res) => {
        if (!res.ok) {
          if (!cancelled) setLoading(false);
          return null;
        }
        return res.json();
      })
      .then((me) => {
        if (cancelled || me === null) return;
        if (me.onboardingComplete === false) {
          router.replace("/onboarding");
          setLoading(false);
          return;
        }
        return fetch("/api/trips")
          .then((res) => {
            if (!res.ok) throw new Error("Failed to fetch");
            return res.json();
          })
          .then((data) => {
            if (cancelled) return;
            if (Array.isArray(data)) {
              setMyTrips(data);
              setPublicTrips([]);
            } else {
              setMyTrips(Array.isArray(data?.myTrips) ? data.myTrips : []);
              setPublicTrips(Array.isArray(data?.publicTrips) ? data.publicTrips : []);
            }
            setLoading(false);
          });
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    fetch("/api/templates")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!cancelled) setTemplates(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setTemplates([]);
      });

    return () => {
      cancelled = true;
    };
  }, [session, router]);

  const handleDelete = async (tripId: string) => {
    if (!confirm("Are you sure you want to delete this trip?")) return;

    await fetch(`/api/trips/${tripId}`, { method: "DELETE" });
    setMyTrips((prev) => prev.filter((t) => t.id !== tripId));
  };

  const handleSaveTemplate = async (e: React.MouseEvent, tripId: string) => {
    e.stopPropagation();
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tripId }),
    });
    if (!res.ok) {
      toast.error("Could not save template");
      return;
    }
    const template = await res.json();
    setTemplates((prev) => [template, ...prev]);
    toast.success("Saved as template");
  };

  const handleUseTemplate = async (templateId: string) => {
    setTemplateLoadingId(templateId);
    const res = await fetch(`/api/templates/${templateId}/use`, { method: "POST" });
    if (!res.ok) {
      setTemplateLoadingId(null);
      return;
    }
    const trip = await res.json();
    router.push(`/planner/${trip.id}`);
  };

  const handleGenerateTrendingTrip = async (destination: (typeof trendingDestinations)[number]) => {
    const days = parseDurationDays(destination.duration);
    setGeneratingTrendingName(destination.name);
    try {
      const res = await fetch("/api/trips/generate-from-destination", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: destination.name,
          days,
          pace: "moderate",
          rankingStyle: destination.categories.includes("Adventure") ? "best_spread" : "most_popular",
          interests: destination.activities,
          presetPlan: {
            name: `${destination.name} · ${destination.duration}`,
            description: `${destination.tagline} Route: ${destination.route}.`,
            days: destination.planDays,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data?.error === "string" ? data.error : "Could not create this itinerary.");
        return;
      }
      const tripId = data?.trip?.id as string | undefined;
      if (!tripId) {
        toast.error("Unexpected response from server.");
        return;
      }
      toast.success(`${destination.name} itinerary created.`);
      router.push(`/planner/${tripId}`);
      router.refresh();
    } catch {
      toast.error("Network error. Try again.");
    } finally {
      setGeneratingTrendingName(null);
    }
  };

  const getTripShareUrl = async (tripId: string) => {
    const res = await fetch(`/api/trips/${tripId}/share`, { method: "POST" });
    if (!res.ok) throw new Error("Failed to generate share link");
    const data = await res.json();
    return data.shareUrl as string;
  };

  const handleCopyLink = async (e: React.MouseEvent, tripId: string) => {
    e.stopPropagation();
    try {
      const url = await getTripShareUrl(tripId);
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied to clipboard");
    } catch {
      toast.error("Could not copy link");
    }
  };

  const handleShareWhatsApp = (e: React.MouseEvent, tripId: string) => {
    e.stopPropagation();
    getTripShareUrl(tripId)
      .then((url) => {
        const text = `Check out my trip plan: ${url}`;
        window.open(
          `https://wa.me/?text=${encodeURIComponent(text)}`,
          "_blank",
          "noopener,noreferrer"
        );
      })
      .catch(() => {});
  };

  const handleShareFacebook = (e: React.MouseEvent, tripId: string) => {
    e.stopPropagation();
    getTripShareUrl(tripId)
      .then((url) => {
        window.open(
          `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
          "_blank",
          "noopener,noreferrer,width=600,height=400"
        );
      })
      .catch(() => {});
  };

  const handleExportPdf = (e: React.MouseEvent, tripId: string) => {
    e.stopPropagation();
    window.open(`/api/trips/${tripId}/export/pdf`, "_blank", "noopener,noreferrer");
  };

  const canManageVisibility = (trip: Trip) => {
    return trip.members?.[0]?.role === "OWNER";
  };

  const handleToggleVisibility = async (e: React.MouseEvent, trip: Trip) => {
    e.stopPropagation();
    if (!canManageVisibility(trip)) return;
    const method = trip.isPublic ? "DELETE" : "POST";
    const res = await fetch(`/api/trips/${trip.id}/publish`, { method });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      toast.error(data?.error || "Failed to update itinerary visibility");
      return;
    }
    setMyTrips((prev) =>
      prev.map((item) =>
        item.id === trip.id ? { ...item, isPublic: Boolean(data?.isPublic) } : item
      )
    );
    toast.success(
      data?.isPublic ? "Itinerary is now public" : "Itinerary is now private"
    );
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const currentViewParam = searchParams.get("view");
  const currentView: DashboardView = (
    currentViewParam &&
    ["itineraries", "published", "collaborators", "shared", "archive", "explore"].includes(
      currentViewParam
    )
      ? currentViewParam
      : "itineraries"
  ) as DashboardView;

  const showPlaceholderView = ["collaborators", "shared", "archive"].includes(currentView);
  const filteredTrendingDestinations =
    trendingFilter === "All"
      ? trendingDestinations
      : trendingDestinations.filter((destination) => destination.categories.includes(trendingFilter));
  const selectedTrendingDestination =
    filteredTrendingDestinations.find((destination) => destination.name === selectedTrendingName) ??
    filteredTrendingDestinations[0] ??
    trendingDestinations[0];

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8 xl:px-10">
        <div className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">
            {currentView === "published"
              ? "Published Itineraries"
              : currentView === "collaborators"
                ? "Collaborators"
                : currentView === "shared"
                  ? "Shared Itineraries"
                  : currentView === "archive"
                    ? "Archive"
                    : currentView === "explore"
                      ? "Explore the world your way"
                      : "Your Itineraries"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {currentView === "published"
              ? "Browse itineraries that are visible to everyone."
              : currentView === "collaborators"
                ? "Manage people and permissions for group planning."
                : currentView === "shared"
                  ? "Trips shared with you will appear here."
                  : currentView === "archive"
                    ? "Archived trips can be restored whenever you need them."
                    : currentView === "explore"
                      ? "Discover trending destinations, hidden gems, and AI-curated travel ideas tailored to your travel style."
                      : "Only itineraries you own or are invited to appear here—your private plans stay yours."}
          </p>
        </div>

        {showPlaceholderView && (
          <Card className="mb-10">
            <CardHeader>
              <CardTitle>
                {currentView === "collaborators"
                  ? "Collaboration hub coming soon"
                  : currentView === "shared"
                    ? "Shared itinerary view coming soon"
                    : currentView === "archive"
                      ? "Archive view coming soon"
                      : "Explore hub coming soon"}
              </CardTitle>
              <CardDescription>
                {currentView === "collaborators"
                  ? "You will see teammate roles, pending invites, and collaboration activity here."
                  : currentView === "shared"
                    ? "Itineraries that other travelers share with you will be organized in this section."
                    : currentView === "archive"
                      ? "Archived itineraries will live here, with quick restore actions."
                      : "Destination inspiration and discovery tools will appear in this section."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/dashboard?view=itineraries">
                <Button size="sm">Back to My Trips</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {currentView === "explore" && (
          <div className="space-y-10">
            <section className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 text-white shadow-sm">
              <div className="relative px-6 py-8 sm:px-8 lg:px-10 lg:py-12">
                <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-cyan-400/20 blur-3xl" />
                <div className="absolute bottom-0 right-24 h-40 w-40 rounded-full bg-indigo-400/20 blur-3xl" />
                <div className="relative max-w-3xl">
                  <Badge className="mb-4 bg-white/10 text-white hover:bg-white/10">
                    <Sparkles className="mr-1 h-3.5 w-3.5" />
                    AI-powered inspiration
                  </Badge>
                  <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">
                    Discover inspiration for your next journey
                  </h2>
                  <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
                    Explore trending destinations, hidden gems, and curated travel experiences tailored to your vibe.
                    From relaxing beach escapes to adventure-packed road trips, find ideas that turn into unforgettable
                    itineraries.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link href="/dashboard/generate">
                      <Button className="rounded-xl bg-white text-slate-950 hover:bg-slate-100">
                        Plan with AI
                      </Button>
                    </Link>
                    <a href="#travel-vibes">
                      <Button
                        variant="outline"
                        className="rounded-xl border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                      >
                        Start exploring
                      </Button>
                    </a>
                  </div>
                </div>
              </div>
            </section>

            <section id="travel-vibes">
              <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900">Choose your travel vibe</h2>
                  <p className="text-sm text-muted-foreground">
                    Pick a style and discover destinations tailored to how you love to travel.
                  </p>
                </div>
                <Link href="/dashboard/generate" className="text-sm font-medium text-indigo-700 hover:text-indigo-900">
                  Generate a custom itinerary
                </Link>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {travelVibes.map((vibe) => {
                  const Icon = vibe.icon;
                  return (
                    <Link key={vibe.label} href="/dashboard/generate" className="group">
                      <Card className="h-full border-slate-200 bg-white transition-all hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md">
                        <CardContent className="p-4">
                          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 transition-colors group-hover:bg-indigo-600 group-hover:text-white">
                            <Icon className="h-5 w-5" />
                          </div>
                          <p className="font-semibold text-slate-900">{vibe.label}</p>
                          <p className="mt-1 text-sm text-slate-500">{vibe.description}</p>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </section>

            <section>
              <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900">Trending right now</h2>
                  <p className="text-sm text-muted-foreground">
                    Click a destination to expand season, duration, budget, route, and activity insights.
                  </p>
                </div>
                <Badge variant="outline" className="w-fit">
                  Updated for inspiration
                </Badge>
              </div>
              <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
                {trendingFilters.map((filter) => (
                  <Button
                    key={filter}
                    type="button"
                    size="sm"
                    variant={trendingFilter === filter ? "default" : "outline"}
                    className="shrink-0 rounded-full"
                    onClick={() => setTrendingFilter(filter)}
                  >
                    {filter}
                  </Button>
                ))}
              </div>
              <div className="flex snap-x gap-4 overflow-x-auto pb-2">
                {filteredTrendingDestinations.map((destination) => (
                  <button
                    key={destination.name}
                    type="button"
                    onClick={() => setSelectedTrendingName(destination.name)}
                    className={cn(
                      "min-w-[280px] snap-start rounded-xl text-left transition-all",
                      selectedTrendingDestination?.name === destination.name
                        ? "ring-2 ring-indigo-500 ring-offset-2"
                        : "hover:-translate-y-0.5"
                    )}
                  >
                    <Card className="h-full overflow-hidden border-slate-200">
                    <div className="h-28 bg-gradient-to-br from-indigo-500 via-sky-500 to-emerald-400 p-4 text-white">
                      <MapPin className="mb-6 h-5 w-5" />
                      <p className="text-lg font-bold">{destination.name}</p>
                    </div>
                    <CardContent className="space-y-4 p-4">
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <p className="text-slate-400">Budget</p>
                          <p className="font-semibold text-slate-800">{destination.budget}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Season</p>
                          <p className="font-semibold text-slate-800">{destination.season}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Trip</p>
                          <p className="font-semibold text-slate-800">{destination.duration}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {destination.activities.map((activity) => (
                          <Badge key={activity} variant="secondary" className="rounded-full">
                            {activity}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                  </button>
                ))}
              </div>
              {selectedTrendingDestination && (
                <Card className="mt-5 overflow-hidden border-indigo-100 bg-gradient-to-br from-white to-indigo-50/50 shadow-sm">
                  <CardContent className="grid gap-6 p-5 lg:grid-cols-[1.1fr_0.9fr] lg:p-6">
                    <div>
                      <Badge className="mb-3 w-fit bg-indigo-100 text-indigo-700 hover:bg-indigo-100">
                        Expanded insight
                      </Badge>
                      <h3 className="text-2xl font-bold tracking-tight text-slate-900">
                        {selectedTrendingDestination.name}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {selectedTrendingDestination.tagline}
                      </p>
                      <div className="mt-5 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Budget</p>
                          <p className="mt-1 font-semibold text-slate-900">{selectedTrendingDestination.budget}</p>
                          <p className="mt-1 text-xs text-slate-500">{selectedTrendingDestination.dailySpend}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Best season</p>
                          <p className="mt-1 font-semibold text-slate-900">{selectedTrendingDestination.season}</p>
                          <p className="mt-1 text-xs text-slate-500">Best weather window</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Duration</p>
                          <p className="mt-1 font-semibold text-slate-900">{selectedTrendingDestination.duration}</p>
                          <p className="mt-1 text-xs text-slate-500">Suggested trip length</p>
                        </div>
                      </div>
                      <div className="mt-5 grid gap-4 sm:grid-cols-2">
                        <div>
                          <p className="font-semibold text-slate-900">Why now</p>
                          <p className="mt-1 text-sm leading-6 text-slate-600">{selectedTrendingDestination.whyNow}</p>
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">Suggested route</p>
                          <p className="mt-1 text-sm leading-6 text-slate-600">{selectedTrendingDestination.route}</p>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="font-semibold text-slate-900">Season explained</p>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          {selectedTrendingDestination.seasonDetails}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="font-semibold text-slate-900">Budget explained</p>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          {selectedTrendingDestination.budgetDetails}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="font-semibold text-slate-900">Duration explained</p>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          {selectedTrendingDestination.durationDetails}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="font-semibold text-slate-900">Best for</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {selectedTrendingDestination.bestFor.map((item) => (
                            <Badge key={item} variant="outline" className="rounded-full">
                              {item}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <Button
                        className="w-full rounded-xl"
                        disabled={generatingTrendingName === selectedTrendingDestination.name}
                        onClick={() => void handleGenerateTrendingTrip(selectedTrendingDestination)}
                      >
                        {generatingTrendingName === selectedTrendingDestination.name ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Generating itinerary...
                          </>
                        ) : (
                          <>
                            Plan this trip with AI
                            <Sparkles className="ml-2 h-4 w-4" />
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </section>

            <section className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
              <div>
                <div className="mb-4">
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900">Featured AI itineraries</h2>
                  <p className="text-sm text-muted-foreground">
                    Ready-to-imagine routes that move naturally into Viazo planning.
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  {featuredItineraries.map((itinerary) => (
                    <Card key={itinerary.title} className="border-slate-200">
                      <CardHeader>
                        <CardTitle className="text-base">{itinerary.title}</CardTitle>
                        <CardDescription>{itinerary.route}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <p className="text-sm text-slate-600">{itinerary.summary}</p>
                        <Link href="/dashboard/generate">
                          <Button size="sm" className="w-full rounded-xl">
                            Generate similar
                          </Button>
                        </Link>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              <Card className="border-slate-200 bg-gradient-to-br from-amber-50 to-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Star className="h-5 w-5 text-amber-500" />
                    How do you want to feel?
                  </CardTitle>
                  <CardDescription>
                    Tell Viazo your vibe and let AI suggest destinations that match your energy.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {travelMoods.map((mood) => (
                    <Link key={mood} href="/dashboard/generate">
                      <Badge variant="outline" className="rounded-full bg-white px-3 py-1.5 text-sm hover:bg-amber-50">
                        {mood}
                      </Badge>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            </section>

            <section className="grid gap-6 lg:grid-cols-3">
              <Card className="border-slate-200 lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Camera className="h-5 w-5 text-indigo-600" />
                    Hidden gems travelers love
                  </CardTitle>
                  <CardDescription>
                    Go beyond tourist hotspots with unique destinations recommended by travelers and AI insights.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  {hiddenGems.map((gem) => (
                    <Link
                      key={gem}
                      href="/dashboard/generate"
                      className="rounded-2xl border border-slate-100 bg-slate-50 p-4 transition-colors hover:border-indigo-200 hover:bg-indigo-50"
                    >
                      <p className="font-semibold text-slate-900">{gem}</p>
                      <p className="mt-1 text-sm text-slate-500">Offbeat, memorable, and worth building around.</p>
                    </Link>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="text-lg">Best places this season</CardTitle>
                  <CardDescription>Seasonal sparks for your next itinerary.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {seasonalPicks.map((pick) => (
                    <div key={pick.title} className="rounded-2xl bg-slate-50 p-4">
                      <p className="font-semibold text-slate-900">{pick.title}</p>
                      <p className="mt-1 text-sm text-slate-500">{pick.places}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900">Trips travelers are sharing</h2>
                  <p className="text-sm text-muted-foreground">
                    Explore real itineraries and travel moments shared by the Viazo community.
                  </p>
                </div>
                <Link href="/dashboard?view=published">
                  <Button variant="outline" className="rounded-xl">
                    View all shared trips
                  </Button>
                </Link>
              </div>
              {publicTrips.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No public community trips yet. Publish one of your itineraries to help seed the inspiration loop.
                </p>
              ) : (
                <div className="grid gap-4 md:grid-cols-3">
                  {publicTrips.slice(0, 3).map((trip) => (
                    <Card
                      key={trip.id}
                      className="cursor-pointer overflow-hidden border-slate-200 p-0 transition-shadow hover:shadow-md"
                      onClick={() => router.push(`/share/${trip.shareId}`)}
                    >
                      <TripCardHeaderImage waypoints={trip.waypoints} label={trip.name} />
                      <CardHeader className="px-4 pt-4">
                        <CardTitle className="truncate text-base">{trip.name}</CardTitle>
                        <CardDescription className="line-clamp-2">
                          {trip.description || "Community-shared itinerary"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="px-4 pb-4 text-sm text-muted-foreground">
                        {trip.waypoints.length} stop{trip.waypoints.length !== 1 ? "s" : ""} by{" "}
                        {trip.user?.name?.trim() || "a traveler"}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-3xl bg-indigo-600 p-6 text-white shadow-sm sm:p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Ready to turn inspiration into a plan?</h2>
                  <p className="mt-1 text-indigo-100">
                    Choose a destination, travel style, and pace. Viazo will shape it into a day-by-day itinerary.
                  </p>
                </div>
                <Link href="/dashboard/generate">
                  <Button className="rounded-xl bg-white text-indigo-700 hover:bg-indigo-50">
                    Generate my itinerary
                    <Plane className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </section>
          </div>
        )}

        {!showPlaceholderView && currentView === "itineraries" && templates.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Templates</h2>
            <div className="grid md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
              {templates.map((template) => (
                <Card key={template.id} className="border-dashed">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base truncate">{template.name}</CardTitle>
                    {template.description && (
                      <CardDescription className="line-clamp-2">
                        {template.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-xs text-muted-foreground">
                      {template.waypoints.length} stop{template.waypoints.length !== 1 ? "s" : ""} ·
                      {" "}updated {formatDate(template.updatedAt)}
                    </div>
                    <Button
                      size="sm"
                      className="w-full"
                      disabled={templateLoadingId === template.id}
                      onClick={() => handleUseTemplate(template.id)}
                    >
                      {templateLoadingId === template.id ? "Creating itinerary..." : "Start from Template"}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {!showPlaceholderView && currentView === "itineraries" && (loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        ) : myTrips.length === 0 ? (
          <div className="py-8">
            <EmptyState
              icon={Route}
              title="No trips yet"
              description="Add stops on the map, build a day-by-day plan, then save or share. Start from a template or a blank itinerary."
              action={{ label: "Create your first itinerary", href: "/planner" }}
            />
            <div className="max-w-xl mx-auto mt-10 grid sm:grid-cols-3 gap-3 text-left">
              <div className="rounded-lg border bg-white p-3">
                <p className="text-xs font-semibold text-blue-700">1. Pick a starter</p>
                <p className="text-xs text-slate-600 mt-1">
                  Use a quick-start template or start blank.
                </p>
              </div>
              <div className="rounded-lg border bg-white p-3">
                <p className="text-xs font-semibold text-blue-700">2. Add key stops</p>
                <p className="text-xs text-slate-600 mt-1">
                  Add cities, attractions, and must-visit places.
                </p>
              </div>
              <div className="rounded-lg border bg-white p-3">
                <p className="text-xs font-semibold text-blue-700">3. Finalize & share</p>
                <p className="text-xs text-slate-600 mt-1">
                  Finalize your itinerary, export PDF, and invite collaborators.
                </p>
              </div>
            </div>
            {templates.length > 0 && (
              <p className="text-xs text-slate-600 text-center mt-6">
                You also have {templates.length} personal template
                {templates.length !== 1 ? "s" : ""} ready above.
              </p>
            )}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-6 mb-10">
            {myTrips.map((trip) => (
              <Card
                key={trip.id}
                className="group hover:shadow-lg transition-shadow cursor-pointer overflow-hidden flex flex-col p-0 gap-0"
                onClick={() => router.push(`/planner/${trip.id}`)}
              >
                <TripCardHeaderImage waypoints={trip.waypoints} label={trip.name} />
                <CardHeader className="pb-3 px-4 sm:px-6 pt-4">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-lg truncate">
                        {trip.name}
                      </CardTitle>
                      <div className="mt-1 flex items-center gap-1.5">
                        <Badge variant={trip.status === "FINALIZED" ? "default" : "secondary"}>
                          {trip.status === "FINALIZED" ? "Finalized" : "Draft"}
                        </Badge>
                        {trip.isPublic && <Badge variant="outline">Published</Badge>}
                        <Badge variant="outline" className="gap-1">
                          <Users2 className="h-3 w-3" />
                          {trip._count.members ?? 1}
                        </Badge>
                      </div>
                      {trip.description && (
                        <CardDescription className="mt-1 line-clamp-2">
                          {trip.description}
                        </CardDescription>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 touch-manipulation"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        sideOffset={8}
                        collisionPadding={12}
                        className="w-56"
                      >
                        <DropdownMenuItem
                          onClick={(e) => handleCopyLink(e, trip.id)}
                          disabled={!trip.isPublic}
                        >
                          <Share2 className="h-4 w-4 mr-2" />
                          Copy share link
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => handleShareWhatsApp(e, trip.id)}
                          disabled={!trip.isPublic}
                        >
                          <WhatsAppIcon className="h-4 w-4 mr-2" />
                          Share via WhatsApp
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => handleShareFacebook(e, trip.id)}
                          disabled={!trip.isPublic}
                        >
                          <FacebookIcon className="h-4 w-4 mr-2" />
                          Share on Facebook
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={(e) => handleToggleVisibility(e, trip)}
                          disabled={!canManageVisibility(trip)}
                        >
                          <Globe className="h-4 w-4 mr-2" />
                          {trip.isPublic ? "Make private" : "Make public"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={(e) => handleSaveTemplate(e, trip.id)}
                        >
                          <Route className="h-4 w-4 mr-2" />
                          Save as template
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={(e) => handleExportPdf(e, trip.id)}
                          disabled={trip.status !== "FINALIZED"}
                        >
                          <FileDown className="h-4 w-4 mr-2" />
                          Export itinerary PDF
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(trip.id);
                          }}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete itinerary
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="px-4 sm:px-6 pb-4">
                  <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {trip.waypoints.length} stop{trip.waypoints.length !== 1 ? "s" : ""}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {formatDate(trip.updatedAt)}
                    </div>
                  </div>
                  {trip.waypoints.length > 0 && (
                    <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                      {trip.waypoints.slice(0, 3).map((wp, i) => (
                        <span key={wp.id} className="flex items-center">
                          {i > 0 && <span className="mx-1">→</span>}
                          <span className="truncate max-w-[80px]">
                            {wp.name.split(",")[0]}
                          </span>
                        </span>
                      ))}
                      {trip.waypoints.length > 3 && (
                        <span className="text-gray-400">
                          +{trip.waypoints.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ))}

        {!showPlaceholderView && !loading && (currentView === "itineraries" || currentView === "published") && (
          <div className="border-t pt-8">
            <div className="mb-3">
              <h2 className="text-lg font-semibold text-gray-900">Published itineraries</h2>
              <p className="text-sm text-muted-foreground">
                Anyone can open these read-only plans. Yours also appear under Your Itineraries above.
              </p>
            </div>
            {publicTrips.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No other published itineraries yet. Publish a trip (make it public) to share it with everyone.
              </p>
            ) : (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-6">
                {publicTrips.map((trip) => (
                  <Card
                    key={trip.id}
                    className="group hover:shadow-lg transition-shadow cursor-pointer overflow-hidden flex flex-col p-0 gap-0"
                    onClick={() => router.push(`/share/${trip.shareId}`)}
                  >
                    <TripCardHeaderImage waypoints={trip.waypoints} label={trip.name} />
                    <CardHeader className="pb-3 px-4 sm:px-6 pt-4">
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-lg truncate">{trip.name}</CardTitle>
                        <div className="mt-1 flex items-center gap-1.5">
                          <Badge variant="outline">Published</Badge>
                          <Badge variant="outline" className="gap-1">
                            <Users2 className="h-3 w-3" />
                            {trip._count.members ?? 1}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          By {trip.user?.name?.trim() || "A traveler"}
                        </p>
                        <CardDescription className="mt-1 line-clamp-2">
                          {trip.description || "Community-shared itinerary"}
                        </CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 sm:px-6 pb-4">
                      <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {trip.waypoints.length} stop
                          {trip.waypoints.length !== 1 ? "s" : ""}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {formatDate(trip.updatedAt)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
          </div>
  );
}
