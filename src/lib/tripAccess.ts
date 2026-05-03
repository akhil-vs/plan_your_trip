import { prisma } from "@/lib/prisma";
import {
  canEditTrip,
  canInviteCollaborators,
  canManageTrip,
  canViewTrip,
  TripRole,
} from "./tripRoles";

export async function getTripAccess(tripId: string, userId: string) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { id: true, userId: true, status: true, isPublic: true, shareId: true },
  });

  if (!trip) return null;
  if (trip.userId === userId) {
    return { trip, role: "OWNER" as TripRole };
  }

  const membership = await prisma.tripMember.findUnique({
    where: { tripId_userId: { tripId, userId } },
    select: { role: true },
  });

  if (!membership) return null;
  return { trip, role: membership.role as TripRole };
}
export { canViewTrip, canEditTrip, canManageTrip, canInviteCollaborators };
