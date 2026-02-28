"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import {
  MapPin,
  Plus,
  Route,
  Trash2,
  Clock,
  MoreVertical,
  LogOut,
  User,
  Share2,
  FileDown,
  Users2,
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

export default function DashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [templates, setTemplates] = useState<TripTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [templateLoadingId, setTemplateLoadingId] = useState<string | null>(null);

  useEffect(() => {
    if (session?.user) {
      fetch("/api/trips")
        .then((res) => {
          if (!res.ok) throw new Error("Failed to fetch");
          return res.json();
        })
        .then((data) => {
          setTrips(Array.isArray(data) ? data : []);
          setLoading(false);
        })
        .catch(() => setLoading(false));

      fetch("/api/templates")
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => setTemplates(Array.isArray(data) ? data : []))
        .catch(() => setTemplates([]));
    }
  }, [session]);

  const handleDelete = async (tripId: string) => {
    if (!confirm("Are you sure you want to delete this trip?")) return;

    await fetch(`/api/trips/${tripId}`, { method: "DELETE" });
    setTrips((prev) => prev.filter((t) => t.id !== tripId));
  };

  const handleSaveTemplate = async (e: React.MouseEvent, tripId: string) => {
    e.stopPropagation();
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tripId }),
    });
    if (!res.ok) return;
    const template = await res.json();
    setTemplates((prev) => [template, ...prev]);
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

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const getTripShareUrl = async (tripId: string) => {
    const res = await fetch(`/api/trips/${tripId}/share`, { method: "POST" });
    if (!res.ok) throw new Error("Failed to generate share link");
    const data = await res.json();
    return data.shareUrl as string;
  };

  const handleCopyLink = async (e: React.MouseEvent, tripId: string) => {
    e.stopPropagation();
    const url = await getTripShareUrl(tripId);
    await navigator.clipboard.writeText(url);
    setCopiedId(tripId);
    setTimeout(() => setCopiedId(null), 2000);
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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <MapPin className="h-6 w-6 text-blue-600" />
            <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-emerald-600 bg-clip-text text-transparent">
              PlanYourTrip
            </span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/planner">
              <Button size="sm" className="gap-1.5 min-h-9 min-w-9 sm:min-w-0">
                <Plus className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">New itinerary</span>
              </Button>
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <User className="h-4 w-4 text-blue-600" />
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{session?.user?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {session?.user?.email}
                  </p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="text-red-600"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Your Trips</h1>
          <p className="text-muted-foreground mt-1">
            Manage, refine, and share your itineraries
          </p>
        </div>

        {templates.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Templates</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
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

        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        ) : trips.length === 0 ? (
          <div className="text-center py-20">
            <Route className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              No trips yet
            </h2>
            <p className="text-muted-foreground mb-6">
              Create your first itinerary in three guided steps
            </p>
            <div className="max-w-xl mx-auto mb-6 grid sm:grid-cols-3 gap-3 text-left">
              <div className="rounded-lg border bg-white p-3">
                <p className="text-xs font-semibold text-blue-700">1. Pick a starter</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Use a quick-start template or start blank.
                </p>
              </div>
              <div className="rounded-lg border bg-white p-3">
                <p className="text-xs font-semibold text-blue-700">2. Add key stops</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Add cities, attractions, and must-visit places.
                </p>
              </div>
              <div className="rounded-lg border bg-white p-3">
                <p className="text-xs font-semibold text-blue-700">3. Finalize & share</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Finalize your itinerary, export PDF, and invite collaborators.
                </p>
              </div>
            </div>
            <Link href="/planner">
              <Button size="lg" className="gap-2">
                <Plus className="h-5 w-5" />
                Create Your First Itinerary
              </Button>
            </Link>
            {templates.length > 0 && (
              <p className="text-xs text-muted-foreground mt-4">
                You also have {templates.length} personal template
                {templates.length !== 1 ? "s" : ""} ready above.
              </p>
            )}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trips.map((trip) => (
              <Card
                key={trip.id}
                className="group hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => router.push(`/planner/${trip.id}`)}
              >
                <CardHeader className="pb-3">
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
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => handleCopyLink(e, trip.id)}
                        >
                          <Share2 className="h-4 w-4 mr-2" />
                          {copiedId === trip.id ? "Link copied" : "Copy share link"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => handleShareWhatsApp(e, trip.id)}
                        >
                          <WhatsAppIcon className="h-4 w-4 mr-2" />
                          Share via WhatsApp
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => handleShareFacebook(e, trip.id)}
                        >
                          <FacebookIcon className="h-4 w-4 mr-2" />
                          Share on Facebook
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
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
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
        )}
      </div>

      {copiedId && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:bottom-6 sm:w-auto bg-gray-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg z-50 animate-in fade-in duration-200 text-center">
          Share link copied to clipboard
        </div>
      )}
    </div>
  );
}
