"use client";

import { useRef, useState } from "react";

type Match = { photoId: string; score: number };
type Tag = { name: string; count: number };

export function FaceSearch({ code, tags = [] }: { code: string; tags?: Tag[] }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [nameTag, setNameTag] = useState<string | null>(null);
  const [nameIds, setNameIds] = useState<string[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function search(file: File) {
    setBusy(true);
    setError(null);
    setMatches(null);
    setNameIds(null);
    setNameTag(null);
    setNote(null);
    setPreviewUrl(URL.createObjectURL(file));

    const body = new FormData();
    body.set("code", code);
    body.set("probe", file);

    try {
      const response = await fetch("/api/face-search", { method: "POST", body });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Search failed");
        return;
      }
      setMatches(data.matches as Match[]);
      setNote(data.note ?? null);
    } catch {
      setError("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  async function searchName(tag: string) {
    setBusy(true);
    setError(null);
    setMatches(null);
    setNameIds(null);
    setNote(null);
    setPreviewUrl(null);
    setNameTag(tag);
    try {
      const response = await fetch(
        `/api/face-tags?code=${encodeURIComponent(code)}&tag=${encodeURIComponent(tag)}`,
      );
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Could not load photos");
        return;
      }
      setNameIds(data.photoIds as string[]);
      if ((data.photoIds as string[]).length === 0) setNote(`No photos tagged ${tag} yet.`);
    } catch {
      setError("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setOpen(false);
    setMatches(null);
    setNameIds(null);
    setNameTag(null);
    setNote(null);
    setError(null);
    setPreviewUrl(null);
  }

  if (!open) {
    return (
      <div className="mx-auto max-w-6xl px-5 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white px-4 py-3">
          <div>
            <p className="text-sm font-medium">Find your photos</p>
            <p className="text-xs text-muted">
              Search by selfie, or pick your name if the photographer has tagged the group.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium hover:bg-surface"
          >
            Search photos
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-5 pt-5">
      <div className="rounded-xl border border-line bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Find your photos</p>
            <p className="mt-0.5 text-xs text-muted">
              On-device demo model — colour and framing similarity, not identity matching.
            </p>
          </div>
          <button type="button" onClick={reset} className="text-xs text-muted hover:text-ink">
            Close
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void search(file);
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-white hover:bg-ink/90 disabled:opacity-60"
          >
            {busy ? "Searching…" : matches ? "Try another selfie" : "Upload a selfie"}
          </button>
          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Your probe" className="size-12 rounded-lg object-cover" />
          )}
          {note && <span className="text-xs text-muted">{note}</span>}
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>

        {tags.length > 0 && (
          <div className="mt-4 border-t border-line pt-3">
            <p className="text-xs font-medium text-muted">Or pick a tagged person</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <button
                  key={tag.name}
                  type="button"
                  disabled={busy}
                  onClick={() => searchName(tag.name)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium disabled:opacity-50 ${
                    nameTag === tag.name
                      ? "border-brand bg-brand-soft text-brand"
                      : "border-line hover:bg-surface"
                  }`}
                >
                  {tag.name} · {tag.count}
                </button>
              ))}
            </div>
          </div>
        )}

        {matches && matches.length > 0 && (
          <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {matches.map((match) => (
              <li key={match.photoId} className="overflow-hidden rounded-lg border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/photos/${match.photoId}/file?kind=preview`}
                  alt="Possible match"
                  className="aspect-square w-full object-cover"
                  loading="lazy"
                />
                <p className="px-1.5 py-1 text-[10px] text-muted">
                  {Math.round(match.score * 100)}% similar
                </p>
              </li>
            ))}
          </ul>
        )}

        {nameIds && nameIds.length > 0 && (
          <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {nameIds.map((photoId) => (
              <li key={photoId} className="overflow-hidden rounded-lg border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/photos/${photoId}/file?kind=preview`}
                  alt={`Photo tagged ${nameTag ?? ""}`}
                  className="aspect-square w-full object-cover"
                  loading="lazy"
                />
                <p className="px-1.5 py-1 text-[10px] text-muted">{nameTag}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
