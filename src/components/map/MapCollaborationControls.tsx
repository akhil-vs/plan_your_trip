"use client";

import { useSession } from "next-auth/react";
import { useMapStore } from "@/stores/mapStore";
import { useTripStore } from "@/stores/tripStore";
import { canUseCollaboration } from "@/lib/subscription";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MessageCircle, Users } from "lucide-react";

/**
 * Map overlay: open Trip Members sheet or Trip chat sheet (Pro/Team + saved trip).
 */
export function MapCollaborationControls() {
  const { data: session } = useSession();
  const tripId = useTripStore((s) => s.tripId);
  const setMembersSheetOpen = useMapStore((s) => s.setMembersSheetOpen);
  const setChatSheetOpen = useMapStore((s) => s.setChatSheetOpen);
  const plan = session?.user?.plan || "FREE";
  const enabled = canUseCollaboration(plan);
  if (!tripId) return null;

  const cardClass =
    "rounded-lg border bg-white p-0.5 shadow-lg sm:p-1";
  const cardClassDisabled =
    "rounded-lg border border-dashed border-muted-foreground/25 bg-white/80 p-0.5 shadow-sm sm:p-1";
  const btnClass =
    "h-9 w-9 min-h-9 min-w-9 sm:h-8 sm:w-8 sm:min-h-8 sm:min-w-8";

  if (!enabled) {
    return (
      <>
        <div className={cardClassDisabled}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={btnClass}
                disabled
                aria-label="Members — upgrade to Pro"
              >
                <Users className="h-4 w-4 opacity-50" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              Save the trip and use Pro to invite collaborators
            </TooltipContent>
          </Tooltip>
        </div>
        <div className={cardClassDisabled}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={btnClass}
                disabled
                aria-label="Chat — upgrade to Pro"
              >
                <MessageCircle className="h-4 w-4 opacity-50" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Trip chat on Pro and Team plans</TooltipContent>
          </Tooltip>
        </div>
      </>
    );
  }

  return (
    <>
      <div className={cardClass}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={btnClass}
              aria-label="Trip members"
              onClick={() => setMembersSheetOpen(true)}
            >
              <Users className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Trip members</TooltipContent>
        </Tooltip>
      </div>
      <div className={cardClass}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={btnClass}
              aria-label="Trip chat"
              onClick={() => setChatSheetOpen(true)}
            >
              <MessageCircle className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Trip chat & photos</TooltipContent>
        </Tooltip>
      </div>
    </>
  );
}
