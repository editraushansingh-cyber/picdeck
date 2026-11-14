"use client";

import { useState } from "react";

type ReferredStudio = { id: string; name: string; email: string; joinedAt: string };
type CreditRow = {
  id: string;
  amount: number;
  reason: string;
  sourceName: string | null;
  createdAt: string;
};

export function ReferralPanel({
  code,
  link,
  total,
  referred,
  credits,
}: {
  code: string;
  link: string;
  total: number;
  referred: ReferredStudio[];
  credits: CreditRow[];
}) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  async function copy(kind: "code" | "link", value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      window.prompt("Copy this:", value);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <section className="space-y-4">
        <div className="rounded-xl border border-line bg-white p-5">
          <h2 className="font-medium">Your referral code</h2>
          <p className="mt-1 text-sm text-muted">
            Every studio that signs up with this code puts ₹200 of credit in your account.
          </p>

          <div className="mt-4 flex items-center gap-2">
            <span className="rounded-lg bg-surface px-3 py-2 font-mono text-lg tracking-widest">
              {code}
            </span>
            <button
              type="button"
              onClick={() => copy("code", code)}
              className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium hover:bg-surface"
            >
              {copied === "code" ? "Copied" : "Copy code"}
            </button>
          </div>

          <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted">Share link</p>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              readOnly
              value={link}
              onFocus={(event) => event.currentTarget.select()}
              className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-xs"
              aria-label="Referral link"
            />
            <button
              type="button"
              onClick={() => copy("link", link)}
              className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium hover:bg-surface"
            >
              {copied === "link" ? "Copied" : "Copy link"}
            </button>
          </div>

          <a
            href={`mailto:?subject=${encodeURIComponent("Client galleries on PicDeck")}&body=${encodeURIComponent(
              `I run my client galleries on PicDeck — the studio picks the photos, you just approve. Use my code ${code}: ${link}`,
            )}`}
            className="mt-4 inline-block rounded-lg border border-line px-3 py-2 text-xs font-semibold hover:bg-surface"
          >
            Share by email
          </a>
        </div>

        <div className="rounded-xl border border-line bg-white p-5">
          <h2 className="font-medium">Credit balance</h2>
          <p className="mt-2 text-3xl font-semibold tracking-tight">₹{total.toLocaleString("en-IN")}</p>
          <p className="mt-1 text-sm text-muted">
            Applied against your next renewal. Credits never expire.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <div className="rounded-xl border border-line bg-white p-5">
          <h2 className="font-medium">Studios you brought in</h2>
          {referred.length === 0 ? (
            <p className="mt-3 rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
              Nobody yet. Share your code with a studio that still collects selections on WhatsApp.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {referred.map((studio) => (
                <li key={studio.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{studio.name}</p>
                    <p className="truncate text-xs text-muted">{studio.email}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted">{studio.joinedAt}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-line bg-white p-5">
          <h2 className="font-medium">Credit history</h2>
          {credits.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No credits yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {credits.map((credit) => (
                <li key={credit.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate">
                      {credit.sourceName ? credit.sourceName : "Manual credit"}
                      <span className="ml-2 rounded-full bg-surface px-2 py-0.5 text-[10px] uppercase text-muted">
                        {credit.reason}
                      </span>
                    </p>
                    <p className="text-xs text-muted">{credit.createdAt}</p>
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums text-emerald-700">
                    +₹{credit.amount}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}