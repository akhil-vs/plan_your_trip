import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getApiUser } from "@/lib/api-auth";
import { buildGeneratedItineraryFromDestination, type Pace, type RankingStyle } from "@/lib/itinerary/fromDestination";
import { buildItineraryNarrative } from "@/lib/llm/itineraryNarrative";
import { resolveDestination } from "@/lib/mapbox/destinationResolve";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "@/lib/randomUuid";
import { createTripEvent } from "@/lib/tripEvents";
import { buildTripCreatedActivityLines } from "@/lib/tripUpdateActivitySummary";

const RL_WINDOW_MS = 60 * 60 * 1000;
const RL_MAX_PER_WINDOW = 15;
const rateState = new Map<string, { count: number; windowStart: number }>();

function allowGenerate(userId: string): boolean {
  const now = Date.now();
  const row = rateState.get(userId);
  if (!row || now - row.windowStart > RL_WINDOW_MS) {
    rateState.set(userId, { count: 1, windowStart: now });
    return true;
  }
  if (row.count >= RL_MAX_PER_WINDOW) return false;
  row.count += 1;
  return true;
}

function isPace(v: unknown): v is Pace {
  return v === "relaxed" || v === "moderate" || v === "packed";
}
function isRankingStyle(v: unknown): v is RankingStyle {
  return v === "most_popular" || v === "best_spread" || v === "hidden_gems";
}

function normalizeName(v: string): string {
  return v.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function isKnownHotspotName(name: string): boolean {
  const n = normalizeName(name);
  return (
    n.includes("lands end") ||
    n.includes("land s end") ||
    n.includes("st ives") ||
    n.includes("st michaels mount") ||
    n.includes("st michael s mount")
  );
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function buildPresetItinerary(rawPreset: unknown, days: number, defaultVisitMinutes: number) {
  const preset = asRecord(rawPreset);
  const rawDays = Array.isArray(preset.days) ? preset.days : [];
  if (rawDays.length !== days || rawDays.length < 1 || rawDays.length > 14) return null;

  const waypoints: Array<{
    id: string;
    name: string;
    lat: number;
    lng: number;
    order: number;
    visitMinutes: number;
  }> = [];
  const dayPlans: Array<{
    day: number;
    waypointIndexes: number[];
    waypointIds: string[];
    estimatedTravelMinutes: number;
  }> = [];
  const placesByDay: string[][] = [];
  const narrativeDays: Array<{ day: number; title: string; summary: string; mealIdeas: string[] }> = [];

  for (let dayIdx = 0; dayIdx < rawDays.length; dayIdx += 1) {
    const rawDay = asRecord(rawDays[dayIdx]);
    const rawStops = Array.isArray(rawDay.stops) ? rawDay.stops : [];
    if (rawStops.length < 1) return null;

    const indexes: number[] = [];
    const ids: string[] = [];
    const names: string[] = [];
    for (const rawStop of rawStops) {
      const stop = asRecord(rawStop);
      const name = String(stop.name ?? "").trim();
      const lat = Number(stop.lat);
      const lng = Number(stop.lng);
      if (name.length < 2 || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;

      const id = randomUUID();
      indexes.push(waypoints.length);
      ids.push(id);
      names.push(name);
      waypoints.push({
        id,
        name,
        lat,
        lng,
        order: waypoints.length,
        visitMinutes: Math.max(5, Math.round(defaultVisitMinutes)),
      });
    }

    const day = dayIdx + 1;
    placesByDay.push(names);
    dayPlans.push({
      day,
      waypointIndexes: indexes,
      waypointIds: ids,
      estimatedTravelMinutes: Math.max(0, rawStops.length - 1) * 25,
    });
    narrativeDays.push({
      day,
      title: String(rawDay.title ?? `Day ${day}`).trim() || `Day ${day}`,
      summary: String(rawDay.summary ?? names.join(", ")).trim() || names.join(", "),
      mealIdeas: [],
    });
  }

  const tripName = String(preset.name ?? "").trim() || `Popular itinerary · ${days} days`;
  const description = String(preset.description ?? "").trim() || `A curated ${days}-day itinerary.`;

  return {
    tripName,
    description,
    waypoints,
    dayPlans,
    placesByDay,
    selectedStops: waypoints.map((wp) => ({ name: wp.name, lat: wp.lat, lng: wp.lng, popularityScore: 5 })),
    alternativeStops: [],
    narrative: {
      tripIntro: description,
      days: narrativeDays,
      source: "popular_preset",
    },
  };
}

export async function POST(req: NextRequest) {
  const authUser = await getApiUser(req);
  if (!authUser?.id) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const preview = body?.preview === true;
  if (!preview && !allowGenerate(authUser.id)) {
    return NextResponse.json(
      { error: "Too many itinerary generations. Try again later.", code: "RATE_LIMIT" },
      { status: 429 }
    );
  }
  const destination =
    typeof body?.destination === "string" ? body.destination.trim() : "";
  const mapboxId =
    typeof body?.mapboxId === "string" ? body.mapboxId.trim() : "";
  const daysRaw = body?.days;
  const days =
    typeof daysRaw === "number" && Number.isFinite(daysRaw)
      ? Math.round(daysRaw)
      : Number.parseInt(String(daysRaw ?? ""), 10);
  const pace: Pace = isPace(body?.pace) ? body.pace : "moderate";
  const rankingStyle: RankingStyle = isRankingStyle(body?.rankingStyle) ? body.rankingStyle : "most_popular";
  const selectedStops = Array.isArray(body?.selectedStops)
    ? (body.selectedStops as unknown[])
        .map((x) => (x && typeof x === "object" ? (x as Record<string, unknown>) : null))
        .filter((x): x is Record<string, unknown> => Boolean(x))
        .map((x) => ({
          name: String(x.name ?? "").trim(),
          lat: Number(x.lat),
          lng: Number(x.lng),
          popularityScore: Number.isFinite(Number(x.popularityScore)) ? Number(x.popularityScore) : undefined,
          category: typeof x.category === "string" ? x.category : undefined,
        }))
        .filter((x) => x.name.length >= 2 && Number.isFinite(x.lat) && Number.isFinite(x.lng))
    : [];
  const interests = Array.isArray(body?.interests)
    ? (body.interests as unknown[])
        .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        .map((x) => x.trim())
        .slice(0, 12)
    : [];

  const optimizationSettings = body?.optimizationSettings as
    | {
        dayStartMinutes?: number;
        dayEndMinutes?: number;
        defaultVisitMinutes?: number;
      }
    | undefined;

  const optimizerDayStartMinutes =
    typeof optimizationSettings?.dayStartMinutes === "number" &&
    Number.isFinite(optimizationSettings.dayStartMinutes)
      ? Math.max(0, Math.min(23 * 60 + 59, Math.round(optimizationSettings.dayStartMinutes)))
      : 9 * 60;
  const optimizerDayEndMinutes =
    typeof optimizationSettings?.dayEndMinutes === "number" &&
    Number.isFinite(optimizationSettings.dayEndMinutes)
      ? Math.max(0, Math.min(23 * 60 + 59, Math.round(optimizationSettings.dayEndMinutes)))
      : 20 * 60;
  const optimizerDefaultVisitMinutes =
    typeof optimizationSettings?.defaultVisitMinutes === "number" &&
    Number.isFinite(optimizationSettings.defaultVisitMinutes)
      ? Math.max(5, Math.round(optimizationSettings.defaultVisitMinutes))
      : 60;

  if (!mapboxId && destination.length < 3) {
    return NextResponse.json(
      { error: "Enter a destination or choose a place from search.", code: "VALIDATION" },
      { status: 400 }
    );
  }

  if (!Number.isFinite(days) || days < 1 || days > 14) {
    return NextResponse.json(
      { error: "Days must be between 1 and 14.", code: "VALIDATION" },
      { status: 400 }
    );
  }

  const presetBuilt = body?.presetPlan ? buildPresetItinerary(body.presetPlan, days, optimizerDefaultVisitMinutes) : null;
  if (body?.presetPlan && !presetBuilt) {
    return NextResponse.json(
      { error: "Preset itinerary is invalid.", code: "VALIDATION" },
      { status: 400 }
    );
  }

  if (presetBuilt) {
    if (preview) {
      return NextResponse.json(
        {
          selectedStops: presetBuilt.selectedStops,
          alternativeStops: presetBuilt.alternativeStops,
        },
        { status: 200 }
      );
    }

    const aiPlanMetaValue = presetBuilt.narrative as unknown as Prisma.InputJsonValue;
    try {
      const trip = await prisma.trip.create({
        data: {
          name: presetBuilt.tripName,
          description: presetBuilt.description,
          aiPlanMeta: aiPlanMetaValue,
          userId: authUser.id,
          optimizerDayStartMinutes,
          optimizerDayEndMinutes,
          optimizerDefaultVisitMinutes,
          waypoints: {
            create: presetBuilt.waypoints.map((wp) => ({
              id: wp.id,
              name: wp.name,
              notes: null,
              lat: wp.lat,
              lng: wp.lng,
              order: wp.order,
              visitMinutes: wp.visitMinutes,
              openMinutes: 0,
              closeMinutes: 23 * 60 + 59,
            })),
          },
          dayPlans: {
            create: presetBuilt.dayPlans.map((dp) => ({
              day: dp.day,
              waypointIndexes: dp.waypointIndexes,
              waypointIds: dp.waypointIds,
              estimatedTravelMinutes: dp.estimatedTravelMinutes,
            })),
          },
          members: {
            create: {
              userId: authUser.id,
              role: "OWNER",
            },
          },
        },
        include: {
          waypoints: { orderBy: { order: "asc" } },
          dayPlans: { orderBy: { day: "asc" } },
          members: true,
        },
      });

      await createTripEvent(
        trip.id,
        "trip.created",
        {
          name: trip.name,
          waypointCount: trip.waypoints.length,
          activityLines: buildTripCreatedActivityLines(
            authUser.name ?? "Someone",
            trip.name,
            trip.waypoints.map((w) => ({ name: w.name, order: w.order }))
          ),
        },
        authUser.id,
        authUser.name ?? null
      );

      return NextResponse.json(
        {
          trip,
          narrative: presetBuilt.narrative,
        },
        { status: 201 }
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save itinerary";
      return NextResponse.json({ error: message, code: "SAVE_FAILED" }, { status: 500 });
    }
  }

  const resolved = await resolveDestination({
    destinationQuery: mapboxId ? undefined : destination,
    mapboxId: mapboxId || undefined,
  });

  if (!resolved) {
    return NextResponse.json(
      {
        error:
          process.env.MAPBOX_ACCESS_TOKEN
            ? "Could not resolve that destination. Try a different spelling or pick a suggestion."
            : "Map search is not configured on the server.",
        code: "DESTINATION_NOT_FOUND",
      },
      { status: 404 }
    );
  }

  let built;
  try {
    built = await buildGeneratedItineraryFromDestination({
      destination: resolved,
      days,
      pace,
      rankingStyle,
      defaultVisitMinutes: optimizerDefaultVisitMinutes,
      travelMode: "driving",
      selectedOverrideStops: selectedStops,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Generation failed";
    const insufficient = /not enough|enough places/i.test(msg);
    return NextResponse.json(
      { error: msg, code: insufficient ? "INSUFFICIENT_PLACES" : "GENERATION_FAILED" },
      { status: insufficient ? 422 : 400 }
    );
  }

  if (preview) {
    const hotspotSelected = built.selectedStops.filter((s) => isKnownHotspotName(s.name)).map((s) => s.name);
    const hotspotAlternatives = built.alternativeStops.filter((s) => isKnownHotspotName(s.name)).map((s) => s.name);
    return NextResponse.json(
      {
        resolvedDestination: {
          mapboxId: resolved.mapboxId,
          name: resolved.name,
          fullName: resolved.fullName,
          lat: resolved.lat,
          lng: resolved.lng,
        },
        selectedStops: built.selectedStops,
        alternativeStops: built.alternativeStops,
        debugHotspots: {
          selected: hotspotSelected,
          alternatives: hotspotAlternatives,
        },
      },
      { status: 200 }
    );
  }

  const narrative = await buildItineraryNarrative({
    destinationLabel: resolved.fullName || resolved.name,
    placesByDay: built.placesByDay,
    interests,
  });

  const aiPlanMetaValue: Prisma.InputJsonValue | undefined = narrative
    ? ({
        ...narrative,
        source: "hybrid_generator",
        destinationMapboxId: resolved.mapboxId,
        interests,
      } as unknown as Prisma.InputJsonValue)
    : undefined;

  try {
    const trip = await prisma.trip.create({
      data: {
        name: built.tripName,
        description: narrative?.tripIntro ?? null,
        ...(aiPlanMetaValue !== undefined ? { aiPlanMeta: aiPlanMetaValue } : {}),
        userId: authUser.id,
        optimizerDayStartMinutes,
        optimizerDayEndMinutes,
        optimizerDefaultVisitMinutes,
        waypoints: {
          create: built.waypoints.map((wp) => ({
            id: wp.id,
            name: wp.name,
            notes: null,
            lat: wp.lat,
            lng: wp.lng,
            order: wp.order,
            visitMinutes: wp.visitMinutes,
            openMinutes: 0,
            closeMinutes: 23 * 60 + 59,
          })),
        },
        dayPlans: {
          create: built.dayPlans.map((dp) => ({
            day: dp.day,
            waypointIndexes: dp.waypointIndexes,
            waypointIds: dp.waypointIds,
            estimatedTravelMinutes: dp.estimatedTravelMinutes,
          })),
        },
        members: {
          create: {
            userId: authUser.id,
            role: "OWNER",
          },
        },
      },
      include: {
        waypoints: { orderBy: { order: "asc" } },
        dayPlans: { orderBy: { day: "asc" } },
        members: true,
      },
    });

    await createTripEvent(
      trip.id,
      "trip.created",
      {
        name: trip.name,
        waypointCount: trip.waypoints.length,
        activityLines: buildTripCreatedActivityLines(
          authUser.name ?? "Someone",
          trip.name,
          trip.waypoints.map((w) => ({ name: w.name, order: w.order }))
        ),
      },
      authUser.id,
      authUser.name ?? null
    );

    return NextResponse.json(
      {
        trip,
        narrative,
        resolvedDestination: {
          mapboxId: resolved.mapboxId,
          name: resolved.name,
          fullName: resolved.fullName,
          lat: resolved.lat,
          lng: resolved.lng,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save itinerary";
    return NextResponse.json({ error: message, code: "SAVE_FAILED" }, { status: 500 });
  }
}
