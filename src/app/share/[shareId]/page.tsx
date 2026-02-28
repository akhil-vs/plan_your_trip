"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Route, Copy } from "lucide-react";

interface SharedTrip {
  name: string;
  description: string | null;
  shareId: string;
  updatedAt: string;
  user: { name: string | null };
  waypoints: { id: string; name: string; order: number }[];
  dayPlans: {
    day: number;
    waypointIndexes: number[];
    waypointIds?: string[];
    estimatedTravelMinutes: number;
  }[];
}

export default function SharedTripPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const shareId = params.shareId as string;

  const [trip, setTrip] = useState<SharedTrip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copying, setCopying] = useState(false);
  const [cloning, setCloning] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetch(`/api/public/trips/${shareId}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || "Failed to load shared itinerary");
        }
        return res.json();
      })
      .then((data: SharedTrip) => {
        if (!mounted) return;
        setTrip(data);
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to load shared itinerary");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [shareId]);

  const formattedDate = useMemo(() => {
    if (!trip) return "";
    return new Date(trip.updatedAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, [trip]);

  const handleCopy = async () => {
    setCopying(true);
    try {
      await navigator.clipboard.writeText(window.location.href);
    } finally {
      setTimeout(() => setCopying(false), 800);
    }
  };

  const handleClone = async () => {
    if (!session?.user) {
      router.push(`/auth/login?callbackUrl=${encodeURIComponent(`/share/${shareId}`)}`);
      return;
    }
    setCloning(true);
    try {
      const res = await fetch("/api/trips/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareId }),
      });
      if (!res.ok) throw new Error("Failed to save this itinerary");
      const data = await res.json();
      router.push(`/planner/${data.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save this itinerary");
      setCloning(false);
    }
  };

  const formatMinutes = (minutes: number) => {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hrs === 0) return `${mins}m`;
    if (mins === 0) return `${hrs}h`;
    return `${hrs}h ${mins}m`;
  };

  if (loading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading shared itinerary...</div>;
  }

  if (error || !trip) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">{error || "Shared itinerary not found"}</p>
        <Link href="/">
          <Button className="mt-4">Go Home</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Card>
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl">{trip.name}</CardTitle>
            <p className="text-sm text-muted-foreground">
              Shared by {trip.user?.name || "Traveler"} · Updated {formattedDate}
            </p>
            {trip.description && (
              <p className="text-sm text-muted-foreground">{trip.description}</p>
            )}
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-2 mb-5">
              <Button onClick={handleClone} disabled={cloning} className="gap-2">
                <Route className="h-4 w-4" />
                {cloning ? "Saving..." : "Save itinerary"}
              </Button>
              <Button variant="outline" onClick={handleCopy} className="gap-2">
                <Copy className="h-4 w-4" />
                {copying ? "Link copied" : "Copy share link"}
              </Button>
            </div>

            {trip.dayPlans?.length > 0 ? (
              <div className="space-y-3">
                {trip.dayPlans.map((dayPlan) => (
                  <div key={dayPlan.day} className="rounded-md border p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium">Day {dayPlan.day}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatMinutes(dayPlan.estimatedTravelMinutes)} travel
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      {dayPlan.waypointIndexes
                        .map((idx) => trip.waypoints[idx])
                        .filter(
                          (wp): wp is (typeof trip.waypoints)[number] => Boolean(wp)
                        )
                        .concat(
                          dayPlan.waypointIds && dayPlan.waypointIds.length > 0
                            ? dayPlan.waypointIds
                                .map((id) => trip.waypoints.find((wp) => wp.id === id))
                                .filter(
                                  (wp): wp is (typeof trip.waypoints)[number] => Boolean(wp)
                                )
                            : []
                        )
                        .filter(
                          (wp, idx, arr) =>
                            arr.findIndex((candidate) => candidate.id === wp.id) === idx
                        )
                        .map((wp, idx) => (
                          <div key={`${dayPlan.day}-${wp.id}-${idx}`} className="flex items-center text-sm">
                            <span className="w-6 text-muted-foreground">{idx + 1}.</span>
                            <MapPin className="h-3.5 w-3.5 mr-2 text-blue-600" />
                            <span>{wp.name}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {trip.waypoints.map((wp, idx) => (
                  <div key={wp.id} className="flex items-center text-sm">
                    <span className="w-6 text-muted-foreground">{idx + 1}.</span>
                    <MapPin className="h-3.5 w-3.5 mr-2 text-blue-600" />
                    <span>{wp.name}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
