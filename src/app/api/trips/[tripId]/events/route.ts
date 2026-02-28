import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canViewTrip, getTripAccess } from "@/lib/tripAccess";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function encodeSse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { tripId } = await params;
  const access = await getTripAccess(tripId, session.user.id);
  if (!access || !canViewTrip(access.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const historyLimit = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("limit") || 30))
  );
  const historyOnly = url.searchParams.get("mode") === "history";
  const initialSince = Number(url.searchParams.get("since") || 0);

  if (historyOnly) {
    const events = await prisma.tripChangeEvent.findMany({
      where: { tripId },
      orderBy: { createdAt: "desc" },
      take: historyLimit,
    });
    return NextResponse.json(
      events.map((evt) => ({
        id: evt.id,
        type: evt.eventType,
        payload: evt.payload,
        actorId: evt.actorId,
        createdAt: evt.createdAt,
      }))
    );
  }

  const encoder = new TextEncoder();
  let closed = false;
  const stream = new ReadableStream({
    start(controller) {
      let cursor = Number.isFinite(initialSince) ? initialSince : 0;
      const push = async () => {
        if (closed) return;
        const events = await prisma.tripChangeEvent.findMany({
          where: {
            tripId,
            createdAt: cursor ? { gt: new Date(cursor) } : undefined,
          },
          orderBy: { createdAt: "asc" },
          take: 100,
        });
        for (const evt of events) {
          controller.enqueue(
            encoder.encode(
              encodeSse("trip_event", {
                id: evt.id,
                type: evt.eventType,
                payload: evt.payload,
                actorId: evt.actorId,
                createdAt: evt.createdAt,
              })
            )
          );
          cursor = evt.createdAt.getTime();
        }
      };

      controller.enqueue(encoder.encode(encodeSse("ready", { tripId })));
      void push();
      const interval = setInterval(async () => {
        try {
          await push();
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          clearInterval(interval);
          if (!closed) controller.close();
        }
      }, 3000);

      req.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
