"use client";

import { Marker, Popup } from "react-map-gl/mapbox";
import { useTripStore, POI } from "@/stores/tripStore";
import { useState, useMemo } from "react";
import { Landmark, Utensils, Hotel, Star } from "lucide-react";

const ICONS = {
  attractions: Landmark,
  stays: Hotel,
  food: Utensils,
};

const COLORS = {
  attractions: { bg: "bg-amber-500", text: "text-amber-500" },
  stays: { bg: "bg-purple-500", text: "text-purple-500" },
  food: { bg: "bg-rose-500", text: "text-rose-500" },
};

interface POIMarkersProps {
  type: "attractions" | "stays" | "food";
}

export function POIMarkers({ type }: POIMarkersProps) {
  const pois = useTripStore((s) => s[type]);
  const setSelectedPOI = useTripStore((s) => s.setSelectedPOI);
  const selectedPOI = useTripStore((s) => s.selectedPOI);
  const hoveredPOIId = useTripStore((s) => s.hoveredPOIId);
  const [popupPOI, setPopupPOI] = useState<POI | null>(null);

  const Icon = ICONS[type];
  const color = COLORS[type];

  const visiblePOIs = useMemo(() => pois.slice(0, 100), [pois]);

  return (
    <>
      {visiblePOIs.map((poi) => {
        const isHighlighted = hoveredPOIId === poi.id || selectedPOI?.id === poi.id;
        return (
          <Marker
            key={poi.id}
            longitude={poi.lng}
            latitude={poi.lat}
            anchor="center"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              setPopupPOI(poi);
              setSelectedPOI(poi);
            }}
          >
            <div
              className={`w-7 h-7 rounded-full ${color.bg} text-white flex items-center justify-center shadow-md border-2 cursor-pointer transition-transform ${
                isHighlighted
                  ? "scale-125 border-yellow-300 ring-2 ring-yellow-300/60"
                  : "border-white hover:scale-110"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
            </div>
          </Marker>
        );
      })}

      {popupPOI && (
        <Popup
          longitude={popupPOI.lng}
          latitude={popupPOI.lat}
          anchor="bottom"
          onClose={() => setPopupPOI(null)}
          closeButton={true}
          offset={18}
        >
          <div className="p-2 min-w-[160px] max-w-[220px]">
            <p className="font-semibold text-sm">{popupPOI.name}</p>
            {popupPOI.subcategory && (
              <p className="text-xs text-gray-500 capitalize mt-0.5">
                {popupPOI.subcategory.replace(/_/g, " ")}
              </p>
            )}
            {popupPOI.address && (
              <p className="text-xs text-gray-500 mt-1">{popupPOI.address}</p>
            )}
            {(popupPOI.rating ?? 0) > 0 && (
              <div className="flex items-center gap-1 mt-1">
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                <span className="text-xs font-medium">{popupPOI.rating}</span>
              </div>
            )}
          </div>
        </Popup>
      )}
    </>
  );
}
