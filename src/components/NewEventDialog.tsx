"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createEvent } from "@/app/actions/events";

export function NewEventDialog() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createEvent(formData);
      if (result && !result.ok) setError(result.message);
      else router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand/90"
      >
        New event
      </button>

      {open && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-ink/40 p-4 pd-fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">New event</h2>
                <p className="mt-1 text-sm text-muted">A private gallery and code are created with it.</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-1 text-muted hover:bg-surface"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {error && (
              <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}

            <form action={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label className="text-sm font-medium" htmlFor="title">Event name</label>
                <input
                  id="title"
                  name="title"
                  required
                  autoFocus
                  placeholder="Ananya & Rohan — Reception"
                  className="mt-1.5 w-full rounded-lg border border-line px-3 py-2.5 text-sm focus:border-brand focus:outline-none"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium" htmlFor="eventDate">Event date</label>
                  <input
                    id="eventDate"
                    name="eventDate"
                    type="date"
                    className="mt-1.5 w-full rounded-lg border border-line px-3 py-2.5 text-sm focus:border-brand focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium" htmlFor="selectionLimit">Selection limit</label>
                  <input
                    id="selectionLimit"
                    name="selectionLimit"
                    type="number"
                    min={1}
                    max={5000}
                    placeholder="e.g. 60"
                    className="mt-1.5 w-full rounded-lg border border-line px-3 py-2.5 text-sm focus:border-brand focus:outline-none"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="text-sm font-medium" htmlFor="clientName">Client name</label>
                  <input
                    id="clientName"
                    name="clientName"
                    className="mt-1.5 w-full rounded-lg border border-line px-3 py-2.5 text-sm focus:border-brand focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium" htmlFor="clientPhone">Client phone</label>
                  <input
                    id="clientPhone"
                    name="clientPhone"
                    inputMode="tel"
                    className="mt-1.5 w-full rounded-lg border border-line px-3 py-2.5 text-sm focus:border-brand focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium" htmlFor="clientEmail">Client email</label>
                  <input
                    id="clientEmail"
                    name="clientEmail"
                    type="email"
                    className="mt-1.5 w-full rounded-lg border border-line px-3 py-2.5 text-sm focus:border-brand focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium" htmlFor="note">Note for the client</label>
                <textarea
                  id="note"
                  name="note"
                  rows={2}
                  placeholder="Please pick 60 photos for the album."
                  className="mt-1.5 w-full rounded-lg border border-line px-3 py-2.5 text-sm focus:border-brand focus:outline-none"
                />
              </div>
              <div className="space-y-2 rounded-lg bg-surface p-3 text-sm">
                <label className="flex items-center gap-2.5">
                  <input type="checkbox" name="downloadEnabled" defaultChecked className="size-4 accent-[var(--pd-brand)]" />
                  Allow downloads
                </label>
                <label className="flex items-center gap-2.5">
                  <input type="checkbox" name="originalDownloadEnabled" className="size-4 accent-[var(--pd-brand)]" />
                  Allow original-size downloads
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-line px-4 py-2.5 text-sm hover:bg-surface"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-60"
                >
                  {pending ? "Creating…" : "Create event"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}