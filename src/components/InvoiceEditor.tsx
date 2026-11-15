"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateInvoiceItems } from "@/app/actions/invoices";
import { FunctionsEditor, type FunctionRow } from "@/components/FunctionsEditor";
import { PaymentsEditor, type PaymentRow } from "@/components/PaymentsEditor";
import { computeTotals, round2 } from "@/lib/invoices";

type Line = { description: string; quantity: string; rate: string; group: string };

const inr = (value: number) => `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

const DEFAULT_GROUP = "Deliverables";

const blankLine = (group = DEFAULT_GROUP): Line => ({
  description: "",
  quantity: "1",
  rate: "",
  group,
});

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
  extra: number;
  budgetMode: boolean;
  budgetAmount: number;
  notes: string | null;
  eventTitle: string | null;
  functions: FunctionRow[];
  items: Line[];
  payments: PaymentRow[];
  /** Terms that will print: the invoice's own list, else the studio default. */
  terms: string[];
};

export function InvoiceEditor({ invoice }: { invoice: InvoiceDraft }) {
  const [lines, setLines] = useState<Line[]>(
    invoice.items.length > 0 ? invoice.items : [blankLine()],
  );
  const [discount, setDiscount] = useState(String(invoice.discount));
  const [extra, setExtra] = useState(String(invoice.extra));
  const [budgetMode, setBudgetMode] = useState(invoice.budgetMode);
  const [budgetAmount, setBudgetAmount] = useState(
    invoice.budgetAmount > 0 ? String(invoice.budgetAmount) : "",
  );
  const [terms, setTerms] = useState(invoice.terms.join("\n"));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const totals = useMemo(
    () =>
      computeTotals({
        items: lines.map((line) => ({
          description: line.description,
          quantity: Number(line.quantity) || 0,
          rate: Number(line.rate) || 0,
        })),
        discount: Number(discount) || 0,
        extra: Number(extra) || 0,
        budgetAmount: Number(budgetAmount) || 0,
        budgetMode,
      }),
    [lines, discount, extra, budgetAmount, budgetMode],
  );

  /** Group order follows first appearance, so rows stay where the studio put them. */
  const groupNames = useMemo(() => {
    const seen: string[] = [];
    for (const line of lines) {
      const name = line.group.trim() || DEFAULT_GROUP;
      if (!seen.includes(name)) seen.push(name);
    }
    return seen;
  }, [lines]);

  const groupTotals = useMemo(() => {
    const sums = new Map<string, number>();
    for (const line of lines) {
      const name = line.group.trim() || DEFAULT_GROUP;
      const amount = (Number(line.quantity) || 0) * (Number(line.rate) || 0);
      sums.set(name, round2((sums.get(name) ?? 0) + amount));
    }
    return sums;
  }, [lines]);

  const patchLine = (index: number, patch: Partial<Line>) =>
    setLines((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));

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
              onClick={() => setLines((current) => [...current, blankLine(current.at(-1)?.group)])}
              className="text-xs font-medium text-brand hover:underline"
            >
              + Add line
            </button>
          </div>
          <p className="mt-1 text-xs text-muted">
            Items with the same group name print together under one heading with their own subtotal.
          </p>
          <div className="mt-2 space-y-2">
            {lines.map((line, index) => (
              <div key={index} className="rounded-lg border border-line p-2">
                <div className="flex gap-2">
                  <input
                    name="item_group"
                    value={line.group}
                    placeholder={DEFAULT_GROUP}
                    list="pd-item-groups"
                    onChange={(event) => patchLine(index, { group: event.target.value })}
                    className="w-32 rounded-lg border border-line px-2 py-2 text-sm focus:border-brand focus:outline-none"
                    aria-label="Item group"
                  />
                  <input
                    name="item_description"
                    value={line.description}
                    placeholder="Candid photography — day 1"
                    onChange={(event) => patchLine(index, { description: event.target.value })}
                    className="min-w-0 flex-1 rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
                  />
                  <input
                    name="item_quantity"
                    type="number"
                    min={0}
                    step="0.5"
                    value={line.quantity}
                    onChange={(event) => patchLine(index, { quantity: event.target.value })}
                    className="w-16 rounded-lg border border-line px-2 py-2 text-right text-sm focus:border-brand focus:outline-none"
                    aria-label="Quantity"
                  />
                  <input
                    name="item_rate"
                    type="number"
                    min={0}
                    value={line.rate}
                    placeholder="Rate"
                    onChange={(event) => patchLine(index, { rate: event.target.value })}
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
              </div>
            ))}
          </div>

          <datalist id="pd-item-groups">
            {groupNames.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>

          {groupNames.length > 0 && (
            <div className="mt-2 space-y-1 rounded-lg bg-surface px-3 py-2 text-xs text-muted">
              {groupNames.map((name) => (
                <div key={name} className="flex justify-between">
                  <span>{name}</span>
                  <span className="tabular-nums">{inr(groupTotals.get(name) ?? 0)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <FunctionsEditor initial={invoice.functions} />

        <div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Pricing</span>
            <label className="flex items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                name="budgetMode"
                checked={budgetMode}
                onChange={(event) => setBudgetMode(event.target.checked)}
                className="size-4 rounded border-line"
              />
              Flat package total
            </label>
          </div>
          <p className="mt-1 text-xs text-muted">
            {budgetMode
              ? "The item rows describe the package; the flat total is what the client pays."
              : "Totals come from quantity × rate."}
          </p>

          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            {budgetMode && (
              <label className="text-sm">
                <span className="font-medium">Package total (₹)</span>
                <input
                  name="budgetAmount"
                  type="number"
                  min={0}
                  value={budgetAmount}
                  onChange={(event) => setBudgetAmount(event.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
                />
              </label>
            )}
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
            <label className="text-sm">
              <span className="font-medium">Extra charges (₹)</span>
              <input
                name="extra"
                type="number"
                min={0}
                value={extra}
                onChange={(event) => setExtra(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
              />
            </label>
          </div>
        </div>

        <PaymentsEditor initial={invoice.payments} total={totals.total} />

        <label className="block text-sm">
          <span className="font-medium">Terms &amp; conditions</span>
          <textarea
            name="terms"
            rows={4}
            value={terms}
            onChange={(event) => setTerms(event.target.value)}
            placeholder={"50% advance to confirm the date\nBalance on delivery"}
            className="mt-1.5 w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
          />
          <span className="mt-1 block text-xs text-muted">
            One term per line. Clear the box to fall back to the studio default.
          </span>
        </label>

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
            <span className="text-muted">{budgetMode ? "Package total" : "Subtotal"}</span>
            <span className="tabular-nums">{inr(totals.subtotal)}</span>
          </div>
          {Number(discount) > 0 && (
            <div className="flex justify-between">
              <span className="text-muted">Discount</span>
              <span className="tabular-nums">−{inr(Number(discount))}</span>
            </div>
          )}
          {Number(extra) > 0 && (
            <div className="flex justify-between">
              <span className="text-muted">Extra charges</span>
              <span className="tabular-nums">+{inr(Number(extra))}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{inr(totals.total)}</span>
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
