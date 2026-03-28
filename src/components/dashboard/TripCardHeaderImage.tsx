"use client";

import { useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import { buildTripHeaderMapUrl } from "@/lib/tripCardImageUrl";

type Wp = { lat: number; lng: number };

interface TripCardHeaderImageProps {
  waypoints: Wp[];
  /** Used for a11y when the map loads */
  label: string;
}

export function TripCardHeaderImage({ waypoints, label }: TripCardHeaderImageProps) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
  const [failed, setFailed] = useState(false);

  const url = useMemo(
    () => (token && waypoints.length > 0 ? buildTripHeaderMapUrl(waypoints, token) : null),
    [waypoints, token]
  );

  if (!url || failed) {
    return (
      <div
        className="relative w-full h-36 sm:h-40 bg-gradient-to-br from-slate-200 via-slate-100 to-sky-100 flex items-center justify-center border-b"
        aria-hidden
      >
        <MapPin className="h-10 w-10 text-slate-400/80" strokeWidth={1.25} />
      </div>
    );
  }

  return (
    <div className="relative w-full h-36 sm:h-40 overflow-hidden border-b bg-muted shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        loading="lazy"
        decoding="async"
        className="absolute inset-0 w-full h-full object-cover"
        onError={() => setFailed(true)}
      />
      <span className="sr-only">{label} — map preview of route stops</span>
    </div>
  );
}
