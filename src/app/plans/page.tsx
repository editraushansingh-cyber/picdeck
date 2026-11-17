import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { getCurrentUser } from "@/lib/auth";
import {
  AI_PLANS,
  ALBUM_PLANS,
  ALL_ACCESS_PLAN,
  FREE_PLAN,
  PHOTO_SELECTION_PLANS,
  type PlanSeed,
} from "@/lib/plans";

export const metadata: Metadata = {
  title: "Plans — PicDeck",
  description:
    "Create your studio account, add album or AI face search when you need it, or take everything with All-Access at ₹1,999 a year.",
};

const headlinePlans: PlanSeed[] = [
  FREE_PLAN,
  ...PHOTO_SELECTION_PLANS,
  ALL_ACCESS_PLAN,
];

const matrixColumns = ["Free", "Basic", "Silver", "Gold", "All-Access"];

const included = [
  ["Photo Selection galleries & codes", "yes", "yes", "yes", "yes", "yes"],
  ["Invoices, quotations & invitations", "yes", "yes", "yes", "yes", "yes"],
  ["Studio website", "yes", "yes", "yes", "yes", "yes"],
  ["Notification queue (email)", "yes", "yes", "yes", "yes", "yes"],
  ["Referral credits", "yes", "yes", "yes", "yes", "yes"],
  ["RAW file support", "yes", "yes", "yes", "yes", "yes"],
  ["Active events", "1", "Unlimited", "Unlimited", "Unlimited", "Unlimited"],
  ["Compressed client downloads", "yes", "yes", "yes", "yes", "yes"],
  ["Original-size client downloads", "—", "—", "yes", "yes", "yes"],
  ["AI face search & named groups", "—", "—", "yes", "yes", "yes"],
  ["Album / flipbook with music", "—", "—", "yes", "yes", "yes"],
  ["Custom logo & watermark", "—", "—", "—", "yes", "yes"],
  ["Lifetime album QR + studio QR", "—", "—", "yes", "yes", "yes"],
  ["Invitation templates", "2", "2", "25", "200", "200"],
] as const;

const faqs = [
  {
    question: "What is actually free?",
    answer:
      "One active event, selection galleries with 6-digit codes, invoices, invitations, your studio page and compressed client downloads. No card required.",
  },
  {
    question: "Why are album and AI sold separately?",
    answer:
      "Plenty of studios only need selection and delivery. Album packs add the flipbook, cover art, music and lifetime QR. AI packs add selfie search and named person groups. If you want both, All-Access is cheaper than buying the two add-ons.",
  },
  {
    question: "Can I switch plans later?",
    answer:
      "Yes. Plan changes apply to new modules immediately; existing galleries, albums and invoices stay untouched.",
  },
  {
    question: "Do clients need an account?",
    answer:
      "No. They open the link or enter the 6-digit code, tap photos, and send the list. Nothing to install.",
  },
  {
    question: "What happens when I delete an event?",
    answer:
      "The photos, previews, thumbnails and selection records are removed from disk. Archiving keeps everything but closes the gallery.",
  },
];

export const instant = false;

function PlanCard({
  plan,
  featured,
  signedIn,
}: {
  plan: PlanSeed;
  featured?: boolean;
  signedIn: boolean;
}) {
  const monthly = plan.priceInr === 0 ? 0 : Math.round(plan.priceInr / plan.periodMonths);
  return (
    <div
      className={`flex flex-col rounded-2xl border p-6 ${
        featured ? "border-brand bg-brand-soft/25 shadow-sm" : "border-line bg-white"
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-semibold">{plan.name}</h3>
        {plan.highlight && (
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
              featured ? "bg-brand text-white" : "bg-surface text-muted"
            }`}
          >
            {plan.highlight}
          </span>
        )}
      </div>
      <p className="mt-4">
        <span className="text-3xl font-semibold">
          {plan.priceInr === 0 ? "₹0" : `₹${plan.priceInr.toLocaleString("en-IN")}`}
        </span>
        <span className="text-sm text-muted">
          {plan.priceInr === 0
            ? " forever"
            : plan.periodMonths === 1
              ? " / month"
              : plan.periodMonths === 12
                ? " / year"
                : ` / ${plan.periodMonths} months`}
        </span>
      </p>
      {plan.priceInr > 0 && (
        <p className="mt-1 text-xs text-muted">≈ ₹{monthly.toLocaleString("en-IN")} per month</p>
      )}
      <ul className="mt-5 flex-1 space-y-2 text-sm text-muted">
        {plan.features.map((feature) => (
          <li key={feature} className="flex gap-2">
            <span className="text-brand">✓</span>
            {feature}
          </li>
        ))}
      </ul>
      <Link
        href={signedIn ? "/dashboard" : "/register"}
        className={`mt-6 rounded-lg py-2.5 text-center text-sm font-semibold ${
          featured
            ? "bg-brand text-white hover:bg-brand/90"
            : "border border-line hover:bg-surface"
        }`}
      >
        {plan.priceInr === 0 ? "Create account" : "Choose plan"}
      </Link>
    </div>
  );
}

export default async function PlansPage() {
  await connection();
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader signedIn={!!user} />
      <main className="flex-1">
        <section className="border-b border-line bg-surface">
          <div className="mx-auto max-w-6xl px-5 py-14 text-center">
            <p className="text-xs font-medium uppercase tracking-wider text-brand">
              The PicDeck studio suite
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Start with the Free plan. Add what you actually use.
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-muted">
              Selection, invoices, invitations and your studio site are always included. Albums and
              AI face search are add-ons — or take everything with All-Access.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-12">
          <h2 className="text-xl font-semibold tracking-tight">Selection & delivery</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {headlinePlans.map((plan) => (
              <PlanCard
                key={plan.slug}
                plan={plan}
                signedIn={!!user}
                featured={plan.slug === ALL_ACCESS_PLAN.slug}
              />
            ))}
          </div>

          <div className="mt-12 grid gap-10 lg:grid-cols-2">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Album add-ons</h2>
              <p className="mt-1 text-sm text-muted">
                Flipbook delivery, cover art, music and a lifetime QR — sold without the rest of the
                suite.
              </p>
              <div className="mt-4 space-y-3">
                {ALBUM_PLANS.map((plan) => (
                  <div
                    key={plan.slug}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-line bg-white p-4"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">
                        {plan.name}
                        {plan.highlight && (
                          <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-medium text-brand">
                            {plan.highlight}
                          </span>
                        )}
                      </p>
                      <ul className="mt-1.5 space-y-1 text-xs text-muted">
                        {plan.features.map((feature) => (
                          <li key={feature}>· {feature}</li>
                        ))}
                      </ul>
                    </div>
                    <p className="shrink-0 text-sm font-semibold">
                      ₹{plan.priceInr.toLocaleString("en-IN")}
                      <span className="text-xs font-normal text-muted">/yr</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-xl font-semibold tracking-tight">AI face search add-ons</h2>
              <p className="mt-1 text-sm text-muted">
                Selfie search and named person groups for teams shooting thousands of candids.
              </p>
              <div className="mt-4 space-y-3">
                {AI_PLANS.map((plan) => (
                  <div
                    key={plan.slug}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-line bg-white p-4"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">
                        {plan.name}
                        {plan.highlight && (
                          <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-medium text-brand">
                            {plan.highlight}
                          </span>
                        )}
                      </p>
                      <ul className="mt-1.5 space-y-1 text-xs text-muted">
                        {plan.features.map((feature) => (
                          <li key={feature}>· {feature}</li>
                        ))}
                      </ul>
                    </div>
                    <p className="shrink-0 text-sm font-semibold">
                      ₹{plan.priceInr.toLocaleString("en-IN")}
                      <span className="text-xs font-normal text-muted">/yr</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p className="mt-8 text-center text-xs text-muted">
            Prices in INR, inclusive of applicable taxes. Payment collection is not enabled in this
            build — new accounts begin on the Free plan and a paid plan can be assigned by the admin.
          </p>
        </section>

        <section className="border-y border-line bg-surface">
          <div className="mx-auto max-w-6xl px-5 py-12">
            <h2 className="text-xl font-semibold tracking-tight">What is in each plan</h2>
            <div className="mt-6 overflow-x-auto pd-scroll">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line text-left">
                    <th className="py-2.5 pr-4 font-medium">Feature</th>
                    {matrixColumns.map((name) => (
                      <th key={name} className="px-3 py-2.5 text-center font-medium">
                        {name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {included.map(([feature, ...values]) => (
                    <tr key={feature} className="border-b border-line/70">
                      <td className="py-2.5 pr-4 text-muted">{feature}</td>
                      {values.map((value, index) => (
                        <td
                          key={index}
                          className={`px-3 py-2.5 text-center ${
                            value === "yes" ? "text-brand" : "text-muted"
                          }`}
                        >
                          {value === "yes" ? "✓" : value}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-5 py-14">
          <h2 className="text-xl font-semibold tracking-tight">Questions</h2>
          <dl className="mt-6 divide-y divide-line">
            {faqs.map((faq) => (
              <div key={faq.question} className="py-4">
                <dt className="font-medium">{faq.question}</dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-muted">{faq.answer}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-8 rounded-xl bg-ink px-6 py-8 text-white">
            <h2 className="text-xl font-semibold tracking-tight">Try it on the next wedding.</h2>
            <p className="mt-2 text-sm text-white/70">
              Free forever for one event. No card, your files stay yours.
            </p>
            <Link
              href={user ? "/dashboard" : "/register"}
              className="mt-5 inline-block rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-ink hover:bg-white/90"
            >
              {user ? "Open dashboard" : "Create a free gallery"}
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
