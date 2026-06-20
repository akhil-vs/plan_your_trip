"use client";

import { useEffect, useCallback, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useMapStore, type CollaborationTab } from "@/stores/mapStore";
import { useTripStore, WaypointData } from "@/stores/tripStore";
import { getDirections, optimizeWaypoints } from "@/lib/api/mapbox";
import { buildDirectionsCoordKeyFromWaypoints } from "@/lib/route/directionsCoordKey";
import {
  parseTripWaypointsForStore,
  tripPayloadFromJson,
} from "@/lib/planner/parseTripApiWaypoints";
import { SearchInput } from "./SearchInput";
import { WaypointList } from "./WaypointList";
import { PlaceDetailPanel } from "./PlaceDetailPanel";
import { TripMembersPanel } from "./TripMembersPanel";
import { TripMemberChat } from "./TripMemberChat";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import {
  MapPin,
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
  MessageCircle,
  ClipboardList,
  FileDown,
  Globe,
  History,
  Compass,
  X,
  Trash2,
  MoreVertical,
  Shield,
  Search,
  Clock,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useAdminAccess } from "@/contexts/AdminAccessContext";
import {
  canUseActivityTimeline,
  canUseCollaboration,
} from "@/lib/subscription";
import { toast } from "@/lib/toast";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { placeNameForActivity } from "@/lib/placeDisplayName";
import { useIsMobilePlanner } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

interface PlannerSidebarProps {
  tripId?: string;
}

interface DayPlan {
  day: number;
  waypointIds: string[];
  estimatedTravelMinutes: number;
  estimatedTravelMeters: number;
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

interface SaveSignatureInput {
  name: string;
  waypoints: Array<{
    id?: string;
    name: string;
    notes?: string;
    lat: number;
    lng: number;
    order: number;
    isLocked?: boolean;
    isTransitSplit?: boolean;
    visitMinutes?: number;
    openMinutes?: number;
    closeMinutes?: number;
  }>;
  dayPlans: Array<{
    day: number;
    waypointIds: string[];
    estimatedTravelMinutes: number;
    estimatedTravelMeters: number;
  }>;
  dayStartMinutes: number;
  dayEndMinutes: number;
  defaultVisitMinutes: number;
}

interface StarterTemplate {
  id: string;
  name: string;
  description: string;
  waypoints: Array<{ name: string; lat: number; lng: number }>;
}

/** Shown in the save-name dialog when the user has not entered a title yet. */
const DEFAULT_SAVE_NAME = "Untitled";
const TRANSIT_SPLIT_NAME_PREFIX = "Transit stop between ";

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

type SidebarRouteToolsProps = {
  canEditTrip: boolean;
  pickPointsMode: boolean;
  onTogglePick: () => void;
  hasRouteGeometry: boolean;
  onExplore: () => void;
};

function SidebarRouteTools({
  canEditTrip,
  pickPointsMode,
  onTogglePick,
  hasRouteGeometry,
  onExplore,
}: SidebarRouteToolsProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={onTogglePick}
        disabled={!canEditTrip}
        className={`h-9 gap-1.5 font-medium shadow-sm ${
          pickPointsMode
            ? "border-slate-900 bg-slate-900 text-white hover:bg-slate-800 hover:text-white"
            : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
        }`}
      >
        <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Pick points
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={onExplore}
        disabled={!canEditTrip || !hasRouteGeometry}
        title={
          hasRouteGeometry
            ? undefined
            : "Add stops and wait for the route line to appear on the map"
        }
        className="h-9 gap-1.5 border-slate-200 bg-white font-medium text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-40"
      >
        <Search className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Explore attractions
      </Button>
    </div>
  );
}

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
    pickPointsMode,
    setPickPointsMode,
    setRouteExploreOpen,
    setRouteSummaryOpen,
    setActiveWaypoint,
    collaborationPanelOpen,
    collaborationTab,
    openCollaborationPanel,
    setCollaborationPanelOpen,
    setCollaborationTab,
  } = useMapStore();
  const {
    tripId: activeTripId,
    waypoints,
    tripName,
    selectedPOI,
    route,
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
  const { isAdmin: isAdminUser, ready: adminReady } = useAdminAccess();
  const isMobile = useIsMobilePlanner();
  const userPlan = session?.user?.plan || "FREE";
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionNotice, setActionNotice] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(tripName);
  const [lastSavedSignature, setLastSavedSignature] = useState<string | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  const [optimizeSummary, setOptimizeSummary] = useState("");
  const [optimizeDays, setOptimizeDays] = useState<DayPlan[]>([]);
  const [showDayPlanner, setShowDayPlanner] = useState(false);
  const [dayPlannerOpen, setDayPlannerOpen] = useState(false);
  const [autoSplitLongTransfers, setAutoSplitLongTransfers] = useState(false);
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
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityEvents, setActivityEvents] = useState<TripTimelineEvent[]>([]);
  const [showOnboardingCard, setShowOnboardingCard] = useState(false);
  const [discardDraftDialogOpen, setDiscardDraftDialogOpen] = useState(false);
  const [deleteTripDialogOpen, setDeleteTripDialogOpen] = useState(false);
  const [deletingTrip, setDeletingTrip] = useState(false);
  const lastEventAtRef = useRef(0);
  const lastMergedRemoteTripEventIdRef = useRef<string | null>(null);
  const routeDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const routeFetchAbortRef = useRef<AbortController | null>(null);
  const lastSuccessfulDirectionsKeyRef = useRef("");
  const hasUnsavedChangesRef = useRef(false);
  const routeSectionRef = useRef<HTMLElement | null>(null);
  const saveInFlightRef = useRef(false);
  const performSaveRef = useRef<(name: string) => Promise<void>>(async () => {});
  const router = useRouter();

  const canEditTrip =
    (currentUserRole === "OWNER" || currentUserRole === "EDITOR") &&
    (tripStatus === "DRAFT" || isPublic);
  const canManageTrip = currentUserRole === "OWNER";
  const canInviteTrip = currentUserRole === "OWNER" || currentUserRole === "EDITOR";
  const collaborationEnabled = canUseCollaboration(userPlan);
  const timelineEnabled = canUseActivityTimeline(userPlan);
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
    DRAFT: "Add key stops—your draft saves automatically.",
    PLANNING: "",
    FINALIZED: "Your itinerary is ready to publish and share.",
    SHARED: "Your shared itinerary is available to collaborators and viewers.",
  };

  const getCollabToastMessage = (
    eventType?: string,
    payload?: EventPayload,
    actorName?: string
  ) => {
    const actor = actorName || "Someone";
    switch (eventType) {
      case "trip.updated": {
        const lines = payload?.activityLines;
        if (Array.isArray(lines) && typeof lines[0] === "string" && lines[0].trim()) {
          return `${actor} saved: ${lines[0]}`;
        }
        return `${actor} updated itinerary details.`;
      }
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

  /** Splits server-written activity lines: true route permutations vs other edits. */
  const splitActivityDetailLines = (lines: string[]) => {
    const primary: string[] = [];
    const reorder: string[] = [];
    for (const line of lines) {
      if (/\bre-ordered\b/i.test(line)) reorder.push(line);
      else primary.push(line);
    }
    return { primary, reorder };
  };

  const getEventActivityLines = (evt: TripTimelineEvent): string[] => {
    const p = evt.payload || {};
    const raw = p.activityLines;
    if (Array.isArray(raw)) {
      return raw.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
    }
    if (evt.type === "trip.updated") {
      const w = Number(p.waypointCount ?? 0);
      const d = Number(p.dayCount ?? 0);
      if (w || d) {
        return [
          `${w} stop(s), ${d} day plan(s). Older saves do not include a detailed change list.`,
        ];
      }
    }
    if (evt.type === "trip.created") {
      const w = Number(p.waypointCount ?? 0);
      if (w) return [`${w} stop(s) at creation. Older events do not list stop names.`];
    }
    return [];
  };

  const formatEventHeadline = (
    evt: TripTimelineEvent,
    detailLines: string[],
    split: ReturnType<typeof splitActivityDetailLines>
  ): string => {
    const payload = evt.payload || {};
    const actorName = (payload.actorName as string) || "Someone";
    const { primary, reorder } = split;
    switch (evt.type) {
      case "trip.updated":
        if (detailLines.length === 0) return `${actorName} saved the itinerary`;
        if (primary.length === 1 && reorder.length === 0 && detailLines.length === 1) {
          return primary[0]!;
        }
        if (primary.length === 1 && reorder.length > 0) {
          return primary[0]!;
        }
        if (primary.length === 0 && reorder.length > 0) {
          return `${actorName} re-ordered ${reorder.length} ${reorder.length === 1 ? "stop" : "stops"}`;
        }
        if (detailLines.length > 1) {
          return `${actorName} updated the itinerary (${detailLines.length} changes)`;
        }
        return detailLines[0] ?? `${actorName} saved the itinerary`;
      case "trip.created":
        return `${actorName} created this itinerary`;
      case "trip.finalized":
        return `${actorName} finalized the itinerary`;
      case "trip.unfinalized":
        return `${actorName} moved the itinerary back to draft`;
      case "trip.published":
        return `${actorName} published this itinerary for sharing`;
      case "trip.unpublished":
        return `${actorName} unpublished this itinerary`;
      case "trip.invite.created":
        return `${actorName} invited ${(payload.email as string) || "a collaborator"} as ${
          (payload.role as string) || "member"
        }`;
      case "trip.invite.revoked":
        return `${actorName} revoked an invite`;
      case "trip.invite.accepted":
        return `${actorName} accepted an invite`;
      case "trip.member.upserted":
        return `${actorName} changed ${(payload.email as string) || "a member"} to ${
          (payload.role as string) || "member"
        }`;
      case "trip.member.removed":
        return `${actorName} removed a member`;
      default:
        return `${actorName} updated the itinerary`;
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
    if (!effectiveTripId || !timelineEnabled) return;
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
  }, [effectiveTripId, timelineEnabled]);

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
            estimatedTravelMeters: Math.max(0, Math.round(plan.estimatedTravelMeters || 0)),
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
            estimatedTravelMeters: 0,
          },
        ];
      }

      if (missingIds.length > 0) {
        if (cleaned.length === 0) {
          cleaned.push({
            day: 1,
            waypointIds: missingIds,
            estimatedTravelMinutes: 0,
            estimatedTravelMeters: 0,
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

  const createSaveSignature = ({
    name,
    waypoints: routeWaypoints,
    dayPlans,
    dayStartMinutes: startMinutes,
    dayEndMinutes: endMinutes,
    defaultVisitMinutes: visitDefaults,
  }: SaveSignatureInput) =>
    JSON.stringify({
      name: name.trim(),
      waypoints: [...routeWaypoints]
        .sort((a, b) => a.order - b.order)
        .map((wp) => ({
          name: wp.name,
          notes: wp.notes || "",
          lat: Number(wp.lat.toFixed(6)),
          lng: Number(wp.lng.toFixed(6)),
          order: wp.order,
          isLocked: wp.isLocked ?? false,
          isTransitSplit: wp.isTransitSplit ?? false,
          visitMinutes: wp.visitMinutes ?? visitDefaults,
          openMinutes: wp.openMinutes ?? 0,
          closeMinutes: wp.closeMinutes ?? 23 * 60 + 59,
        })),
      dayPlans: [...dayPlans]
        .sort((a, b) => a.day - b.day)
        .map((dayPlan) => ({
          day: dayPlan.day,
          waypointIndexes: dayPlan.waypointIds
            .map((id) => routeWaypoints.findIndex((wp) => wp.id === id))
            .filter((idx) => idx >= 0),
          estimatedTravelMinutes: dayPlan.estimatedTravelMinutes,
        })),
      optimizationSettings: {
        dayStartMinutes: startMinutes,
        dayEndMinutes: endMinutes,
        defaultVisitMinutes: visitDefaults,
      },
    });

  const currentSaveSignature = useMemo(
    () =>
      createSaveSignature({
        name: tripName,
        waypoints,
        dayPlans: optimizeDays,
        dayStartMinutes,
        dayEndMinutes,
        defaultVisitMinutes,
      }),
    [
      tripName,
      waypoints,
      optimizeDays,
      dayStartMinutes,
      dayEndMinutes,
      defaultVisitMinutes,
    ]
  );

  const hasUnsavedChanges = useMemo(() => {
    // URL `/planner` only: draft exists if there are stops (avoid stale activeTripId from store).
    if (!tripId) return waypoints.length > 0;
    if (!lastSavedSignature) return true;
    return currentSaveSignature !== lastSavedSignature;
  }, [tripId, waypoints.length, currentSaveSignature, lastSavedSignature]);

  useEffect(() => {
    hasUnsavedChangesRef.current = hasUnsavedChanges;
  }, [hasUnsavedChanges]);

  const formatMinutes = (minutes: number) => {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hrs === 0) return `${mins}m`;
    if (mins === 0) return `${hrs}h`;
    return `${hrs}h ${mins}m`;
  };

  const formatKm = (meters: number) => {
    if (!Number.isFinite(meters) || meters <= 0) return "0.0 km";
    return `${(meters / 1000).toFixed(1)} km`;
  };

  const estimateLegMinutesForDay = useCallback((a: WaypointData, b: WaypointData) => {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const earthRadiusKm = 6371;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const sinDLat = Math.sin(dLat / 2);
    const sinDLng = Math.sin(dLng / 2);
    const h =
      sinDLat * sinDLat +
      Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
    const distanceKm = 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
    const speedKmPerHour = 60; // Keep manual recalc aligned with default driving mode
    return Math.max(1, Math.round((distanceKm / speedKmPerHour) * 60));
  }, []);

  const estimateLegMetersForDay = useCallback((a: WaypointData, b: WaypointData) => {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const earthRadiusKm = 6371;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const sinDLat = Math.sin(dLat / 2);
    const sinDLng = Math.sin(dLng / 2);
    const h =
      sinDLat * sinDLat +
      Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
    const distanceKm = 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
    return Math.round(distanceKm * 1000);
  }, []);

  const recalculateDayPlanTravel = useCallback(
    (plans: DayPlan[], allWaypoints: WaypointData[]): DayPlan[] => {
      const waypointById = new Map(allWaypoints.map((wp) => [wp.id, wp]));
      let previousDayLastWaypointId: string | null = null;

      return plans.map((plan) => {
        let estimatedTravelMinutes = 0;
        let estimatedTravelMeters = 0;

        // Carry-over leg: previous day's endpoint -> current day's first stop.
        if (previousDayLastWaypointId && plan.waypointIds.length > 0) {
          const previousDayLast = waypointById.get(previousDayLastWaypointId);
          const currentDayFirst = waypointById.get(plan.waypointIds[0]);
          if (previousDayLast && currentDayFirst) {
            estimatedTravelMinutes += estimateLegMinutesForDay(previousDayLast, currentDayFirst);
            estimatedTravelMeters += estimateLegMetersForDay(previousDayLast, currentDayFirst);
          }
        }

        for (let i = 0; i < plan.waypointIds.length - 1; i += 1) {
          const from = waypointById.get(plan.waypointIds[i]);
          const to = waypointById.get(plan.waypointIds[i + 1]);
          if (!from || !to) continue;
          estimatedTravelMinutes += estimateLegMinutesForDay(from, to);
          estimatedTravelMeters += estimateLegMetersForDay(from, to);
        }

        if (plan.waypointIds.length > 0) {
          previousDayLastWaypointId = plan.waypointIds[plan.waypointIds.length - 1];
        }

        return { ...plan, estimatedTravelMinutes, estimatedTravelMeters };
      });
    },
    [estimateLegMinutesForDay, estimateLegMetersForDay]
  );

  const getDayVisitMinutes = (dayPlan: DayPlan) =>
    dayPlan.waypointIds.reduce((total, id) => {
      const wp = waypoints.find((item) => item.id === id);
      if (!wp) return total;
      if (wp.isTransitSplit) return total;
      const visit =
        typeof wp.visitMinutes === "number" && Number.isFinite(wp.visitMinutes)
          ? Math.max(0, Math.round(wp.visitMinutes))
          : defaultVisitMinutes;
      return total + visit;
    }, 0);

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
      estimatedTravelMeters: d.estimatedTravelMeters,
    })),
    summary,
  });

  const applySnapshot = (snapshot: OptimizationSnapshot) => {
    reorderWaypoints(snapshot.waypoints);
    setOptimizeDays(snapshot.days);
    setOptimizeSummary(snapshot.summary);
  };
  useEffect(() => {
    setOptimizeDays((prev) =>
      recalculateDayPlanTravel(normalizeDayPlans(waypoints, prev), waypoints)
    );
  }, [waypoints, normalizeDayPlans, recalculateDayPlanTravel]);

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

  // Desktop starts with sidebar open; mobile keeps map full-screen.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    if (mq.matches) setSidebarOpen(true);
  }, [setSidebarOpen]);

  useEffect(() => {
    if (!sidebarOpen || !isMobile) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sidebarOpen, isMobile, setSidebarOpen]);

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

  const resetNewTripPlanner = useCallback(() => {
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
    setLastSavedSignature(null);
    setAutoSplitLongTransfers(false);
  }, [
    resetTrip,
    setTripId,
    setDayStartMinutes,
    setDayEndMinutes,
    setDefaultVisitMinutes,
  ]);

  const isSyntheticTransitWaypoint = useCallback(
    (wp: { isTransitSplit?: boolean; name?: string }) =>
      wp.isTransitSplit === true ||
      (typeof wp.name === "string" && wp.name.startsWith(TRANSIT_SPLIT_NAME_PREFIX)),
    []
  );

  const nonSyntheticWaypointsForRoute = useMemo(
    () => waypoints.filter((w) => !isSyntheticTransitWaypoint(w)),
    [waypoints, isSyntheticTransitWaypoint]
  );

  const routeCoordKey = useMemo(
    () =>
      nonSyntheticWaypointsForRoute.length < 2
        ? ""
        : buildDirectionsCoordKeyFromWaypoints(nonSyntheticWaypointsForRoute),
    [nonSyntheticWaypointsForRoute]
  );

  const ROUTE_FETCH_DEBOUNCE_MS = 700;

  useEffect(() => {
    if (!routeCoordKey || nonSyntheticWaypointsForRoute.length < 2) {
      if (routeDebounceTimerRef.current) {
        clearTimeout(routeDebounceTimerRef.current);
        routeDebounceTimerRef.current = null;
      }
      routeFetchAbortRef.current?.abort();
      routeFetchAbortRef.current = null;
      lastSuccessfulDirectionsKeyRef.current = "";
      setRoute(null);
      setLoading("route", false);
      return;
    }

    const routeNow = useTripStore.getState().route;
    if (
      routeCoordKey === lastSuccessfulDirectionsKeyRef.current &&
      routeNow?.geometry?.coordinates &&
      routeNow.geometry.coordinates.length >= 2
    ) {
      return;
    }

    if (routeDebounceTimerRef.current) {
      clearTimeout(routeDebounceTimerRef.current);
      routeDebounceTimerRef.current = null;
    }

    routeDebounceTimerRef.current = setTimeout(() => {
      routeDebounceTimerRef.current = null;
      const wps = useTripStore
        .getState()
        .waypoints.filter((w) => !isSyntheticTransitWaypoint(w));
      if (wps.length < 2) {
        lastSuccessfulDirectionsKeyRef.current = "";
        setRoute(null);
        setLoading("route", false);
        return;
      }
      const keyNow = buildDirectionsCoordKeyFromWaypoints(wps);
      const latestRoute = useTripStore.getState().route;
      if (
        keyNow === lastSuccessfulDirectionsKeyRef.current &&
        latestRoute?.geometry?.coordinates &&
        latestRoute.geometry.coordinates.length >= 2
      ) {
        return;
      }

      routeFetchAbortRef.current?.abort();
      const ac = new AbortController();
      routeFetchAbortRef.current = ac;
      setLoading("route", true);
      const coords: [number, number][] = wps.map((w) => [w.lng, w.lat]);
      getDirections(coords, { signal: ac.signal })
        .then((result) => {
          if (ac.signal.aborted) return;
          if (result) {
            lastSuccessfulDirectionsKeyRef.current = keyNow;
            setRoute({
              distance: result.distance,
              duration: result.duration,
              geometry: result.geometry,
              legs: result.legs,
            });
          } else {
            setRoute(null);
          }
        })
        .catch(() => {
          if (ac.signal.aborted) return;
          setRoute(null);
        })
        .finally(() => {
          if (!ac.signal.aborted) {
            setLoading("route", false);
          }
        });
    }, ROUTE_FETCH_DEBOUNCE_MS);

    return () => {
      if (routeDebounceTimerRef.current) {
        clearTimeout(routeDebounceTimerRef.current);
        routeDebounceTimerRef.current = null;
      }
      routeFetchAbortRef.current?.abort();
      routeFetchAbortRef.current = null;
    };
  }, [
    routeCoordKey,
    nonSyntheticWaypointsForRoute.length,
    isSyntheticTransitWaypoint,
    setRoute,
    setLoading,
  ]);

  // New trip: reset store. Existing trip: load data
  useEffect(() => {
    if (!tripId) {
      resetNewTripPlanner();
      return;
    }
    setTripId(tripId);
    lastMergedRemoteTripEventIdRef.current = null;
    fetch(`/api/trips/${tripId}`)
      .then((res) => res.json())
      .then((data) => {
        const loadedTripName = typeof data.name === "string" ? data.name : "";
        if (data.waypoints) {
          resetTrip();
          setTripId(tripId);
          setTripName(loadedTripName);
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
          const loadedWaypoints = [...data.waypoints]
            .filter(
              (wp: { isTransitSplit?: boolean; name?: string }) =>
                !isSyntheticTransitWaypoint(wp)
            )
            .sort(
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
          const normalizedLoadedDayPlans = normalizeDayPlans(
            loadedWaypoints.map(
              (wp: {
                id: string;
                name: string;
                notes?: string;
                lat: number;
                lng: number;
                order: number;
                isLocked?: boolean;
                isTransitSplit?: boolean;
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
                isTransitSplit: wp.isTransitSplit ?? false,
                visitMinutes: wp.visitMinutes,
                openMinutes: wp.openMinutes,
                closeMinutes: wp.closeMinutes,
              })
            ),
            Array.isArray(data.dayPlans)
              ? data.dayPlans.map(
                  (dp: {
                    day: number;
                    waypointIndexes: number[];
                    waypointIds?: string[];
                    estimatedTravelMinutes: number;
                    estimatedTravelMeters?: number;
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
                    estimatedTravelMeters: dp.estimatedTravelMeters || 0,
                  })
                )
              : []
          );
          const recalculatedLoadedDayPlans = recalculateDayPlanTravel(
            normalizedLoadedDayPlans,
            loadedWaypoints
          );
          setOptimizeDays(recalculatedLoadedDayPlans);
          setLastSavedSignature(
            createSaveSignature({
              name: loadedTripName.trim() ? loadedTripName : DEFAULT_SAVE_NAME,
              waypoints: loadedWaypoints.map(
                (wp: {
                  name: string;
                  notes?: string;
                  lat: number;
                  lng: number;
                  order: number;
                  isLocked?: boolean;
                  isTransitSplit?: boolean;
                  visitMinutes?: number;
                  openMinutes?: number;
                  closeMinutes?: number;
                }) => ({
                  ...wp,
                  isLocked: wp.isLocked ?? false,
                  isTransitSplit: wp.isTransitSplit ?? false,
                })
              ),
              dayPlans: recalculatedLoadedDayPlans,
              dayStartMinutes:
                typeof data.optimizerDayStartMinutes === "number"
                  ? data.optimizerDayStartMinutes
                  : 9 * 60,
              dayEndMinutes:
                typeof data.optimizerDayEndMinutes === "number"
                  ? data.optimizerDayEndMinutes
                  : 20 * 60,
              defaultVisitMinutes:
                typeof data.optimizerDefaultVisitMinutes === "number"
                  ? data.optimizerDefaultVisitMinutes
                  : 60,
            })
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
    isSyntheticTransitWaypoint,
    setDayStartMinutes,
    setDayEndMinutes,
    setDefaultVisitMinutes,
    resetNewTripPlanner,
    recalculateDayPlanTravel,
  ]);

  const performSave = async (resolvedName: string) => {
    if (!session?.user || !canEditTrip) return;
    if (saveInFlightRef.current) return;
    saveInFlightRef.current = true;
    const nameToPersist = resolvedName.trim() || DEFAULT_SAVE_NAME;
    setSaving(true);
    setSaved(false);
    setSaveError("");
    try {
      const body = {
        name: nameToPersist,
        waypoints: waypoints
          .filter((w) => !isSyntheticTransitWaypoint(w))
          .map((w) => ({
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
        dayPlans: recalculateDayPlanTravel(optimizeDays, waypoints).map((dp) => ({
          day: dp.day,
          waypointIds: dp.waypointIds,
          waypointIndexes: dp.waypointIds
            .map((id) => waypoints.findIndex((w) => w.id === id))
            .filter((idx) => idx >= 0),
          estimatedTravelMinutes: dp.estimatedTravelMinutes,
          estimatedTravelMeters: dp.estimatedTravelMeters,
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
        if (!tripId && typeof data.id === "string") {
          router.replace(`/planner/${data.id}`);
        }
        setTripName(
          typeof data.name === "string" && data.name.trim()
            ? data.name.trim()
            : nameToPersist
        );
        if (data.currentUserRole) setCurrentUserRole(data.currentUserRole as TripRole);
        if (data.status) setTripStatus(data.status as TripStatus);
        setIsPublic(Boolean(data.isPublic));
        setLastSavedSignature(
          createSaveSignature({
            name: nameToPersist,
            waypoints,
            dayPlans: optimizeDays,
            dayStartMinutes,
            dayEndMinutes,
            defaultVisitMinutes,
          })
        );
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
      saveInFlightRef.current = false;
    }
  };

  performSaveRef.current = performSave;

  useEffect(() => {
    if (!session?.user || !canEditTrip) return;
    if (!hasUnsavedChanges) return;
    if (saving) return;
    const id = window.setTimeout(() => {
      const name =
        useTripStore.getState().tripName.trim() || DEFAULT_SAVE_NAME;
      void performSaveRef.current(name);
    }, 1500);
    return () => window.clearTimeout(id);
  }, [hasUnsavedChanges, saving, session?.user, canEditTrip]);

  const handleConfirmDiscardDraft = () => {
    setDiscardDraftDialogOpen(false);
    setEditingName(false);
    setSelectedPOI(null);
    setActiveWaypoint(null);
    setRouteSummaryOpen(false);
    setPickPointsMode(false);
    setRouteExploreOpen(false);
    setCollaborationPanelOpen(false);
    resetNewTripPlanner();
    toast.success("Draft discarded.");
    router.replace("/dashboard");
  };

  const handleConfirmDeleteTrip = async () => {
    const currentTripId = useTripStore.getState().tripId;
    if (!currentTripId || !canManageTrip) return;
    setDeletingTrip(true);
    try {
      const res = await fetch(`/api/trips/${currentTripId}`, { method: "DELETE" });
      if (res.ok) {
        setDeleteTripDialogOpen(false);
        resetNewTripPlanner();
        router.push("/dashboard");
      } else {
        const err = await res.json().catch(() => null);
        toast.error(typeof err?.error === "string" ? err.error : "Could not delete itinerary");
      }
    } finally {
      setDeletingTrip(false);
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

  const handleSetVisibility = async (nextPublic: boolean) => {
    const currentTripId = useTripStore.getState().tripId;
    if (!currentTripId || !canManageTrip) return;
    setActionError("");
    setActionNotice("");
    try {
      const res = await fetch(`/api/trips/${currentTripId}/publish`, {
        method: nextPublic ? "POST" : "DELETE",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setActionError(
          data?.error ||
            (nextPublic
              ? "Failed to make itinerary public"
              : "Failed to make itinerary private")
        );
        return;
      }
      setIsPublic(Boolean(data?.isPublic));
      const shareUrl = data?.shareUrl as string | undefined;
      if (nextPublic && shareUrl && typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl).catch(() => {});
      }
      setActionNotice(
        nextPublic
          ? shareUrl
            ? "Itinerary is public. Share link copied to clipboard."
            : "Itinerary is public."
          : "Itinerary is private."
      );
      window.setTimeout(() => setActionNotice(""), 3200);
    } catch {
      setActionError(
        nextPublic ? "Failed to make itinerary public" : "Failed to make itinerary private"
      );
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
        "driving",
        dayStartMinutes,
        dayEndMinutes,
        defaultVisitMinutes,
        waypoints.filter((wp) => wp.isLocked).map((wp) => wp.id),
        {},
        timeWindowsByWaypointId,
        autoSplitLongTransfers
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
                estimatedTravelMeters: dayPlan.estimatedTravelMeters || 0,
              }))
            )
          );
          setOptimizeSummary(
            optimized.optimization
              ? `Optimized ${optimized.optimization.optimizedIntermediateWaypointIndex.length} stop${
                  optimized.optimization.optimizedIntermediateWaypointIndex.length === 1
                    ? ""
                    : "s"
                } by travel time into ${optimized.days.length} day${
                  optimized.days.length !== 1 ? "s" : ""
                }`
              : `Optimized into ${optimized.days.length} day${
                  optimized.days.length !== 1 ? "s" : ""
                }`
          );
        } else {
          setOptimizeDays([]);
          setOptimizeSummary(
            optimized.optimization
              ? `Route optimized by travel time (${Math.max(
                  0,
                  Math.round(
                    (optimized.optimization.originalTravelSeconds -
                      optimized.optimization.optimizedTravelSeconds) /
                      60
                  )
                )} min saved)`
              : "Route optimized"
          );
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
    setOptimizeDays((prev) =>
      recalculateDayPlanTravel(
        normalizeDayPlans(waypoints, updater(prev)),
        waypoints
      )
    );
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
    if (!effectiveTripId || !session?.user?.id || !timelineEnabled) return;
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
        toast.message(getCollabToastMessage(parsed?.type, parsed?.payload, actorName), {
          duration: 2800,
        });
      }
      if (parsed?.id && parsed.type && parsed.createdAt) {
        const eventId = parsed.id;
        const eventType = parsed.type;
        const eventCreatedAt = parsed.createdAt;
        const eventPayload = parsed.payload || {};
        const eventActorId = parsed.actorId;
        setActivityEvents((prev) => {
          const next = [
            {
              id: eventId,
              type: eventType,
              payload: eventPayload,
              actorId: eventActorId,
              createdAt: eventCreatedAt,
            },
            ...prev.filter((evt) => evt.id !== eventId),
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

          const tripPayload = tripPayloadFromJson(data);
          const eventActorId = parsed?.actorId;
          const shouldMergeRemoteWaypoints =
            parsed?.type === "trip.updated" &&
            typeof eventActorId === "string" &&
            typeof session?.user?.id === "string" &&
            eventActorId !== session.user.id &&
            !hasUnsavedChangesRef.current &&
            Boolean(tripPayload);

          if (!shouldMergeRemoteWaypoints || !tripPayload) {
            return;
          }

          const parsedWp = parseTripWaypointsForStore(tripPayload, isSyntheticTransitWaypoint);
          if (!parsedWp) return;

          const incomingKey = buildDirectionsCoordKeyFromWaypoints(parsedWp.waypoints);
          const localKey = buildDirectionsCoordKeyFromWaypoints(
            useTripStore.getState().waypoints.filter((w) => !isSyntheticTransitWaypoint(w))
          );

          if (incomingKey === localKey) {
            return;
          }

          const eventId = parsed?.id;
          if (typeof eventId === "string" && lastMergedRemoteTripEventIdRef.current === eventId) {
            return;
          }
          if (typeof eventId === "string") {
            lastMergedRemoteTripEventIdRef.current = eventId;
          }

          lastSuccessfulDirectionsKeyRef.current = "";
          const loadedTripName = parsedWp.tripName;
          setTripName(loadedTripName.trim() ? loadedTripName : DEFAULT_SAVE_NAME);

          if (typeof tripPayload.optimizerDayStartMinutes === "number") {
            setDayStartMinutes(tripPayload.optimizerDayStartMinutes);
          }
          if (typeof tripPayload.optimizerDayEndMinutes === "number") {
            setDayEndMinutes(tripPayload.optimizerDayEndMinutes);
          }
          if (typeof tripPayload.optimizerDefaultVisitMinutes === "number") {
            setDefaultVisitMinutes(tripPayload.optimizerDefaultVisitMinutes);
          }

          const loadedWaypoints = parsedWp.waypoints;
          const loadedWaypointIdSet = parsedWp.loadedWaypointIdSet;

          reorderWaypoints(loadedWaypoints);

          const optDefVisit =
            typeof tripPayload.optimizerDefaultVisitMinutes === "number"
              ? tripPayload.optimizerDefaultVisitMinutes
              : defaultVisitMinutes;

          setVisitMinutesByWaypointId(
            loadedWaypoints.reduce<Record<string, number>>((acc, wp) => {
              acc[wp.id] = wp.visitMinutes ?? optDefVisit;
              return acc;
            }, {})
          );
          setTimeWindowsByWaypointId(
            loadedWaypoints.reduce<Record<string, { openMinutes: number; closeMinutes: number }>>(
              (acc, wp) => {
                acc[wp.id] = {
                  openMinutes: wp.openMinutes ?? 0,
                  closeMinutes: wp.closeMinutes ?? 23 * 60 + 59,
                };
                return acc;
              },
              {}
            )
          );

          const normalizedLoadedDayPlans = normalizeDayPlans(
            loadedWaypoints.map((wp) => ({
              ...wp,
              isTransitSplit: wp.isTransitSplit ?? false,
            })),
            Array.isArray(tripPayload.dayPlans)
              ? tripPayload.dayPlans.map((dp) => ({
                  day: dp.day,
                  waypointIds:
                    dp.waypointIds &&
                    dp.waypointIds.length > 0 &&
                    dp.waypointIds.every((id) => loadedWaypointIdSet.has(id))
                      ? dp.waypointIds
                      : (dp.waypointIndexes || [])
                          .map((idx) => loadedWaypoints[idx]?.id)
                          .filter((id): id is string => typeof id === "string"),
                  estimatedTravelMinutes: dp.estimatedTravelMinutes || 0,
                  estimatedTravelMeters: dp.estimatedTravelMeters || 0,
                }))
              : []
          );

          const recalculatedLoadedDayPlans = recalculateDayPlanTravel(
            normalizedLoadedDayPlans,
            loadedWaypoints
          );
          setOptimizeDays(recalculatedLoadedDayPlans);
          setLastSavedSignature(
            createSaveSignature({
              name: loadedTripName.trim() ? loadedTripName : DEFAULT_SAVE_NAME,
              waypoints: loadedWaypoints.map((wp) => ({
                name: wp.name,
                notes: wp.notes,
                lat: wp.lat,
                lng: wp.lng,
                order: wp.order,
                isLocked: wp.isLocked ?? false,
                isTransitSplit: wp.isTransitSplit ?? false,
                visitMinutes: wp.visitMinutes,
                openMinutes: wp.openMinutes,
                closeMinutes: wp.closeMinutes,
              })),
              dayPlans: recalculatedLoadedDayPlans,
              dayStartMinutes:
                typeof tripPayload.optimizerDayStartMinutes === "number"
                  ? tripPayload.optimizerDayStartMinutes
                  : 9 * 60,
              dayEndMinutes:
                typeof tripPayload.optimizerDayEndMinutes === "number"
                  ? tripPayload.optimizerDayEndMinutes
                  : 20 * 60,
              defaultVisitMinutes:
                typeof tripPayload.optimizerDefaultVisitMinutes === "number"
                  ? tripPayload.optimizerDefaultVisitMinutes
                  : 60,
            })
          );
          if (Array.isArray(tripPayload.dayPlans) && tripPayload.dayPlans.length > 0) {
            setShowDayPlanner(true);
          }
        })
        .catch(() => {});
    };
    stream.addEventListener("trip_event", handleTripEvent);
    return () => {
      stream.removeEventListener("trip_event", handleTripEvent);
      stream.close();
    };
  }, [
    effectiveTripId,
    session?.user?.id,
    timelineEnabled,
    isSyntheticTransitWaypoint,
    normalizeDayPlans,
    recalculateDayPlanTravel,
    createSaveSignature,
    defaultVisitMinutes,
    reorderWaypoints,
    setTripName,
    setVisitMinutesByWaypointId,
    setTimeWindowsByWaypointId,
    setOptimizeDays,
    setLastSavedSignature,
    setDayStartMinutes,
    setDayEndMinutes,
    setDefaultVisitMinutes,
    setShowDayPlanner,
  ]);

  useEffect(() => {
    if (!collaborationPanelOpen || collaborationTab !== "activity") return;
    if (!effectiveTripId || !timelineEnabled) return;
    void loadActivityHistory();
  }, [
    collaborationPanelOpen,
    collaborationTab,
    effectiveTripId,
    timelineEnabled,
    loadActivityHistory,
  ]);

  if (!sidebarOpen) {
    return (
      <>
        <div className="fixed top-[max(0.75rem,env(safe-area-inset-top))] left-3 sm:top-4 sm:left-4 z-[70] flex items-center gap-2 pointer-events-none">
          <Link
            href={session?.user ? "/dashboard" : "/"}
            className="pointer-events-auto p-2 sm:p-2.5 rounded-lg bg-white shadow-lg border hover:bg-gray-50 min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label={session?.user ? "Back to dashboard" : "Back to home"}
            title={session?.user ? "Dashboard" : "Home"}
          >
            <Home className="h-5 w-5" aria-hidden />
          </Link>
          {adminReady && isAdminUser && (
            <Link
              href="/admin"
              className="pointer-events-auto p-2 sm:p-2.5 rounded-lg bg-white shadow-lg border hover:bg-gray-50 min-w-[44px] min-h-[44px] flex items-center justify-center text-amber-700"
              aria-label="Admin panel"
              title="Admin panel"
            >
              <Shield className="h-5 w-5" aria-hidden />
            </Link>
          )}
          {session?.user ? (
            <NotificationBell className="pointer-events-auto h-11 w-11 sm:h-10 sm:w-10 bg-white shadow-lg border hover:bg-gray-50 text-foreground" />
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            className="pointer-events-auto h-11 w-11 sm:h-10 sm:w-10 bg-white shadow-lg border hover:bg-gray-50"
            aria-label="Open itinerary sidebar"
            onClick={() => setSidebarOpen(true)}
          >
            <PanelLeft className="h-5 w-5" aria-hidden />
          </Button>
        </div>
        <nav
          className="fixed bottom-0 left-0 right-0 z-[70] lg:hidden pointer-events-none"
          aria-label="Itinerary quick access"
        >
          <div className="pointer-events-auto mx-auto max-w-lg px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
            <Button
              type="button"
              variant="secondary"
              aria-label={`Open itinerary sidebar, ${waypoints.length} ${waypoints.length === 1 ? "stop" : "stops"}`}
              className="w-full h-12 rounded-xl border bg-white/95 shadow-lg backdrop-blur-sm text-base font-medium gap-2"
              onClick={() => setSidebarOpen(true)}
            >
              <MapPin className="h-5 w-5 shrink-0 text-blue-600" aria-hidden />
              Itinerary
              <span className="text-muted-foreground font-normal tabular-nums">
                · {waypoints.length} {waypoints.length === 1 ? "stop" : "stops"}
              </span>
            </Button>
          </div>
        </nav>
      </>
    );
  }

  const sidebarPanel = (
    <div
      className={cn(
        "flex h-full w-full flex-col overflow-hidden bg-white",
        !isMobile && "lg:border-r"
      )}
    >
      {/* Header */}
      <div className="shrink-0 border-b border-slate-200/80 bg-gradient-to-b from-slate-50/90 to-white">
        <div className="px-3 pt-3 sm:px-4 sm:pt-4">
          <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/90 bg-white px-1 py-1 shadow-sm">
            <div className="flex min-w-0 flex-1 items-center gap-0.5">
              <Link
                href={session?.user ? "/dashboard" : "/"}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                title={session?.user ? "Dashboard" : "Home"}
              >
                <Home className="h-[1.15rem] w-[1.15rem]" aria-hidden />
              </Link>
              {adminReady && isAdminUser && (
                <Link
                  href="/admin"
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-amber-700 transition-colors hover:bg-amber-50 hover:text-amber-900"
                  title="Admin panel"
                  aria-label="Admin panel"
                >
                  <Shield className="h-[1.15rem] w-[1.15rem]" aria-hidden />
                </Link>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              {session?.user ? (
                collaborationEnabled ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 touch-manipulation rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        aria-label="Trip chat, members, and activity"
                        onClick={() => openCollaborationPanel("chat")}
                      >
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      Chat, members, and activity
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 touch-manipulation rounded-lg text-slate-400"
                          disabled
                          aria-label="Trip collaboration — upgrade to Pro"
                        >
                          <MessageCircle className="h-4 w-4 opacity-60" />
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      Upgrade to Pro for chat, members, and activity
                    </TooltipContent>
                  </Tooltip>
                )
              ) : null}
              {session?.user ? (
                <NotificationBell className="h-9 w-9 shrink-0 rounded-lg text-slate-700 hover:bg-slate-100" />
              ) : null}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0 touch-manipulation rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    aria-label="Jump to route and stops"
                    onClick={() =>
                      routeSectionRef.current?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      })
                    }
                  >
                    <ClipboardList className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Route & stops</TooltipContent>
              </Tooltip>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 touch-manipulation rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 lg:hidden"
                onClick={() => setSidebarOpen(false)}
                aria-label="Close itinerary"
              >
                <X className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 touch-manipulation rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 max-lg:hidden"
                onClick={() => setSidebarOpen(false)}
                aria-label="Close sidebar"
              >
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="px-3 pb-1 pt-4 sm:px-4 sm:pb-2 sm:pt-5">
          {editingName ? (
            <div className="flex items-center gap-2">
              <Input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="h-10 text-base font-medium"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setTripName(nameInput);
                    setEditingName(false);
                  }
                }}
              />
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 shrink-0 rounded-lg"
                onClick={() => {
                  setTripName(nameInput);
                  setEditingName(false);
                }}
              >
                <Check className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex min-w-0 items-center gap-0.5">
              <button
                type="button"
                className="group min-w-0 flex-1 rounded-lg py-0.5 text-left transition-colors hover:bg-slate-50/80 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                disabled={!canEditTrip}
                onClick={() => {
                  if (!canEditTrip) return;
                  setNameInput(tripName);
                  setEditingName(true);
                }}
              >
                <span
                  className={`block truncate text-xl font-semibold leading-snug tracking-tight sm:text-[1.35rem] ${
                    tripName.trim() ? "text-slate-900" : "text-muted-foreground"
                  }`}
                >
                  {tripName.trim() ? tripName : "Name your trip"}
                </span>
              </button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 touch-manipulation rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                disabled={!canEditTrip}
                aria-label="Edit itinerary name"
                onClick={() => {
                  if (!canEditTrip) return;
                  setNameInput(tripName);
                  setEditingName(true);
                }}
              >
                <Pencil className="h-4 w-4" aria-hidden />
              </Button>
              {session?.user && canManageTrip && effectiveTripId ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0 touch-manipulation rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                      aria-label="Trip options"
                    >
                      <MoreVertical className="h-4 w-4" aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" sideOffset={6} className="w-52">
                    <DropdownMenuItem
                      onClick={() => void handleSetVisibility(!isPublic)}
                      disabled={!effectiveTripId}
                    >
                      <Globe className="h-4 w-4" />
                      {isPublic ? "Make private" : "Make public"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => void handleFinalize()}
                      disabled={!effectiveTripId || tripStatus === "FINALIZED"}
                    >
                      Finalize itinerary
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setDeleteTripDialogOpen(true)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete itinerary
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
          )}
        </div>

        {session?.user && (
          <div className="space-y-2 px-3 pb-3 sm:px-4 sm:pb-4">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                  lifecycleStage === "SHARED"
                    ? "bg-emerald-700 text-white"
                    : tripStatus === "FINALIZED"
                      ? "bg-slate-800 text-white"
                      : "bg-slate-200/90 text-slate-700"
                }`}
              >
                {lifecycleLabelByStage[lifecycleStage].toUpperCase()}
              </span>
              <Badge
                variant="outline"
                className="rounded-full border-slate-200 bg-white px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-700"
              >
                {currentUserRole.toUpperCase()}
              </Badge>
              <Badge
                variant="outline"
                className="gap-1 rounded-full border-slate-200 bg-white px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-700"
              >
                <Users className="h-3 w-3 opacity-80" aria-hidden />
                {memberCount}
              </Badge>
              {saving ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
                  Saving…
                </span>
              ) : saveError ? (
                <span className="text-[11px] text-destructive">{saveError}</span>
              ) : saved && !hasUnsavedChanges ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                  <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Saved
                </span>
              ) : hasUnsavedChanges && canEditTrip ? (
                <span className="text-[11px] text-muted-foreground">Changes will save automatically</span>
              ) : effectiveTripId && !hasUnsavedChanges ? (
                <span className="text-[11px] font-medium text-emerald-700/90">All changes saved</span>
              ) : null}
            </div>
            {lifecycleHintByStage[lifecycleStage] ? (
              <p className="text-[11px] text-muted-foreground">
                {lifecycleHintByStage[lifecycleStage]}
              </p>
            ) : null}
            {(lifecycleStage === "SHARED" || (!tripId && waypoints.length > 0)) ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {lifecycleStage === "SHARED" ? (
                  <Button
                    size="sm"
                    className="w-full gap-1.5 min-h-9 touch-manipulation sm:col-span-2"
                    onClick={handleExportPdf}
                    disabled={!effectiveTripId}
                  >
                    <FileDown className="h-4 w-4" />
                    Export itinerary PDF
                  </Button>
                ) : null}
                {!tripId && waypoints.length > 0 ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-destructive border-destructive/35 hover:bg-destructive/10 sm:col-span-2"
                    onClick={() => setDiscardDraftDialogOpen(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Discard draft
                  </Button>
                ) : null}
              </div>
            ) : null}
            {!collaborationEnabled && (
              <p className="text-[11px] text-muted-foreground">
                Upgrade to Pro to unlock collaborators and activity timeline.
              </p>
            )}
          </div>
        )}
        <div className="space-y-3 px-3 pb-3 pt-1 sm:px-4 sm:pb-4">
        {showDayPlanner && optimizationHistory.length > 0 && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <Button
              onClick={handleUndoOptimization}
              variant="ghost"
              size="sm"
              className="gap-1.5 min-h-8 w-full sm:w-auto"
            >
              <Undo2 className="h-4 w-4" />
              Undo last optimization
            </Button>
            <Button
              onClick={handleResetAllOptimizations}
              variant="ghost"
              size="sm"
              className="gap-1.5 min-h-8 w-full sm:w-auto text-amber-700 hover:text-amber-800"
            >
              <RotateCcw className="h-4 w-4" />
              Reset all
            </Button>
          </div>
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
        <section aria-label="Map actions" className="pt-1">
          <SidebarRouteTools
            canEditTrip={canEditTrip}
            pickPointsMode={pickPointsMode}
            onTogglePick={() => {
              if (!canEditTrip) return;
              setPickPointsMode(!pickPointsMode);
            }}
            hasRouteGeometry={Boolean(route?.geometry)}
            onExplore={() => {
              setPickPointsMode(false);
              setRouteExploreOpen(true);
            }}
          />
        </section>
        {waypoints.length >= 3 && (
          <div className="space-y-3 rounded-2xl border border-blue-100/90 bg-gradient-to-b from-blue-50/95 to-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="min-w-0 flex-1 text-[11px] font-bold uppercase tracking-[0.12em] text-blue-800">
                Day-by-day itinerary
              </p>
              {showDayPlanner && optimizeDays.length > 0 && (
                <Badge
                  asChild
                  variant="secondary"
                  className="h-auto cursor-pointer border-emerald-200/90 bg-emerald-100 p-0 text-[10px] font-bold uppercase tracking-wide text-emerald-800 shadow-sm transition-colors hover:bg-emerald-200/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30"
                >
                  <button
                    type="button"
                    onClick={() => setDayPlannerOpen(true)}
                    className="inline-flex items-center justify-center rounded-full px-2.5 py-1 outline-none"
                    aria-label={`View generated day-by-day itinerary, ${optimizeDays.length} day${
                      optimizeDays.length !== 1 ? "s" : ""
                    }`}
                  >
                    {optimizeDays.length} day{optimizeDays.length !== 1 ? "s" : ""} ready
                  </button>
                </Badge>
              )}
            </div>
            <Button
              onClick={async () => {
                setDayPlannerOpen(true);
                if (!showDayPlanner && canEditTrip) {
                  await handleOptimize();
                }
              }}
              disabled={optimizing || !canEditTrip}
              size="sm"
              className="h-10 w-full gap-2 rounded-xl border-0 bg-slate-900 text-sm font-semibold text-white shadow-md hover:bg-slate-800 disabled:opacity-50"
            >
              {optimizing ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : showDayPlanner ? (
                <RotateCcw className="h-4 w-4" aria-hidden />
              ) : (
                <Sparkles className="h-4 w-4" aria-hidden />
              )}
              {showDayPlanner ? "Regenerate smart itinerary" : "Generate smart itinerary"}
            </Button>
          </div>
        )}
        </div>
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
                Or search above, add your first stop—your draft saves automatically.
              </p>
            </section>
          )}
          <section ref={routeSectionRef} className="scroll-mt-3">
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Route stops
            </h3>
            <WaypointList
              disabled={!canEditTrip}
              onWaypointReplaced={() => {
                if (!canEditTrip || optimizing || waypoints.length < 3) return;
                void handleOptimize();
              }}
            />
            {waypoints.length === 0 && (
              <div className="rounded-md border border-dashed p-3 mt-3">
                <p className="text-xs font-medium">No stops yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Add at least 3 stops to unlock day-wise auto planning.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {isMobile ? (
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent
            side="left"
            showCloseButton={false}
            accessibilityTitle="Trip itinerary"
            className="z-[90] flex h-[100dvh] max-h-[100dvh] w-[min(92vw,400px)] max-w-[400px] flex-col gap-0 overflow-hidden border-0 p-0 shadow-2xl"
          >
            {sidebarPanel}
          </SheetContent>
        </Sheet>
      ) : (
        <div className="absolute inset-y-0 left-0 z-30 hidden h-full w-[380px] lg:flex">
          {sidebarPanel}
        </div>
      )}

      {/* Detail Panel overlay */}
      {selectedPOI && (
        <PlaceDetailPanel
          poi={selectedPOI}
          onClose={() => setSelectedPOI(null)}
        />
      )}
      <Sheet open={dayPlannerOpen} onOpenChange={setDayPlannerOpen}>
        <SheetContent
          side="right"
          className="flex h-[100dvh] max-h-[100dvh] w-[min(100vw-0.5rem,26rem)] flex-col gap-0 border-l border-slate-200/90 bg-slate-50/90 p-0 shadow-2xl sm:max-w-md"
        >
          <SheetHeader className="shrink-0 space-y-2 border-b border-slate-200/80 bg-white px-5 pb-4 pt-5 pr-14 text-left">
            <SheetTitle className="flex items-center gap-3 text-lg font-semibold tracking-tight text-slate-900">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shadow-sm ring-1 ring-blue-100/80">
                <CalendarDays className="h-5 w-5" aria-hidden />
              </span>
              Day-by-Day Planner
            </SheetTitle>
            <SheetDescription className="text-left text-[13px] leading-relaxed text-slate-500">
              Adjust planning constraints and generate an itinerary by opening hours and nearest
              stops.
            </SheetDescription>
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      <Clock className="h-3 w-3 opacity-80" aria-hidden />
                      Day start
                    </p>
                    <Input
                      type="time"
                      className="h-10 rounded-lg border-slate-200 bg-slate-50/80 text-sm font-medium shadow-sm focus-visible:bg-white"
                      value={formatClock(dayStartMinutes)}
                      onChange={(e) => {
                        if (!canEditTrip) return;
                        const next = parseClock(e.target.value);
                        if (next === null) return;
                        setDayStartMinutes(Math.min(next, dayEndMinutes - 30));
                      }}
                      disabled={!canEditTrip}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      <Clock className="h-3 w-3 opacity-80" aria-hidden />
                      Day end
                    </p>
                    <Input
                      type="time"
                      className="h-10 rounded-lg border-slate-200 bg-slate-50/80 text-sm font-medium shadow-sm focus-visible:bg-white"
                      value={formatClock(dayEndMinutes)}
                      onChange={(e) => {
                        if (!canEditTrip) return;
                        const next = parseClock(e.target.value);
                        if (next === null) return;
                        setDayEndMinutes(Math.max(next, dayStartMinutes + 30));
                      }}
                      disabled={!canEditTrip}
                    />
                  </div>
                </div>
                <div className="mt-4 space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Visit min / stop (minutes)
                  </p>
                  <Input
                    type="number"
                    min={5}
                    step={5}
                    className="h-10 rounded-lg border-slate-200 bg-slate-50/80 text-sm font-medium shadow-sm focus-visible:bg-white"
                    value={defaultVisitMinutes}
                    onChange={(e) =>
                      canEditTrip &&
                      setDefaultVisitMinutes(Math.max(5, Number(e.target.value) || 60))
                    }
                    disabled={!canEditTrip}
                  />
                </div>
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm transition-colors hover:border-slate-300/90">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-slate-900"
                  checked={autoSplitLongTransfers}
                  onChange={(e) => setAutoSplitLongTransfers(e.target.checked)}
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-900">
                    Auto-split long transfers
                  </span>
                  <span className="mt-1 block text-[12px] leading-snug text-slate-500">
                    Adds en-route waypoints when a leg cannot fit in one day.
                  </span>
                </span>
              </label>

              <Button
                onClick={handleOptimize}
                disabled={optimizing || waypoints.length < 3 || !canEditTrip}
                className="h-11 w-full gap-2 rounded-xl border-0 bg-slate-900 text-sm font-semibold text-white shadow-md hover:bg-slate-800 disabled:opacity-50"
              >
                {optimizing ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <RotateCcw className="h-4 w-4" aria-hidden />
                )}
                Regenerate Day-by-Day Itinerary
              </Button>

              {showDayPlanner && optimizeDays.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Itinerary
                  </p>
                  {optimizeDays.map((dayPlan) => {
                    const isOpen = expandedDay === dayPlan.day;
                    const nStops = dayPlan.waypointIds.length;
                    return (
                      <div
                        key={dayPlan.day}
                        className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm"
                      >
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-50/80"
                          onClick={() =>
                            setExpandedDay((prev) => (prev === dayPlan.day ? null : dayPlan.day))
                          }
                        >
                          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                            <span className="text-base font-semibold text-slate-900">
                              Day {dayPlan.day}
                            </span>
                            <Badge
                              variant="outline"
                              className="rounded-full border-blue-100/90 bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-800 shadow-none"
                            >
                              {nStops} stop{nStops !== 1 ? "s" : ""}
                            </Badge>
                          </div>
                          <ChevronDown
                            className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${
                              isOpen ? "rotate-180" : ""
                            }`}
                            aria-hidden
                          />
                        </button>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-slate-100 px-4 py-2.5 text-xs font-medium text-slate-600">
                              <span className="inline-flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5 text-blue-600" aria-hidden />
                                {formatMinutes(getDayTotalMinutes(dayPlan))}
                              </span>
                              <span className="inline-flex items-center gap-1.5">
                                <MapPin className="h-3.5 w-3.5 text-blue-600" aria-hidden />
                                {formatKm(dayPlan.estimatedTravelMeters)} total
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[14rem]">
                            Total time includes driving between stops and visit time at each stop.
                          </TooltipContent>
                        </Tooltip>
                        {isOpen ? (
                          <div className="border-t border-slate-100 px-3 pb-3 pt-2">
                            <p className="mb-3 px-1 text-[11px] text-slate-500">
                              {formatMinutes(dayPlan.estimatedTravelMinutes)} travel +{" "}
                              {formatMinutes(getDayVisitMinutes(dayPlan))} visit
                            </p>
                            <ul className="relative ml-2 space-y-0 border-l-2 border-blue-100 pl-4">
                              {dayPlan.waypointIds.map((id, idx) => {
                                const wp = waypoints.find((w) => w.id === id);
                                if (!wp) return null;
                                const last = idx === dayPlan.waypointIds.length - 1;
                                return (
                                  <li key={id} className="relative pb-4 last:pb-1">
                                    <span
                                      className="absolute -left-[21px] top-2 flex h-2.5 w-2.5 rounded-full border-2 border-white bg-blue-600 shadow-sm ring-2 ring-blue-100"
                                      aria-hidden
                                    />
                                    {!last ? (
                                      <span
                                        className="absolute -left-[15px] top-5 h-[calc(100%-0.25rem)] w-0.5 bg-blue-100"
                                        aria-hidden
                                      />
                                    ) : null}
                                    <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 shadow-sm">
                                      <div className="flex items-start gap-2">
                                        <div className="min-w-0 flex-1">
                                          <p className="text-sm font-medium leading-snug text-slate-900">
                                            {placeNameForActivity(wp.name)}
                                          </p>
                                          {wp.isTransitSplit && (
                                            <p className="mt-0.5 text-[10px] text-slate-500">
                                              {(() => {
                                                const match = wp.id.match(/-(\d+)$/);
                                                return match
                                                  ? `En-route stop ${match[1]}`
                                                  : "En-route stop";
                                              })()}
                                            </p>
                                          )}
                                        </div>
                                        {wp.isTransitSplit && (
                                          <Badge
                                            variant="outline"
                                            className="shrink-0 border-slate-200 text-[10px]"
                                          >
                                            Transit
                                          </Badge>
                                        )}
                                        <div className="flex shrink-0 items-center gap-0.5">
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-slate-500"
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
                                            className="h-8 w-8 text-slate-500"
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
                                            className="h-8 w-8 text-slate-500"
                                            onClick={() =>
                                              moveWaypointWithinDay(dayPlan.day, id, "down")
                                            }
                                            disabled={
                                              idx === dayPlan.waypointIds.length - 1 ||
                                              !canEditTrip
                                            }
                                            title="Move down in day"
                                          >
                                            <ChevronDown className="h-3.5 w-3.5" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-slate-500"
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
                                        placeholder={
                                          wp.isTransitSplit
                                            ? "Transit stop generated for long transfer"
                                            : "Add note for this day plan stop..."
                                        }
                                        className="mt-2 h-8 border-slate-200/80 bg-white text-xs"
                                        onChange={(e) =>
                                          updateWaypoint(id, { notes: e.target.value })
                                        }
                                        disabled={!canEditTrip || wp.isTransitSplit}
                                      />
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white/80 px-4 py-8 text-center">
                  <p className="text-sm font-medium text-slate-700">No itinerary yet</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">
                    Set your day window above, then tap Regenerate to build your day-by-day plan.
                  </p>
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
      <Sheet open={collaborationPanelOpen} onOpenChange={setCollaborationPanelOpen}>
        <SheetContent
          side="right"
          className="h-[100dvh] max-h-[100dvh] w-full max-w-full gap-0 border-l p-0 sm:w-[min(90vw,28rem)] sm:max-w-md lg:w-[min(92vw,32rem)] lg:max-w-lg flex flex-col"
        >
          <SheetHeader className="shrink-0 space-y-1.5 border-b border-slate-200/80 bg-white px-4 py-4 pr-14 text-left">
            <SheetTitle className="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-slate-900">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                <MessageCircle className="h-4 w-4 shrink-0" aria-hidden />
              </span>
              Trip collaboration
            </SheetTitle>
            <SheetDescription className="text-left text-[13px] leading-relaxed text-slate-500">
              Chat, invite members, and review activity—Pro and Team plans.
            </SheetDescription>
          </SheetHeader>
          <Tabs
            value={collaborationTab}
            onValueChange={(v) => setCollaborationTab(v as CollaborationTab)}
            className="flex min-h-0 flex-1 flex-col gap-0"
          >
            <TabsList
              variant="line"
              className="mx-4 mt-2 h-11 w-[calc(100%-2rem)] shrink-0 justify-stretch rounded-none border-b border-slate-200/80 bg-transparent px-0.5 pb-0 pt-0"
            >
              <TabsTrigger
                value="chat"
                className="flex-1 gap-1.5 rounded-none text-xs font-medium sm:text-sm"
              >
                <MessageCircle className="h-3.5 w-3.5 opacity-70" aria-hidden />
                Chat
              </TabsTrigger>
              <TabsTrigger
                value="members"
                className="flex-1 gap-1.5 rounded-none text-xs font-medium sm:text-sm"
              >
                <Users className="h-3.5 w-3.5 opacity-70" aria-hidden />
                Members
              </TabsTrigger>
              <TabsTrigger
                value="activity"
                className="flex-1 gap-1.5 rounded-none text-xs font-medium sm:text-sm"
              >
                <History className="h-3.5 w-3.5 opacity-70" aria-hidden />
                Activity
              </TabsTrigger>
            </TabsList>
            <TabsContent
              value="chat"
              className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 data-[state=inactive]:hidden"
            >
              {!collaborationEnabled ? (
                <p className="text-xs text-muted-foreground">
                  Collaboration is available on Pro and Team plans.
                </p>
              ) : effectiveTripId ? (
                <TripMemberChat tripId={effectiveTripId} />
              ) : (
                <p className="text-xs text-muted-foreground">
                  Save the itinerary first to use trip chat.
                </p>
              )}
            </TabsContent>
            <TabsContent
              value="members"
              className="mt-0 min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 data-[state=inactive]:hidden"
            >
              {!collaborationEnabled ? (
                <p className="text-xs text-muted-foreground">
                  Collaboration is available on Pro and Team plans.
                </p>
              ) : effectiveTripId ? (
                <TripMembersPanel
                  tripId={effectiveTripId}
                  canManage={canManageTrip}
                  canInvite={canInviteTrip}
                />
              ) : (
                <p className="text-xs text-muted-foreground">
                  Save the itinerary first to invite collaborators.
                </p>
              )}
            </TabsContent>
            <TabsContent
              value="activity"
              className="mt-0 min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 data-[state=inactive]:hidden"
            >
              {!timelineEnabled ? (
                <p className="text-xs text-muted-foreground">
                  Activity timeline is available on Pro and Team plans.
                </p>
              ) : activityLoading ? (
                <p className="text-xs text-muted-foreground">Loading activity...</p>
              ) : activityEvents.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No activity yet. Changes will appear here in real time.
                </p>
              ) : (
                <div className="space-y-2 pr-1">
                  {activityEvents.map((evt) => {
                    const detailLines = getEventActivityLines(evt);
                    const split = splitActivityDetailLines(detailLines);
                    const { primary, reorder } = split;
                    const headlineOnlyTripUpdate =
                      evt.type === "trip.updated" &&
                      primary.length === 1 &&
                      reorder.length === 0 &&
                      detailLines.length === 1;
                    const showReorderCollapsible = reorder.length > 0;
                    const headlineRepeatsOnlyPrimary =
                      evt.type === "trip.updated" &&
                      primary.length === 1 &&
                      reorder.length > 0;
                    return (
                      <div key={evt.id} className="rounded-md border bg-muted/20 p-2.5">
                        <p className="text-xs font-medium text-foreground">
                          {formatEventHeadline(evt, detailLines, split)}
                        </p>
                        {detailLines.length > 0 && !headlineOnlyTripUpdate ? (
                          <div className="mt-2 space-y-2">
                            {primary.length > 0 && !headlineRepeatsOnlyPrimary ? (
                              <ul className="list-inside list-disc space-y-1 text-[11px] leading-snug text-muted-foreground">
                                {primary.map((line, idx) => (
                                  <li key={`p-${idx}`}>{line}</li>
                                ))}
                              </ul>
                            ) : null}
                            {showReorderCollapsible ? (
                              <details className="rounded-md border border-border/50 bg-background/60 px-2 py-1.5">
                                <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[11px] font-medium text-foreground marker:hidden [&::-webkit-details-marker]:hidden">
                                  <ChevronDown
                                    aria-hidden
                                    className="size-3.5 shrink-0 text-muted-foreground"
                                  />
                                  Re-ordered stops ({reorder.length})
                                </summary>
                                <ul className="mt-2 list-inside list-disc space-y-1 border-t border-border/40 pt-2 text-[11px] leading-snug text-muted-foreground">
                                  {reorder.map((line, idx) => (
                                    <li key={`r-${idx}`}>{line}</li>
                                  ))}
                                </ul>
                              </details>
                            ) : null}
                          </div>
                        ) : null}
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          {formatEventTime(evt.createdAt)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
    <Dialog open={discardDraftDialogOpen} onOpenChange={setDiscardDraftDialogOpen}>
      <DialogContent showCloseButton>
        <DialogHeader>
          <DialogTitle>Discard this draft?</DialogTitle>
          <DialogDescription>
            All stops on this unsaved itinerary will be removed. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setDiscardDraftDialogOpen(false)}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={handleConfirmDiscardDraft}>
            Discard draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={deleteTripDialogOpen} onOpenChange={setDeleteTripDialogOpen}>
      <DialogContent showCloseButton>
        <DialogHeader>
          <DialogTitle>Delete this itinerary?</DialogTitle>
          <DialogDescription>
            This permanently deletes the saved itinerary for everyone. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setDeleteTripDialogOpen(false)}
            disabled={deletingTrip}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void handleConfirmDeleteTrip()}
            disabled={deletingTrip}
          >
            {deletingTrip ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                Deleting…
              </>
            ) : (
              "Delete itinerary"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
