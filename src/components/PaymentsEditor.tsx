"use client";

import { useState } from "react";

export type PaymentRow = { amount: string; paidAt: string; mode: string; note: string };

export const PAYMENT_MODES = ["CASH", "UPI", "CARD", "BANK"] as const;

const blank = (): PaymentRow => ({ amount: "", paidAt: "", mode: "UPI", note: "" });

const inr = (value: number) => `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

/**
 * Advance / part-payment log. Rows post as `pay_amount[]`, `pay_date[]`,
 * `pay_mode[]`, `pay_note[]`; the server sums them into `Invoice.advance`.
 */
export function PaymentsEditor({
  initial,
  total,
}: {
  initial: PaymentRow[];
  total: number;
}) {
  const [rows, setRows] = useState<PaymentRow[]>(initial);

  const update = (index: number, patch: Partial<PaymentRow>) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const paid = rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  const balance = Math.max(0, total - paid);

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Payments received</span>
        <button
          type="button"
          onClick={() => setRows((current) => [...current, blank()])}
          className="text-xs font-medium text-brand hover:underline"
        >
          + Add payment
        </button>
      </div>
      <p className="mt-1 text-xs text-muted">
        Advance and part payments. The balance is what the invoice still shows as due.
      </p>

      {rows.length === 0 ? (
        <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-xs text-muted">
          Nothing recorded yet — the full {inr(total)} shows as balance.
        </p>
      ) : (
        <div className="mt-2 space-y-2">
          {rows.map((row, index) => (
            <div key={index} className="rounded-lg border border-line p-2">
              <div className="flex gap-2">
                <input
                  name="pay_amount"
                  type="number"
                  min={0}
                  step="1"
                  value={row.amount}
                  placeholder="Amount"
                  onChange={(event) => update(index, { amount: event.target.value })}
                  className="w-28 rounded-lg border border-line px-3 py-2 text-right text-sm focus:border-brand focus:outline-none"
                  aria-label="Payment amount"
                />
                <input
                  name="pay_date"
                  type="date"
                  value={row.paidAt}
                  onChange={(event) => update(index, { paidAt: event.target.value })}
                  className="rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
                  aria-label="Payment date"
                />
                <select
                  name="pay_mode"
                  value={row.mode}
                  onChange={(event) => update(index, { mode: event.target.value })}
                  className="rounded-lg border border-line px-2 py-2 text-sm focus:border-brand focus:outline-none"
                  aria-label="Payment mode"
                >
                  {PAYMENT_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode}
                    </option>
                  ))}
                </select>
                <input
                  name="pay_note"
                  value={row.note}
                  placeholder="Booking advance"
                  onChange={(event) => update(index, { note: event.target.value })}
                  className="min-w-0 flex-1 rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
                  aria-label="Payment note"
                />
                <button
                  type="button"
                  onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
                  className="px-1 text-xs text-muted hover:text-red-600"
                  aria-label="Remove payment"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex justify-between rounded-lg bg-surface px-3 py-2 text-sm">
        <span className="text-muted">
          Advance {inr(paid)} · Balance <b className="text-ink">{inr(balance)}</b>
        </span>
      </div>
    </div>
  );
}
