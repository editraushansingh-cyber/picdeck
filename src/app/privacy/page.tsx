import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Privacy — PicDeck",
  description: "What PicDeck stores, why, and how to have it deleted.",
};

const sections = [
  {
    heading: "What we collect",
    body: [
      "Account data: your name, email address, phone number, password hash, profession, and optional city, postal code and billing address.",
      "Gallery data: event titles, dates, client name and phone (if you enter them), uploaded photos, generated thumbnails and previews, and the list of photos a client selected along with the name and phone the client chose to type.",
      "Security data: one-time codes (stored as a hash), expiry and attempt counters, and failed gallery-code attempts with the requesting IP address and a timestamp.",
    ],
  },
  {
    heading: "Why we hold it",
    body: [
      "Account and gallery data exist to run the product: authenticate you, show your events, serve photos to people you shared a code with, and display the selection list.",
      "Security data exists to stop code guessing and OTP abuse. Failed gallery attempts are deleted as part of normal cleanup; they are not used for advertising.",
    ],
  },
  {
    heading: "Cookies",
    body: [
      "PicDeck sets one session cookie after login. It is signed, HttpOnly, SameSite=Lax, and lasts 14 days.",
      "Opening a client gallery sets a per-event cookie for 12 hours so the client does not have to retype the code on every page. No analytics or advertising cookies are used in this build.",
    ],
  },
  {
    heading: "Who can see a gallery",
    body: [
      "The studio that owns the event, and anyone who has the gallery link or six-digit code. Codes can be regenerated at any time, which immediately revokes the old one.",
      "Photos are served through an authenticated route; files are not exposed by a public, guessable path.",
    ],
  },
  {
    heading: "Where data lives",
    body: [
      "The database and photo files are stored on the server that runs this installation. If the installation is moved to hosted storage, the same rules apply to that provider.",
      "Uploaded originals are kept untouched. Thumbnails and previews are derived copies; RAW files have no derived preview.",
    ],
  },
  {
    heading: "Retention and deletion",
    body: [
      "Deleting an event removes its photos, previews, thumbnails, selection records and gallery code from disk. Deleting your account removes your events in the same way.",
      "One-time codes and gallery attempt records are short-lived by design: codes expire after 10 minutes, and attempt records are only relevant to a 15-minute window.",
    ],
  },
  {
    heading: "Your choices",
    body: [
      "You can edit event settings, turn client downloads on or off, regenerate a code, archive an event, or delete it from the dashboard.",
      "To request a copy or deletion of your account data, write to support@picdeck.example from the email address on the account.",
    ],
  },
  {
    heading: "Security",
    body: [
      "Passwords are hashed with bcrypt. Sessions are signed cookies. Gallery codes are rate-limited per device and per gallery. Uploads are size- and type-checked.",
      "No system is perfect. If you believe a gallery has been exposed, regenerate its code immediately and contact support.",
    ],
  },
  {
    heading: "Children",
    body: [
      "The service is intended for professional use by adults. It is not directed at children, and we do not knowingly create accounts for them.",
    ],
  },
  {
    heading: "Changes and contact",
    body: [
      "We will announce material changes to this policy in the dashboard or by email. Questions: support@picdeck.example.",
    ],
  },
];

// This route reads the session cookie, event params or search params on every request.
export const instant = false;


export default async function PrivacyPage() {
  await connection();
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader signedIn={!!user} />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-5 py-12">
          <h1 className="text-3xl font-semibold tracking-tight">Privacy policy</h1>
          <p className="mt-2 text-sm text-muted">Last updated: 13 November 2026</p>

          <div className="mt-8 space-y-7 text-sm leading-relaxed text-muted">
            {sections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-base font-semibold text-ink">{section.heading}</h2>
                {section.body.map((paragraph) => (
                  <p key={paragraph} className="mt-2">
                    {paragraph}
                  </p>
                ))}
              </section>
            ))}
          </div>

          <p className="mt-10 rounded-xl border border-line bg-surface p-4 text-sm text-muted">
            See also the <Link href="/terms" className="text-ink underline">Terms of service</Link>.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
