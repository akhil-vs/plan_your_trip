"use client";

import { Marker } from "react-map-gl/mapbox";
import { useTripStore } from "@/stores/tripStore";
import { useMapStore } from "@/stores/mapStore";

export function WaypointMarkers() {
  const waypoints = useTripStore((s) => s.waypoints);
  const { activeWaypoint, setActiveWaypoint } = useMapStore();

  return (
    <>
      {waypoints.map((wp, index) => {
        const isActive = activeWaypoint?.id === wp.id;
        return (
          <Marker
            key={wp.id}
            longitude={wp.lng}
            latitude={wp.lat}
            anchor="center"
            draggable
            onDragEnd={(e) => {
              useTripStore.getState().updateWaypoint(wp.id, {
                lat: e.lngLat.lat,
                lng: e.lngLat.lng,
              });
            }}
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              e.originalEvent.preventDefault();
              setActiveWaypoint(
                isActive
                  ? null
                  : { id: wp.id, name: wp.name, lat: wp.lat, lng: wp.lng, index }
              );
            }}
          >
            <div className="relative cursor-pointer">
              <div
                aria-label={`Stop ${index + 1}: ${wp.name}${isActive ? ", selected" : ""}. Drag to move on the map.`}
                className={`w-8 h-8 rounded-full text-white flex items-center justify-center text-sm font-bold shadow-lg border-2 transition-all ${
                  isActive
                    ? "bg-blue-800 border-blue-300 scale-125"
                    : "bg-blue-600 border-white hover:scale-110"
                }`}
              >
                {index + 1}
              </div>
            </div>
          </Marker>
        );
      })}
    </>
  );
}
