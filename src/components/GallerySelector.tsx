"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { saveSelection } from "@/app/actions/gallery";
import { pushLiveSelection } from "@/app/actions/live-selection";
import { useGalleryStream } from "@/components/useGalleryStream";

export type GalleryPhoto = {
  id: string;
  originalName: string;
  isRaw: boolean;
  width: number | null;
  height: number | null;
  hasThumb: boolean;
  hasPreview: boolean;
};

export type GalleryData = {
  id: string;
  title: string;
  clientName: string | null;
  note: string | null;
  selectionLimit: number | null;
  downloadEnabled: boolean;
  originalDownloadEnabled: boolean;
  photos: GalleryPhoto[];
  selectedIds: string[];
};

export function GallerySelector({ gallery }: { gallery: GalleryData }) {
  const [photos, setPhotos] = useState<GalleryPhoto[]>(gallery.photos);
  const [selected, setSelected] = useState<string[]>(gallery.selectedIds);
  const [name, setName] = useState(gallery.clientName ?? "");
  const [phone, setPhone] = useState("");
  const [preview, setPreview] = useState<GalleryPhoto | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ count: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const limit = gallery.selectionLimit;
  const atLimit = limit !== null && selected.length >= limit;

  // Live channel: the studio dashboard listens on the same stream, so it sees
  // each pick the moment it happens (CamTom's client→studio behaviour).
  const { status: liveStatus } = useGalleryStream({
    eventId: gallery.id,
    onEvent: (event) => {
      // "ping" is the polling fallback: pull a fresh snapshot of tiles and picks.
      if (event.kind === "ping" || event.kind === "photo-ready" || event.kind === "photo-removed") {
        void refreshPhotos();
        return;
      }
      // Only studio-driven changes need to reach this tab; our own picks are
      // already in local state and must not fight the user's taps.
      if (event.actor !== "studio") return;
      setSelected(event.photoIds);
    },
  });

  async function refreshPhotos() {
    try {
      const response = await fetch(`/api/events/${gallery.id}/gallery-state`, {
        cache: "no-store",
      });
      if (!response.ok) return;
      const data = (await response.json()) as {
        photos: GalleryPhoto[];
        selectedIds: string[];
      };
      setPhotos(data.photos);
      setSelected(data.selectedIds);
    } catch {
      // Offline or transient error; the next event retries.
    }
  }

  const liveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingLive = useRef<string[] | null>(null);

  // Debounce so a client flicking through 20 photos does not open 20 writes.
  const pushLive = useCallback((ids: string[]) => {
    pendingLive.current = ids;
    if (liveTimer.current) clearTimeout(liveTimer.current);
    liveTimer.current = setTimeout(() => {
      const next = pendingLive.current;
      if (!next) return;
      pendingLive.current = null;
      void pushLiveSelection(gallery.id, next).catch(() => null);
    }, 350);
  }, [gallery.id]);

  useEffect(() => {
    return () => {
      if (liveTimer.current) clearTimeout(liveTimer.current);
    };
  }, []);

  function updateSelection(next: string[]) {
    setSelected(next);
    pushLive(next);
  }

  function toggle(photo: GalleryPhoto) {
    setSaved(null);
    if (selectedSet.has(photo.id)) {
      updateSelection(selected.filter((id) => id !== photo.id));
      setNotice(null);
      return;
    }
    if (limit !== null && selected.length >= limit) {
      setNotice(`You can select up to ${limit} photos. Deselect one to pick another.`);
      return;
    }
    updateSelection([...selected, photo.id]);
    setNotice(null);
  }

  async function handleSubmit() {
    setSaving(true);
    setNotice(null);
    try {
      const result = await saveSelection(gallery.id, selected, { name, phone });
      if (!result.ok) {
        setNotice(result.message);
        return;
      }
      setSaved({ count: result.count });
    } catch {
      setNotice("Could not save your selection. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function downloadSelected() {
    const ids = selected;
    if (ids.length === 0) return;
    setDownloading(true);
    const kind = gallery.originalDownloadEnabled ? "original" : "preview";
    for (const id of ids) {
      const link = document.createElement("a");
      link.href = `/api/photos/${id}/file?kind=${kind}&download=1`;
      link.download = "";
      document.body.appendChild(link);
      link.click();
      link.remove();
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
    setDownloading(false);
  }

  return (
    <div className="pb-40">
      <header className="mx-auto max-w-6xl px-5 pt-10">
        <p className="text-xs font-medium uppercase tracking-wider text-muted">
          {photos.length} photos
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{gallery.title}</h1>
        {gallery.note && <p className="mt-2 max-w-2xl text-sm text-muted">{gallery.note}</p>}
        <p className="mt-3 text-sm text-muted">
          Tap a photo to pick it. Tap again to remove it.
          {limit !== null && <> You may choose up to <strong className="text-ink">{limit}</strong>.</>}
        </p>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
          <span
            aria-hidden
            className={`inline-block size-1.5 rounded-full ${
              liveStatus === "live"
                ? "bg-emerald-500"
                : liveStatus === "polling"
                  ? "bg-amber-400"
                  : "bg-line"
            }`}
          />
          {liveStatus === "live"
            ? "Live — your photographer sees each pick right away"
            : liveStatus === "polling"
              ? "Sending your picks every few seconds"
              : "Connecting…"}
        </p>
      </header>

      {photos.length === 0 ? (
        <div className="mx-auto mt-10 max-w-6xl px-5">
          <div className="rounded-2xl border border-dashed border-line p-12 text-center">
            <p className="font-medium">No photos yet</p>
            <p className="mt-1.5 text-sm text-muted">
              Your photographer is still uploading. Check back in a little while.
            </p>
          </div>
        </div>
      ) : (
        <div className="mx-auto mt-6 max-w-6xl px-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {photos.map((photo) => {
              const isSelected = selectedSet.has(photo.id);
              return (
                <div
                  key={photo.id}
                  className={`group relative overflow-hidden rounded-xl border bg-surface ${
                    isSelected ? "border-brand ring-2 ring-brand/30" : "border-line"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggle(photo)}
                    className="block w-full"
                    aria-pressed={isSelected}
                    aria-label={`${isSelected ? "Remove" : "Select"} ${photo.originalName}`}
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
                        <div className="grid size-full place-items-center px-2 text-center">
                          <div>
                            <span className="block font-mono text-[10px] uppercase tracking-wider text-muted">
                              {photo.isRaw ? "RAW" : "Preview"}
                            </span>
                            <span className="mt-1 block truncate text-xs text-muted">
                              {photo.originalName}
                            </span>
                          </div>
                        </div>
                      )}
                      <span
                        className={`absolute left-2 top-2 grid size-6 place-items-center rounded-full text-xs font-semibold transition ${
                          isSelected
                            ? "bg-brand text-white"
                            : "border border-white/70 bg-black/25 text-white opacity-0 group-hover:opacity-100"
                        }`}
                      >
                        {isSelected ? "✓" : "+"}
                      </span>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreview(photo)}
                    className="absolute bottom-2 right-2 rounded-md bg-black/55 px-2 py-1 text-[11px] font-medium text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100"
                  >
                    View
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-6xl px-5 py-3">
          {notice && (
            <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {notice}
            </p>
          )}
          {saved && (
            <p className="mb-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Sent. Your photographer can see {saved.count} selected{" "}
              {saved.count === 1 ? "photo" : "photos"} now. You can still change the list and send
              again.
            </p>
          )}
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="text-sm">
                <span className="font-semibold">{selected.length}</span>
                {limit !== null && <span className="text-muted"> / {limit}</span>}
                <span className="text-muted"> selected</span>
              </div>
              {atLimit && (
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                  Limit reached
                </span>
              )}
              {gallery.downloadEnabled && selected.length > 0 && (
                <button
                  type="button"
                  onClick={downloadSelected}
                  disabled={downloading}
                  className="text-xs font-medium text-brand hover:underline disabled:opacity-50"
                >
                  {downloading
                    ? "Preparing…"
                    : gallery.originalDownloadEnabled
                      ? "Download originals"
                      : "Download previews"}
                </button>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-2 sm:max-w-xl sm:flex-row">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name"
                className="w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none sm:w-40"
                aria-label="Your name"
              />
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value.replace(/[^\d+\s-]/g, ""))}
                placeholder="Phone (optional)"
                inputMode="tel"
                className="w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none sm:w-40"
                aria-label="Your phone"
              />
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving || selected.length === 0}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-50"
              >
                {saving ? "Sending…" : saved ? "Send again" : "Send my list"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/90 p-4 pd-fade-in"
          role="dialog"
          aria-modal="true"
          aria-label={preview.originalName}
        >
          <div className="flex items-center justify-between text-white/80">
            <span className="truncate text-sm">{preview.originalName}</span>
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="rounded-lg px-3 py-1.5 text-sm hover:bg-white/10"
            >
              Close
            </button>
          </div>
          <div className="flex flex-1 items-center justify-center overflow-hidden py-4">
            {preview.hasPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/photos/${preview.id}/file?kind=preview`}
                alt={preview.originalName}
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <p className="max-w-sm text-center text-sm text-white/70">
                No preview available for this file. Ask your photographer for the original after
                your list is final.
              </p>
            )}
          </div>
          <div className="flex justify-center pb-2">
            <button
              type="button"
              onClick={() => {
                toggle(preview);
                setPreview(null);
              }}
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                selectedSet.has(preview.id)
                  ? "bg-white/15 text-white"
                  : "bg-brand text-white hover:bg-brand/90"
              }`}
            >
              {selectedSet.has(preview.id) ? "Remove from my list" : "Add to my list"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
