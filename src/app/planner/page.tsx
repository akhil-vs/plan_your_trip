"use client";

import dynamic from "next/dynamic";
import { PlannerSidebar } from "@/components/sidebar/PlannerSidebar";
import { Skeleton } from "@/components/ui/skeleton";

const MapView = dynamic(
  () => import("@/components/map/MapView").then((mod) => mod.MapView),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-gray-100 flex items-center justify-center">
        <Skeleton className="w-full h-full" />
      </div>
    ),
  }
);

const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

export default function PlannerPage() {
  return (
    <div className="flex h-full min-h-0 w-full max-w-full overflow-hidden">
      <PlannerSidebar />
      <div className="flex-1 relative overflow-visible min-w-0 min-h-0">
        <MapView mapboxToken={mapboxToken} />
      </div>
    </div>
  );
}
