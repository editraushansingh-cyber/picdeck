import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isGalleryUnlocked } from "@/lib/gallery-session";
import { subscribe, type GalleryEvent } from "@/lib/gallery-events";

export const maxDuration = 300;

const HEARTBEAT_MS = 25_000;

/**
 * Live gallery stream (Server-Sent Events).
 *
 * Two kinds of tabs connect here:
 * - the studio dashboard (`/dashboard/events/<id>`), authenticated by session
 * - the client gallery (`/g/<code>`), authorised by the unlock cookie
 *
 * A tab that reconnects sends `Last-Event-ID`; we replay whatever selections it
 * missed from Postgres before switching to live delivery. This is the piece
 * CamTom gets from Firestore snapshots — same outcome, our own stack.
 */
export async function GET(
  request: Request,
  context: RouteContext<"/api/events/[id]/stream">,
) {
  const { id: eventId } = await context.params;
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, userId: true },
  });
  if (!event) return new Response("Event not found", { status: 404 });

  const user = await getCurrentUser();
  const isStudio = user?.id === event.userId;
  const isClient = !isStudio && (await isGalleryUnlocked(eventId));
  if (!isStudio && !isClient) return new Response("Forbidden", { status: 403 });

  const lastEventId = request.headers.get("last-event-id");
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      // Ids already written to this socket, so the in-process hub and the
      // Postgres catch-up poll cannot deliver the same event twice.
      const sent = new Set<string>();
      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };
      const sendEvent = (event: GalleryEvent) => {
        if (sent.has(event.id)) return;
        sent.add(event.id);
        send(
          `id: ${event.id}\nevent: gallery\ndata: ${JSON.stringify(event)}\n\n`,
        );
      };

      send(`retry: 3000\n\n`);

      let cursor: string | null = lastEventId ?? null;

      // Replay missed events so a phone that went to sleep is not out of date.
      void (async () => {
        if (lastEventId) {
          const missed = await prisma.selectionEvent.findMany({
            where: { eventId, id: { gt: lastEventId } },
            orderBy: { createdAt: "asc" },
            take: 100,
          });
          for (const row of missed) {
            cursor = row.id;
            sendEvent({
              id: row.id,
              eventId,
              kind: row.kind as GalleryEvent["kind"],
              photoIds: JSON.parse(row.photoIds) as string[],
              actor: row.actor as GalleryEvent["actor"],
              clientName: row.clientName,
              at: row.createdAt.toISOString(),
            });
          }
        } else {
          // Fresh connection: start from the newest row so history is not
          // replayed as if it had just happened.
          const latest = await prisma.selectionEvent.findFirst({
            where: { eventId },
            orderBy: { createdAt: "desc" },
            select: { id: true },
          });
          cursor = latest?.id ?? null;
        }
        send(`event: ready\ndata: {}\n\n`);
      })();

      const unsubscribe = subscribe(eventId, sendEvent);
      const heartbeat = setInterval(() => send(`: ping\n\n`), HEARTBEAT_MS);

      // The in-process hub only sees writes made by this instance. Vercel runs
      // several, so a client pick handled elsewhere would never reach this
      // socket. Poll the event log as a catch-up; duplicates are filtered by
      // `sent`, and the 2.5s cadence keeps the "instant" feel while the hub
      // covers same-instance writes with zero latency.
      const CATCH_UP_MS = 2_500;
      const catchUp = setInterval(() => {
        if (closed) return;
        void (async () => {
          try {
            const rows = await prisma.selectionEvent.findMany({
              where: { eventId, ...(cursor ? { id: { gt: cursor } } : {}) },
              orderBy: { createdAt: "asc" },
              take: 50,
            });
            for (const row of rows) {
              cursor = row.id;
              sendEvent({
                id: row.id,
                eventId,
                kind: row.kind as GalleryEvent["kind"],
                photoIds: JSON.parse(row.photoIds) as string[],
                actor: row.actor as GalleryEvent["actor"],
                clientName: row.clientName,
                at: row.createdAt.toISOString(),
              });
            }
          } catch {
            // A transient database error must not kill the stream.
          }
        })();
      }, CATCH_UP_MS);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        clearInterval(catchUp);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Already closed by the client.
        }
      };
      request.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Disable proxy buffering (nginx, Caddy) so events arrive immediately.
      "X-Accel-Buffering": "no",
    },
  });
}