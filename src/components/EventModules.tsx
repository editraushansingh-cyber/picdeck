"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createAlbum, faceGroups, nameFaceGroup, toggleAlbumPublished } from "@/app/actions/albums";

export type EventAlbum = {
  id: string;
  slug: string;
  title: string;
  published: boolean;
  pages: number;
  url: string;
};

export function AlbumPanel({
  eventId,
  albums,
  selectedCount,
  photoCount,
  allowed,
}: {
  eventId: string;
  albums: EventAlbum[];
  selectedCount: number;
  photoCount: number;
  allowed: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit(formData: FormData) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await createAlbum(eventId, formData);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setCreatedSlug(result.slug);
      setMessage(`Album created — ${result.pages} spreads`);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <section className="rounded-xl border border-line bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-medium">Album / flipbook</h2>
        {!allowed && (
          <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-medium text-muted">
            Silver+
          </span>
        )}
      </div>

      {!allowed ? (
        <p className="mt-2 text-sm text-muted">
          Turn the selection into a page-turning album. Available on Silver and Gold.
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted">
            Lay the picked photos out as spreads and share one private link.
          </p>

          {message && (
            <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {message}{" "}
              {createdSlug && (
                <a
                  href={`/album/${createdSlug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium underline"
                >
                  Open
                </a>
              )}
            </p>
          )}
          {error && (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          {albums.length > 0 && (
            <ul className="mt-3 divide-y divide-line">
              {albums.map((album) => (
                <li key={album.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span className="min-w-0 truncate">
                    {album.title}
                    <span className="ml-2 text-xs text-muted">{album.pages} spreads</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <a href={album.url} target="_blank" rel="noreferrer" className="text-xs font-medium text-brand hover:underline">
                      Open
                    </a>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          await toggleAlbumPublished(album.id);
                          router.refresh();
                        })
                      }
                      className="text-xs text-muted hover:text-ink disabled:opacity-50"
                    >
                      {album.published ? "Hide" : "Publish"}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {open ? (
            <form action={submit} className="mt-4 space-y-3">
              <input
                name="title"
                placeholder="Album title"
                className="w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
              />
              <input
                name="subtitle"
                placeholder="Subtitle (optional)"
                className="w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
              />
              <div className="space-y-1.5 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="source"
                    value="selection"
                    defaultChecked={selectedCount > 0}
                    disabled={selectedCount === 0}
                    className="accent-[var(--pd-brand)]"
                  />
                  Client&apos;s selection ({selectedCount})
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="source"
                    value="all"
                    defaultChecked={selectedCount === 0}
                    disabled={photoCount === 0}
                    className="accent-[var(--pd-brand)]"
                  />
                  Every photo ({photoCount})
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={pending || photoCount === 0}
                  className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-60"
                >
                  {pending ? "Building…" : "Create album"}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-line px-3 py-2 text-sm hover:bg-surface"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setOpen(true)}
              disabled={photoCount === 0}
              className="mt-3 rounded-lg border border-line px-3 py-1.5 text-xs font-medium hover:bg-surface disabled:opacity-50"
            >
              {photoCount === 0 ? "Upload photos first" : "Create album"}
            </button>
          )}
        </>
      )}
    </section>
  );
}

type Group = { label: string; name: string | null; count: number; names: string[]; faceIds: string[] };

export function FaceGroupsPanel({
  eventId,
  indexed,
  total,
  allowed,
}: {
  eventId: string;
  indexed: number;
  total: number;
  allowed: boolean;
}) {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function run() {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const result = await faceGroups(eventId, 4);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setGroups((result.groups ?? []) as Group[]);
      setInfo(`${result.indexed} of ${result.total} photos indexed`);
    });
  }

  function rename(group: Group, formData: FormData) {
    const name = String(formData.get("name") || "").trim();
    if (!name) return;
    setError(null);
    startTransition(async () => {
      const result = await nameFaceGroup(eventId, group.faceIds, name);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setInfo(`Tagged ${group.count} photos as ${name}. Clients can now search that name.`);
      router.refresh();
    });
  }

  return (
    <section className="rounded-xl border border-line bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-medium">Face groups</h2>
        {!allowed && (
          <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-medium text-muted">
            Silver+
          </span>
        )}
      </div>

      {!allowed ? (
        <p className="mt-2 text-sm text-muted">
          Cluster the album into people so the couple can pick their own photos faster. Silver and
          Gold.
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted">
            {indexed} of {total} photos are indexed. Grouping is a demo similarity model.
          </p>

          {info && <p className="mt-2 text-xs text-muted">{info}</p>}
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

          {groups && groups.length > 0 && (
            <ul className="mt-3 space-y-2">
              {groups.map((group) => (
                <li key={group.label} className="rounded-lg bg-surface px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{group.name ?? `Group ${group.label}`}</span>
                    <span className="shrink-0 text-xs text-muted">{group.count} photos</span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {group.names.slice(0, 4).join(", ")}
                    {group.names.length > 4 ? "…" : ""}
                  </p>
                  <form action={(formData) => rename(group, formData)} className="mt-2 flex gap-1.5">
                    <input
                      name="name"
                      defaultValue={group.name ?? ""}
                      placeholder="Name this person"
                      className="min-w-0 flex-1 rounded-lg border border-line bg-white px-2 py-1 text-xs focus:border-brand focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={pending}
                      className="rounded-lg border border-line bg-white px-2 py-1 text-xs font-medium hover:bg-surface disabled:opacity-50"
                    >
                      Tag
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={run}
            disabled={pending || indexed === 0}
            className="mt-3 rounded-lg border border-line px-3 py-1.5 text-xs font-medium hover:bg-surface disabled:opacity-50"
          >
            {pending ? "Grouping…" : groups ? "Regroup" : "Group into 4 sets"}
          </button>
        </>
      )}
    </section>
  );
}