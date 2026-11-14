"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export type AlbumPhoto = { id: string; alt: string; hasThumb: boolean };
export type AlbumSpread = { id: string; caption: string | null; a: AlbumPhoto; b: AlbumPhoto | null };

function Photo({ photo }: { photo: AlbumPhoto }) {
  if (!photo.hasThumb) {
    return (
      <div className="grid h-full w-full place-items-center bg-surface text-xs text-muted">
        {photo.alt}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/album-photos/${photo.id}`}
      alt={photo.alt}
      className="h-full w-full object-cover"
      draggable={false}
    />
  );
}

export function AlbumViewer({
  title,
  subtitle,
  eventTitle,
  pages,
  coverUrl,
  logoUrl,
  musicUrl,
  musicTitle,
}: {
  title: string;
  subtitle: string | null;
  eventTitle: string;
  pages: AlbumSpread[];
  coverUrl: string | null;
  logoUrl: string | null;
  musicUrl: string | null;
  musicTitle: string | null;
}) {
  const [index, setIndex] = useState(0);
  const [opened, setOpened] = useState(false);
  const [turning, setTurning] = useState<"next" | "prev" | null>(null);
  const [muted, setMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const total = pages.length;

  const go = (target: number) => {
    if (turning || total === 0) return;
    if (target < 0 || target >= total || target === index) return;
    setTurning(target > index ? "next" : "prev");
    window.setTimeout(() => {
      setIndex(target);
      setTurning(null);
    }, 560);
  };

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowRight" || event.key === " ") go(index + 1);
      if (event.key === "ArrowLeft") go(index - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function openAlbum() {
    setOpened(true);
    const audio = audioRef.current;
    if (audio) {
      audio.volume = 0.55;
      void audio.play().catch(() => null);
    }
  }

  function toggleSound() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play().catch(() => null);
      setMuted(false);
    } else {
      audio.pause();
      setMuted(true);
    }
  }

  if (total === 0) {
    return (
      <div className="grid min-h-screen place-items-center bg-ink px-6 text-center text-white">
        <div>
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="mt-2 text-sm text-white/60">This album has no pages yet.</p>
        </div>
      </div>
    );
  }

  const spread = pages[index];

  return (
    <div className="flex min-h-screen flex-col bg-ink text-white">
      {musicUrl && <audio ref={audioRef} src={musicUrl} loop preload="none" />}

      {!opened ? (
        <button
          type="button"
          onClick={openAlbum}
          className="pd-cover group relative flex min-h-screen w-full items-center justify-center overflow-hidden px-6 text-center"
        >
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-70 transition duration-700 group-hover:scale-[1.03] group-hover:opacity-80"
            />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,#2c3448,#0d1220_70%)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/30" />

          <div className="relative max-w-xl">
            {logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="mx-auto mb-6 h-16 w-auto object-contain" />
            )}
            <p className="text-[11px] uppercase tracking-[0.4em] text-white/70">{eventTitle}</p>
            <h1 className="mt-4 font-serif text-4xl leading-tight sm:text-5xl">{title}</h1>
            {subtitle && <p className="mt-3 text-sm text-white/70">{subtitle}</p>}
            <span className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/30 px-5 py-2.5 text-sm font-medium backdrop-blur-sm transition group-hover:bg-white group-hover:text-ink">
              Open the album
              <span aria-hidden>→</span>
            </span>
            {musicUrl && (
              <p className="mt-3 text-[11px] text-white/50">
                ♪ {musicTitle || "Background music"} plays as you flip
              </p>
            )}
          </div>
        </button>
      ) : (
        <>
          <header className="flex items-center justify-between px-5 py-4">
            <Link href="/" className="text-xs uppercase tracking-widest text-white/50 hover:text-white">
              PicDeck
            </Link>
            <div className="text-center">
              <p className="text-sm font-medium">{title}</p>
              {subtitle && <p className="text-xs text-white/50">{subtitle}</p>}
            </div>
            <div className="flex items-center gap-3 text-xs text-white/50">
              {musicUrl && (
                <button type="button" onClick={toggleSound} className="hover:text-white" aria-label="Toggle music">
                  {muted ? "♪ off" : "♪ on"}
                </button>
              )}
              <span>
                {index + 1} / {total}
              </span>
            </div>
          </header>

          <main className="flex flex-1 flex-col items-center justify-center px-4 pb-6" style={{ perspective: "2200px" }}>
            <div
              key={spread.id}
              className={`pd-spread flex w-full max-w-6xl overflow-hidden rounded-lg bg-black shadow-2xl ${
                turning === "next" ? "pd-turn-next" : turning === "prev" ? "pd-turn-prev" : ""
              }`}
              style={{ height: "min(68vh, 620px)" }}
            >
              <div className="relative w-1/2 border-r border-white/10">
                <Photo photo={spread.a} />
              </div>
              <div className="relative w-1/2">
                {spread.b ? (
                  <Photo photo={spread.b} />
                ) : (
                  <div className="grid h-full place-items-center text-xs text-white/30">end of album</div>
                )}
              </div>
            </div>
            {spread.caption && (
              <p className="mt-3 max-w-xl text-center text-xs text-white/50">{spread.caption}</p>
            )}

            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={() => go(index - 1)}
                disabled={index === 0}
                className="rounded-lg border border-white/20 px-4 py-2 text-sm hover:bg-white/10 disabled:opacity-30"
              >
                ← Previous
              </button>
              <div className="flex max-w-md flex-wrap justify-center gap-1">
                {pages.slice(0, 24).map((page, pageIndex) => (
                  <button
                    key={page.id}
                    type="button"
                    onClick={() => go(pageIndex)}
                    aria-label={`Go to spread ${pageIndex + 1}`}
                    className={`size-2 rounded-full ${
                      pageIndex === index ? "bg-white" : "bg-white/25 hover:bg-white/50"
                    }`}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => go(index + 1)}
                disabled={index === total - 1}
                className="rounded-lg border border-white/20 px-4 py-2 text-sm hover:bg-white/10 disabled:opacity-30"
              >
                Next →
              </button>
            </div>
          </main>
        </>
      )}
    </div>
  );
}
