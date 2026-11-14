"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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
  /** Studio display name, shown as the author of the photographer's note. */
  studioName?: string | null;
  /** Event date, used for the "Date" fact in the hero. */
  eventDate?: string | null;
  /** Cover photo id (first photo by default) for the hero image. */
  coverPhotoId?: string | null;
};

type Fact = { k: string; v: string };

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "PD";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function GallerySelector({
  gallery,
  faceSearch,
}: {
  gallery: GalleryData;
  /** Optional studio-plan extra (selfie search), rendered between the hero and the grid. */
  faceSearch?: React.ReactNode;
}) {
  const [photos, setPhotos] = useState<GalleryPhoto[]>(gallery.photos);
  const [selected, setSelected] = useState<string[]>(gallery.selectedIds);
  const [name, setName] = useState(gallery.clientName ?? "");
  const [phone, setPhone] = useState("");
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ count: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [filter, setFilter] = useState<"all" | "picked">("all");

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const limit = gallery.selectionLimit;
  const atLimit = limit !== null && selected.length >= limit;
  const coverPhoto =
    photos.find((photo) => photo.id === gallery.coverPhotoId) ?? photos[0] ?? null;
  // The hero is large, so prefer the 1600px preview; fall back to the thumbnail.
  const coverSrc = coverPhoto
    ? `/api/photos/${coverPhoto.id}/file?kind=${coverPhoto.hasPreview ? "preview" : "thumb"}`
    : null;

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

  const shown = filter === "picked" ? photos.filter((photo) => selectedSet.has(photo.id)) : photos;
  const studioName = gallery.studioName?.trim() || "Your photographer";
  const eventDate = formatDate(gallery.eventDate);

  const facts: Fact[] = [];
  if (eventDate) facts.push({ k: "Date", v: eventDate });
  facts.push({ k: "Frames", v: String(photos.length) });
  facts.push({ k: "Studio", v: studioName });

  // Progress rail across the dock — fills as the client approaches the limit.
  const progress = limit && limit > 0 ? Math.min(100, (selected.length / limit) * 100) : selected.length > 0 ? 100 : 0;

  const liveLabel =
    liveStatus === "live"
      ? "Your photographer sees each pick as you make it"
      : liveStatus === "polling"
        ? "Sending your picks every few seconds"
        : "Connecting to your photographer…";

  // Lightbox navigation helpers — index based so the arrow keys can walk the
  // same list the client is looking at.
  const current = previewIndex === null ? null : photos[previewIndex] ?? null;
  const stepPreview = useCallback(
    (delta: number) => {
      setPreviewIndex((index) => {
        if (index === null || photos.length === 0) return index;
        return (index + delta + photos.length) % photos.length;
      });
    },
    [photos.length],
  );

  useEffect(() => {
    if (previewIndex === null) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setPreviewIndex(null);
      if (event.key === "ArrowRight") stepPreview(1);
      if (event.key === "ArrowLeft") stepPreview(-1);
    }
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [previewIndex, stepPreview]);

  return (
    <>
      <div className="pg-wrap">
        <header className="pg-nav">
          <Link className="pg-brand" href="/">
            <span className="pg-mark">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden>
                <rect x="3" y="5.5" width="18" height="13" rx="2.6" stroke="#c9a468" strokeWidth="1.4" />
                <path d="m7.6 15.2 2.7-3.5 2.2 2.7 1.8-2.1 2.3 2.9" stroke="#c9a468" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="15.7" cy="9.4" r="1" fill="#c9a468" />
              </svg>
            </span>
            <span className="pg-brand-name">
              Pic<span>Deck</span>
            </span>
          </Link>
          <div className="pg-nav-r">
            <span className="pg-private">Private gallery</span>
            <span className="pg-studio">
              <span className="pg-av" aria-hidden>
                {initials(studioName)}
              </span>
              {studioName}
            </span>
          </div>
        </header>

        <section className="pg-hero">
          <div>
            <p className="pg-eyebrow">Private collection</p>
            <h1 className="pg-title">{gallery.title}</h1>
            <p className="pg-lede">
              {photos.length > 0 ? (
                <>
                  <em>{photos.length}</em> {photos.length === 1 ? "frame" : "frames"} from your session. Mark the
                  ones you love — your photographer sees each pick as you make it.
                </>
              ) : (
                <>Your gallery is getting ready. Photos will appear here as they land.</>
              )}
            </p>
            <div className="pg-hr" />
            <div className="pg-facts">
              {facts.map((fact) => (
                <div className="pg-fact" key={fact.k}>
                  <div className="k">{fact.k}</div>
                  <div className="v">{fact.v}</div>
                </div>
              ))}
            </div>
            <div className={`pg-live${liveStatus === "connecting" ? " muted" : ""}`}>
              <span className="pg-dot" aria-hidden />
              {liveLabel}
            </div>
          </div>

          {coverSrc && (
            <div className="pg-hero-media">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={coverSrc} alt="" loading="eager" fetchPriority="high" />
              <span className="pg-hero-cap">From your collection</span>
            </div>
          )}
        </section>

        {faceSearch}

        {gallery.note && (
          <div className="pg-note">
            <span className="q" aria-hidden>
              “
            </span>
            <div>
              <p>{gallery.note}</p>
              <div className="by">{studioName}</div>
            </div>
          </div>
        )}

        <div className="pg-toolbar">
          <p className="pg-hint">
            Tap to pick, tap again to release.
            {limit !== null && (
              <>
                {" "}
                Up to <b>{limit}</b> selections.
              </>
            )}
          </p>
          <div className="pg-chips" role="group" aria-label="Filter photos">
            <button
              type="button"
              className="pg-chip"
              aria-pressed={filter === "all"}
              onClick={() => setFilter("all")}
            >
              All {photos.length}
            </button>
            <button
              type="button"
              className="pg-chip"
              aria-pressed={filter === "picked"}
              onClick={() => setFilter("picked")}
              disabled={selected.length === 0}
            >
              Picked · {selected.length}
            </button>
          </div>
        </div>

        {photos.length === 0 ? (
          <div className="pg-empty">
            <p>No photos yet</p>
            <p>Your photographer is still uploading. Check back in a little while.</p>
          </div>
        ) : shown.length === 0 ? (
          <div className="pg-empty">
            <p>Nothing picked yet</p>
            <p>Tap any photo below to add it to your list.</p>
          </div>
        ) : (
          <div className="pg-grid">
            {shown.map((photo) => {
              const isPicked = selectedSet.has(photo.id);
              const index = photos.findIndex((item) => item.id === photo.id);
              return (
                <div key={photo.id} className={`pg-card${isPicked ? " on" : ""}`}>
                  <button
                    type="button"
                    onClick={() => toggle(photo)}
                    aria-pressed={isPicked}
                    aria-label={`${isPicked ? "Remove" : "Select"} ${photo.originalName}`}
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      zIndex: 2,
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    <span className="sr-only">
                      {isPicked ? "Remove from my list" : "Add to my list"}
                    </span>
                  </button>

                  {photo.hasThumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/photos/${photo.id}/file?kind=thumb`}
                      alt={photo.originalName}
                      loading="lazy"
                    />
                  ) : (
                    <div className="pg-placeholder">
                      <div>
                        <span>{photo.isRaw ? "RAW" : "Preview"}</span>
                        <small>{photo.originalName}</small>
                      </div>
                    </div>
                  )}

                  <span className="pg-tick" aria-hidden>
                    {isPicked ? "✓" : "+"}
                  </span>
                  <span className="pg-flag" aria-hidden>
                    Picked
                  </span>
                  <span className="pg-num" aria-hidden>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPreviewIndex(index)}
                    className="pg-view"
                    aria-label={`View ${photo.originalName} full size`}
                    style={{ pointerEvents: "auto" }}
                  >
                    View
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <footer className="pg-foot">
          {gallery.downloadEnabled && (
            <div>
              <a className="zip" href={`/api/events/${gallery.id}/download`}>
                Download the whole folder (.zip)
              </a>
            </div>
          )}
          <p style={{ margin: 0 }}>
            Your list goes straight to <b style={{ color: "#948b7d", fontWeight: 500 }}>{studioName}</b>.{" "}
            <Link href="/">About PicDeck</Link>
          </p>
        </footer>
      </div>

      {/* Sticky action dock */}
      <div className="pg-dock">
        <div className="pg-rail" style={{ width: `${Math.max(progress, 1.5)}%` }} />
        <div className="pg-dock-in">
          <div className="pg-dock-count">
            <div className="pg-count">
              {selected.length}
              {limit !== null && <span className="of"> / {limit}</span>}
            </div>
            <div className="pg-cl">{atLimit ? "Limit reached" : "Selected"}</div>
          </div>

          <div className="pg-sep" aria-hidden />

          <div className="pg-dock-dl">
            {gallery.downloadEnabled ? (
              <>
                <div className="pg-dl-note">
                  {gallery.originalDownloadEnabled ? "Originals available" : "Previews available"}
                </div>
                <button
                  type="button"
                  className="pg-dl"
                  onClick={downloadSelected}
                  disabled={downloading || selected.length === 0}
                >
                  {downloading
                    ? "Preparing…"
                    : gallery.originalDownloadEnabled
                      ? "Download originals"
                      : "Download previews"}
                </button>
              </>
            ) : (
              <div className="pg-dl-note">Downloads closed</div>
            )}
          </div>

          <div className="pg-inputs">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
              className="pg-field"
              aria-label="Your name"
            />
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value.replace(/[^\d+\s-]/g, ""))}
              placeholder="Phone (optional)"
              inputMode="tel"
              className="pg-field"
              aria-label="Your phone"
            />
            <button
              type="button"
              className="pg-send"
              onClick={handleSubmit}
              disabled={saving || selected.length === 0}
            >
              {saving ? "Sending…" : saved ? "Send again →" : "Send my list →"}
            </button>
          </div>
        </div>

        {/* Feedback stays inside the dock so it is never scrolled past. */}
        {(notice || saved) && (
          <div style={{ maxWidth: 1300, margin: "0 auto", padding: "0 44px 12px" }}>
            {notice && <div className="pg-alert warn">{notice}</div>}
            {saved && (
              <div className="pg-alert ok">
                Sent. Your photographer can see {saved.count} selected{" "}
                {saved.count === 1 ? "photo" : "photos"} now. You can still change the list and send again.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {current && previewIndex !== null && (
        <div className="pg-lb" role="dialog" aria-modal="true" aria-label={current.originalName}>
          <div className="pg-lb-top">
            <div className="l">
              <span className="pg-lb-idx">
                {String(previewIndex + 1).padStart(2, "0")} / {String(photos.length).padStart(2, "0")}
              </span>
              <span className="pg-lb-name">{current.originalName}</span>
            </div>
            <button type="button" className="pg-lb-close" onClick={() => setPreviewIndex(null)}>
              Close
            </button>
          </div>

          {photos.length > 1 && (
            <>
              <button type="button" className="pg-lb-nav l" onClick={() => stepPreview(-1)} aria-label="Previous photo">
                ‹
              </button>
              <button type="button" className="pg-lb-nav r" onClick={() => stepPreview(1)} aria-label="Next photo">
                ›
              </button>
            </>
          )}

          <div className="pg-lb-stage">
            {current.hasPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/photos/${current.id}/file?kind=preview`} alt={current.originalName} />
            ) : (
              <p className="pg-lb-missing">
                No preview available for this file. Ask your photographer for the original after your
                list is final.
              </p>
            )}
          </div>

          <div className="pg-lb-bot">
            <button
              type="button"
              className={`pg-lb-btn ${selectedSet.has(current.id) ? "picked" : "pick"}`}
              onClick={() => toggle(current)}
            >
              {selectedSet.has(current.id) ? "Remove from my list" : "Add to my list"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
