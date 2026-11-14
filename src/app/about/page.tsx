import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "About — PicDeck",
  description:
    "PicDeck is a photo selection tool for wedding and event photographers. Private galleries, a six-digit code, and a clean list back in your dashboard.",
};

// This route reads the session cookie, event params or search params on every request.
export const instant = false;


export default async function AboutPage() {
  await connection();
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader signedIn={!!user} />
      <main className="flex-1">
        <section className="border-b border-line bg-surface">
          <div className="mx-auto max-w-3xl px-5 py-14">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Built for the part of the job that never ends
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-muted">
              Every photographer knows the routine: the wedding is over, the photos are ready, and
              then two weeks disappear into &ldquo;can you resend the folder?&rdquo;
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-3xl space-y-8 px-5 py-12 text-sm leading-relaxed text-muted">
          <div>
            <h2 className="text-lg font-semibold text-ink">What PicDeck does</h2>
            <p className="mt-2">
              It gives each event a private gallery and a six-digit code. Your client opens the
              link on their phone, taps the photos they want, and sends the list. You see the same
              list in your dashboard with a download button next to it. No spreadsheet, no
              screenshots, no half-finished WhatsApp thread.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-ink">What we deliberately do not do</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li>We do not show invented &ldquo;someone just purchased&rdquo; pop-ups.</li>
              <li>We do not label testimonials as verified when nobody verified them.</li>
              <li>We do not leave a gallery open to unlimited code guessing.</li>
              <li>We do not keep your files after you delete an event.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-ink">Scope of this build</h2>
            <p className="mt-2">
              PicDeck currently ships the Photo Selection module only. AI face search, printed
              flipbooks, invoicing and custom websites are separate products and are not part of
              this application. Payment collection is also not wired up: registration starts a
              14-day trial, and plans exist so the feature gating is real rather than decorative.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-ink">How it is built</h2>
            <p className="mt-2">
              The app is a single Next.js service with a relational database and local file storage.
              Thumbnails and previews are generated on upload; originals are kept untouched. It can
              be moved to object storage and Postgres without changing the product behaviour.
            </p>
          </div>

          <div className="rounded-xl border border-line bg-white p-6">
            <h2 className="text-lg font-semibold text-ink">Need help?</h2>
            <p className="mt-2">
              Write to <span className="text-ink">support@picdeck.example</span>, Monday to
              Saturday, 10:00–19:00 IST.
            </p>
            <Link
              href={user ? "/dashboard" : "/register"}
              className="mt-4 inline-block rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand/90"
            >
              {user ? "Open dashboard" : "Start a free trial"}
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
