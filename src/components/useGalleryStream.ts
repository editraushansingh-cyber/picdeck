"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

export type LiveGalleryEvent = {
  id: string;
  eventId: string;
  kind: "select" | "unselect" | "replace" | "photo-ready" | "photo-removed" | "ping";
  photoIds: string[];
  actor: "client" | "studio";
  clientName?: string | null;
  at: string;
};

export type LiveStatus = "connecting" | "live" | "polling";

type Options = {
  eventId: string;
  /** Called on every event. Must be safe to call from a stream callback. */
  onEvent: (event: LiveGalleryEvent) => void;
  /**
   * Polling fallback in milliseconds. Some corporate proxies buffer or block
   * `text/event-stream`; when the stream stays closed we poll instead so the
   * studio still updates, just a few seconds later.
   */
  pollMs?: number;
};

type Subscriber = {
  onEvent: (event: LiveGalleryEvent) => void;
};

type Room = {
  subscribers: Set<Subscriber>;
  statusListeners: Set<() => void>;
  status: LiveStatus;
  close: () => void;
};

/**
 * One SSE connection per event, shared by every hook mounted for that event.
 *
 * The studio event page renders the live counter in its header *and* the photo
 * grid below it; two independent connections would double server work and eat
 * into the browser's per-origin connection budget. Whichever hook mounts first
 * opens the room, and the room is torn down when the last one unmounts.
 */
const rooms = new Map<string, Room>();

function setRoomStatus(room: Room, status: LiveStatus) {
  if (room.status === status) return;
  room.status = status;
  for (const listener of room.statusListeners) listener();
}

function openRoom(eventId: string, pollMs: number): Room {
  let closed = false;
  let source: EventSource | null = null;
  let poll: ReturnType<typeof setInterval> | null = null;
  let sawEvent = false;

  const room: Room = {
    subscribers: new Set(),
    statusListeners: new Set(),
    status: "connecting",
    close: () => {
      closed = true;
      if (poll) clearInterval(poll);
      poll = null;
      source?.close();
      source = null;
      rooms.delete(eventId);
    },
  };

  const stopPolling = () => {
    if (poll) clearInterval(poll);
    poll = null;
  };

  const emit = (event: LiveGalleryEvent) => {
    for (const subscriber of room.subscribers) {
      try {
        subscriber.onEvent(event);
      } catch {
        // One broken consumer must not starve the others.
      }
    }
  };

  const startPolling = () => {
    if (closed || poll) return;
    setRoomStatus(room, "polling");
    poll = setInterval(() => {
      // Consumers treat "ping" as "re-sync from the server": the studio grid
      // refreshes its server render, the client grid pulls a snapshot.
      emit({
        id: `poll-${Date.now()}`,
        eventId,
        kind: "ping",
        photoIds: [],
        actor: "studio",
        at: new Date().toISOString(),
      });
    }, pollMs);
  };

  if (typeof window !== "undefined" && typeof EventSource !== "undefined") {
    source = new EventSource(`/api/events/${eventId}/stream`);

    source.addEventListener("ready", () => {
      sawEvent = true;
      stopPolling();
      setRoomStatus(room, "live");
    });

    source.addEventListener("gallery", (message) => {
      sawEvent = true;
      stopPolling();
      setRoomStatus(room, "live");
      let payload: LiveGalleryEvent;
      try {
        payload = JSON.parse((message as MessageEvent<string>).data) as LiveGalleryEvent;
      } catch {
        return; // Malformed frame — ignore rather than kill the stream.
      }
      emit(payload);
    });

    source.onerror = () => {
      // EventSource retries on its own; only fall back if it never came up
      // (a proxy that blocks event-stream, for example).
      if (sawEvent || closed) return;
      source?.close();
      source = null;
      startPolling();
    };
  } else {
    setRoomStatus(room, "polling");
  }

  return room;
}

/**
 * Subscribes to `/api/events/<id>/stream` and falls back to polling.
 *
 * This is the client half of PicDeck's live-sync: the studio dashboard and the
 * client gallery both mount it, so a pick made on a client's phone reaches the
 * studio tab within a second — the behaviour CamTom delivers via Firestore
 * snapshots.
 */
export function useGalleryStream({ eventId, onEvent, pollMs = 5000 }: Options) {
  // Keep the callback fresh without re-subscribing on every parent render.
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  });

  useEffect(() => {
    const subscriber: Subscriber = { onEvent: (event) => onEventRef.current(event) };
    const room = rooms.get(eventId) ?? openRoom(eventId, pollMs);
    rooms.set(eventId, room);
    room.subscribers.add(subscriber);

    return () => {
      room.subscribers.delete(subscriber);
      if (room.subscribers.size === 0) room.close();
    };
  }, [eventId, pollMs]);

  // Status lives in the shared room, so read it through an external store:
  // that keeps "connecting" on the server render (no hydration mismatch) and
  // lets every consumer of the same event see the same label.
  const status = useSyncExternalStore(
    (onChange) => {
      const room = rooms.get(eventId);
      if (!room) return () => {};
      room.statusListeners.add(onChange);
      return () => room.statusListeners.delete(onChange);
    },
    () => rooms.get(eventId)?.status ?? "connecting",
    () => "connecting" as LiveStatus,
  );

  return { status };
}

/** Exposed for tests: drop every room (no-op when nothing is open). */
export function __resetGalleryStream() {
  for (const room of Array.from(rooms.values())) room.close();
}