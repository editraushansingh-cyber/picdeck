"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteNotification,
  markNotificationSent,
  queueNotification,
} from "@/app/actions/notifications";
import { mailtoLink, renderTemplate } from "@/lib/notifications";

export type NotificationRowData = {
  id: string;
  toName: string | null;
  toEmail: string | null;
  template: string;
  message: string;
  status: string;
  createdAt: string;
};

type TemplateOption = { key: string; label: string; body: string; fields: string[] };
type EventOption = {
  id: string;
  title: string;
  clientName: string | null;
  clientPhone: string | null;
  clientEmail: string | null;
};

export function NotificationComposer({
  templates,
  events,
  notifications,
  mailReady,
}: {
  templates: TemplateOption[];
  events: EventOption[];
  notifications: NotificationRowData[];
  mailReady: boolean;
}) {
  const [templateKey, setTemplateKey] = useState(templates[0]?.key ?? "gallery_ready");
  const [eventId, setEventId] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [toEmail, setToEmail] = useState("");
  const [toName, setToName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [manualLink, setManualLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const template = templates.find((option) => option.key === templateKey) ?? templates[0];

  const preview = useMemo(() => {
    if (!template) return "";
    return renderTemplate(template.body, { ...values, name: toName || values.name || "" });
  }, [template, values, toName]);

  function pickEvent(id: string) {
    setEventId(id);
    const found = events.find((event) => event.id === id);
    if (!found) return;
    setValues((current) => ({ ...current, event: found.title }));
    if (found.clientName) setToName(found.clientName);
    if (found.clientEmail) setToEmail(found.clientEmail);
  }

  function submit(formData: FormData) {
    setMessage(null);
    setError(null);
    setManualLink(null);
    startTransition(async () => {
      const result = await queueNotification(formData);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setMessage(
        result.link
          ? `Queued. ${result.detail} — or open it in your mail app below.`
          : `Queued. ${result.detail}`,
      );
      setManualLink(result.link ?? null);
      router.refresh();
    });
  }

  if (!template) {
    return <p className="text-sm text-muted">No templates configured.</p>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section className="rounded-xl border border-line bg-white p-5">
        <h2 className="font-medium">Compose</h2>
        <p className="mt-1 text-sm text-muted">
          PicDeck fills the message and keeps a copy in the queue. Email sends through your provider
          when one is configured; otherwise you get a mailto: link.
        </p>

        {!mailReady && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            No email provider key set. Messages are queued with a mailto: link so you can still send
            them from your own mailbox.
          </p>
        )}

        {message && (
          <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {message}
          </p>
        )}
        {manualLink && (
          <a
            href={manualLink}
            className="mt-2 inline-block rounded-lg border border-line px-3 py-1.5 text-xs font-medium hover:bg-surface"
          >
            Open in mail app
          </a>
        )}
        {error && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <form action={submit} className="mt-4 space-y-3">
          <input type="hidden" name="template" value={template.key} />
          <input type="hidden" name="eventId" value={eventId} />

          <label className="block text-sm">
            <span className="font-medium">Template</span>
            <select
              value={templateKey}
              onChange={(event) => {
                setTemplateKey(event.target.value);
                setValues({});
              }}
              className="mt-1.5 w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
            >
              {templates.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-lg border border-line bg-surface px-3 py-2 text-sm">
            <span className="font-medium">Channel</span>
            <span className="ml-2 text-muted">Email{mailReady ? "" : " · opens in your mail app"}</span>
          </div>

          <label className="block text-sm">
            <span className="font-medium">Event (optional)</span>
            <select
              value={eventId}
              onChange={(event) => pickEvent(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
            >
              <option value="">— none —</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="font-medium">Client name</span>
              <input
                name="toName"
                value={toName}
                onChange={(event) => setToName(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
              />
            </label>
            <label className="text-sm">
              <span className="font-medium">Email address</span>
              <input
                name="toEmail"
                type="email"
                value={toEmail}
                onChange={(event) => setToEmail(event.target.value)}
                placeholder="client@example.com"
                required
                className="mt-1.5 w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
              />
            </label>
          </div>

          <div className="space-y-2">
            {template.fields
              .filter((field) => field !== "name" && field !== "event")
              .map((field) => (
                <label key={field} className="block text-sm">
                  <span className="font-medium capitalize">{field}</span>
                  <input
                    name={`field_${field}`}
                    value={values[field] ?? ""}
                    onChange={(event) =>
                      setValues((current) => ({ ...current, [field]: event.target.value }))
                    }
                    className="mt-1.5 w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
                  />
                </label>
              ))}
          </div>

          <input type="hidden" name="field_name" value={toName} />
          <input type="hidden" name="field_event" value={values.event ?? ""} />

          <div className="rounded-lg bg-surface p-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">Preview</p>
            <p className="mt-1.5 whitespace-pre-line text-sm">{preview}</p>
          </div>

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-60"
          >
            {pending ? "Queuing…" : mailReady ? "Send email" : "Add to queue"}
          </button>
        </form>
      </section>

      <div>
        <h2 className="mb-3 font-medium">Queue</h2>
        {notifications.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line bg-white px-4 py-10 text-center text-sm text-muted">
            Nothing queued yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {notifications.map((item) => (
              <NotificationItem key={item.id} item={item} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function NotificationItem({ item }: { item: NotificationRowData }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <li className="rounded-xl border border-line bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {item.toName ? `${item.toName} · ` : ""}
            <span className="font-mono text-xs">{item.toEmail ?? "—"}</span>
          </p>
          <p className="mt-1 text-xs text-muted">
            <span className="mr-2 rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold uppercase">
              Email
            </span>
            {item.createdAt}
            <span
              className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                item.status === "SENT"
                  ? "bg-emerald-50 text-emerald-700"
                  : item.status === "FAILED"
                    ? "bg-red-50 text-red-700"
                    : "bg-surface text-muted"
              }`}
            >
              {item.status}
            </span>
          </p>
        </div>
      </div>

      <p className="mt-2 rounded-lg bg-surface px-3 py-2 text-xs leading-relaxed">{item.message}</p>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {item.toEmail && (
          <a
            href={mailtoLink(item.toEmail, "PicDeck update", item.message)}
            onClick={() =>
              startTransition(async () => {
                await markNotificationSent(item.id);
                router.refresh();
              })
            }
            className="rounded-lg bg-ink px-2.5 py-1 text-xs font-medium text-white hover:bg-ink/90"
          >
            Open in mail app
          </a>
        )}
        {item.status !== "SENT" && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await markNotificationSent(item.id);
                router.refresh();
              })
            }
            className="rounded-lg border border-line px-2.5 py-1 text-xs hover:bg-surface disabled:opacity-50"
          >
            Mark sent
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await deleteNotification(item.id);
              router.refresh();
            })
          }
          className="rounded-lg border border-red-200 px-2.5 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          Remove
        </button>
      </div>
    </li>
  );
}
