"use client";

import { useState } from "react";

export type FunctionRow = { name: string; date: string; venue: string; desc: string };

const SUGGESTIONS = ["Tilak", "Haldi", "Mehndi", "Wedding", "Reception", "Sangeet", "Cocktail"];

const blank = (): FunctionRow => ({ name: "", date: "", venue: "", desc: "" });

/**
 * Wedding-function schedule. Rows post as `fn_name[]`, `fn_date[]`, `fn_venue[]`
 * and `fn_desc[]` so the server action can store them as one JSON array.
 */
export function FunctionsEditor({ initial }: { initial: FunctionRow[] }) {
  const [rows, setRows] = useState<FunctionRow[]>(initial.length > 0 ? initial : [blank()]);

  const update = (index: number, patch: Partial<FunctionRow>) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Functions</span>
        <button
          type="button"
          onClick={() => setRows((current) => [...current, blank()])}
          disabled={rows.length >= 8}
          className="text-xs font-medium text-brand hover:underline disabled:opacity-50"
        >
          + Add function
        </button>
      </div>
      <p className="mt-1 text-xs text-muted">
        Printed as a schedule across the top of the invoice, each with its date. Leave the
        description empty to hide that line.
      </p>

      <div className="mt-2 space-y-2">
        {rows.map((row, index) => (
          <div key={index} className="rounded-lg border border-line p-2">
            <div className="flex gap-2">
              <input
                name="fn_name"
                list="pd-function-names"
                value={row.name}
                placeholder="Haldi"
                onChange={(event) => update(index, { name: event.target.value })}
                className="w-28 rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
                aria-label="Function name"
              />
              <input
                name="fn_date"
                value={row.date}
                placeholder="11 Nov 2026"
                onChange={(event) => update(index, { date: event.target.value })}
                className="w-32 rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
                aria-label="Function date"
              />
              <input
                name="fn_venue"
                value={row.venue}
                placeholder="Venue"
                onChange={(event) => update(index, { venue: event.target.value })}
                className="min-w-0 flex-1 rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
                aria-label="Function venue"
              />
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
                  className="px-1 text-xs text-muted hover:text-red-600"
                  aria-label="Remove function"
                >
                  ×
                </button>
              )}
            </div>
            <input
              name="fn_desc"
              value={row.desc}
              placeholder="Time, dress code or anything the client should know (optional)"
              onChange={(event) => update(index, { desc: event.target.value })}
              className="mt-2 w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
              aria-label="Function description"
            />
          </div>
        ))}
      </div>

      <datalist id="pd-function-names">
        {SUGGESTIONS.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
    </div>
  );
}
