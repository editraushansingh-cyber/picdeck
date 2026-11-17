import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Terms — PicDeck",
  description: "The terms that apply to a PicDeck studio account and client galleries.",
};

const sections = [
  {
    heading: "1. The service",
    body: [
      "PicDeck provides private client galleries for photo selection. A studio account can create events, upload photos, share a gallery link or six-digit code, and download the list of photos a client selected.",
      "This build covers the Photo Selection module only. Features described elsewhere (AI face search, flipbooks, invoicing, custom websites) are not included unless they appear inside your account.",
    ],
  },
  {
    heading: "2. Accounts",
    body: [
      "You must verify a phone number and provide a valid email address to create an account. You are responsible for keeping your password confidential and for activity under your account.",
      "One account represents one studio. Do not share credentials between businesses.",
    ],
  },
  {
    heading: "3. Your content",
    body: [
      "You keep ownership of the photos you upload and of the selection data attached to them. You grant PicDeck only the permission needed to store the files, generate previews and thumbnails, and serve them to people you have given the gallery code to.",
      "You confirm that you have the right to upload every photo, including the consent of the people in them.",
    ],
  },
  {
    heading: "4. Client access",
    body: [
      "A gallery is accessible with its link or six-digit code. You are responsible for who receives that code. Regenerating the code invalidates the previous one immediately.",
      "Clients do not create accounts. Anything a client submits (a selection list, a name, a phone number) is stored so you can view it.",
    ],
  },
  {
    heading: "5. Plans",
    body: [
      "New accounts start on the Free plan. A payment method is not required to create an account.",
      "Paid plans are monthly, half-yearly or yearly. Prices are shown on the Plans page in Indian Rupees and may change for future billing periods.",
      "This build does not process payments. If no active plan remains, galleries stop accepting new selections; existing files are not deleted automatically.",
    ],
  },
  {
    heading: "6. Acceptable use",
    body: [
      "Do not upload unlawful content, malware, or photos you have no permission to distribute. Do not attempt to access galleries that were not shared with you, probe codes in bulk, or interfere with the service.",
      "We may suspend an account that attacks the service or uses it to distribute content that is illegal in India.",
    ],
  },
  {
    heading: "7. Deletion",
    body: [
      "Deleting an event removes its photos, generated previews and thumbnails, selection records, and the gallery code from our storage. Deletion cannot be undone.",
      "Deleting your account removes your events in the same way. Backups, if any, rotate out within a short retention window.",
    ],
  },
  {
    heading: "8. Availability and liability",
    body: [
      "We aim to keep the service available, but it is provided as-is. We are not liable for indirect losses, including lost bookings or missed delivery deadlines, to the extent permitted by law.",
      "Our total liability for any claim is limited to the amount you paid for the service in the three months before the claim.",
    ],
  },
  {
    heading: "9. Changes",
    body: [
      "We may update these terms. Material changes will be announced in the dashboard or by email before they take effect. Continuing to use the service after a change means you accept the new terms.",
    ],
  },
  {
    heading: "10. Contact",
    body: ["Questions about these terms: support@picdeck.example."],
  },
];

// This route reads the session cookie, event params or search params on every request.
export const instant = false;


export default async function TermsPage() {
  await connection();
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader signedIn={!!user} />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-5 py-12">
          <h1 className="text-3xl font-semibold tracking-tight">Terms of service</h1>
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
            See also the <Link href="/privacy" className="text-ink underline">Privacy Policy</Link>{" "}
            and the <Link href="/plans" className="text-ink underline">Plans</Link>.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
