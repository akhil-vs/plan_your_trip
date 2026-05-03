/**
 * Human-readable activity lines for trip save / create events (timeline).
 */

import { placeNameForActivity } from "@/lib/placeDisplayName";

export type WaypointSnap = {
  id: string;
  name: string;
  order: number;
  lat: number;
  lng: number;
  notes: string | null;
  visitMinutes: number;
  openMinutes: number;
  closeMinutes: number;
  isLocked: boolean;
};

export type WaypointInput = {
  id?: string;
  name: string;
  order: number;
  lat: number;
  lng: number;
  notes?: string | null;
  visitMinutes?: number;
  openMinutes?: number;
  closeMinutes?: number;
  isLocked?: boolean;
};

function normNotes(n: string | null | undefined): string {
  return (typeof n === "string" ? n : "").trim();
}

function coordsMeaningfullyChanged(a: WaypointSnap, b: WaypointInput): boolean {
  return Math.abs(a.lat - b.lat) > 2e-5 || Math.abs(a.lng - b.lng) > 2e-5;
}

function describeFieldChanges(prev: WaypointSnap, next: WaypointInput): string[] {
  const bits: string[] = [];
  if (prev.name !== next.name) {
    bits.push(
      `renamed from "${placeNameForActivity(prev.name)}" to "${placeNameForActivity(next.name)}"`
    );
  }
  if (coordsMeaningfullyChanged(prev, next)) bits.push("location updated");
  if (normNotes(prev.notes) !== normNotes(next.notes)) bits.push("notes updated");
  const vm = typeof next.visitMinutes === "number" ? next.visitMinutes : prev.visitMinutes;
  if (prev.visitMinutes !== vm) bits.push("visit duration updated");
  const om = typeof next.openMinutes === "number" ? next.openMinutes : prev.openMinutes;
  const cm = typeof next.closeMinutes === "number" ? next.closeMinutes : prev.closeMinutes;
  if (prev.openMinutes !== om || prev.closeMinutes !== cm) bits.push("opening hours updated");
  const locked = next.isLocked === true;
  if (prev.isLocked !== locked) bits.push(locked ? "stop locked" : "stop unlocked");
  return bits;
}

function sortByOrder<T extends { order: number }>(list: T[]): T[] {
  return [...list].sort((a, b) => a.order - b.order);
}

function stopNumberBySortedIds(sorted: { id: string }[], id: string): number {
  const i = sorted.findIndex((w) => w.id === id);
  return i < 0 ? 0 : i + 1;
}

function pickIncomingId(wp: WaypointInput): string | null {
  const raw = typeof wp.id === "string" ? wp.id.trim() : "";
  if (raw.length >= 3 && raw.length <= 128) return raw;
  return null;
}

const MAX_ACTIVITY_LINES = 32;

export function diffWaypointNamesMultiset(
  previousNames: string[],
  nextNames: string[]
): { added: string[]; removed: string[] } {
  const bump = (m: Map<string, number>, key: string, delta: number) => {
    m.set(key, (m.get(key) || 0) + delta);
  };
  const prev = new Map<string, number>();
  const next = new Map<string, number>();
  for (const n of previousNames) bump(prev, n, 1);
  for (const n of nextNames) bump(next, n, 1);
  const keys = new Set([...prev.keys(), ...next.keys()]);
  const added: string[] = [];
  const removed: string[] = [];
  for (const k of keys) {
    const d = (next.get(k) || 0) - (prev.get(k) || 0);
    for (let i = 0; i < d; i++) added.push(k);
    for (let i = 0; i < -d; i++) removed.push(k);
  }
  return { added, removed };
}

function joinNameList(names: string[], max = 6): string {
  const slice = names.slice(0, max).map((n) => placeNameForActivity(n));
  const more = names.length - slice.length;
  return `${slice.join(", ")}${more > 0 ? ` (+${more} more)` : ""}`;
}

export function buildTripSaveActivityLines(params: {
  actorName: string;
  previousWaypoints: WaypointSnap[];
  incomingWaypoints: WaypointInput[];
  previousTitle: string;
  newTitle: string;
  previousDayPlanCount: number;
  newDayPlanCount: number;
}): string[] {
  const actor = params.actorName.trim() || "Someone";
  const lines: string[] = [];

  const prevSorted = sortByOrder(params.previousWaypoints);
  const incomingSorted = sortByOrder(params.incomingWaypoints);

  const incomingResolved = incomingSorted.map((wp) => ({
    wp,
    id: pickIncomingId(wp),
  }));
  const ids = incomingResolved.map((r) => r.id).filter((x): x is string => Boolean(x));
  const allIncomingHaveStableIds =
    incomingResolved.length === 0 ||
    (incomingResolved.every((r) => r.id) && new Set(ids).size === ids.length);

  const useIdDiff =
    prevSorted.length > 0 && incomingResolved.length > 0 && allIncomingHaveStableIds;

  if (useIdDiff) {
    const prevById = new Map(prevSorted.map((w) => [w.id, w]));
    const newById = new Map<string, WaypointInput>();
    const newSortedForStops = sortByOrder(
      incomingResolved
        .filter((x): x is { wp: WaypointInput; id: string } => Boolean(x.id))
        .map(({ wp, id }) => ({ id, order: wp.order, name: wp.name }))
    );

    for (const { id } of newSortedForStops) {
      newById.set(id, incomingResolved.find((x) => x.id === id)!.wp);
    }

    const prevIds = new Set(prevSorted.map((w) => w.id));
    const newIds = new Set(newSortedForStops.map((w) => w.id));

    for (const id of prevIds) {
      if (!newIds.has(id)) {
        const p = prevById.get(id)!;
        const n = stopNumberBySortedIds(prevSorted, id);
        lines.push(`${actor} removed "${placeNameForActivity(p.name)}" (was stop ${n}).`);
      }
    }

    for (const id of newIds) {
      if (!prevIds.has(id)) {
        const wp = newById.get(id)!;
        const n = stopNumberBySortedIds(newSortedForStops, id);
        lines.push(`${actor} added "${placeNameForActivity(wp.name)}" as stop ${n}.`);
      }
    }

    /** Same ids in the same relative order — only stop *numbers* shifted due to add/remove elsewhere. */
    const prevSurvivorIds = prevSorted.filter((w) => newIds.has(w.id)).map((w) => w.id);
    const newSurvivorIds = newSortedForStops.filter((w) => prevIds.has(w.id)).map((w) => w.id);
    const survivorOrderUnchanged =
      prevSurvivorIds.length === newSurvivorIds.length &&
      prevSurvivorIds.every((sid, i) => sid === newSurvivorIds[i]);

    for (const id of prevIds) {
      if (!newIds.has(id)) continue;
      const prev = prevById.get(id)!;
      const next = newById.get(id)!;
      const oldN = stopNumberBySortedIds(prevSorted, id);
      const newN = stopNumberBySortedIds(newSortedForStops, id);
      const bits = describeFieldChanges(prev, next);

      if (survivorOrderUnchanged) {
        if (oldN !== newN && bits.length === 0) {
          continue;
        }
        if (bits.length > 0) {
          lines.push(
            `${actor} updated stop ${newN} "${placeNameForActivity(next.name)}": ${bits.join(", ")}.`
          );
        }
        continue;
      }

      if (oldN !== newN && bits.length > 0) {
        lines.push(
          `${actor} re-ordered "${placeNameForActivity(next.name)}" from stop ${oldN} to stop ${newN} (${bits.join(", ")}).`
        );
      } else if (oldN !== newN) {
        lines.push(
          `${actor} re-ordered "${placeNameForActivity(next.name)}" from stop ${oldN} to stop ${newN}.`
        );
      } else if (bits.length > 0) {
        lines.push(
          `${actor} updated stop ${newN} "${placeNameForActivity(next.name)}": ${bits.join(", ")}.`
        );
      }
    }
  } else {
    const { added, removed } = diffWaypointNamesMultiset(
      prevSorted.map((w) => w.name),
      incomingSorted.map((w) => (typeof w.name === "string" ? w.name : "Stop"))
    );
    if (removed.length) {
      lines.push(`${actor} removed stop(s): ${joinNameList(removed)}.`);
    }
    if (added.length) {
      lines.push(`${actor} added stop(s): ${joinNameList(added)}.`);
    }
    if (
      !added.length &&
      !removed.length &&
      prevSorted.length === incomingSorted.length &&
      prevSorted.length > 0
    ) {
      lines.push(
        `${actor} updated the route (${incomingSorted.length} stops; order, text, times, or pins may have changed).`
      );
    }
  }

  const prevTitle = (params.previousTitle || "").trim();
  const nextTitle = (params.newTitle || "").trim();
  if (prevTitle !== nextTitle) {
    if (!prevTitle && nextTitle) {
      lines.push(`${actor} set itinerary title to "${nextTitle}".`);
    } else if (prevTitle && nextTitle) {
      lines.push(`${actor} renamed itinerary from "${prevTitle}" to "${nextTitle}".`);
    } else if (prevTitle && !nextTitle) {
      lines.push(`${actor} cleared itinerary title (was "${prevTitle}").`);
    }
  }

  if (params.previousDayPlanCount !== params.newDayPlanCount) {
    lines.push(
      `${actor} changed day-by-day plan from ${params.previousDayPlanCount} to ${params.newDayPlanCount} day(s).`
    );
  }

  const trimmed = lines.filter(Boolean);
  if (trimmed.length > MAX_ACTIVITY_LINES) {
    const extra = trimmed.length - MAX_ACTIVITY_LINES + 1;
    return [...trimmed.slice(0, MAX_ACTIVITY_LINES - 1), `${actor}: …and ${extra} more change(s).`];
  }

  if (trimmed.length === 0) {
    return [`${actor} saved the itinerary.`];
  }

  return trimmed;
}

export function buildTripCreatedActivityLines(
  actorName: string,
  tripName: string,
  waypoints: { name: string; order: number }[]
): string[] {
  const actor = actorName.trim() || "Someone";
  const title = (tripName || "").trim() || "Untitled itinerary";
  const sorted = sortByOrder(waypoints);
  const lines: string[] = [`${actor} created itinerary "${title}".`];
  sorted.slice(0, 24).forEach((w, idx) => {
    lines.push(`${actor} added "${placeNameForActivity(w.name)}" as stop ${idx + 1}.`);
  });
  if (sorted.length > 24) {
    lines.push(`${actor}: …and ${sorted.length - 24} more stop(s).`);
  } else if (sorted.length === 0) {
    lines.push(`${actor} started with no stops yet.`);
  }
  return lines;
}
