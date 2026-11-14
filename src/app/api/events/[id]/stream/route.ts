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
      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };
      const sendEvent = (event: GalleryEvent) =>
        send(
          `id: ${event.id}\nevent: gallery\ndata: ${JSON.stringify(event)}\n\n`,
        );

      send(`retry: 3000\n\n`);

      // Replay missed events so a phone that went to sleep is not out of date.
      void (async () => {
        if (lastEventId) {
          const missed = await prisma.selectionEvent.findMany({
            where: { eventId, id: { gt: lastEventId } },
            orderBy: { createdAt: "asc" },
            take: 100,
          });
          for (const row of missed) {
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
        }
        send(`event: ready\ndata: {}\n\n`);
      })();

      const unsubscribe = subscribe(eventId, sendEvent);
      const heartbeat = setInterval(() => send(`: ping\n\n`), HEARTBEAT_MS);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
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