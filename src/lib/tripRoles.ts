export type TripRole = "OWNER" | "EDITOR" | "VIEWER";

export function canViewTrip(role: TripRole) {
  return role === "OWNER" || role === "EDITOR" || role === "VIEWER";
}

export function canEditTrip(role: TripRole) {
  return role === "OWNER" || role === "EDITOR";
}

export function canManageTrip(role: TripRole) {
  return role === "OWNER";
}

/** Send, list, and revoke email invites (not the same as removing members). */
export function canInviteCollaborators(role: TripRole) {
  return role === "OWNER" || role === "EDITOR";
}
