"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteAlbum, toggleAlbumPublished } from "@/app/actions/albums";

export type AlbumRowData = {
  id: string;
  title: string;
  subtitle: string | null;
  slug: string;
  published: boolean;
  views: number;
  pages: number;
  eventTitle: string;
  eventId: string;
  url: string;
  createdAt: string;
};

export function AlbumRow({ album }: { album: AlbumRowData }) {
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  return (
    <li className="rounded-xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate font-medium">{album.title}</h2>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                album.published ? "bg-brand-soft text-brand" : "bg-surface text-muted"
              }`}
            >
              {album.published ? "Live" : "Hidden"}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">
            <Link href={`/dashboard/events/${album.eventId}`} className="hover:text-ink">
              {album.eventTitle}
            </Link>{" "}
            · {album.pages} spreads · {album.views} views · {album.createdAt}
          </p>
          {album.subtitle && <p className="mt-1 text-xs text-muted">{album.subtitle}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/dashboard/albums/${album.id}`}
            className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium hover:bg-surface"
          >
            Manage
          </Link>
          <Link
            href={`/dashboard/albums/${album.id}/qr`}
            className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium hover:bg-surface"
          >
            QR
          </Link>
          <a
            href={album.url}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-white hover:bg-ink/90"
          >
            Open
          </a>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(album.url);
                setCopied(true);
                setTimeout(() => setCopied(false), 1600);
              } catch {
                window.prompt("Copy this link:", album.url);
              }
            }}
            className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium hover:bg-surface"
          >
            {copied ? "Copied" : "Copy link"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await toggleAlbumPublished(album.id);
                router.refresh();
              })
            }
            className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium hover:bg-surface disabled:opacity-50"
          >
            {album.published ? "Hide" : "Publish"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!window.confirm(`Delete the album "${album.title}"? The photos stay in the event.`))
                return;
              startTransition(async () => {
                await deleteAlbum(album.id);
                router.refresh();
              });
            }}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>
    </li>
  );
}