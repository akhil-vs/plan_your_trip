import type { InAppNotificationType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type { InAppNotificationType };

export type NotificationPayload = {
  tripId?: string;
  tripName?: string;
  inviteId?: string;
  href?: string;
};

export async function createInAppNotification(input: {
  userId: string;
  type: InAppNotificationType;
  title: string;
  body: string;
  data?: NotificationPayload | null;
}) {
  return prisma.inAppNotification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      data: (input.data ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

/** Notify a registered user by email, if they exist and are not `exceptUserId`. */
export async function notifyRegisteredUserByEmail(
  email: string,
  payload: {
    type: InAppNotificationType;
    title: string;
    body: string;
    data?: NotificationPayload | null;
  },
  options?: { exceptUserId?: string }
) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  const user = await prisma.user.findUnique({
    where: { email: normalized },
    select: { id: true },
  });
  if (!user) return null;
  if (options?.exceptUserId && user.id === options.exceptUserId) return null;
  return createInAppNotification({ ...payload, userId: user.id });
}

export async function listNotificationsForUser(
  userId: string,
  options?: { take?: number }
) {
  const take = Math.min(Math.max(options?.take ?? 40, 1), 100);
  const notifications = await prisma.inAppNotification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      data: true,
      readAt: true,
      createdAt: true,
    },
  });
  const unreadCount = await prisma.inAppNotification.count({
    where: { userId, readAt: null },
  });
  return { notifications, unreadCount };
}

export async function markNotificationRead(userId: string, notificationId: string) {
  const existing = await prisma.inAppNotification.findFirst({
    where: { id: notificationId, userId },
    select: { id: true, readAt: true },
  });
  if (!existing) return { ok: false as const, error: "Not found" };
  if (existing.readAt) return { ok: true as const, alreadyRead: true };
  await prisma.inAppNotification.update({
    where: { id: notificationId },
    data: { readAt: new Date() },
  });
  return { ok: true as const, alreadyRead: false };
}

export async function markAllNotificationsRead(userId: string) {
  const result = await prisma.inAppNotification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return { count: result.count };
}

/** Trip owner plus all members, excluding `exceptUserId`. */
export async function getTripCollaboratorUserIds(
  tripId: string,
  exceptUserId: string
): Promise<string[]> {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { userId: true, members: { select: { userId: true } } },
  });
  if (!trip) return [];
  const ids = new Set<string>();
  ids.add(trip.userId);
  for (const m of trip.members) ids.add(m.userId);
  ids.delete(exceptUserId);
  return [...ids];
}

/** In-app notify every collaborator except the actor (best-effort). */
export async function notifyTripCollaborators(input: {
  tripId: string;
  exceptUserId: string;
  type: InAppNotificationType;
  title: string;
  body: string;
  data?: NotificationPayload | null;
}) {
  const recipientIds = await getTripCollaboratorUserIds(input.tripId, input.exceptUserId);
  if (recipientIds.length === 0) return;
  const trip = await prisma.trip.findUnique({
    where: { id: input.tripId },
    select: { name: true },
  });
  const tripName = trip?.name?.trim() || "Itinerary";
  const href = `/planner/${input.tripId}`;
  const baseData: NotificationPayload = {
    tripId: input.tripId,
    tripName,
    href,
    ...(input.data ?? {}),
  };
  for (const userId of recipientIds) {
    try {
      await createInAppNotification({
        userId,
        type: input.type,
        title: input.title,
        body: input.body,
        data: baseData,
      });
    } catch {
      // best-effort
    }
  }
}

/** When someone saves the itinerary, notify other collaborators (only if there are activity lines). */
export async function notifyCollaboratorsOfTripSave(input: {
  tripId: string;
  actorUserId: string;
  tripName: string;
  activityLines: string[];
}) {
  if (input.activityLines.length === 0) return;
  const name = input.tripName.trim() || "Itinerary";
  const body =
    input.activityLines.length === 1
      ? input.activityLines[0]!
      : `${input.activityLines[0]} · ${input.activityLines[1]}`;
  const clipped = body.length > 400 ? `${body.slice(0, 397)}…` : body;
  await notifyTripCollaborators({
    tripId: input.tripId,
    exceptUserId: input.actorUserId,
    type: "TRIP_UPDATED",
    title: `“${name}” updated`,
    body: clipped,
  });
}
