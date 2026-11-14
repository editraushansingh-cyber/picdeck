"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteInvitation, saveInvitation, toggleInvitationPublished } from "@/app/actions/site";

export type InviteRowData = {
  id: string;
  slug: string;
  template: string;
  couple: string;
  date: string | null;
  venue: string | null;
  rsvpCount: number;
  published: boolean;
  url: string;
};

const TEMPLATES = [
  { key: "ivory", name: "Ivory", swatch: "bg-[#fbf7ef] border-[#e0d3ba]", note: "Cream, serif, classic" },
  { key: "marigold", name: "Marigold", swatch: "bg-[#fff6e5] border-[#f0d3a1]", note: "Warm gold, South Indian" },
  { key: "midnight", name: "Midnight", swatch: "bg-[#10172b] border-[#2a3654]", note: "Dark, modern, evening" },
  { key: "rose", name: "Rose", swatch: "bg-[#fdf2f4] border-[#f0cdd5]", note: "Blush, soft, intimate" },
];

export function InvitationStudio({
  invites,
  remaining,
}: {
  invites: InviteRowData[];
  remaining: number;
}) {
  const [template, setTemplate] = useState("ivory");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const locked = remaining <= 0;

  function submit(formData: FormData) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await saveInvitation(formData);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setMessage("Invitation created — copy the link below.");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">      <section className="rounded-xl border border-line bg-white p-5">
        <h2 className="font-medium">New invitation</h2>
        <p className="mt-1 text-sm text-muted">
          A single page your couple can forward on WhatsApp. RSVP taps are counted per invite.
        </p>

        {locked && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            You have used every invitation on this plan. Upgrade for more.
          </p>
        )}
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

        <form action={submit} className="mt-4 space-y-4">
          <fieldset disabled={locked}>
            <span className="text-sm font-medium">Template</span>
            <input type="hidden" name="template" value={template} />
            <div className="mt-2 grid grid-cols-2 gap-2">
              {TEMPLATES.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setTemplate(option.key)}
                  className={`rounded-lg border p-2.5 text-left transition ${
                    template === option.key
                      ? "border-brand ring-1 ring-brand"
                      : "border-line hover:border-muted"
                  }`}
                >
                  <span className={`block h-8 rounded ${option.swatch} border`} />
                  <span className="mt-2 block text-xs font-medium">{option.name}</span>
                  <span className="block text-[11px] text-muted">{option.note}</span>
                </button>
              ))}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="font-medium">First name</span>
                <input
                  name="coupleA"
                  required
                  placeholder="Ananya"
                  className="mt-1.5 w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
                />
              </label>
              <label className="text-sm">
                <span className="font-medium">Second name</span>
                <input
                  name="coupleB"
                  required
                  placeholder="Rahul"
                  className="mt-1.5 w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
                />
              </label>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="font-medium">Event date</span>
                <input
                  name="eventDate"
                  type="date"
                  className="mt-1.5 w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
                />
              </label>
              <label className="text-sm">
                <span className="font-medium">Venue</span>
                <input
                  name="venue"
                  placeholder="Leela Palace, Chennai"
                  className="mt-1.5 w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
                />
              </label>
            </div>

            <label className="mt-3 block text-sm">
              <span className="font-medium">Message</span>
              <textarea
                name="message"
                rows={2}
                placeholder="Two families, one evening, and a lot of filter coffee."
                className="mt-1.5 w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
              />
            </label>

            <button
              type="submit"
              disabled={pending || locked}
              className="mt-4 w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-60"
            >
              {pending ? "Creating…" : "Create invitation"}
            </button>
          </fieldset>
        </form>
      </section>

      <div>
        <h2 className="mb-3 font-medium">Your invitations</h2>
        {invites.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line bg-white px-4 py-10 text-center text-sm text-muted">
            None yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {invites.map((invite) => (
              <InviteRow key={invite.id} invite={invite} busy={pending} onChanged={() => router.refresh()} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function InviteRow({
  invite,
  busy,
  onChanged,
}: {
  invite: InviteRowData;
  busy: boolean;
  onChanged: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const theme = TEMPLATES.find((t) => t.key === invite.template) ?? TEMPLATES[0];

  return (
    <li className="rounded-xl border border-line bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`inline-block size-3 rounded-full border ${theme.swatch}`} />
            <p className="truncate font-medium">{invite.couple}</p>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                invite.published ? "bg-brand-soft text-brand" : "bg-surface text-muted"
              }`}
            >
              {invite.published ? "Live" : "Hidden"}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted">
            {[invite.date, invite.venue].filter(Boolean).join(" · ") || "Details pending"} ·{" "}
            {invite.rsvpCount} RSVP
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <a
            href={invite.url}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-line px-2.5 py-1 text-xs font-medium hover:bg-surface"
          >
            Open
          </a>
          <button
            type="button"
            disabled={pending || busy}
            onClick={() =>
              startTransition(async () => {
                await toggleInvitationPublished(invite.id);
                onChanged();
              })
            }
            className="rounded-lg border border-line px-2.5 py-1 text-xs font-medium hover:bg-surface disabled:opacity-50"
          >
            {invite.published ? "Hide" : "Publish"}
          </button>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(invite.url);
                setCopied(true);
                setTimeout(() => setCopied(false), 1600);
              } catch {
                window.prompt("Copy this link:", invite.url);
              }
            }}
            className="rounded-lg border border-line px-2.5 py-1 text-xs font-medium hover:bg-surface"
          >
            {copied ? "Copied" : "Link"}
          </button>
          <button
            type="button"
            disabled={pending || busy}
            onClick={() => {
              if (!window.confirm(`Delete the invitation for ${invite.couple}?`)) return;
              startTransition(async () => {
                await deleteInvitation(invite.id);
                onChanged();
              });
            }}
            className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>
    </li>
  );
}