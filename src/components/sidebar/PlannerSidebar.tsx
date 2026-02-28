"use client";

import { useEffect, useCallback, useRef, useState, useMemo } from "react";
import { useMapStore } from "@/stores/mapStore";
import { useTripStore, WaypointData } from "@/stores/tripStore";
import { getDirections, optimizeWaypoints } from "@/lib/api/mapbox";
import { SearchInput } from "./SearchInput";
import { WaypointList } from "./WaypointList";
import { FilterPanel } from "./FilterPanel";
import { PlaceDetailPanel } from "./PlaceDetailPanel";
import { TripMembersPanel } from "./TripMembersPanel";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import Link from "next/link";
import {
  MapPin,
  Save,
  Loader2,
  PanelLeftClose,
  PanelLeft,
  Pencil,
  Check,
  Home,
  Sparkles,
  Undo2,
  RotateCcw,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Users,
  FileDown,
  Globe,
  History,
  Compass,
  X,
} from "lucide-react";
import { useSession } from "next-auth/react";

interface PlannerSidebarProps {
  tripId?: string;
}

interface DayPlan {
  day: number;
  waypointIds: string[];
  estimatedTravelMinutes: number;
}

interface OptimizationSnapshot {
  waypoints: WaypointData[];
  days: DayPlan[];
  summary: string;
}

type TripRole = "OWNER" | "EDITOR" | "VIEWER";
type TripStatus = "DRAFT" | "FINALIZED";
type LifecycleStage = "DRAFT" | "PLANNING" | "FINALIZED" | "SHARED";
type EventPayload = Record<string, unknown>;

interface TripTimelineEvent {
  id: string;
  type: string;
  payload?: EventPayload;
  actorId?: string;
  createdAt: string;
}

interface StarterTemplate {
  id: string;
  name: string;
  description: string;
  waypoints: Array<{ name: string; lat: number; lng: number }>;
}

const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: "city-weekend",
    name: "Weekend in Tokyo",
    description: "A curated city flow with highlights, food, and neighborhoods.",
    waypoints: [
      { name: "Senso-ji Temple, Tokyo", lat: 35.7148, lng: 139.7967 },
      { name: "Shibuya Crossing, Tokyo", lat: 35.6595, lng: 139.7005 },
      { name: "Meiji Shrine, Tokyo", lat: 35.6764, lng: 139.6993 },
    ],
  },
  {
    id: "europe-loop",
    name: "Europe Multi-city",
    description: "A polished multi-city loop for a longer itinerary.",
    waypoints: [
      { name: "Eiffel Tower, Paris", lat: 48.8584, lng: 2.2945 },
      { name: "Colosseum, Rome", lat: 41.8902, lng: 12.4922 },
      { name: "Sagrada Familia, Barcelona", lat: 41.4036, lng: 2.1744 },
    ],
  },
];

export function PlannerSidebar({ tripId }: PlannerSidebarProps) {
  const {
    sidebarOpen,
    setSidebarOpen,
    dayStartMinutes,
    dayEndMinutes,
    defaultVisitMinutes,
    setDayStartMinutes,
    setDayEndMinutes,
    setDefaultVisitMinutes,
  } = useMapStore();
  const {
    tripId: activeTripId,
    waypoints,
    tripName,
    selectedPOI,
    setTripName,
    setTripId,
    setRoute,
    setLoading,
    setSelectedPOI,
    resetTrip,
    reorderWaypoints,
    updateWaypoint,
  } = useTripStore();
  const { data: session } = useSession();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionNotice, setActionNotice] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(tripName);
  const [optimizing, setOptimizing] = useState(false);
  const [optimizeSummary, setOptimizeSummary] = useState("");
  const [optimizeDays, setOptimizeDays] = useState<DayPlan[]>([]);
  const [showDayPlanner, setShowDayPlanner] = useState(false);
  const [dayPlannerOpen, setDayPlannerOpen] = useState(false);
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  const [optimizationConflicts, setOptimizationConflicts] = useState<string[]>([]);
  const [visitMinutesByWaypointId, setVisitMinutesByWaypointId] = useState<
    Record<string, number>
  >({});
  const [timeWindowsByWaypointId, setTimeWindowsByWaypointId] = useState<
    Record<string, { openMinutes: number; closeMinutes: number }>
  >({});
  const [optimizationHistory, setOptimizationHistory] = useState<
    OptimizationSnapshot[]
  >([]);
  const [optimizationBaseline, setOptimizationBaseline] =
    useState<OptimizationSnapshot | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<TripRole>("OWNER");
  const [tripStatus, setTripStatus] = useState<TripStatus>("DRAFT");
  const [isPublic, setIsPublic] = useState(false);
  const [memberCount, setMemberCount] = useState(1);
  const [membersOpen, setMembersOpen] = useState(false);
  const [advancedActionsOpen, setAdvancedActionsOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityEvents, setActivityEvents] = useState<TripTimelineEvent[]>([]);
  const [showOnboardingCard, setShowOnboardingCard] = useState(false);
  const [liveCollabToast, setLiveCollabToast] = useState("");
  const lastEventAtRef = useRef(0);

  const canEditTrip =
    (currentUserRole === "OWNER" || currentUserRole === "EDITOR") &&
    tripStatus === "DRAFT";
  const canManageTrip = currentUserRole === "OWNER";
  const effectiveTripId = tripId ?? activeTripId;
  const lifecycleStage: LifecycleStage = useMemo(() => {
    if (tripStatus === "FINALIZED" && isPublic) return "SHARED";
    if (tripStatus === "FINALIZED") return "FINALIZED";
    if (showDayPlanner || optimizeDays.length > 0) return "PLANNING";
    return "DRAFT";
  }, [tripStatus, isPublic, showDayPlanner, optimizeDays.length]);

  const lifecycleLabelByStage: Record<LifecycleStage, string> = {
    DRAFT: "Draft",
    PLANNING: "Planning",
    FINALIZED: "Finalized",
    SHARED: "Shared",
  };

  const lifecycleHintByStage: Record<LifecycleStage, string> = {
    DRAFT: "Add key stops and save your first draft.",
    PLANNING: "Review day-by-day details, then finalize your itinerary.",
    FINALIZED: "Your itinerary is ready to publish and share.",
    SHARED: "Your shared itinerary is live for collaborators and viewers.",
  };

  const getCollabToastMessage = (
    eventType?: string,
    payload?: EventPayload,
    actorName?: string
  ) => {
    const actor = actorName || "Someone";
    switch (eventType) {
      case "trip.updated":
        return `${actor} updated itinerary details.`;
      case "trip.created":
        return `${actor} created this itinerary.`;
      case "trip.finalized":
        return `${actor} finalized the itinerary.`;
      case "trip.unfinalized":
        return `${actor} reopened the itinerary as draft.`;
      case "trip.published":
        return `${actor} published the itinerary.`;
      case "trip.unpublished":
        return `${actor} unpublished the itinerary.`;
      case "trip.member.upserted":
        return `${actor} updated ${(payload?.email as string) || "a member"} access.`;
      case "trip.member.removed":
        return `${actor} removed a member.`;
      case "trip.invite.created":
        return `${actor} invited ${(payload?.email as string) || "a member"}.`;
      case "trip.invite.revoked":
        return `${actor} revoked an invite.`;
      case "trip.invite.accepted":
        return `${actor} accepted an invite.`;
      default:
        return actorName
          ? `Itinerary updated by ${actorName}.`
          : "Itinerary updated by a collaborator.";
    }
  };

  const formatEventMessage = (evt: TripTimelineEvent) => {
    const payload = evt.payload || {};
    const actorName = (payload.actorName as string) || "Someone";
    switch (evt.type) {
      case "trip.updated":
        return `${actorName} updated the itinerary (${Number(payload.waypointCount || 0)} stops, ${Number(
          payload.dayCount || 0
        )} days).`;
      case "trip.created":
        return `${actorName} created this itinerary.`;
      case "trip.finalized":
        return `${actorName} finalized the itinerary.`;
      case "trip.unfinalized":
        return `${actorName} moved the itinerary back to draft.`;
      case "trip.published":
        return `${actorName} published this itinerary for sharing.`;
      case "trip.unpublished":
        return `${actorName} unpublished this itinerary.`;
      case "trip.invite.created":
        return `${actorName} invited ${(payload.email as string) || "a collaborator"} as ${
          (payload.role as string) || "member"
        }.`;
      case "trip.invite.revoked":
        return `${actorName} revoked an invite.`;
      case "trip.invite.accepted":
        return `${actorName} accepted an invite.`;
      case "trip.member.upserted":
        return `${actorName} changed ${(payload.email as string) || "a member"} role to ${
          (payload.role as string) || "member"
        }.`;
      case "trip.member.removed":
        return `${actorName} removed a member.`;
      default:
        return `${actorName} made an update.`;
    }
  };

  const formatEventTime = (isoTime: string) => {
    const date = new Date(isoTime);
    const deltaMs = Date.now() - date.getTime();
    const deltaMinutes = Math.floor(deltaMs / 60000);
    if (deltaMinutes < 1) return "just now";
    if (deltaMinutes < 60) return `${deltaMinutes}m ago`;
    const deltaHours = Math.floor(deltaMinutes / 60);
    if (deltaHours < 24) return `${deltaHours}h ago`;
    const deltaDays = Math.floor(deltaHours / 24);
    if (deltaDays < 7) return `${deltaDays}d ago`;
    return date.toLocaleDateString();
  };

  const loadActivityHistory = useCallback(async () => {
    if (!effectiveTripId) return;
    setActivityLoading(true);
    try {
      const res = await fetch(`/api/trips/${effectiveTripId}/events?mode=history&limit=40`);
      if (!res.ok) return;
      const data = (await res.json()) as TripTimelineEvent[];
      setActivityEvents(Array.isArray(data) ? data : []);
    } catch {
      // Best-effort UI; ignore errors.
    } finally {
      setActivityLoading(false);
    }
  }, [effectiveTripId]);

  const dismissOnboarding = () => {
    setShowOnboardingCard(false);
    try {
      window.localStorage.setItem("pty_onboarding_seen", "1");
    } catch {
      // Ignore storage issues.
    }
  };

  const applyStarterTemplate = (template: StarterTemplate) => {
    if (!canEditTrip) return;
    const now = Date.now();
    reorderWaypoints(
      template.waypoints.map((wp, index) => ({
        id: `starter-${template.id}-${now}-${index}`,
        name: wp.name,
        lat: wp.lat,
        lng: wp.lng,
        order: index,
        isLocked: false,
        visitMinutes: defaultVisitMinutes,
        openMinutes: 0,
        closeMinutes: 23 * 60 + 59,
      }))
    );
    setTripName(template.name);
    setShowDayPlanner(false);
    setOptimizeDays([]);
    setOptimizeSummary("");
    dismissOnboarding();
  };

  const normalizeDayPlans = useCallback(
    (allWaypoints: WaypointData[], plans: DayPlan[]) => {
      const validIds = new Set(allWaypoints.map((wp) => wp.id));
      const seen = new Set<string>();

      const cleaned = plans
        .map((plan) => {
          const uniqueValidIds = plan.waypointIds.filter((id) => {
            if (!validIds.has(id) || seen.has(id)) return false;
            seen.add(id);
            return true;
          });
          return {
            day: plan.day,
            waypointIds: uniqueValidIds,
            estimatedTravelMinutes: Math.max(0, Math.round(plan.estimatedTravelMinutes || 0)),
          };
        })
        .filter((plan) => plan.waypointIds.length > 0);

      const missingIds = allWaypoints
        .map((wp) => wp.id)
        .filter((id) => !seen.has(id));

      if (cleaned.length === 0 && allWaypoints.length > 0) {
        return [
          {
            day: 1,
            waypointIds: allWaypoints.map((wp) => wp.id),
            estimatedTravelMinutes: 0,
          },
        ];
      }

      if (missingIds.length > 0) {
        if (cleaned.length === 0) {
          cleaned.push({
            day: 1,
            waypointIds: missingIds,
            estimatedTravelMinutes: 0,
          });
        } else {
          cleaned[cleaned.length - 1] = {
            ...cleaned[cleaned.length - 1],
            waypointIds: [...cleaned[cleaned.length - 1].waypointIds, ...missingIds],
          };
        }
      }

      return cleaned.map((plan, index) => ({ ...plan, day: index + 1 }));
    },
    []
  );

  const formatClock = (minutes: number) => {
    const clamped = Math.max(0, Math.min(23 * 60 + 59, minutes));
    const hrs = Math.floor(clamped / 60)
      .toString()
      .padStart(2, "0");
    const mins = (clamped % 60).toString().padStart(2, "0");
    return `${hrs}:${mins}`;
  };

  const parseClock = (value: string) => {
    const [hrs, mins] = value.split(":").map((v) => Number(v));
    if (!Number.isFinite(hrs) || !Number.isFinite(mins)) return null;
    return Math.max(0, Math.min(23 * 60 + 59, hrs * 60 + mins));
  };

  const formatMinutes = (minutes: number) => {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hrs === 0) return `${mins}m`;
    if (mins === 0) return `${hrs}h`;
    return `${hrs}h ${mins}m`;
  };

  const getDayVisitMinutes = (dayPlan: DayPlan) =>
    dayPlan.waypointIds.length * defaultVisitMinutes;

  const getDayTotalMinutes = (dayPlan: DayPlan) =>
    dayPlan.estimatedTravelMinutes + getDayVisitMinutes(dayPlan);

  const createSnapshot = (
    currentWaypoints: WaypointData[],
    days: DayPlan[],
    summary: string
  ): OptimizationSnapshot => ({
    waypoints: currentWaypoints.map((w) => ({ ...w })),
    days: days.map((d) => ({
      day: d.day,
      waypointIds: [...d.waypointIds],
      estimatedTravelMinutes: d.estimatedTravelMinutes,
    })),
    summary,
  });

  const applySnapshot = (snapshot: OptimizationSnapshot) => {
    reorderWaypoints(snapshot.waypoints);
    setOptimizeDays(snapshot.days);
    setOptimizeSummary(snapshot.summary);
  };
  useEffect(() => {
    setOptimizeDays((prev) => normalizeDayPlans(waypoints, prev));
  }, [waypoints, normalizeDayPlans]);

  useEffect(() => {
    setVisitMinutesByWaypointId((prev) => {
      const next: Record<string, number> = {};
      waypoints.forEach((wp) => {
        next[wp.id] = prev[wp.id] ?? wp.visitMinutes ?? defaultVisitMinutes;
      });
      return next;
    });
    setTimeWindowsByWaypointId((prev) => {
      const next: Record<string, { openMinutes: number; closeMinutes: number }> = {};
      waypoints.forEach((wp) => {
        next[wp.id] = prev[wp.id] ?? {
          openMinutes: wp.openMinutes ?? 0,
          closeMinutes: wp.closeMinutes ?? 23 * 60 + 59,
        };
      });
      return next;
    });
  }, [waypoints, defaultVisitMinutes]);


  // Fetch route whenever waypoints change
  const fetchRoute = useCallback(async () => {
    if (waypoints.length < 2) {
      setRoute(null);
      return;
    }

    const coords: [number, number][] = waypoints.map((w) => [w.lng, w.lat]);

    setLoading("route", true);
    try {
      const result = await getDirections(coords);
      if (result) {
        setRoute({
          distance: result.distance,
          duration: result.duration,
          geometry: result.geometry,
          legs: result.legs,
        });
      } else {
        setRoute(null);
      }
    } catch {
      setRoute(null);
    } finally {
      setLoading("route", false);
    }
  }, [waypoints, setRoute, setLoading]);

  useEffect(() => {
    fetchRoute();
  }, [fetchRoute]);

  // On mobile, start with sidebar closed
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    if (mq.matches) setSidebarOpen(false);
  }, [setSidebarOpen]);

  useEffect(() => {
    if (tripId || waypoints.length > 0) {
      setShowOnboardingCard(false);
      return;
    }
    try {
      const alreadySeen = window.localStorage.getItem("pty_onboarding_seen") === "1";
      setShowOnboardingCard(!alreadySeen);
    } catch {
      setShowOnboardingCard(true);
    }
  }, [tripId, waypoints.length]);

  // New trip: reset store. Existing trip: load data
  useEffect(() => {
    if (!tripId) {
      resetTrip();
      setTripId(null);
      setShowDayPlanner(false);
      setDayStartMinutes(9 * 60);
      setDayEndMinutes(20 * 60);
      setDefaultVisitMinutes(60);
      setOptimizeDays([]);
      setOptimizeSummary("");
      setOptimizationConflicts([]);
      setOptimizationHistory([]);
      setOptimizationBaseline(null);
      return;
    }
    setTripId(tripId);
    fetch(`/api/trips/${tripId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.name) setTripName(data.name);
        if (data.waypoints) {
          resetTrip();
          setTripId(tripId);
          setTripName(data.name);
          if (typeof data.optimizerDayStartMinutes === "number") {
            setDayStartMinutes(data.optimizerDayStartMinutes);
          }
          if (typeof data.optimizerDayEndMinutes === "number") {
            setDayEndMinutes(data.optimizerDayEndMinutes);
          }
          if (typeof data.optimizerDefaultVisitMinutes === "number") {
            setDefaultVisitMinutes(data.optimizerDefaultVisitMinutes);
          }
          setOptimizationHistory([]);
          setOptimizationBaseline(null);
          setShowDayPlanner(false);
          setOptimizationConflicts([]);
          setCurrentUserRole((data.currentUserRole as TripRole) || "OWNER");
          setTripStatus((data.status as TripStatus) || "DRAFT");
          setIsPublic(Boolean(data.isPublic));
          setMemberCount(
            Array.isArray(data.members)
              ? data.members.length
              : typeof data._count?.members === "number"
                ? data._count.members
                : 1
          );
          lastEventAtRef.current = Date.now();
          const loadedWaypoints = [...data.waypoints].sort(
            (a: { order: number }, b: { order: number }) => a.order - b.order
          );
          const loadedWaypointIdSet = new Set(
            loadedWaypoints.map((wp: { id: string }) => wp.id)
          );
          reorderWaypoints(
            loadedWaypoints.map(
              (wp: {
                id: string;
                name: string;
                notes?: string;
                lat: number;
                lng: number;
                order: number;
                isLocked?: boolean;
                visitMinutes?: number;
                openMinutes?: number;
                closeMinutes?: number;
              }) => ({
                id: wp.id,
                name: wp.name,
                notes: wp.notes,
                lat: wp.lat,
                lng: wp.lng,
                order: wp.order,
                isLocked: wp.isLocked ?? false,
                visitMinutes: wp.visitMinutes,
                openMinutes: wp.openMinutes,
                closeMinutes: wp.closeMinutes,
              })
            )
          );
          setVisitMinutesByWaypointId(
            loadedWaypoints.reduce((acc: Record<string, number>, wp: {
              id: string;
              visitMinutes?: number;
            }) => {
              acc[wp.id] = wp.visitMinutes ?? data.optimizerDefaultVisitMinutes ?? 60;
              return acc;
            }, {})
          );
          setTimeWindowsByWaypointId(
            loadedWaypoints.reduce(
              (
                acc: Record<string, { openMinutes: number; closeMinutes: number }>,
                wp: { id: string; openMinutes?: number; closeMinutes?: number }
              ) => {
                acc[wp.id] = {
                  openMinutes: wp.openMinutes ?? 0,
                  closeMinutes: wp.closeMinutes ?? 23 * 60 + 59,
                };
                return acc;
              },
              {}
            )
          );
          setOptimizeDays(
            normalizeDayPlans(
              loadedWaypoints.map(
                (wp: {
                  id: string;
                  name: string;
                  notes?: string;
                  lat: number;
                  lng: number;
                  order: number;
                  isLocked?: boolean;
                }) => ({
                  id: wp.id,
                  name: wp.name,
                  notes: wp.notes,
                  lat: wp.lat,
                  lng: wp.lng,
                  order: wp.order,
                  isLocked: wp.isLocked ?? false,
                })
              ),
              Array.isArray(data.dayPlans)
                ? data.dayPlans.map(
                    (dp: {
                      day: number;
                      waypointIndexes: number[];
                      waypointIds?: string[];
                      estimatedTravelMinutes: number;
                    }) => ({
                      day: dp.day,
                      waypointIds:
                        dp.waypointIds &&
                        dp.waypointIds.length > 0 &&
                        dp.waypointIds.every((id) => loadedWaypointIdSet.has(id))
                          ? dp.waypointIds
                          : (dp.waypointIndexes || [])
                              .map((idx) => loadedWaypoints[idx]?.id)
                              .filter(Boolean),
                      estimatedTravelMinutes: dp.estimatedTravelMinutes || 0,
                    })
                  )
                : []
            )
          );
          if (Array.isArray(data.dayPlans) && data.dayPlans.length > 0) {
            setShowDayPlanner(true);
          }
        }
      })
      .catch(() => {});
  }, [
    tripId,
    setTripId,
    setTripName,
    resetTrip,
    reorderWaypoints,
    normalizeDayPlans,
    setDayStartMinutes,
    setDayEndMinutes,
    setDefaultVisitMinutes,
  ]);

  const handleSave = async () => {
    if (!session?.user || !canEditTrip) return;
    setSaving(true);
    setSaved(false);
    setSaveError("");
    try {
      const body = {
        name: tripName,
        waypoints: waypoints.map((w) => ({
          id: w.id,
          name: w.name,
          notes: w.notes || "",
          lat: w.lat,
          lng: w.lng,
          order: w.order,
          isLocked: w.isLocked ?? false,
          visitMinutes: visitMinutesByWaypointId[w.id] ?? w.visitMinutes ?? defaultVisitMinutes,
          openMinutes: timeWindowsByWaypointId[w.id]?.openMinutes ?? w.openMinutes ?? 0,
          closeMinutes:
            timeWindowsByWaypointId[w.id]?.closeMinutes ?? w.closeMinutes ?? 23 * 60 + 59,
        })),
        dayPlans: optimizeDays.map((dp) => ({
          day: dp.day,
          waypointIds: dp.waypointIds,
          waypointIndexes: dp.waypointIds
            .map((id) => waypoints.findIndex((w) => w.id === id))
            .filter((idx) => idx >= 0),
          estimatedTravelMinutes: dp.estimatedTravelMinutes,
        })),
        optimizationSettings: {
          dayStartMinutes,
          dayEndMinutes,
          defaultVisitMinutes,
        },
      };

      const currentTripId = useTripStore.getState().tripId;
      const url = currentTripId ? `/api/trips/${currentTripId}` : "/api/trips";
      const method = currentTripId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        setTripId(data.id);
        if (data.currentUserRole) setCurrentUserRole(data.currentUserRole as TripRole);
        if (data.status) setTripStatus(data.status as TripStatus);
        setIsPublic(Boolean(data.isPublic));
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        const errorData = await res.json().catch(() => null);
        setSaveError(errorData?.error || "Failed to save itinerary");
        setTimeout(() => setSaveError(""), 4000);
      }
    } catch {
      setSaveError("Failed to save itinerary");
      setTimeout(() => setSaveError(""), 4000);
    } finally {
      setSaving(false);
    }
  };

  const handleFinalize = async () => {
    const currentTripId = useTripStore.getState().tripId;
    if (!currentTripId || !canManageTrip) return;
    setActionError("");
    setActionNotice("");
    try {
      const res = await fetch(`/api/trips/${currentTripId}/finalize`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setActionError(data?.error || "Failed to finalize itinerary");
        return;
      }
      setTripStatus("FINALIZED");
      setActionNotice("Itinerary finalized.");
      window.setTimeout(() => setActionNotice(""), 2500);
    } catch {
      setActionError("Failed to finalize itinerary");
    }
  };

  const handlePublish = async () => {
    const currentTripId = useTripStore.getState().tripId;
    if (!currentTripId || !canManageTrip) return;
    setActionError("");
    setActionNotice("");
    try {
      const res = await fetch(`/api/trips/${currentTripId}/publish`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setActionError(data?.error || "Failed to publish itinerary");
        return;
      }
      setIsPublic(true);
      const shareUrl = data?.shareUrl as string | undefined;
      if (shareUrl && typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl).catch(() => {});
      }
      setActionNotice(
        shareUrl
          ? "Itinerary published. Share link copied to clipboard."
          : "Itinerary published."
      );
      window.setTimeout(() => setActionNotice(""), 3200);
    } catch {
      setActionError("Failed to publish itinerary");
    }
  };

  const handleExportPdf = async () => {
    const currentTripId = useTripStore.getState().tripId;
    if (!currentTripId) return;
    window.open(`/api/trips/${currentTripId}/export/pdf`, "_blank", "noopener,noreferrer");
  };

  const handleOptimize = async () => {
    if (waypoints.length < 3) return;
    setOptimizing(true);
    setOptimizationConflicts([]);
    const previous = createSnapshot(waypoints, optimizeDays, optimizeSummary);
    try {
      const optimized = await optimizeWaypoints(
        waypoints,
        true,
        true,
        dayStartMinutes,
        dayEndMinutes,
        defaultVisitMinutes,
        waypoints.filter((wp) => wp.isLocked).map((wp) => wp.id),
        {},
        timeWindowsByWaypointId
      );
      if (optimized?.waypoints) {
        setShowDayPlanner(true);
        if (optimized.days.length > 0) {
          setExpandedDay(1);
        }
        if (!optimizationBaseline) {
          setOptimizationBaseline(previous);
        }
        setOptimizationHistory((prev) => [...prev, previous]);
        reorderWaypoints(optimized.waypoints);
        if (optimized.days.length > 0) {
          setOptimizeDays(
            normalizeDayPlans(
              optimized.waypoints,
              optimized.days.map((dayPlan) => ({
                day: dayPlan.day,
                waypointIds: dayPlan.waypointIndexes
                  .map((idx) => optimized.waypoints[idx]?.id)
                  .filter(Boolean),
                estimatedTravelMinutes: dayPlan.estimatedTravelMinutes,
              }))
            )
          );
          setOptimizeSummary(
            `Optimized into ${optimized.days.length} day${
              optimized.days.length !== 1 ? "s" : ""
            }`
          );
        } else {
          setOptimizeDays([]);
          setOptimizeSummary("Route optimized");
        }
        if (optimized.conflicts.length > 0) {
          setOptimizationConflicts(optimized.conflicts.map((conflict) => conflict.message));
        }
      }
    } finally {
      setOptimizing(false);
    }
  };

  const handleUndoOptimization = () => {
    if (optimizationHistory.length === 0) return;
    const previous = optimizationHistory[optimizationHistory.length - 1];
    applySnapshot(previous);
    setOptimizationConflicts([]);
    setOptimizationHistory((prev) => prev.slice(0, -1));
    if (optimizationHistory.length === 1) {
      setOptimizationBaseline(null);
    }
  };

  const handleResetAllOptimizations = () => {
    if (!optimizationBaseline) return;
    applySnapshot(optimizationBaseline);
    setOptimizationConflicts([]);
    setOptimizationHistory([]);
    setOptimizationBaseline(null);
  };

  const updateDayPlans = (updater: (prev: DayPlan[]) => DayPlan[]) => {
    setOptimizeDays((prev) => normalizeDayPlans(waypoints, updater(prev)));
  };

  const moveWaypointWithinDay = (
    dayNumber: number,
    waypointId: string,
    direction: "up" | "down"
  ) => {
    updateDayPlans((prev) =>
      prev.map((plan) => {
        if (plan.day !== dayNumber) return plan;
        const idx = plan.waypointIds.indexOf(waypointId);
        if (idx === -1) return plan;
        const swapWith = direction === "up" ? idx - 1 : idx + 1;
        if (swapWith < 0 || swapWith >= plan.waypointIds.length) return plan;
        const next = [...plan.waypointIds];
        [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
        return { ...plan, waypointIds: next };
      })
    );
  };

  const moveWaypointAcrossDays = (
    dayNumber: number,
    waypointId: string,
    direction: "prev" | "next"
  ) => {
    updateDayPlans((prev) => {
      const sourceIdx = prev.findIndex((plan) => plan.day === dayNumber);
      if (sourceIdx === -1) return prev;
      const targetIdx = direction === "prev" ? sourceIdx - 1 : sourceIdx + 1;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;

      const next = prev.map((plan) => ({ ...plan, waypointIds: [...plan.waypointIds] }));
      next[sourceIdx].waypointIds = next[sourceIdx].waypointIds.filter((id) => id !== waypointId);
      next[targetIdx].waypointIds.push(waypointId);
      return next;
    });
  };

  useEffect(() => {
    if (!effectiveTripId || !session?.user?.id) return;
    const stream = new EventSource(
      `/api/trips/${effectiveTripId}/events?since=${lastEventAtRef.current || 0}`
    );
    const handleTripEvent = (event: Event) => {
      const messageEvent = event as MessageEvent<string>;
      let parsed:
        | {
            id?: string;
            actorId?: string;
            type?: string;
            actorName?: string;
            payload?: EventPayload & { actorName?: string };
            createdAt?: string;
          }
        | undefined;
      try {
        parsed = JSON.parse(messageEvent.data) as {
          id?: string;
          actorId?: string;
          type?: string;
          actorName?: string;
          payload?: EventPayload & { actorName?: string };
          createdAt?: string;
        };
      } catch {
        // Ignore parse errors; sync fetch still runs below.
      }
      const actorId = parsed?.actorId;
      const actorName = parsed?.payload?.actorName || parsed?.actorName;
      if (actorId && actorId !== session.user.id) {
        setLiveCollabToast(getCollabToastMessage(parsed?.type, parsed?.payload, actorName));
        window.setTimeout(() => setLiveCollabToast(""), 2200);
      }
      if (parsed?.id && parsed.type && parsed.createdAt) {
        setActivityEvents((prev) => {
          const next = [
            {
              id: parsed.id,
              type: parsed.type,
              payload: parsed.payload || {},
              actorId: parsed.actorId,
              createdAt: parsed.createdAt,
            },
            ...prev.filter((evt) => evt.id !== parsed?.id),
          ];
          return next.slice(0, 40);
        });
      }
      lastEventAtRef.current = Date.now();
      fetch(`/api/trips/${effectiveTripId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!data) return;
          if (data.status) setTripStatus(data.status as TripStatus);
          setIsPublic(Boolean(data.isPublic));
          if (data.currentUserRole) setCurrentUserRole(data.currentUserRole as TripRole);
          if (Array.isArray(data.members)) setMemberCount(data.members.length);
        })
        .catch(() => {});
    };
    stream.addEventListener("trip_event", handleTripEvent);
    return () => {
      stream.removeEventListener("trip_event", handleTripEvent);
      stream.close();
    };
  }, [effectiveTripId, session?.user?.id]);

  useEffect(() => {
    if (!effectiveTripId || !session?.user?.id) return;
    void loadActivityHistory();
  }, [effectiveTripId, session?.user?.id, loadActivityHistory]);

  if (!sidebarOpen) {
    return (
      <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-10 flex items-center gap-2">
        <Link
          href={session?.user ? "/dashboard" : "/"}
          className="p-2 sm:p-2.5 rounded-lg bg-white shadow-lg border hover:bg-gray-50 min-w-[44px] min-h-[44px] flex items-center justify-center"
          title={session?.user ? "Dashboard" : "Home"}
        >
          <Home className="h-5 w-5" />
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 sm:h-10 sm:w-10 bg-white shadow-lg border hover:bg-gray-50"
          onClick={() => setSidebarOpen(true)}
        >
          <PanelLeft className="h-5 w-5" />
        </Button>
      </div>
    );
  }

  return (
    <>
      {/* Backdrop on mobile */}
      <div
        className="fixed inset-0 bg-black/40 z-30 lg:hidden"
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />
      <div className="w-[min(100vw,400px)] lg:w-[380px] h-full bg-white lg:border-r flex flex-col shrink-0 relative overflow-hidden lg:relative max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-40 max-lg:shadow-2xl max-lg:rounded-r-xl">
      {/* Header */}
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Link
              href={session?.user ? "/dashboard" : "/"}
              className="shrink-0 p-1.5 rounded-md hover:bg-gray-100 text-muted-foreground hover:text-foreground transition-colors"
              title={session?.user ? "Dashboard" : "Home"}
            >
              <Home className="h-5 w-5" />
            </Link>
            <MapPin className="h-5 w-5 text-blue-600 shrink-0" />
            {editingName ? (
              <div className="flex items-center gap-1 flex-1">
                <Input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="h-7 text-sm"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setTripName(nameInput);
                      setEditingName(false);
                    }
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => {
                    setTripName(nameInput);
                    setEditingName(false);
                  }}
                >
                  <Check className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <button
                className="text-sm font-semibold truncate flex items-center gap-1 hover:text-blue-600"
                disabled={!canEditTrip}
                onClick={() => {
                  if (!canEditTrip) return;
                  setNameInput(tripName);
                  setEditingName(true);
                }}
              >
                {tripName}
                <Pencil className="h-3 w-3 text-gray-400" />
              </button>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 touch-manipulation"
            onClick={() => setSidebarOpen(false)}
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        </div>

        {session?.user && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
                <Badge variant={tripStatus === "FINALIZED" ? "default" : "secondary"}>
                  {lifecycleLabelByStage[lifecycleStage]}
                </Badge>
                <Badge variant="outline">{currentUserRole}</Badge>
                <Badge variant="outline" className="gap-1">
                  <Users className="h-3 w-3" />
                  {memberCount}
                </Badge>
            </div>
              <p className="text-[11px] text-muted-foreground">
                {lifecycleHintByStage[lifecycleStage]}
              </p>
            <div className="flex items-center gap-2">
                {!effectiveTripId ? (
                  <Button
                    onClick={handleSave}
                    disabled={saving || waypoints.length === 0 || !canEditTrip}
                    size="sm"
                    className="w-full gap-1.5 min-h-9 touch-manipulation"
                    variant={saved ? "outline" : "default"}
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : saved ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {saving ? "Saving..." : saved ? "Saved!" : "Save itinerary"}
                  </Button>
                ) : canManageTrip && lifecycleStage === "PLANNING" ? (
                  <Button
                    size="sm"
                    className="w-full min-h-9 touch-manipulation"
                    onClick={handleFinalize}
                    disabled={!effectiveTripId || tripStatus === "FINALIZED"}
                  >
                    Finalize itinerary
                  </Button>
                ) : canManageTrip && lifecycleStage === "FINALIZED" ? (
                  <Button
                    size="sm"
                    className="w-full gap-1.5 min-h-9 touch-manipulation"
                    onClick={handlePublish}
                    disabled={!effectiveTripId || tripStatus !== "FINALIZED"}
                  >
                    <Globe className="h-4 w-4" />
                    Publish itinerary
                  </Button>
                ) : lifecycleStage === "SHARED" ? (
                  <Button
                    size="sm"
                    className="w-full gap-1.5 min-h-9 touch-manipulation"
                    onClick={handleExportPdf}
                    disabled={!effectiveTripId}
                  >
                    <FileDown className="h-4 w-4" />
                    Export itinerary PDF
                  </Button>
                ) : (
                  <Button
                    onClick={handleSave}
                    disabled={saving || waypoints.length === 0 || !canEditTrip}
                    size="sm"
                    className="w-full gap-1.5 min-h-9 touch-manipulation"
                    variant={saved ? "outline" : "default"}
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : saved ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {saving ? "Saving..." : saved ? "Saved!" : "Save itinerary"}
                  </Button>
                )}
              </div>
              <button
                type="button"
                className="w-full flex items-center justify-between rounded-md border px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted/40"
                onClick={() => setAdvancedActionsOpen((prev) => !prev)}
              >
                More actions
                {advancedActionsOpen ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>
              {advancedActionsOpen && (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setActivityOpen(true);
                      void loadActivityHistory();
                    }}
                    disabled={!effectiveTripId}
                    className="gap-1.5"
                  >
                    <History className="h-4 w-4" />
                    Activity
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setMembersOpen(true)}
                    disabled={!effectiveTripId}
                    className="gap-1.5"
                  >
                    <Users className="h-4 w-4" />
                    Members
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleExportPdf}
                    disabled={!effectiveTripId || tripStatus !== "FINALIZED"}
                    className="gap-1.5"
                  >
                    <FileDown className="h-4 w-4" />
                    Export itinerary PDF
                  </Button>
                  {canManageTrip && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleFinalize}
                        disabled={!effectiveTripId || tripStatus === "FINALIZED"}
                      >
                        Finalize itinerary
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handlePublish}
                        disabled={!effectiveTripId || tripStatus !== "FINALIZED"}
                        className="gap-1.5"
                      >
                        <Globe className="h-4 w-4" />
                        Publish itinerary
                      </Button>
                    </>
                  )}
                </div>
              )}
          </div>
        )}
        {showDayPlanner && optimizationHistory.length > 0 && (
          <div className="flex items-center gap-2">
            <Button
              onClick={handleUndoOptimization}
              variant="ghost"
              size="sm"
              className="gap-1.5 min-h-8"
            >
              <Undo2 className="h-4 w-4" />
              Undo last optimization
            </Button>
            <Button
              onClick={handleResetAllOptimizations}
              variant="ghost"
              size="sm"
              className="gap-1.5 min-h-8 text-amber-700 hover:text-amber-800"
            >
              <RotateCcw className="h-4 w-4" />
              Reset all
            </Button>
          </div>
        )}

        {saveError && (
          <p className="text-xs text-red-500">{saveError}</p>
        )}
        {actionError && <p className="text-xs text-red-500">{actionError}</p>}
        {actionNotice && <p className="text-xs text-emerald-600">{actionNotice}</p>}
        {optimizeSummary && (
          <p className="text-xs text-green-600">{optimizeSummary}</p>
        )}
        {optimizationConflicts.length > 0 && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-2">
            <p className="text-xs font-medium text-amber-900 mb-1">
              Scheduling conflicts ({optimizationConflicts.length})
            </p>
            <div className="space-y-1">
              {optimizationConflicts.slice(0, 4).map((message, index) => (
                <p key={`${message}-${index}`} className="text-[11px] text-amber-800">
                  - {message}
                </p>
              ))}
            </div>
          </div>
        )}

        <SearchInput disabled={!canEditTrip} />
      </div>

      {/* Content - scrollable */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-4 space-y-6">
          {showOnboardingCard && (
            <section className="rounded-md border border-blue-200 bg-blue-50/70 p-3 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
                    Quick Start
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Start from a polished template so your first itinerary is never blank.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={dismissOnboarding}
                  title="Dismiss onboarding"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="space-y-2">
                {STARTER_TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    className="w-full rounded-md border bg-white px-3 py-2 text-left hover:bg-blue-50 disabled:opacity-60"
                    onClick={() => applyStarterTemplate(template)}
                    disabled={!canEditTrip}
                  >
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      <Compass className="h-3.5 w-3.5 text-blue-600" />
                      {template.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{template.description}</p>
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Or search above, add your first stop, and save your draft.
              </p>
            </section>
          )}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              Route
            </h3>
            <WaypointList disabled={!canEditTrip} />
            {waypoints.length === 0 && (
              <div className="rounded-md border border-dashed p-3 mt-3">
                <p className="text-xs font-medium">No stops yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Add at least 3 stops to unlock day-wise auto planning.
                </p>
              </div>
            )}
            <Separator className="my-4" />
            <FilterPanel />
            {waypoints.length >= 3 && (
              <>
                <Separator className="my-4" />
                <div className="rounded-md border bg-blue-50/60 p-3 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
                      Day-by-Day Itinerary
                    </p>
                    {showDayPlanner && optimizeDays.length > 0 && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] font-medium bg-emerald-100 text-emerald-700 border-emerald-200"
                      >
                        Itinerary ready · {optimizeDays.length} day
                        {optimizeDays.length !== 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Build your route first, then generate a day-by-day itinerary using opening
                    hours and nearest-stop sequencing.
                  </p>
                  <Button
                    onClick={async () => {
                      setDayPlannerOpen(true);
                      if (!showDayPlanner && canEditTrip) {
                        await handleOptimize();
                      }
                    }}
                    disabled={optimizing || !canEditTrip}
                    size="sm"
                    className="w-full gap-2"
                  >
                    {optimizing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {showDayPlanner
                      ? "Regenerate Day-by-Day Itinerary"
                      : "Generate Day-by-Day Itinerary"}
                  </Button>
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      {/* Detail Panel overlay */}
      {selectedPOI && (
        <PlaceDetailPanel
          poi={selectedPOI}
          onClose={() => setSelectedPOI(null)}
        />
      )}
      <Sheet open={dayPlannerOpen} onOpenChange={setDayPlannerOpen}>
        <SheetContent side="right" className="sm:max-w-lg w-[92vw]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Day-by-Day Planner
            </SheetTitle>
            <SheetDescription>
              Adjust planning constraints and generate an itinerary by opening hours
              and nearest stops.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4 space-y-3 overflow-y-auto">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[11px] text-muted-foreground mb-1">Day start</p>
                <Input
                  type="time"
                  className="h-8 text-xs"
                  value={formatClock(dayStartMinutes)}
                  onChange={(e) => {
                    if (!canEditTrip) return;
                    const next = parseClock(e.target.value);
                    if (next === null) return;
                    setDayStartMinutes(Math.min(next, dayEndMinutes - 30));
                  }}
                />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground mb-1">Day end</p>
                <Input
                  type="time"
                  className="h-8 text-xs"
                  value={formatClock(dayEndMinutes)}
                  onChange={(e) => {
                    if (!canEditTrip) return;
                    const next = parseClock(e.target.value);
                    if (next === null) return;
                    setDayEndMinutes(Math.max(next, dayStartMinutes + 30));
                  }}
                />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground mb-1">Visit min/stop</p>
                <Input
                  type="number"
                  min={5}
                  step={5}
                  className="h-8 text-xs"
                  value={defaultVisitMinutes}
                  onChange={(e) =>
                    canEditTrip &&
                    setDefaultVisitMinutes(Math.max(5, Number(e.target.value) || 60))
                  }
                  disabled={!canEditTrip}
                />
              </div>
            </div>
            <Button
              onClick={handleOptimize}
              disabled={optimizing || waypoints.length < 3 || !canEditTrip}
              className="w-full gap-2"
            >
              {optimizing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Regenerate Day-by-Day Itinerary
            </Button>
            {showDayPlanner && optimizeDays.length > 0 ? (
              <div className="space-y-2">
                {optimizeDays.map((dayPlan) => (
                  <div key={dayPlan.day} className="rounded-md border p-2 space-y-2">
                    <button
                      className="w-full flex items-center justify-between text-left"
                      onClick={() =>
                        setExpandedDay((prev) => (prev === dayPlan.day ? null : dayPlan.day))
                      }
                    >
                      <div>
                        <p className="text-sm font-medium">Day {dayPlan.day}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {dayPlan.waypointIds.length} stop
                          {dayPlan.waypointIds.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <p className="text-xs text-muted-foreground cursor-help">
                              {formatMinutes(getDayTotalMinutes(dayPlan))} total
                            </p>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            Total time = travel + per-stop visit duration
                          </TooltipContent>
                        </Tooltip>
                        {expandedDay === dayPlan.day ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </button>
                    {expandedDay === dayPlan.day ? (
                      <div className="space-y-1.5">
                        <p className="text-[11px] text-muted-foreground">
                          {formatMinutes(dayPlan.estimatedTravelMinutes)} travel +{" "}
                          {formatMinutes(getDayVisitMinutes(dayPlan))} visit
                        </p>
                        {dayPlan.waypointIds.map((id, idx) => {
                          const wp = waypoints.find((w) => w.id === id);
                          if (!wp) return null;
                          return (
                            <div
                              key={id}
                              className="rounded border bg-muted/30 px-2 py-1.5 space-y-1.5"
                            >
                              <div className="flex items-center gap-2">
                                <p className="text-xs flex-1 truncate">{wp.name}</p>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() =>
                                      moveWaypointAcrossDays(dayPlan.day, id, "prev")
                                    }
                                    disabled={dayPlan.day === 1 || !canEditTrip}
                                    title="Move to previous day"
                                  >
                                    <ChevronLeft className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() =>
                                      moveWaypointWithinDay(dayPlan.day, id, "up")
                                    }
                                    disabled={idx === 0 || !canEditTrip}
                                    title="Move up in day"
                                  >
                                    <ChevronUp className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() =>
                                      moveWaypointWithinDay(dayPlan.day, id, "down")
                                    }
                                    disabled={
                                      idx === dayPlan.waypointIds.length - 1 || !canEditTrip
                                    }
                                    title="Move down in day"
                                  >
                                    <ChevronDown className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() =>
                                      moveWaypointAcrossDays(dayPlan.day, id, "next")
                                    }
                                    disabled={
                                      dayPlan.day === optimizeDays.length || !canEditTrip
                                    }
                                    title="Move to next day"
                                  >
                                    <ChevronRight className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                              <Input
                                value={wp.notes || ""}
                                placeholder="Add note for this day plan stop..."
                                className="h-7 text-xs"
                                onChange={(e) =>
                                  updateWaypoint(id, { notes: e.target.value })
                                }
                                disabled={!canEditTrip}
                              />
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {dayPlan.waypointIds
                          .map((id) => waypoints.find((w) => w.id === id)?.name)
                          .filter(Boolean)
                          .join(" -> ")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No itinerary generated yet. Regenerate to create one.
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>
      <Sheet open={membersOpen} onOpenChange={setMembersOpen}>
        <SheetContent side="right" className="sm:max-w-md w-[90vw]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Trip Members
            </SheetTitle>
            <SheetDescription>
              Invite editors/viewers and manage collaboration access.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4">
            {effectiveTripId ? (
              <TripMembersPanel tripId={effectiveTripId} canManage={canManageTrip} />
            ) : (
              <p className="text-xs text-muted-foreground">
                Save the itinerary first to invite collaborators.
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>
      <Sheet open={activityOpen} onOpenChange={setActivityOpen}>
        <SheetContent side="right" className="sm:max-w-md w-[90vw]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Activity Timeline
            </SheetTitle>
            <SheetDescription>
              Recent collaboration updates with clear attribution.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4 pt-2">
            {activityLoading ? (
              <p className="text-xs text-muted-foreground">Loading activity...</p>
            ) : activityEvents.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No activity yet. Changes will appear here in real time.
              </p>
            ) : (
              <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
                {activityEvents.map((evt) => (
                  <div key={evt.id} className="rounded-md border p-2">
                    <p className="text-xs text-foreground">{formatEventMessage(evt)}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {formatEventTime(evt.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
      {liveCollabToast && (
        <div className="pointer-events-none fixed bottom-4 right-4 z-[70] rounded-md bg-gray-900/95 text-white text-xs px-3 py-2 shadow-lg">
          {liveCollabToast}
        </div>
      )}
    </div>
    </>
  );
}
