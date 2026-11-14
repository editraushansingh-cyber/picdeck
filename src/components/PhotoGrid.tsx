"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { deletePhoto } from "@/app/actions/events";
import { useGalleryStream } from "@/components/useGalleryStream";

export type PhotoTile = {
  id: string;
  originalName: string;
  isRaw: boolean;
  hasThumb: boolean;
  sizeBytes: number;
  selected: boolean;
};

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Studio-side grid. It keeps a live selection set so a client's tap lights up
 * here without a page reload, and refreshes once after a burst of picks so the
 * "N selected" summary and the download links catch up.
 */
export function PhotoGrid({ eventId, photos }: { eventId: string; photos: PhotoTile[] }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [liveSelected, setLiveSelected] = useState<string[] | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const router = useRouter();

  const { status } = useGalleryStream({
    eventId,
    onEvent: (event) => {
      // "ping" is the polling fallback asking us to re-sync from the server.
      if (event.kind === "ping") {
        setLastSyncedAt(event.at);
        return;
      }
      setLiveSelected(event.photoIds);
      if (event.photoIds.length > 0) {
        setFlashId(event.photoIds[event.photoIds.length - 1]);
      }
    },
  });

  // Re-fetch the server render (counts, download list) shortly after events
  // settle, so the page stays authoritative without racing every tap. The same
  // debounced refresh serves the polling fallback.
  const syncKey = lastSyncedAt;
  useEffect(() => {
    if (!syncKey) return;
    const timer = setTimeout(() => router.refresh(), 900);
    return () => clearTimeout(timer);
  }, [syncKey, router]);

  useEffect(() => {
    if (!flashId) return;
    const timer = setTimeout(() => setFlashId(null), 1600);
    return () => clearTimeout(timer);
  }, [flashId]);

  const selectedSet = new Set(liveSelected ?? photos.filter((p) => p.selected).map((p) => p.id));

  async function remove(photo: PhotoTile) {
    if (!window.confirm(`Delete ${photo.originalName}? This cannot be undone.`)) return;
    setBusyId(photo.id);
    try {
      const result = await deletePhoto(photo.id);
      if (!result.ok) window.alert(result.message);
      else router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  if (photos.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line bg-white p-6 text-center text-sm text-muted">
        No photos uploaded yet.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-xs text-muted">
        <span
          aria-hidden
          className={`inline-block size-1.5 rounded-full ${
            status === "live"
              ? "bg-emerald-500"
              : status === "polling"
                ? "bg-amber-400"
                : "bg-line"
          }`}
        />
        {status === "live"
          ? "Live — client picks appear here instantly"
          : status === "polling"
            ? "Checking for client picks every few seconds"
            : "Connecting to live updates…"}
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((photo) => {
          const picked = selectedSet.has(photo.id);
          return (
            <figure
              key={photo.id}
              className={`group relative overflow-hidden rounded-xl border bg-white transition ${
                flashId === photo.id
                  ? "border-brand ring-2 ring-brand/40"
                  : picked
                    ? "border-brand/40"
                    : "border-line"
              }`}
            >
              <div className="pd-checker relative aspect-square">
                {photo.hasThumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/photos/${photo.id}/file?kind=thumb`}
                    alt={photo.originalName}
                    loading="lazy"
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="grid size-full place-items-center text-center text-xs text-muted">
                    {photo.isRaw ? "RAW file" : "No preview"}
                  </div>
                )}
                {picked && (
                  <span className="absolute left-2 top-2 rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold text-white">
                    Picked
                  </span>
                )}
              </div>
              <figcaption className="flex items-center justify-between gap-2 px-2.5 py-2">
                <div className="min-w-0">
                  <p className="truncate text-xs" title={photo.originalName}>
                    {photo.originalName}
                  </p>
                  <p className="text-[11px] text-muted">{formatSize(photo.sizeBytes)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void remove(photo)}
                  disabled={busyId === photo.id}
                  className="rounded-md px-1.5 py-1 text-xs text-muted opacity-0 transition hover:bg-red-50 hover:text-red-700 group-hover:opacity-100 focus:opacity-100 disabled:opacity-50"
                  aria-label={`Delete ${photo.originalName}`}
                >
                  {busyId === photo.id ? "…" : "Delete"}
                </button>
              </figcaption>
            </figure>
          );
        })}
      </div>
    </div>
  );
}