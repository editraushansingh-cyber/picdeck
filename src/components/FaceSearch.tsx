"use client";

import { useRef, useState } from "react";

type Match = { photoId: string; score: number };
type Tag = { name: string; count: number };

export function FaceSearch({
  code,
  tags = [],
  tone = "light",
}: {
  code: string;
  tags?: Tag[];
  /** "dark" matches the cinematic client gallery; studio/light pages keep the default. */
  tone?: "light" | "dark";
}) {
  const dark = tone === "dark";
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

  const shell = dark ? "pg-wrap" : "mx-auto max-w-6xl px-5";
  const card = dark
    ? "rounded-xl border border-[var(--pg-line)] bg-[#131110] px-4 py-3"
    : "rounded-xl border border-line bg-white px-4 py-3";
  const panel = dark
    ? "rounded-xl border border-[var(--pg-line)] bg-[#131110] p-4"
    : "rounded-xl border border-line bg-white p-4";
  const title = dark ? "text-sm font-medium text-[#f4efe6]" : "text-sm font-medium";
  const sub = dark ? "text-xs text-[#8e867a]" : "text-xs text-muted";
  const ghostBtn = dark
    ? "rounded-lg border border-[var(--pg-line)] px-3 py-1.5 text-xs font-medium text-[#e8e0d2] hover:border-[#c9a468]/60"
    : "rounded-lg border border-line px-3 py-1.5 text-xs font-medium hover:bg-surface";
  const solidBtn = dark
    ? "rounded-lg bg-[#c9a468] px-3 py-2 text-xs font-semibold text-[#15120c] hover:bg-[#e3c68f] disabled:opacity-60"
    : "rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-white hover:bg-ink/90 disabled:opacity-60";
  const chip = (active: boolean) =>
    active
      ? dark
        ? "rounded-full border border-[#c9a468] bg-[#c9a468] px-3 py-1 text-xs font-medium text-[#15120c] disabled:opacity-50"
        : "rounded-full border border-brand bg-brand-soft px-3 py-1 text-xs font-medium text-brand disabled:opacity-50"
      : dark
        ? "rounded-full border border-[var(--pg-line)] px-3 py-1 text-xs font-medium text-[#b3aa9c] hover:border-[#c9a468]/50 disabled:opacity-50"
        : "rounded-full border border-line px-3 py-1 text-xs font-medium hover:bg-surface disabled:opacity-50";
  const thumb = dark
    ? "overflow-hidden rounded-lg border border-[var(--pg-line)] bg-[#1a1815]"
    : "overflow-hidden rounded-lg border border-line";
  const small = dark ? "px-1.5 py-1 text-[10px] text-[#8e867a]" : "px-1.5 py-1 text-[10px] text-muted";
  const divider = dark ? "mt-4 border-t border-[var(--pg-line)] pt-3" : "mt-4 border-t border-line pt-3";

  if (!open) {
    return (
      <div className={`${shell} pt-5`}>
        <div className={`${card} flex flex-wrap items-center justify-between gap-3`}>
          <div>
            <p className={title}>Find your photos</p>
            <p className={sub}>
              Search by selfie, or pick your name if the photographer has tagged the group.
            </p>
          </div>
          <button type="button" onClick={() => setOpen(true)} className={ghostBtn}>
            Search photos
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${shell} pt-5`}>
      <div className={panel}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className={title}>Find your photos</p>
            <p className={`mt-0.5 ${sub}`}>
              On-device demo model — colour and framing similarity, not identity matching.
            </p>
          </div>
          <button type="button" onClick={reset} className={dark ? `text-xs text-[#8e867a] hover:text-[#f4efe6]` : "text-xs text-muted hover:text-ink"}>
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
            className={solidBtn}
          >
            {busy ? "Searching…" : matches ? "Try another selfie" : "Upload a selfie"}
          </button>
          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Your probe" className="size-12 rounded-lg object-cover" />
          )}
          {note && <span className={sub}>{note}</span>}
          {error && <span className="text-xs text-red-400">{error}</span>}
        </div>

        {tags.length > 0 && (
          <div className={divider}>
            <p className={`text-xs font-medium ${dark ? "text-[#8e867a]" : "text-muted"}`}>
              Or pick a tagged person
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <button
                  key={tag.name}
                  type="button"
                  disabled={busy}
                  onClick={() => searchName(tag.name)}
                  className={chip(nameTag === tag.name)}
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
              <li key={match.photoId} className={thumb}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/photos/${match.photoId}/file?kind=preview`}
                  alt="Possible match"
                  className="aspect-square w-full object-cover"
                  loading="lazy"
                />
                <p className={small}>
                  {Math.round(match.score * 100)}% similar
                </p>
              </li>
            ))}
          </ul>
        )}

        {nameIds && nameIds.length > 0 && (
          <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {nameIds.map((photoId) => (
              <li key={photoId} className={thumb}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/photos/${photoId}/file?kind=preview`}
                  alt={`Photo tagged ${nameTag ?? ""}`}
                  className="aspect-square w-full object-cover"
                  loading="lazy"
                />
                <p className={small}>{nameTag}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
