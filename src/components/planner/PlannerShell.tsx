"use client";

import { useMapStore } from "@/stores/mapStore";
import { cn } from "@/lib/utils";

interface PlannerShellProps {
  sidebar: React.ReactNode;
  map: React.ReactNode;
}

export function PlannerShell({ sidebar, map }: PlannerShellProps) {
  const sidebarOpen = useMapStore((s) => s.sidebarOpen);

  return (
    <div className="relative h-full min-h-0 w-full max-w-full overflow-hidden">
      <div
        className={cn(
          "absolute inset-0 min-h-0 transition-[left] duration-200 ease-out",
          sidebarOpen ? "lg:left-[380px]" : "lg:left-0"
        )}
      >
        {map}
      </div>
      {sidebar}
    </div>
  );
}
