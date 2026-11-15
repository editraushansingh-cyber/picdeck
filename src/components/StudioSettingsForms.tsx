"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveBranding, saveCustomDomain } from "@/app/actions/studio";

export function BrandingForm({
  watermarkText,
  logoUrl,
  website,
  upiId,
  bankAccount,
  ifsc,
  invoicePrefix,
  invoiceTerms,
}: {
  watermarkText: string | null;
  logoUrl: string | null;
  website: string | null;
  upiId: string | null;
  bankAccount: string | null;
  ifsc: string | null;
  invoicePrefix: string | null;
  invoiceTerms: string[];
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit(formData: FormData) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await saveBranding(formData);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setMessage("Branding saved. New uploads use it.");
      router.refresh();
    });
  }

  return (
    <form action={submit} className="space-y-4 rounded-xl border border-line bg-white p-5">
      <div>
        <h2 className="font-medium">Studio branding</h2>
        <p className="mt-1 text-sm text-muted">
          The logo appears on album covers; the text watermark is burned into new client previews.
          Originals stay clean.
        </p>
      </div>

      {message && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="text-sm">
          <span className="font-medium">Logo</span>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Studio logo" className="mt-2 h-16 w-auto rounded border border-line bg-surface p-2 object-contain" />
          ) : (
            <p className="mt-2 text-xs text-muted">PNG with transparency works best.</p>
          )}
          <input
            type="file"
            name="logo"
            accept="image/*"
            className="mt-2 block w-full text-xs text-muted file:mr-3 file:rounded-lg file:border file:border-line file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium hover:file:bg-surface"
          />
          {logoUrl && (
            <label className="mt-2 flex items-center gap-2 text-xs text-muted">
              <input type="checkbox" name="removeLogo" className="size-3.5 accent-[var(--pd-brand)]" />
              Remove the logo
            </label>
          )}
        </div>

        <label className="text-sm">
          <span className="font-medium">Watermark text</span>
          <input
            name="watermarkText"
            defaultValue={watermarkText ?? ""}
            maxLength={40}
            placeholder="Demo Studio"
            className="mt-2 w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
          />
          <span className="mt-1 block text-xs text-muted">
            Shown bottom-right on previews. Leave empty for a clean preview.
          </span>
        </label>
      </div>

      <div>
        <h3 className="text-sm font-medium">Invoice letterhead</h3>
        <p className="mt-1 text-sm text-muted">
          These appear on every invoice and quotation. Address, city and PIN come from your profile.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            <span className="font-medium">Website</span>
            <input
              name="website"
              defaultValue={website ?? ""}
              maxLength={80}
              placeholder="riyafilm.in"
              className="mt-2 w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
          </label>
          <label className="text-sm">
            <span className="font-medium">UPI ID</span>
            <input
              name="upiId"
              defaultValue={upiId ?? ""}
              maxLength={60}
              placeholder="studio@okhdfc"
              className="mt-2 w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
          </label>
          <label className="text-sm">
            <span className="font-medium">Bank account</span>
            <input
              name="bankAccount"
              defaultValue={bankAccount ?? ""}
              maxLength={40}
              placeholder="5012 4478 9901"
              className="mt-2 w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
          </label>
          <label className="text-sm">
            <span className="font-medium">IFSC</span>
            <input
              name="ifsc"
              defaultValue={ifsc ?? ""}
              maxLength={15}
              placeholder="HDFC0000123"
              className="mt-2 w-full rounded-lg border border-line px-3 py-2 text-sm uppercase focus:border-brand focus:outline-none"
            />
          </label>
        </div>
        <p className="mt-2 text-xs text-muted">
          Leave a field empty to hide it. No GST number is printed.
        </p>
      </div>

      <div>
        <h3 className="text-sm font-medium">Invoice numbering &amp; terms</h3>
        <p className="mt-1 text-sm text-muted">
          Numbers follow <span className="font-mono">PREFIX/YEAR/001</span> and restart every January.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            <span className="font-medium">Number prefix</span>
            <input
              name="invoicePrefix"
              defaultValue={invoicePrefix ?? ""}
              maxLength={3}
              placeholder="RS"
              className="mt-2 w-full rounded-lg border border-line px-3 py-2 text-sm uppercase focus:border-brand focus:outline-none"
            />
            <span className="mt-1 block text-xs text-muted">
              2–3 letters. Empty means <span className="font-mono">2026/001</span>.
            </span>
          </label>
          <label className="text-sm">
            <span className="font-medium">Default terms</span>
            <textarea
              name="invoiceTerms"
              rows={5}
              defaultValue={invoiceTerms.join("\n")}
              placeholder={"50% advance to confirm the date\nBalance on delivery\nTravel outside city billed separately"}
              className="mt-2 w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
            <span className="mt-1 block text-xs text-muted">
              One line per term. Printed on invoices that do not override them.
            </span>
          </label>
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save branding"}
      </button>
    </form>
  );
}

export function DomainForm({
  domain,
  siteUrl,
}: {
  domain: string | null;
  siteUrl: string | null;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit(formData: FormData) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await saveCustomDomain(formData);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setMessage(result.domain ? `Connected ${result.domain}` : "Custom domain removed");
      router.refresh();
    });
  }

  return (
    <form action={submit} className="space-y-3 rounded-xl border border-line bg-white p-5">
      <div>
        <h2 className="font-medium">Custom domain</h2>
        <p className="mt-1 text-sm text-muted">
          Point a domain at your studio site. In production set{" "}
          <code className="rounded bg-surface px-1 py-0.5 text-xs">CUSTOM_DOMAINS=&quot;studio.example.com=your-slug&quot;</code>{" "}
          so the proxy serves it.
        </p>
      </div>
      {message && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>
      )}
      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {!siteUrl && <p className="text-xs text-muted">Create your studio site first on the Website page.</p>}
      <div className="flex flex-wrap gap-2">
        <input
          name="customDomain"
          defaultValue={domain ?? ""}
          placeholder="studio.example.com"
          disabled={!siteUrl}
          className="min-w-0 flex-1 rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none disabled:bg-surface"
        />
        <button
          type="submit"
          disabled={pending || !siteUrl}
          className="rounded-lg border border-line px-3 py-2 text-sm font-medium hover:bg-surface disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save domain"}
        </button>
      </div>
      {domain && siteUrl && (
        <p className="text-xs text-muted">
          DNS: point <code className="rounded bg-surface px-1">A</code> or{" "}
          <code className="rounded bg-surface px-1">CNAME</code> at your host; until DNS is live the
          site stays available at {siteUrl}.
        </p>
      )}
    </form>
  );
}
