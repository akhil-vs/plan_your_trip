"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useAdminAccess } from "@/contexts/AdminAccessContext";
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
import { EmptyState } from "@/components/ui/EmptyState";
import { Logo } from "@/components/ui/Logo";
import { TripCardHeaderImage } from "@/components/dashboard/TripCardHeaderImage";
import { toast } from "@/lib/toast";
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
  Globe,
  Shield,
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

export default function DashboardPage() {
  const { data: session } = useSession();
  const { isAdmin: isAdminUser, ready: adminReady } = useAdminAccess();
  const router = useRouter();
  const [myTrips, setMyTrips] = useState<Trip[]>([]);
  const [publicTrips, setPublicTrips] = useState<Trip[]>([]);
  const [templates, setTemplates] = useState<TripTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [templateLoadingId, setTemplateLoadingId] = useState<string | null>(null);

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b sticky top-0 z-50" aria-label="Dashboard">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 min-h-14 py-2 sm:py-0 sm:h-16 flex flex-wrap items-center justify-between gap-x-2 gap-y-2 sm:flex-nowrap">
          <Link href="/" className="flex items-center min-w-0">
            <span className="hidden min-[361px]:block">
              <Logo size="md" />
            </span>
            <span className="min-[361px]:hidden">
              <Logo size="sm" />
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
              <DropdownMenuContent align="end" sideOffset={8} collisionPadding={12}>
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{session?.user?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {session?.user?.email}
                  </p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push("/profile")}>
                  <User className="h-4 w-4 mr-2" />
                  Profile & membership
                </DropdownMenuItem>
                {adminReady && isAdminUser && (
                  <DropdownMenuItem onClick={() => router.push("/admin")}>
                    <Shield className="h-4 w-4 mr-2" />
                    Admin panel
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() =>
                    signOut({
                      callbackUrl:
                        typeof window !== "undefined"
                          ? `${window.location.origin}/`
                          : "/",
                    })
                  }
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
      <main id="main" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Your Itineraries</h1>
          <p className="text-muted-foreground mt-1">
            Only itineraries you own or are invited to appear here—your private plans stay yours.
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
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6 mb-10">
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
        )}

        {!loading && (
          <div>
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
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
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
      </main>

    </div>
  );
}
