"use client";

import { useMapStore, MapStyle } from "@/stores/mapStore";
import { Map, Mountain, Satellite } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const styles: { value: MapStyle; icon: typeof Map; label: string }[] = [
  { value: "streets", icon: Map, label: "Streets" },
  { value: "outdoors", icon: Mountain, label: "Outdoors" },
  { value: "satellite", icon: Satellite, label: "Satellite" },
];

export function MapStyleToggle() {
  const { mapStyle, setMapStyle } = useMapStore();

  return (
    <div className="flex flex-row gap-0.5 lg:flex-col lg:gap-1 bg-white rounded-lg shadow-lg border p-0.5 sm:p-1">
      {styles.map((s) => (
        <Tooltip key={s.value}>
          <TooltipTrigger asChild>
            <Button
              variant={mapStyle === s.value ? "default" : "ghost"}
              size="icon"
              className="h-9 w-9 sm:h-8 sm:w-8 min-w-9 min-h-9 sm:min-w-8 sm:min-h-8"
              onClick={() => setMapStyle(s.value)}
            >
              <s.icon className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">{s.label}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
