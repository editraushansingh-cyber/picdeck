import Link from "next/link";
import { connection } from "next/server";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { getCurrentUser } from "@/lib/auth";
import { PHOTO_SELECTION_PLANS } from "@/lib/plans";

const steps = [
  {
    title: "Create the event",
    body: "Name the wedding, add the couple. PicDeck generates a private gallery and a 6-digit code.",
  },
  {
    title: "Upload the photos",
    body: "Drop JPEGs or RAW files. Raster images get fast thumbnails; RAW files are kept for the final download.",
  },
  {
    title: "Share the code",
    body: "Send the gallery link or code by email. No client account, no app install.",
  },
  {
    title: "Collect the list",
    body: "Selections land in your dashboard the moment your client saves. Download the list as a folder.",
  },
];

// This route reads the session cookie, event params or search params on every request.
export const instant = false;


export default async function HomePage() {
  await connection();
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader signedIn={!!user} />

      {(process.env.DEMO_MODE === "on" || process.env.OTP_MODE === "console") && (
        <div className="border-b border-amber-200 bg-amber-50">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-5 py-2 text-xs text-amber-900">
            <span>
              Developer mode: the studio sign-up form is bypassed on this machine.
            </span>
            <Link href="/demo" className="font-semibold underline">
              Open the demo dashboard →
            </Link>
          </div>
        </div>
      )}

      <main className="flex-1">
        {/* Hero */}
        <section className="border-b border-line">
          <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:py-24">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-muted">
                <span className="size-1.5 rounded-full bg-brand" />
                The studio suite — galleries, albums, invoices, site
              </p>
              <h1 className="mt-5 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
                Let clients pick their favourites in minutes.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
                One private gallery, one 6-digit code. Clients review on any phone, tap the photos
                they love, and the final list is in your dashboard before the conversation ends.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href={user ? "/dashboard" : "/register"}
                  className="rounded-lg bg-brand px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand/90"
                >
                  {user ? "Open dashboard" : "Start free — 14 days"}
                </Link>
                <Link
                  href="/g"
                  className="rounded-lg border border-line px-5 py-3 text-sm font-medium hover:bg-surface"
                >
                  I have a gallery code
                </Link>
              </div>
              <p className="mt-4 text-sm text-muted">
                No card required. Your trial gallery stays yours if you stop.
              </p>
            </div>

            {/* Product sketch */}
            <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
              <div className="rounded-xl border border-line bg-white p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted">Ananya &amp; Rohan</p>
                    <p className="text-sm font-medium">12 March · 412 photos</p>
                  </div>
                  <span className="rounded-md bg-brand-soft px-2.5 py-1 font-mono text-sm font-semibold text-brand">
                    482 917
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {[
                    "from-amber-100 to-rose-100",
                    "from-sky-100 to-indigo-100",
                    "from-emerald-100 to-teal-100",
                    "from-rose-100 to-orange-100",
                    "from-violet-100 to-sky-100",
                    "from-slate-100 to-emerald-100",
                  ].map((tone, index) => (
                    <div
                      key={tone}
                      className={`aspect-square rounded-lg bg-gradient-to-br ${tone} ${
                        index === 1 || index === 4 ? "ring-2 ring-brand ring-offset-2" : ""
                      }`}
                    />
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between rounded-lg bg-surface px-3 py-2.5 text-sm">
                  <span className="text-muted">Selected</span>
                  <span className="font-medium">2 of 60</span>
                  <span className="rounded-md bg-ink px-3 py-1.5 text-xs font-medium text-white">Send list</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* What it does */}
        <section className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Everything the review needs, nothing it doesn&apos;t
          </h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {[
              {
                title: "Code-protected galleries",
                body: "Six digits unlock one event. Wrong guesses are rate-limited per device and per gallery, so codes are not something anyone can walk through.",
              },
              {
                title: "RAW and JPEG both work",
                body: "Upload straight out of the card. Previews render from JPEGs; RAW files are stored untouched for the final delivery.",
              },
              {
                title: "You control downloads",
                body: "Turn downloads off for review, allow compressed previews, or unlock originals only after the list is final. Per event.",
              },
              {
                title: "Selection limits",
                body: "Ask for 60 photos or 200. The client sees the counter and cannot submit more than you allowed.",
              },
              {
                title: "Live selection list",
                body: "The dashboard shows exactly which files were chosen, with a one-click download of only those files.",
              },
              {
                title: "Delete means delete",
                body: "Deleting an event removes its files and selection records. No archive left behind.",
              },
            ].map((item) => (
              <div key={item.title} className="rounded-xl border border-line p-5">
                <h3 className="font-medium">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* The rest of the suite */}
        <section className="border-y border-line bg-surface">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <p className="text-xs font-medium uppercase tracking-wider text-brand">
              Beyond the selection list
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              Eight tools that usually live in eight different apps
            </h2>
            <p className="mt-3 max-w-2xl text-muted">
              Photo selection is where a wedding starts. The rest of the delivery — albums,
              invoices, invitations, your site, client reminders — runs from the same dashboard.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  title: "AI face search",
                  body: "The couple uploads one selfie and sees only the photos they appear in.",
                  tag: "Silver+",
                },
                {
                  title: "Album / flipbook",
                  body: "Turn the final selection into page spreads with one private, page-turning link.",
                  tag: "Silver+",
                },
                {
                  title: "Invoices & quotations",
                  body: "Line items, GST, discount, printable A4 — numbered INV/QUO automatically.",
                  tag: "Silver+",
                },
                {
                  title: "Invitation templates",
                  body: "Four designs, one share link each, with an RSVP counter built in.",
                  tag: "All plans",
                },
                {
                  title: "Your own website",
                  body: "A one-page studio site on a PicDeck address. No domain to buy.",
                  tag: "Gold",
                },
                {
                  title: "Client notifications",
                  body: "Fill a template, keep the message in a queue, send it by email.",
                  tag: "Gold",
                },
                {
                  title: "Referral credits",
                  body: "Share a code, earn ₹200 for every studio that joins.",
                  tag: "All plans",
                },
                {
                  title: "One-click folder ZIP",
                  body: "The whole folder or just the selected files, in one download.",
                  tag: "All plans",
                },
              ].map((item) => (
                <div key={item.title} className="rounded-xl border border-line bg-white p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium">{item.title}</h3>
                    <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
                      {item.tag}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{item.body}</p>
                </div>
              ))}
            </div>

            <Link
              href="/plans"
              className="mt-8 inline-block rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium hover:bg-surface"
            >
              See what each plan includes →
            </Link>
          </div>
        </section>

        {/* How it works */}
        <section className="border-y border-line bg-surface">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">From shoot to list in four steps</h2>
            <ol className="mt-8 grid gap-5 md:grid-cols-4">
              {steps.map((step, index) => (
                <li key={step.title} className="rounded-xl border border-line bg-white p-5">
                  <span className="grid size-8 place-items-center rounded-lg bg-brand-soft font-mono text-sm font-semibold text-brand">
                    {index + 1}
                  </span>
                  <h3 className="mt-3 font-medium">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Plans */}
        <section className="mx-auto max-w-6xl px-5 py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Simple plans</h2>
              <p className="mt-2 text-muted">
                Free forever for one event. Paid plans add unlimited events, albums and AI search.
              </p>
            </div>
            <Link href="/plans" className="text-sm font-medium text-brand hover:underline">
              Compare all plans
            </Link>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {PHOTO_SELECTION_PLANS.map((plan) => (
              <div
                key={plan.slug}
                className={`rounded-xl border p-6 ${
                  plan.slug === "silver-half-yearly" ? "border-brand/40 bg-brand-soft/30" : "border-line"
                }`}
              >
                <div className="flex items-baseline justify-between">
                  <h3 className="font-semibold">{plan.name}</h3>
                  {plan.highlight && <span className="text-xs text-muted">{plan.highlight}</span>}
                </div>
                <p className="mt-3">
                  <span className="text-3xl font-semibold">₹{plan.priceInr.toLocaleString("en-IN")}</span>
                  <span className="text-sm text-muted">
                    {" "}/ {plan.periodMonths === 1 ? "month" : `${plan.periodMonths} months`}
                  </span>
                </p>
                <ul className="mt-4 space-y-2 text-sm text-muted">
                  {plan.features.slice(0, 4).map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <span className="text-brand">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/plans"
                  className="mt-6 block rounded-lg border border-line py-2.5 text-center text-sm font-medium hover:bg-surface"
                >
                  See details
                </Link>
              </div>
            ))}
          </div>
          <p className="mt-5 text-center text-sm text-muted">
            Want everything?{" "}
            <Link href="/plans" className="font-medium text-brand hover:underline">
              All-Access is ₹1,999 a year
            </Link>{" "}
            — or add Album and AI plans separately.
          </p>
        </section>

        {/* CTA */}
        <section className="border-t border-line">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <div className="rounded-2xl bg-ink px-8 py-12 text-white">
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                The next wedding can be the easy one.
              </h2>
              <p className="mt-3 max-w-2xl text-white/70">
                Create an event, upload the photos you have, and send one code. The client review
                takes minutes, not weeks of WhatsApp threads.
              </p>
              <Link
                href="/register"
                className="mt-7 inline-block rounded-lg bg-white px-5 py-3 text-sm font-semibold text-ink hover:bg-white/90"
              >
                Create a free gallery
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}