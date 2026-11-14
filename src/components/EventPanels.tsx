"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  archiveEvent,
  deleteEvent,
  regenerateGalleryCode,
  updateEventSettings,
} from "@/app/actions/events";

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          window.prompt("Copy this:", value);
        }
      }}
      className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium hover:bg-surface"
    >
      {copied ? "Copied" : label}
    </button>
  );
}

export function SharePanel({
  eventId,
  galleryUrl,
  code,
  qrDataUrl,
}: {
  eventId: string;
  galleryUrl: string;
  code: string;
  qrDataUrl: string;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function regenerate() {
    if (!window.confirm("Generate a new code? The current code stops working immediately.")) return;
    startTransition(async () => {
      const result = await regenerateGalleryCode(eventId);
      setMessage(result.message ?? null);
      if (result.ok) router.refresh();
    });
  }

  return (
    <section className="rounded-xl border border-line bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-medium">Share with your client</h2>
        <span className="rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-medium text-brand">
          Private
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex-1 space-y-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Gallery code</p>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="rounded-lg bg-surface px-3 py-2 font-mono text-xl tracking-[0.25em]">
                {code}
              </span>
              <CopyButton value={code} label="Copy code" />
            </div>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Gallery link</p>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                readOnly
                value={galleryUrl}
                onFocus={(event) => event.currentTarget.select()}
                className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-xs"
                aria-label="Gallery link"
              />
              <CopyButton value={galleryUrl} label="Copy link" />
            </div>
            <p className="mt-1.5 text-xs text-muted">
              The link contains the code, so the client opens straight into the gallery.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <a
              href={galleryUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-white hover:bg-ink/90"
            >
              Open gallery
            </a>
            <button
              type="button"
              onClick={regenerate}
              disabled={pending}
              className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium hover:bg-surface disabled:opacity-50"
            >
              {pending ? "Generating…" : "New code"}
            </button>
          </div>
          {message && <p className="text-xs text-muted">{message}</p>}
        </div>

        <div className="shrink-0 rounded-xl border border-line p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="Gallery QR code" className="size-28" />
          <p className="mt-1 max-w-28 text-center text-[10px] leading-tight text-muted">
            Scan to open the gallery
          </p>
        </div>
      </div>
    </section>
  );
}

export function SettingsPanel({
  eventId,
  selectionLimit,
  downloadEnabled,
  originalDownloadEnabled,
  clientEmail,
}: {
  eventId: string;
  selectionLimit: number | null;
  downloadEnabled: boolean;
  originalDownloadEnabled: boolean;
  clientEmail: string | null;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(formData: FormData) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await updateEventSettings(eventId, formData);
      if (!result.ok) setError(result.message);
      else {
        setMessage(result.message);
        router.refresh();
      }
    });
  }

  return (
    <section className="rounded-xl border border-line bg-white p-5">
      <h2 className="font-medium">Selection rules</h2>
      <p className="mt-1 text-sm text-muted">These apply to the client gallery immediately.</p>

      {message && (
        <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
        </p>
      )}
      {error && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <form action={handleSubmit} className="mt-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium" htmlFor="selectionLimit">
              Selection limit
            </label>
            <input
              id="selectionLimit"
              name="selectionLimit"
              type="number"
              min={1}
              max={5000}
              defaultValue={selectionLimit ?? ""}
              placeholder="No limit"
              className="mt-1.5 w-full rounded-lg border border-line px-3 py-2.5 text-sm focus:border-brand focus:outline-none"
            />
            <p className="mt-1 text-xs text-muted">Leave empty for unlimited.</p>
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="clientEmail">
              Client email
            </label>
            <input
              id="clientEmail"
              name="clientEmail"
              type="email"
              defaultValue={clientEmail ?? ""}
              placeholder="client@example.com"
              className="mt-1.5 w-full rounded-lg border border-line px-3 py-2.5 text-sm focus:border-brand focus:outline-none"
            />
            <p className="mt-1 text-xs text-muted">Used for email reminders from the queue.</p>
          </div>
        </div>
        <div className="space-y-2.5 text-sm">
          <label className="flex items-center gap-2.5">
            <input
              type="checkbox"
              name="downloadEnabled"
              defaultChecked={downloadEnabled}
              className="size-4 accent-[var(--pd-brand)]"
            />
            Allow the client to download previews
          </label>
          <label className="flex items-center gap-2.5">
            <input
              type="checkbox"
              name="originalDownloadEnabled"
              defaultChecked={originalDownloadEnabled}
              className="size-4 accent-[var(--pd-brand)]"
            />
            Allow original-size downloads
          </label>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save rules"}
        </button>
      </form>
    </section>
  );
}

export function DangerZone({
  eventId,
  title,
  archived,
}: {
  eventId: string;
  title: string;
  archived: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <section className="rounded-xl border border-line bg-white p-5">
      <h2 className="font-medium">Event state</h2>
      <p className="mt-1 text-sm text-muted">
        Archiving hides the gallery from clients and keeps the photos. Deleting removes the photos
        and the selection list from disk.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await archiveEvent(eventId);
              router.refresh();
            })
          }
          className="rounded-lg border border-line px-3 py-2 text-sm font-medium hover:bg-surface disabled:opacity-50"
        >
          {archived ? "Restore event" : "Archive event"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (
              !window.confirm(
                `Delete "${title}" permanently? Photos, selection list and the code are removed.`,
              )
            )
              return;
            startTransition(async () => {
              await deleteEvent(eventId);
            });
          }}
          className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          Delete event
        </button>
      </div>
    </section>
  );
}

export function DownloadAllSelected({
  items,
}: {
  items: { id: string; name: string; url: string }[];
}) {
  const [busy, setBusy] = useState(false);

  if (items.length === 0) return null;

  async function run() {
    setBusy(true);
    for (const item of items) {
      const link = document.createElement("a");
      link.href = item.url;
      link.download = item.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
    setBusy(false);
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={busy}
      className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink/90 disabled:opacity-60"
    >
      {busy ? "Preparing…" : `Download all ${items.length} selected`}
    </button>
  );
}
