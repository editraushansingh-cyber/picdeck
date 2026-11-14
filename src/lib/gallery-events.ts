/**
 * In-process pub/sub used by the live gallery stream.
 *
 * CamTom keeps its galleries in sync through Firestore snapshots. PicDeck runs
 * on a single Next.js server (or a few regional instances) and its own Postgres,
 * so the same "client taps a photo → studio updates instantly" behaviour comes
 * from Server-Sent Events plus a replayable `SelectionEvent` log.
 *
 * Trade-offs to know about:
 * - The hub is in memory. With more than one server instance a client may sit
 *   on instance A while a studio writes through instance B; the stream then
 *   only catches up on the next poll fallback (see `RealtimeGallery`). Plug a
 *   shared bus (Postgres LISTEN/NOTIFY, Redis pub/sub) into `publish()` when
 *   you scale past one instance.
 * - Events are also written to Postgres, so reconnects replay whatever was
 *   missed via `Last-Event-ID`.
 */

export type GalleryEvent = {
  /** Monotonic id (cuid) — sent as the SSE `id:` field for replay. */
  id: string;
  eventId: string;
  kind: "select" | "unselect" | "replace" | "photo-ready" | "photo-removed" | "ping";
  photoIds: string[];
  actor: "client" | "studio";
  clientName?: string | null;
  at: string;
};

type Listener = (event: GalleryEvent) => void;

type Hub = {
  rooms: Map<string, Set<Listener>>;
};

const globalForHub = globalThis as unknown as { picdeckHub?: Hub };

const hub: Hub = globalForHub.picdeckHub ?? { rooms: new Map() };
if (process.env.NODE_ENV !== "production") globalForHub.picdeckHub = hub;

export function subscribe(eventId: string, listener: Listener) {
  let room = hub.rooms.get(eventId);
  if (!room) {
    room = new Set();
    hub.rooms.set(eventId, room);
  }
  room.add(listener);
  return () => {
    room.delete(listener);
    if (room.size === 0) hub.rooms.delete(eventId);
  };
}

export function publish(event: GalleryEvent) {
  // Rooms are keyed by the *event* (gallery) id. `event.id` is the per-event
  // row id used for SSE replay, not the room key — mixing them up silently
  // drops every publish.
  const room = hub.rooms.get(event.eventId);
  if (!room) {
    if (process.env.NODE_ENV !== "production") {
      // Helps spot the "realtime looks broken" bug where a room key is wrong.
      console.warn(`[gallery-events] publish with no subscribers for ${event.eventId}`);
    }
    return 0;
  }
  let delivered = 0;
  for (const listener of room) {
    try {
      listener(event);
      delivered += 1;
    } catch {
      // A broken stream must never fail the write that produced the event.
    }
  }
  return delivered;
}

export function subscriberCount(eventId: string) {
  return hub.rooms.get(eventId)?.size ?? 0;
}