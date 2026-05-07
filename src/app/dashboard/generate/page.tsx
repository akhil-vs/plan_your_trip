"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  Loader2,
  MapPin,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { searchLocations, type SearchResult } from "@/lib/api/mapbox";
import { toast } from "@/lib/toast";

type Pace = "relaxed" | "moderate" | "packed";
type RankingStyle = "most_popular" | "best_spread" | "hidden_gems";

type Destination = {
  mapboxId?: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
};
type CandidateStop = {
  name: string;
  lat: number;
  lng: number;
  popularityScore?: number;
  category?: string;
};

const POPULAR_DESTINATIONS: Destination[] = [
  { name: "Paris", country: "France", lat: 48.8566, lng: 2.3522 },
  { name: "Rome", country: "Italy", lat: 41.9028, lng: 12.4964 },
  { name: "Barcelona", country: "Spain", lat: 41.3874, lng: 2.1686 },
  { name: "Amsterdam", country: "Netherlands", lat: 52.3676, lng: 4.9041 },
  { name: "Istanbul", country: "Turkey", lat: 41.0082, lng: 28.9784 },
  { name: "Dubai", country: "UAE", lat: 25.2048, lng: 55.2708 },
  { name: "Singapore", country: "Singapore", lat: 1.3521, lng: 103.8198 },
  { name: "Tokyo", country: "Japan", lat: 35.6762, lng: 139.6503 },
  { name: "New York", country: "USA", lat: 40.7128, lng: -74.006 },
  { name: "Bangkok", country: "Thailand", lat: 13.7563, lng: 100.5018 },
  { name: "Bali", country: "Indonesia", lat: -8.4095, lng: 115.1889 },
  { name: "Cape Town", country: "South Africa", lat: -33.9249, lng: 18.4241 },
];

const STREET_WORDS = [
  "street",
  "road",
  "rd",
  "st",
  "ave",
  "avenue",
  "highway",
  "blvd",
  "lane",
  "drive",
  "boulevard",
];

function looksLikeRoadName(v: string): boolean {
  const lower = v.toLowerCase();
  if (/\d/.test(lower) && STREET_WORDS.some((w) => lower.includes(` ${w}`))) return true;
  return STREET_WORDS.some((w) => lower === w || lower.endsWith(` ${w}`));
}

function toRad(v: number) {
  return (v * Math.PI) / 180;
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function destinationPreviewImage(name: string) {
  return `https://picsum.photos/seed/${encodeURIComponent(name)}/800/500`;
}

export default function GenerateTripPage() {
  const router = useRouter();
  const [days, setDays] = useState("3");
  const [pace, setPace] = useState<Pace>("moderate");
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [destination, setDestination] = useState<Destination | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [rankingStyle, setRankingStyle] = useState<RankingStyle>("most_popular");
  const [selectedStops, setSelectedStops] = useState<CandidateStop[]>([]);
  const [alternativeStops, setAlternativeStops] = useState<CandidateStop[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [hasManualSwaps, setHasManualSwaps] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        // ignore geolocation errors; we still show default popular list
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSuggesting(false);
      return;
    }
    const timer = setTimeout(async () => {
      setSuggesting(true);
      try {
        const rows = await searchLocations(q, userLocation ? { lng: userLocation.lng, lat: userLocation.lat } : undefined);
        const filtered = rows.filter((r) => !looksLikeRoadName(r.name)).slice(0, 8);
        setResults(filtered);
      } catch {
        setResults([]);
      } finally {
        setSuggesting(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, userLocation]);

  const popularByLocation = useMemo(() => {
    if (!userLocation) return POPULAR_DESTINATIONS.slice(0, 8);
    return [...POPULAR_DESTINATIONS]
      .sort(
        (a, b) =>
          haversineKm(userLocation, a) - haversineKm(userLocation, b)
      )
      .slice(0, 8);
  }, [userLocation]);

  const selectedLabel = destination?.name || query.trim();
  const selectedMapboxId = destination?.mapboxId;

  async function loadAreaSuggestions() {
    const n = Number.parseInt(days, 10);
    if (!selectedLabel || selectedLabel.length < 2 || !Number.isFinite(n) || n < 1 || n > 14) return;
    setLoadingPreview(true);
    try {
      const res = await fetch("/api/trips/generate-from-destination", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preview: true,
          ...(selectedMapboxId ? { mapboxId: selectedMapboxId } : { destination: selectedLabel }),
          days: n,
          pace,
          rankingStyle,
          ...(hasManualSwaps && selectedStops.length > 0 ? { selectedStops } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      setSelectedStops(Array.isArray(data?.selectedStops) ? data.selectedStops : []);
      setAlternativeStops(Array.isArray(data?.alternativeStops) ? data.alternativeStops : []);
      setSelectedIndex(0);
    } finally {
      setLoadingPreview(false);
    }
  }

  function swapWithAlternative(altIdx: number) {
    if (selectedStops.length === 0 || altIdx < 0 || altIdx >= alternativeStops.length) return;
    const nextSelected = [...selectedStops];
    const nextAlternative = [...alternativeStops];
    const temp = nextSelected[selectedIndex] ?? nextSelected[0];
    nextSelected[selectedIndex] = nextAlternative[altIdx];
    nextAlternative[altIdx] = temp;
    setSelectedStops(nextSelected);
    setAlternativeStops(nextAlternative);
    setHasManualSwaps(true);
  }

  useEffect(() => {
    if (!selectedLabel) return;
    const timer = setTimeout(() => {
      void loadAreaSuggestions();
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMapboxId, selectedLabel, days, pace, rankingStyle]);

  async function handleGenerate() {
    const n = Number.parseInt(days, 10);
    if (!selectedLabel || selectedLabel.length < 2) {
      toast.error("Choose a destination first.");
      return;
    }
    if (!Number.isFinite(n) || n < 1 || n > 14) {
      toast.error("Days must be between 1 and 14.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/trips/generate-from-destination", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(selectedMapboxId ? { mapboxId: selectedMapboxId } : { destination: selectedLabel }),
          days: n,
          pace,
          rankingStyle,
          ...(selectedStops.length > 0 ? { selectedStops } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data?.error === "string" ? data.error : "Could not generate itinerary.");
        return;
      }
      const tripId = data?.trip?.id as string | undefined;
      if (!tripId) {
        toast.error("Unexpected response from server.");
        return;
      }
      toast.success("Itinerary generated.");
      router.push(`/planner/${tripId}`);
      router.refresh();
    } catch {
      toast.error("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8 xl:px-10">
      <div className="mx-auto max-w-6xl">
        <section>
          <h1 className="flex items-center gap-2 text-5xl font-bold tracking-tight text-slate-900">
            <Sparkles className="h-8 w-8 text-amber-500" />
            Generate itinerary
          </h1>
          <p className="mt-3 max-w-3xl text-2xl leading-relaxed text-slate-700">
            Let our digital concierge curate an effortless travel experience. Define your preferences
            and watch your luxury itinerary unfold.
          </p>

          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="grid gap-4 lg:grid-cols-12">
              <div className="lg:col-span-5">
                <Label
                  htmlFor="destination-search"
                  className="text-xs font-semibold uppercase tracking-wider text-slate-700"
                >
                  Destination
                </Label>
                <Input
                  id="destination-search"
                  placeholder="Where do you want to go?"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setDestination(null);
                    setHasManualSwaps(false);
                  }}
                  className="mt-2 min-h-14 rounded-xl border-slate-300 px-4 text-lg"
                />
              </div>
              <div className="lg:col-span-2">
                <Label
                  htmlFor="days"
                  className="text-xs font-semibold uppercase tracking-wider text-slate-700"
                >
                  Duration (days)
                </Label>
                <Input
                  id="days"
                  type="number"
                  min={1}
                  max={14}
                  value={days}
                  onChange={(e) => {
                    setDays(e.target.value);
                    setHasManualSwaps(false);
                  }}
                  className="mt-2 min-h-14 rounded-xl border-slate-300 px-4 text-lg"
                />
              </div>
              <div className="lg:col-span-3">
                <Label
                  htmlFor="pace"
                  className="text-xs font-semibold uppercase tracking-wider text-slate-700"
                >
                  Travel pace
                </Label>
                <select
                  id="pace"
                  value={pace}
                  onChange={(e) => {
                    setPace(e.target.value as Pace);
                    setHasManualSwaps(false);
                  }}
                  className="mt-2 flex h-14 w-full rounded-xl border border-slate-300 bg-white px-4 text-lg"
                >
                  <option value="relaxed">Balanced Discovery</option>
                  <option value="moderate">Moderate Explorer</option>
                  <option value="packed">Packed Adventure</option>
                </select>
              </div>
            </div>

            <div className="mt-6">
              <Label className="mb-3 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Ranking style
              </Label>
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant={rankingStyle === "most_popular" ? "default" : "outline"}
                  className={cn(
                    "h-12 rounded-xl px-6 text-base",
                    rankingStyle === "most_popular" && "bg-[#031a45] text-white hover:bg-[#05235b]"
                  )}
                  onClick={() => {
                    setRankingStyle("most_popular");
                    setHasManualSwaps(false);
                  }}
                >
                  Most popular
                </Button>
                <Button
                  type="button"
                  variant={rankingStyle === "best_spread" ? "default" : "outline"}
                  className="h-12 rounded-xl px-6 text-base"
                  onClick={() => {
                    setRankingStyle("best_spread");
                    setHasManualSwaps(false);
                  }}
                >
                  Best spread
                </Button>
                <Button
                  type="button"
                  variant={rankingStyle === "hidden_gems" ? "default" : "outline"}
                  className="h-12 rounded-xl px-6 text-base"
                  onClick={() => {
                    setRankingStyle("hidden_gems");
                    setHasManualSwaps(false);
                  }}
                >
                  Hidden gems
                </Button>
              </div>
            </div>
          </div>

          {suggesting && <p className="mt-3 text-xs text-slate-500">Searching places...</p>}
          {results.length > 0 && (
            <div className="mt-3 overflow-hidden rounded-xl border bg-white">
              {results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setDestination({
                      mapboxId: r.id,
                      name: r.name,
                      country: "",
                      lat: r.lat ?? 0,
                      lng: r.lng ?? 0,
                    });
                    setQuery(r.name);
                    setResults([]);
                    setSelectedStops([]);
                    setAlternativeStops([]);
                    setHasManualSwaps(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-slate-50"
                >
                  <MapPin className="h-4 w-4 text-blue-600" />
                  <span className="min-w-0">
                    <span className="block truncate">{r.name}</span>
                    {r.fullName && r.fullName !== r.name ? (
                      <span className="block truncate text-xs text-slate-500">{r.fullName}</span>
                    ) : null}
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-800">Area coverage suggestions</h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadAreaSuggestions()}
              disabled={loadingPreview}
            >
              {loadingPreview ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
            </Button>
          </div>
          <p className="mb-3 text-xs text-slate-500">
            Selected points are used for the trip. Swap with alternatives to customize.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border p-3">
              <p className="mb-2 text-xs font-semibold text-slate-700">Selected points</p>
              <div className="max-h-52 space-y-1.5 overflow-auto">
                {selectedStops.map((s, idx) => (
                  <button
                    key={`${s.name}-${s.lat}-${s.lng}`}
                    type="button"
                    onClick={() => setSelectedIndex(idx)}
                    className={`w-full rounded-md border px-2.5 py-2 text-left text-sm ${
                      idx === selectedIndex ? "border-blue-500 bg-blue-50" : "border-slate-200"
                    }`}
                  >
                    <div className="truncate">{s.name}</div>
                    <div className="mt-0.5 truncate text-xs text-slate-500">
                      {typeof s.popularityScore === "number"
                        ? `Popularity ${s.popularityScore.toFixed(1)}`
                        : "Popularity n/a"}
                      {s.category ? ` • ${s.category.replace(/_/g, " ")}` : ""}
                    </div>
                  </button>
                ))}
                {selectedStops.length === 0 && (
                  <p className="text-xs text-slate-500">Pick destination to load.</p>
                )}
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <p className="mb-2 text-xs font-semibold text-slate-700">
                Popular alternatives in this area
              </p>
              <div className="max-h-52 space-y-1.5 overflow-auto">
                {alternativeStops.map((s, idx) => (
                  <div
                    key={`${s.name}-${s.lat}-${s.lng}`}
                    className="rounded-md border border-slate-200 px-2.5 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm text-slate-800">{s.name}</p>
                        <p className="truncate text-xs text-slate-500">
                          {typeof s.popularityScore === "number"
                            ? `Popularity ${s.popularityScore.toFixed(1)}`
                            : "Popularity n/a"}
                          {s.category ? ` • ${s.category.replace(/_/g, " ")}` : ""}
                        </p>
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={() => swapWithAlternative(idx)}>
                        Swap
                      </Button>
                    </div>
                  </div>
                ))}
                {alternativeStops.length === 0 && (
                  <p className="text-xs text-slate-500">No alternatives loaded yet.</p>
                )}
              </div>
            </div>
          </div>
          </div>

          <div className="mt-7 flex justify-end">
            <Button
              onClick={() => void handleGenerate()}
              disabled={loading}
              className="h-14 rounded-full bg-[#031a45] px-10 text-xl font-semibold text-white hover:bg-[#05235b]"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Generate itinerary
            </Button>
          </div>
        </section>

        <section className="mt-12">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <h2 className="text-4xl font-bold tracking-tight text-slate-900">Popular destinations</h2>
              <p className="mt-1 text-lg text-slate-600">
                Recommended cities near your current location or frequent searches.
              </p>
            </div>
            <button
              type="button"
              className="hidden items-center gap-1 text-sm font-semibold text-slate-700 md:flex"
            >
              View all
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {popularByLocation.map((d) => (
              <button
                key={`${d.name}-${d.country}`}
                type="button"
                onClick={() => {
                  setDestination(d);
                  setQuery(d.name);
                  setResults([]);
                  setSelectedStops([]);
                  setAlternativeStops([]);
                  setHasManualSwaps(false);
                }}
                className="overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <img
                  src={destinationPreviewImage(d.name)}
                  alt={`${d.name} preview`}
                  className="h-32 w-full object-cover"
                />
                <div className="p-3">
                  <p className="text-xl font-semibold text-slate-900">{d.name}</p>
                  <p className="text-sm text-slate-500">{d.country}</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
