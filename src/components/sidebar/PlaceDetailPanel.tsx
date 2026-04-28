"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { POI, useTripStore } from "@/stores/tripStore";
import { useMapStore } from "@/stores/mapStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  MapPin,
  Star,
  ExternalLink,
  Plus,
  Landmark,
  Hotel,
  Utensils,
  ImageOff,
} from "lucide-react";
import { parseOpeningHoursWindow } from "@/lib/utils/openingHours";

interface PlaceDetail {
  id: string;
  name: string;
  description: string;
  image: string;
  url: string;
  address: string;
  lat: number;
  lng: number;
  kinds: string;
  rating: number;
  openingHours?: string;
}

interface PlaceDetailPanelProps {
  poi: POI;
  onClose: () => void;
}

export function PlaceDetailPanel({ poi, onClose }: PlaceDetailPanelProps) {
  const [detail, setDetail] = useState<PlaceDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const insertWaypointNear = useTripStore((s) => s.insertWaypointNear);
  const waypoints = useTripStore((s) => s.waypoints);
  const setViewState = useMapStore((s) => s.setViewState);

  useEffect(() => {
    let cancelled = false;

    if (poi.source === "opentripmap") {
      queueMicrotask(() => {
        if (!cancelled) setLoading(true);
      });
      fetch(`/api/attractions/${poi.id}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (cancelled) return;
          if (data) setDetail(data);
          setLoading(false);
        })
        .catch(() => {
          if (cancelled) return;
          setLoading(false);
        });
    } else {
      queueMicrotask(() => {
        if (cancelled) return;
        setDetail({
          id: poi.id,
          name: poi.name,
          description: "",
          image: poi.image || "",
          url: poi.url || "",
          address: poi.address || "",
          lat: poi.lat,
          lng: poi.lng,
          kinds: poi.subcategory || "",
          rating: poi.rating || 0,
          openingHours: poi.openingHours || "",
        });
        setLoading(false);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [poi]);

  const handleAddToRoute = () => {
    const name = detail?.name || poi.name;
    const parsedWindow = parseOpeningHoursWindow(
      detail?.openingHours || poi.openingHours
    );
    insertWaypointNear({
      name,
      lat: poi.lat,
      lng: poi.lng,
      ...(parsedWindow || {}),
    });
  };

  const alreadyInRoute = waypoints.some(
    (w) =>
      Math.abs(w.lat - poi.lat) < 0.0001 && Math.abs(w.lng - poi.lng) < 0.0001
  );

  const CategoryIcon =
    poi.category === "accommodation"
      ? Hotel
      : poi.category === "catering"
        ? Utensils
        : Landmark;

  const categoryColor =
    poi.category === "accommodation"
      ? "bg-purple-100 text-purple-700"
      : poi.category === "catering"
        ? "bg-rose-100 text-rose-700"
        : "bg-amber-100 text-amber-700";

  const kinds = (detail?.kinds || poi.subcategory || "")
    .split(",")
    .map((k) => k.trim().replace(/_/g, " "))
    .filter(Boolean)
    .slice(0, 5);

  return (
    <div className="absolute inset-0 z-20 bg-white flex flex-col animate-in slide-in-from-right-full duration-200">
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-semibold truncate flex-1">
          {poi.name}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Image */}
        {loading ? (
          <Skeleton className="w-full h-48" />
        ) : detail?.image ? (
          <div className="relative w-full h-48 bg-gray-100">
            <Image
              src={detail.image}
              alt={detail.name}
              fill
              className="object-cover"
              sizes="100vw"
              unoptimized
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
                (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
              }}
            />
            <div className="hidden w-full h-full flex items-center justify-center bg-gray-100 absolute inset-0">
              <ImageOff className="h-10 w-10 text-gray-300" />
            </div>
          </div>
        ) : (
          <div className="w-full h-32 bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center">
            <CategoryIcon className="h-12 w-12 text-gray-300" />
          </div>
        )}

        <div className="p-4 space-y-4">
          {/* Title & rating */}
          <div>
            <h2 className="text-lg font-bold">{detail?.name || poi.name}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${categoryColor}`}>
                <CategoryIcon className="h-3 w-3" />
                {poi.category === "accommodation"
                  ? "Stay"
                  : poi.category === "catering"
                    ? "Food & Drink"
                    : "Attraction"}
              </div>
              {(detail?.rating ?? poi.rating ?? 0) > 0 && (
                <div className="flex items-center gap-0.5">
                  <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                  <span className="text-sm font-medium">
                    {detail?.rating || poi.rating}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Tags */}
          {kinds.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {kinds.map((k) => (
                <Badge key={k} variant="secondary" className="text-[10px] capitalize">
                  {k}
                </Badge>
              ))}
            </div>
          )}

          {/* Address */}
          {(detail?.address || poi.address) && (
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{detail?.address || poi.address}</span>
            </div>
          )}

          {/* Description */}
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/6" />
            </div>
          ) : (
            detail?.description && (
              <p className="text-sm text-gray-700 leading-relaxed">
                {detail.description}
              </p>
            )
          )}

          {/* External link */}
          {detail?.url && (
            <a
              href={detail.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Learn more
            </a>
          )}

          {/* Coordinates */}
          <p className="text-xs text-muted-foreground">
            {poi.lat.toFixed(5)}, {poi.lng.toFixed(5)}
          </p>
        </div>
      </div>

      {/* Footer: Add to Route */}
      <div className="p-4 border-t shrink-0 space-y-2">
        <Button
          className="w-full gap-2"
          onClick={() => {
            setViewState({ longitude: poi.lng, latitude: poi.lat, zoom: 14 });
          }}
          variant="outline"
          size="sm"
        >
          <MapPin className="h-4 w-4" />
          Show on Map
        </Button>
        <Button
          className="w-full gap-2"
          onClick={handleAddToRoute}
          disabled={alreadyInRoute}
          size="sm"
        >
          <Plus className="h-4 w-4" />
          {alreadyInRoute
            ? "Already in Route"
            : waypoints.length === 0
                ? "Add as First Stop"
                : "Add to Route (nearest stop)"}
        </Button>
      </div>
    </div>
  );
}
