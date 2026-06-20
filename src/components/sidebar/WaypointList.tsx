"use client";

import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTripStore, WaypointData } from "@/stores/tripStore";
import { useMapStore } from "@/stores/mapStore";
import { GripVertical, Landmark, Loader2, MapPin, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "@/lib/toast";
import { placeNameForActivity } from "@/lib/placeDisplayName";
import {
  searchLocations,
  type SearchResult,
  retrieveLocationById,
  resetSearchSession,
} from "@/lib/api/mapbox";

function ReplaceWaypointControl({
  wp,
  disabled,
  onReplaced,
}: {
  wp: WaypointData;
  disabled: boolean;
  onReplaced?: () => void;
}) {
  const updateWaypoint = useTripStore((s) => s.updateWaypoint);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout>(undefined);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const doSearch = async (q: string) => {
    if (disabled) return;
    if (q.trim().length < 3) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const rows = await searchLocations(q, { lng: wp.lng, lat: wp.lat });
      setResults(rows.slice(0, 6));
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const replaceWith = async (row: SearchResult) => {
    let selected = row;
    if (selected.lat === undefined || selected.lng === undefined) {
      setLoading(true);
      const resolved = await retrieveLocationById(row.id);
      setLoading(false);
      if (!resolved || resolved.lat === undefined || resolved.lng === undefined) return;
      selected = resolved;
    }
    updateWaypoint(wp.id, {
      name: selected.name,
      lat: selected.lat,
      lng: selected.lng,
    });
    setOpen(false);
    setQuery("");
    setResults([]);
    resetSearchSession();
    toast.success(`Replaced stop with ${selected.name}`);
    onReplaced?.();
  };

  return (
    <div className="mt-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => {
          setOpen((v) => !v);
          setResults([]);
          setQuery("");
        }}
        className="h-7 px-2 text-[11px]"
      >
        <RefreshCw className="mr-1 h-3 w-3" />
        Replace
      </Button>
      {open && (
        <div className="mt-2 rounded-md border bg-white p-2">
          <div className="relative">
            <Input
              value={query}
              onChange={(e) => {
                const next = e.target.value;
                setQuery(next);
                if (debounceRef.current) clearTimeout(debounceRef.current);
                debounceRef.current = setTimeout(() => {
                  void doSearch(next);
                }, 300);
              }}
              placeholder="Search replacement stop..."
              className="h-8 text-xs"
            />
            {loading && <Loader2 className="absolute right-2 top-2 h-3.5 w-3.5 animate-spin text-slate-400" />}
          </div>
          {results.length > 0 && (
            <div className="mt-2 max-h-36 overflow-y-auto rounded border">
              {results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className="block w-full border-b px-2 py-1.5 text-left text-xs last:border-b-0 hover:bg-slate-50"
                  onClick={() => void replaceWith(r)}
                >
                  <div className="truncate font-medium text-slate-900">{r.name}</div>
                  <div className="truncate text-slate-500">{r.fullName}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SortableWaypoint({
  wp,
  index,
  disabled,
  onWaypointReplaced,
}: {
  wp: WaypointData;
  index: number;
  disabled: boolean;
  onWaypointReplaced?: () => void;
}) {
  const removeWaypoint = useTripStore((s) => s.removeWaypoint);
  const reorderWaypoints = useTripStore((s) => s.reorderWaypoints);
  const updateWaypoint = useTripStore((s) => s.updateWaypoint);
  const { setActiveWaypoint, setViewState } = useMapStore();
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: wp.id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const displayName = placeNameForActivity(wp.name);

  const centerOnStop = () => {
    setViewState({ longitude: wp.lng, latitude: wp.lat, zoom: 12 });
  };

  const openNearbyAttractions = () => {
    centerOnStop();
    setActiveWaypoint({ id: wp.id, name: wp.name, lat: wp.lat, lng: wp.lng, index });
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group space-y-2 overflow-hidden rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white shadow-sm">
          {index + 1}
        </div>
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          aria-label={`Center map on ${wp.name}`}
          onClick={centerOnStop}
        >
          <p className="truncate text-sm font-semibold leading-snug text-slate-900">
            {displayName}
          </p>
          <p className="mt-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
            {wp.lat.toFixed(4)}, {wp.lng.toFixed(4)}
          </p>
        </button>
        <div className="flex shrink-0 items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Explore attractions near ${wp.name}`}
                className="h-8 w-8 shrink-0 text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                disabled={disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  openNearbyAttractions();
                }}
              >
                <Landmark className="h-3.5 w-3.5" aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Explore nearby attractions</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Center map on ${wp.name}`}
                className="h-8 w-8 shrink-0 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                disabled={disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  centerOnStop();
                }}
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Focus stop on map</TooltipContent>
          </Tooltip>
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Reorder ${wp.name}`}
            className="flex h-8 w-8 cursor-grab touch-manipulation items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 active:cursor-grabbing disabled:opacity-50"
            disabled={disabled}
          >
            <GripVertical className="h-4 w-4" aria-hidden />
          </button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Remove ${wp.name} from itinerary`}
            className="h-8 w-8 shrink-0 text-slate-400 opacity-100 transition-opacity hover:bg-red-50 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100"
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              const snapshot = useTripStore.getState().waypoints.map((w) => ({ ...w }));
              removeWaypoint(wp.id);
              const short =
                displayName.length > 48 ? `${displayName.slice(0, 45)}…` : displayName;
              toast.message(`Removed “${short}”`, {
                duration: 8000,
                action: {
                  label: "Undo",
                  onClick: () => reorderWaypoints(snapshot),
                },
              });
            }}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </div>
      </div>
      <Input
        value={wp.notes || ""}
        placeholder="Add note for this stop..."
        className="h-8 border-slate-200/80 bg-slate-50/50 text-xs focus-visible:bg-white"
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => updateWaypoint(wp.id, { notes: e.target.value })}
        disabled={disabled}
      />
      <ReplaceWaypointControl wp={wp} disabled={disabled} onReplaced={onWaypointReplaced} />
    </div>
  );
}

export function WaypointList({
  disabled = false,
  onWaypointReplaced,
}: {
  disabled?: boolean;
  onWaypointReplaced?: () => void;
}) {
  const { waypoints, reorderWaypoints } = useTripStore();
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (disabled || !over || active.id === over.id) return;

    const oldIndex = waypoints.findIndex((w) => w.id === active.id);
    const newIndex = waypoints.findIndex((w) => w.id === over.id);

    const newWaypoints = [...waypoints];
    const [moved] = newWaypoints.splice(oldIndex, 1);
    newWaypoints.splice(newIndex, 0, moved);
    reorderWaypoints(newWaypoints);
  };

  if (waypoints.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-10 text-center text-muted-foreground">
        <MapPin className="mx-auto mb-3 h-10 w-10 text-slate-300" aria-hidden />
        <p className="text-sm font-semibold text-slate-700">No stops yet</p>
        <p className="mx-auto mt-1 max-w-[14rem] text-xs leading-relaxed">
          Search above or use your location to add the first place.
        </p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={disabled ? undefined : sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={waypoints.map((w) => w.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2.5">
          {waypoints.map((wp, i) => (
            <SortableWaypoint
              key={wp.id}
              wp={wp}
              index={i}
              disabled={disabled}
              onWaypointReplaced={onWaypointReplaced}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
