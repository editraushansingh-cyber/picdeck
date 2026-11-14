"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateInvoiceItems } from "@/app/actions/invoices";
import { FunctionsEditor, type FunctionRow } from "@/components/FunctionsEditor";

type Line = { description: string; quantity: string; rate: string };

const inr = (value: number) => `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

export type InvoiceDraft = {
  id: string;
  number: string;
  type: string;
  status: string;
  clientName: string;
  clientPhone: string | null;
  clientEmail: string | null;
  clientAddress: string | null;
  discount: number;
  notes: string | null;
  eventTitle: string | null;
  functions: FunctionRow[];
  items: Line[];
};

export function InvoiceEditor({ invoice }: { invoice: InvoiceDraft }) {
  const [lines, setLines] = useState<Line[]>(
    invoice.items.length > 0 ? invoice.items : [{ description: "", quantity: "1", rate: "" }],
  );
  const [discount, setDiscount] = useState(String(invoice.discount));
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
  const total = Math.max(0, subtotal - (Number(discount) || 0));

  function submit(formData: FormData) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await updateInvoiceItems(invoice.id, formData);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setMessage("Saved");
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/dashboard/invoices" className="text-sm text-muted hover:text-ink">
            ← All invoices
          </Link>
          <h1 className="mt-2 font-mono text-2xl font-semibold tracking-tight">{invoice.number}</h1>
          <p className="mt-1 text-sm text-muted">
            {invoice.type === "QUOTATION" ? "Quotation" : "Invoice"} · {invoice.status}
            {invoice.eventTitle ? ` · ${invoice.eventTitle}` : ""}
          </p>
        </div>
        <Link
          href={`/invoice/${invoice.id}/print`}
          className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium hover:bg-surface"
        >
          Print / PDF
        </Link>
      </div>

      {message && (
        <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
        </p>
      )}
      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <form action={submit} className="space-y-4 rounded-xl border border-line bg-white p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="font-medium">Client name</span>
            <input
              name="clientName"
              required
              defaultValue={invoice.clientName}
              className="mt-1.5 w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
          </label>
          <label className="text-sm">
            <span className="font-medium">Phone</span>
            <input
              name="clientPhone"
              defaultValue={invoice.clientPhone ?? ""}
              className="mt-1.5 w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
          </label>
          <label className="text-sm">
            <span className="font-medium">Email</span>
            <input
              name="clientEmail"
              type="email"
              defaultValue={invoice.clientEmail ?? ""}
              className="mt-1.5 w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
          </label>
          <label className="text-sm">
            <span className="font-medium">Billing address</span>
            <textarea
              name="clientAddress"
              rows={2}
              defaultValue={invoice.clientAddress ?? ""}
              className="mt-1.5 w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
          </label>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Line items</span>
            <button
              type="button"
              onClick={() => setLines((current) => [...current, { description: "", quantity: "1", rate: "" }])}
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
                  value={line.description}
                  placeholder="Candid photography — day 1"
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
                  value={line.rate}
                  placeholder="Rate"
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

        <FunctionsEditor initial={invoice.functions} />

        <div className="grid gap-3 sm:grid-cols-2">
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
            defaultValue={invoice.notes ?? ""}
            className="mt-1.5 w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
          />
        </label>

        <div className="space-y-1 rounded-lg bg-surface px-4 py-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Subtotal</span>
            <span className="tabular-nums">{inr(subtotal)}</span>
          </div>
          {Number(discount) > 0 && (
            <div className="flex justify-between">
              <span className="text-muted">Discount</span>
              <span className="tabular-nums">−{inr(Number(discount))}</span>
            </div>
          )}
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
          {pending ? "Saving…" : "Save changes"}
        </button>
      </form>
    </div>
  );
}