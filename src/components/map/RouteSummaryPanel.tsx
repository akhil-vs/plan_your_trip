"use client";

import { useTripStore } from "@/stores/tripStore";
import { useMapStore } from "@/stores/mapStore";
import { Route, Clock, MapPin, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${Math.round(meters)} m`;
}

function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }
  return `${mins} min`;
}

export function RouteSummaryPanel() {
  const { routeSummaryOpen, setRouteSummaryOpen } = useMapStore();
  const route = useTripStore((s) => s.route);
  const waypoints = useTripStore((s) => s.waypoints);
  const loading = useTripStore((s) => s.loading.route);

  const hasRoute = waypoints.length >= 2;

  return (
    <div className="relative flex flex-col items-end">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 sm:h-8 sm:w-8 min-w-9 min-h-9 sm:min-w-8 sm:min-h-8 bg-white shadow-lg border hover:bg-gray-50"
            onClick={() => setRouteSummaryOpen(!routeSummaryOpen)}
            disabled={!hasRoute}
          >
            <Route className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">
          {hasRoute ? "Route summary" : "Add 2+ waypoints for route"}
        </TooltipContent>
      </Tooltip>

      {routeSummaryOpen && (
        <div className="fixed z-[110] left-2 right-2 top-[calc(4rem+env(safe-area-inset-top))] max-h-[min(75vh,440px)] overflow-y-auto lg:absolute lg:inset-x-auto lg:left-auto lg:right-0 lg:top-full lg:mt-1.5 lg:max-h-none lg:overflow-hidden w-auto lg:w-[min(calc(100vw-2rem),320px)] bg-white rounded-xl shadow-2xl border overflow-x-hidden animate-in slide-in-from-right-4 duration-200">
          <div className="flex items-center justify-between p-3 border-b">
            <span className="text-sm font-semibold text-blue-900 flex items-center gap-2">
              <Route className="h-4 w-4 text-blue-600" />
              Route summary
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => setRouteSummaryOpen(false)}
            >
              <ChevronRight className="h-4 w-4 rotate-180" />
            </Button>
          </div>

          <div className="p-3 max-h-[min(60vh,400px)] overflow-y-auto">
            {loading ? (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="h-14 flex-1 rounded-lg bg-blue-100/60 animate-pulse" />
                  <div className="h-14 flex-1 rounded-lg bg-blue-100/60 animate-pulse" />
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-full rounded bg-blue-100/40 animate-pulse" />
                  <div className="h-3 w-4/5 rounded bg-blue-100/40 animate-pulse" />
                </div>
              </div>
            ) : !route || waypoints.length < 2 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Add 2 or more waypoints to see route summary
              </p>
            ) : (
              <>
                <div className="flex gap-2 mb-4">
                  <div className="flex-1 rounded-lg bg-blue-50 border border-blue-100 p-3">
                    <div className="flex items-center gap-1.5 text-blue-600 mb-1">
                      <MapPin className="h-3.5 w-3.5" />
                      <span className="text-[10px] font-semibold uppercase tracking-wider">
                        Distance
                      </span>
                    </div>
                    <p className="text-lg font-bold text-blue-900 tabular-nums">
                      {formatDistance(route.distance)}
                    </p>
                  </div>
                  <div className="flex-1 rounded-lg bg-emerald-50 border border-emerald-100 p-3">
                    <div className="flex items-center gap-1.5 text-emerald-600 mb-1">
                      <Clock className="h-3.5 w-3.5" />
                      <span className="text-[10px] font-semibold uppercase tracking-wider">
                        Duration
                      </span>
                    </div>
                    <p className="text-lg font-bold text-emerald-900 tabular-nums">
                      {formatDuration(route.duration)}
                    </p>
                  </div>
                </div>

                {route.legs.length > 1 && (
                  <div className="rounded-lg border border-blue-100 bg-blue-50/30 overflow-hidden">
                    <div className="px-3 py-2 border-b border-blue-100">
                      <span className="text-xs font-medium text-blue-700">
                        Route legs
                      </span>
                    </div>
                    <div className="divide-y divide-blue-100/60">
                      {route.legs.map((leg, i) => {
                        const fromName =
                          waypoints[i]?.name.split(",")[0] ?? "Start";
                        const toName =
                          waypoints[i + 1]?.name.split(",")[0] ?? "Destination";
                        return (
                          <div
                            key={i}
                            className="flex items-center gap-2 px-3 py-2.5"
                          >
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-[10px] font-bold text-blue-700">
                              {i + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-gray-800 truncate">
                                {fromName}
                              </p>
                              <p className="text-[10px] text-muted-foreground truncate flex items-center gap-0.5">
                                <ChevronRight className="h-3 w-3 shrink-0 text-blue-400" />
                                {toName}
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              <span className="text-xs font-semibold text-blue-700 tabular-nums">
                                {formatDuration(leg.duration)}
                              </span>
                              <span className="text-[10px] text-muted-foreground block tabular-nums">
                                {formatDistance(leg.distance)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
