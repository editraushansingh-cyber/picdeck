"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveInvoice, setInvoiceStatus, deleteInvoice } from "@/app/actions/invoices";

export type InvoiceRowData = {
  id: string;
  number: string;
  type: string;
  status: string;
  clientName: string;
  eventTitle: string | null;
  items: number;
  total: number;
  issuedAt: string;
};

type Line = { description: string; quantity: string; rate: string };

const inr = (value: number) => `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

const emptyLine = (): Line => ({ description: "", quantity: "1", rate: "" });

export function InvoiceComposer({ events }: { events: { id: string; title: string }[] }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"INVOICE" | "QUOTATION">("INVOICE");
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [taxRate, setTaxRate] = useState("18");
  const [discount, setDiscount] = useState("0");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const subtotal = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const quantity = Number(line.quantity) || 0;
        const rate = Number(line.rate) || 0;
        return sum + quantity * rate;
      }, 0),
    [lines],
  );
  const taxable = Math.max(0, subtotal - (Number(discount) || 0));
  const taxAmount = Math.round(taxable * ((Number(taxRate) || 0) / 100) * 100) / 100;
  const total = Math.round((taxable + taxAmount) * 100) / 100;

  function submit(formData: FormData) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await saveInvoice(formData);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setMessage(`${result.number} created`);
      setLines([emptyLine()]);
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <section className="rounded-xl border border-line bg-white p-5">
        <h2 className="font-medium">New document</h2>
        <p className="mt-1 text-sm text-muted">
          Build a GST-ready invoice or quotation with line items, a discount and a printable layout.
        </p>
        {message && (
          <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {message}
          </p>
        )}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90"
        >
          Create invoice
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-line bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">New document</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-muted hover:text-ink"
        >
          Cancel
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <form action={submit} className="mt-4 space-y-4">
        <input type="hidden" name="type" value={type} />

        <div className="flex gap-2">
          {(["INVOICE", "QUOTATION"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setType(option)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                type === option
                  ? "border-brand bg-brand-soft text-brand"
                  : "border-line hover:bg-surface"
              }`}
            >
              {option === "INVOICE" ? "Invoice" : "Quotation"}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="font-medium">Client name</span>
            <input
              name="clientName"
              required
              className="mt-1.5 w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
          </label>
          <label className="text-sm">
            <span className="font-medium">Phone</span>
            <input
              name="clientPhone"
              className="mt-1.5 w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
          </label>
          <label className="text-sm">
            <span className="font-medium">Email</span>
            <input
              name="clientEmail"
              type="email"
              className="mt-1.5 w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
          </label>
          <label className="text-sm">
            <span className="font-medium">Due date</span>
            <input
              name="dueAt"
              type="date"
              className="mt-1.5 w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
          </label>
        </div>

        <label className="block text-sm">
          <span className="font-medium">Link to event (optional)</span>
          <select
            name="eventId"
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

        <div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Line items</span>
            <button
              type="button"
              onClick={() => setLines((current) => [...current, emptyLine()])}
              className="text-xs font-medium text-brand hover:underline"
            >
              + Add line
            </button>
          </div>

          <div className="mt-2 space-y-2">
            {lines.map((line, index) => (
              <div key={index} className="flex gap-2">
                <input
                  name="item_description"
                  placeholder="Candid photography — day 1"
                  value={line.description}
                  onChange={(event) =>
                    setLines((current) =>
                      current.map((item, i) =>
                        i === index ? { ...item, description: event.target.value } : item,
                      ),
                    )
                  }
                  className="min-w-0 flex-1 rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
                />
                <input
                  name="item_quantity"
                  type="number"
                  min={0}
                  step="0.5"
                  value={line.quantity}
                  onChange={(event) =>
                    setLines((current) =>
                      current.map((item, i) =>
                        i === index ? { ...item, quantity: event.target.value } : item,
                      ),
                    )
                  }
                  className="w-16 rounded-lg border border-line px-2 py-2 text-right text-sm focus:border-brand focus:outline-none"
                  aria-label="Quantity"
                />
                <input
                  name="item_rate"
                  type="number"
                  min={0}
                  placeholder="Rate"
                  value={line.rate}
                  onChange={(event) =>
                    setLines((current) =>
                      current.map((item, i) =>
                        i === index ? { ...item, rate: event.target.value } : item,
                      ),
                    )
                  }
                  className="w-24 rounded-lg border border-line px-2 py-2 text-right text-sm focus:border-brand focus:outline-none"
                  aria-label="Rate"
                />
                {lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
                    className="px-1 text-xs text-muted hover:text-red-600"
                    aria-label="Remove line"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="font-medium">GST rate (%)</span>
            <input
              name="taxRate"
              type="number"
              min={0}
              max={28}
              value={taxRate}
              onChange={(event) => setTaxRate(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
          </label>
          <label className="text-sm">
            <span className="font-medium">Discount (₹)</span>
            <input
              name="discount"
              type="number"
              min={0}
              value={discount}
              onChange={(event) => setDiscount(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
          </label>
        </div>

        <label className="block text-sm">
          <span className="font-medium">Notes</span>
          <textarea
            name="notes"
            rows={2}
            className="mt-1.5 w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
            placeholder="50% advance to confirm the date."
          />
        </label>

        <div className="space-y-1 rounded-lg bg-surface px-4 py-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Subtotal</span>
            <span className="tabular-nums">{inr(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">GST</span>
            <span className="tabular-nums">{inr(taxAmount)}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{inr(total)}</span>
          </div>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-60"
        >
          {pending ? "Saving…" : `Save ${type === "INVOICE" ? "invoice" : "quotation"}`}
        </button>
      </form>
    </section>
  );
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-surface text-muted",
  SENT: "bg-blue-50 text-blue-700",
  PAID: "bg-emerald-50 text-emerald-700",
  CANCELLED: "bg-red-50 text-red-700",
};

export function InvoiceList({ invoices }: { invoices: InvoiceRowData[] }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (invoices.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line bg-white px-4 py-10 text-center text-sm text-muted">
        No documents yet. Your invoices and quotations appear here.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {invoices.map((invoice) => (
        <li key={invoice.id} className="rounded-xl border border-line bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-semibold">{invoice.number}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                    STATUS_STYLES[invoice.status] ?? "bg-surface text-muted"
                  }`}
                >
                  {invoice.status}
                </span>
              </div>
              <p className="mt-1 truncate text-sm">{invoice.clientName}</p>
              <p className="text-xs text-muted">
                {invoice.eventTitle ? `${invoice.eventTitle} · ` : ""}
                {invoice.items} lines · {invoice.issuedAt}
              </p>
            </div>
            <div className="text-right">
              <p className="font-semibold tabular-nums">{inr(invoice.total)}</p>
              <p className="text-[11px] uppercase tracking-wide text-muted">{invoice.type}</p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <Link
              href={`/dashboard/invoices/${invoice.id}`}
              className="rounded-lg border border-line px-2.5 py-1 font-medium hover:bg-surface"
            >
              Edit
            </Link>
            <Link
              href={`/invoice/${invoice.id}/print`}
              className="rounded-lg border border-line px-2.5 py-1 font-medium hover:bg-surface"
            >
              Print
            </Link>
            {(["SENT", "PAID", "CANCELLED"] as const)
              .filter((status) => status !== invoice.status)
              .map((status) => (
                <button
                  key={status}
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await setInvoiceStatus(invoice.id, status);
                      router.refresh();
                    })
                  }
                  className="rounded-lg border border-line px-2.5 py-1 hover:bg-surface disabled:opacity-50"
                >
                  Mark {status.toLowerCase()}
                </button>
              ))}
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (!window.confirm(`Delete ${invoice.number}?`)) return;
                startTransition(async () => {
                  await deleteInvoice(invoice.id);
                  router.refresh();
                });
              }}
              className="rounded-lg border border-red-200 px-2.5 py-1 text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}