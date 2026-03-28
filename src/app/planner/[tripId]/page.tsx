"use client";

import dynamic from "next/dynamic";
import { PlannerSidebar } from "@/components/sidebar/PlannerSidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { useParams } from "next/navigation";

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

export default function EditTripPage() {
  const params = useParams();
  const tripId = params.tripId as string;

  return (
    <div className="flex h-full min-h-0 w-full max-w-full overflow-hidden">
      <PlannerSidebar tripId={tripId} />
      <div className="flex-1 relative min-w-0 min-h-0 overflow-hidden">
        <MapView mapboxToken={mapboxToken} />
      </div>
    </div>
  );
}
