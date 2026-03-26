"use client";

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
import { GripVertical, X, MapPin, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function SortableWaypoint({
  wp,
  index,
  disabled,
}: {
  wp: WaypointData;
  index: number;
  disabled: boolean;
}) {
  const removeWaypoint = useTripStore((s) => s.removeWaypoint);
  const updateWaypoint = useTripStore((s) => s.updateWaypoint);
  const { setViewState, setActiveWaypoint, activeWaypoint } = useMapStore();
  const isActive = activeWaypoint?.id === wp.id;
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: wp.id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-lg border bg-white hover:bg-gray-50 group p-2 space-y-2 overflow-hidden"
    >
      <div className="flex items-center gap-2">
        <button
          {...attributes}
          {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 min-w-9 min-h-9 flex items-center justify-center touch-manipulation -m-1 disabled:opacity-50"
        disabled={disabled}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
          {index + 1}
        </div>
        <button
          className="flex-1 min-w-0 text-left"
          onClick={() =>
            setViewState({ longitude: wp.lng, latitude: wp.lat, zoom: 12 })
          }
        >
          <p className="text-sm font-medium truncate">{wp.name}</p>
          <p className="text-xs text-muted-foreground">
            {wp.lat.toFixed(4)}, {wp.lng.toFixed(4)}
          </p>
        </button>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isActive ? "secondary" : "ghost"}
              size="icon"
              className="h-9 w-9 shrink-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50 touch-manipulation"
              onClick={(e) => {
                e.stopPropagation();
              if (disabled) return;
                setViewState({ longitude: wp.lng, latitude: wp.lat, zoom: 12 });
                setActiveWaypoint(
                  isActive
                    ? null
                    : { id: wp.id, name: wp.name, lat: wp.lat, lng: wp.lng, index }
                );
              }}
            >
              <Compass className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            Explore nearby attractions, stays & food
          </TooltipContent>
        </Tooltip>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500 touch-manipulation"
          onClick={(e) => {
            e.stopPropagation();
          if (disabled) return;
            removeWaypoint(wp.id);
          }}
        disabled={disabled}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <Input
        value={wp.notes || ""}
        placeholder="Add note for this stop..."
        className="h-8 text-xs"
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => updateWaypoint(wp.id, { notes: e.target.value })}
        disabled={disabled}
      />
    </div>
  );
}

export function WaypointList({ disabled = false }: { disabled?: boolean }) {
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
      <div className="text-center py-8 text-muted-foreground">
        <MapPin className="h-10 w-10 mx-auto mb-3 text-gray-300" />
        <p className="text-sm font-medium">No destinations yet</p>
        <p className="text-xs mt-1">
          Search for a location above to start planning
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
        <div className="space-y-2">
          {waypoints.map((wp, i) => (
            <SortableWaypoint key={wp.id} wp={wp} index={i} disabled={disabled} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
