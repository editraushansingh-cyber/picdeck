"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  moveAlbumPage,
  setAlbumCoverPhoto,
  toggleAlbumPublished,
  updateAlbumDetails,
  updateAlbumPageCaption,
} from "@/app/actions/albums";

type Page = {
  id: string;
  caption: string | null;
  a: { id: string; alt: string; hasThumb: boolean };
  b: { id: string; alt: string; hasThumb: boolean } | null;
};

export type AlbumEditorData = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  published: boolean;
  coverUrl: string | null;
  musicUrl: string | null;
  musicTitle: string | null;
  coverPhotoId: string | null;
  pages: Page[];
};

export function AlbumEditor({ album }: { album: AlbumEditorData }) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function run(task: () => Promise<{ ok: boolean; message?: string }>) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await task();
      if (!result.ok) {
        setError(result.message ?? "Something went wrong");
        return;
      }
      setMessage("Saved");
      router.refresh();
    });
  }

  function saveDetails(formData: FormData) {
    run(() => updateAlbumDetails(album.id, formData));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/dashboard/albums" className="text-sm text-muted hover:text-ink">
            ← All albums
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{album.title}</h1>
          <p className="mt-1 text-sm text-muted">
            {album.pages.length} spreads ·{" "}
            <a href={`/album/${album.slug}`} target="_blank" rel="noreferrer" className="underline hover:text-ink">
              /album/{album.slug}
            </a>
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/dashboard/albums/${album.id}/qr`}
            className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium hover:bg-surface"
          >
            QR code
          </Link>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => toggleAlbumPublished(album.id))}
            className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium hover:bg-surface disabled:opacity-60"
          >
            {album.published ? "Unpublish" : "Publish"}
          </button>
        </div>
      </div>

      {message && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <form action={saveDetails} className="space-y-4 rounded-xl border border-line bg-white p-5">
        <h2 className="font-medium">Album details</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="font-medium">Title</span>
            <input
              name="title"
              required
              defaultValue={album.title}
              className="mt-1.5 w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
          </label>
          <label className="text-sm">
            <span className="font-medium">Subtitle</span>
            <input
              name="subtitle"
              defaultValue={album.subtitle ?? ""}
              className="mt-1.5 w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="text-sm">
            <span className="font-medium">Cover art</span>
            {album.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={album.coverUrl} alt="Current cover" className="mt-2 h-28 w-full rounded-lg border border-line object-cover" />
            ) : (
              <p className="mt-2 text-xs text-muted">Using the first spread photo.</p>
            )}
            <input
              type="file"
              name="cover"
              accept="image/*"
              className="mt-2 block w-full text-xs text-muted file:mr-3 file:rounded-lg file:border file:border-line file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium hover:file:bg-surface"
            />
            {album.coverUrl && (
              <label className="mt-2 flex items-center gap-2 text-xs text-muted">
                <input type="checkbox" name="removeCover" className="size-3.5 accent-[var(--pd-brand)]" />
                Remove cover art
              </label>
            )}
          </div>

          <div className="text-sm">
            <span className="font-medium">Background music</span>
            {album.musicUrl ? (
              <audio src={album.musicUrl} controls className="mt-2 h-9 w-full max-w-sm" />
            ) : (
              <p className="mt-2 text-xs text-muted">No track yet. MP3, WAV, M4A or OGG up to 20 MB.</p>
            )}
            <input
              type="file"
              name="music"
              accept="audio/*"
              className="mt-2 block w-full text-xs text-muted file:mr-3 file:rounded-lg file:border file:border-line file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium hover:file:bg-surface"
            />
            <input
              name="musicTitle"
              defaultValue={album.musicTitle ?? ""}
              placeholder="Track name (shown on the cover)"
              className="mt-2 w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
            {album.musicUrl && (
              <label className="mt-2 flex items-center gap-2 text-xs text-muted">
                <input type="checkbox" name="removeMusic" className="size-3.5 accent-[var(--pd-brand)]" />
                Remove the current track
              </label>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save album"}
        </button>
      </form>

      <div>
        <h2 className="mb-3 font-medium">Spreads</h2>
        <ul className="space-y-2">
          {album.pages.map((page, index) => (
            <li key={page.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-white p-3">
              <span className="w-6 text-center text-xs text-muted">{index + 1}</span>
              <div className="flex overflow-hidden rounded-lg border border-line">
                {page.a.hasThumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/album-photos/${page.a.id}`} alt={page.a.alt} className="h-14 w-20 object-cover" />
                ) : (
                  <span className="grid h-14 w-20 place-items-center bg-surface text-[10px] text-muted">no preview</span>
                )}
                {page.b &&
                  (page.b.hasThumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/album-photos/${page.b.id}`} alt={page.b.alt} className="h-14 w-20 border-l border-line object-cover" />
                  ) : (
                    <span className="grid h-14 w-20 place-items-center border-l border-line bg-surface text-[10px] text-muted">no preview</span>
                  ))}
              </div>

              <form
                action={(formData) => run(() => updateAlbumPageCaption(album.id, page.id, formData))}
                className="flex min-w-0 flex-1 items-center gap-2"
              >
                <input
                  name="caption"
                  defaultValue={page.caption ?? ""}
                  placeholder="Caption for this spread"
                  className="min-w-0 flex-1 rounded-lg border border-line px-3 py-1.5 text-sm focus:border-brand focus:outline-none"
                />
                <button type="submit" className="rounded-lg border border-line px-2.5 py-1 text-xs font-medium hover:bg-surface">
                  Save
                </button>
              </form>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={pending || index === 0}
                  onClick={() => run(() => moveAlbumPage(album.id, page.id, "up"))}
                  className="rounded-lg border border-line px-2 py-1 text-xs hover:bg-surface disabled:opacity-40"
                  aria-label="Move spread up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={pending || index === album.pages.length - 1}
                  onClick={() => run(() => moveAlbumPage(album.id, page.id, "down"))}
                  className="rounded-lg border border-line px-2 py-1 text-xs hover:bg-surface disabled:opacity-40"
                  aria-label="Move spread down"
                >
                  ↓
                </button>
                <button
                  type="button"
                  disabled={pending || album.coverPhotoId === page.a.id}
                  onClick={() => run(() => setAlbumCoverPhoto(album.id, page.a.id))}
                  className="rounded-lg border border-line px-2 py-1 text-xs hover:bg-surface disabled:opacity-40"
                >
                  Cover
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
