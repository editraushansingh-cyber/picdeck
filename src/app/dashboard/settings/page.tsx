import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import QRCode from "qrcode";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureStudioCode } from "@/lib/studio";
import { driveConnected, oauthConfigured, redirectUri } from "@/lib/drive";
import { mailConfigured } from "@/lib/mail";
import { BrandingForm, DomainForm } from "@/components/StudioSettingsForms";
import { DriveSettings } from "@/components/DriveSettings";

export const metadata: Metadata = { title: "Studio settings — PicDeck" };
export const instant = false;

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ drive?: string }>;
}) {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { drive: driveNotice } = await searchParams;

  const code = await ensureStudioCode(user.id);
  const [site, counts] = await Promise.all([
    prisma.studioSite.findUnique({
      where: { userId: user.id },
      select: { slug: true, customDomain: true },
    }),
    prisma.event.count({ where: { userId: user.id, status: "ACTIVE" } }),
  ]);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const hubUrl = `${appUrl}/studio/${code}`;
  const dataUrl = await QRCode.toDataURL(hubUrl, { margin: 1, width: 480 });
  const drive = await driveConnected(user.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Studio settings</h1>
        <p className="mt-1 text-sm text-muted">
          Branding, one-QR studio hub, domains and storage.
        </p>
      </div>

      <section className="rounded-xl border border-line bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-medium">All events in one QR</h2>
            <p className="mt-1 text-sm text-muted">
              One scan opens every active event ({counts}) and its published flipbooks.
            </p>
            <p className="mt-3 break-all text-xs text-muted">{hubUrl}</p>
            <div className="mt-3 flex gap-2">
              <a
                href={hubUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-line px-3 py-2 text-sm font-medium hover:bg-surface"
              >
                Open hub
              </a>
              <a
                href={dataUrl}
                download="studio-hub-qr.png"
                className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand/90"
              >
                Download QR
              </a>
            </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={dataUrl} alt="Studio hub QR code" className="size-40 rounded-lg border border-line" />
        </div>
      </section>

      <BrandingForm
        watermarkText={user.watermarkText}
        logoUrl={user.logoPath ? `/api/studio-logo/${user.id}` : null}
        website={user.website}
        upiId={user.upiId}
        bankAccount={user.bankAccount}
        ifsc={user.ifsc}
      />

      <DomainForm
        domain={site?.customDomain ?? null}
        siteUrl={site ? `${appUrl}/s/${site.slug}` : null}
      />

      <section className="rounded-xl border border-line bg-white p-5">
        <h2 className="font-medium">Backgrounds</h2>
        <p className="mt-1 text-sm text-muted">
          Eight print-ready backdrops for spreads and client cards.
        </p>
        <Link
          href="/dashboard/backgrounds"
          className="mt-3 inline-block rounded-lg border border-line px-3 py-2 text-sm font-medium hover:bg-surface"
        >
          Open background library
        </Link>
      </section>

      <section className="rounded-xl border border-line bg-white p-5">
        <h2 className="font-medium">Mobile app</h2>
        <p className="mt-1 text-sm text-muted">
          PicDeck installs from the browser — no store download. On Android use Chrome&apos;s
          “Install app”; on iPhone use Safari&apos;s Share → “Add to Home Screen”. The app shell and
          icons are cached; galleries need a connection.
        </p>
        <a
          href="/manifest.webmanifest"
          className="mt-3 inline-block text-sm font-medium text-brand hover:underline"
        >
          View the app manifest
        </a>
      </section>

      <DriveSettings
        data={{
          oauthAvailable: oauthConfigured(),
          status: drive?.status === "CONNECTED" || drive?.status === "REVOKED" || drive?.status === "ERROR"
            ? drive.status
            : "NONE",
          email: drive?.email ?? null,
          connectedAt: drive?.connectedAt
            ? drive.connectedAt.toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })
            : null,
          lastError: drive?.lastError ?? null,
          originalStore: drive?.status === "CONNECTED" ? "DRIVE" : "LOCAL",
          notice: driveNotice ?? null,
        }}
      />

      <section className="rounded-xl border border-line bg-white p-5">
        <h2 className="font-medium">Email</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Provider</dt>
            <dd className="text-right">
              {mailConfigured() ? "Configured" : "Not configured — queued with mailto"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">SMS / WhatsApp</dt>
            <dd className="text-right">Not used</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-muted">
          Email needs <code className="rounded bg-surface px-1">RESEND_API_KEY</code>; the Drive
          redirect URI must be <code className="break-all rounded bg-surface px-1">{redirectUri()}</code>.
        </p>
      </section>
    </div>
  );
}
