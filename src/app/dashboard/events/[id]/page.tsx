import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import QRCode from "qrcode";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { accessFor } from "@/lib/access";
import { UploadDropzone } from "@/components/UploadDropzone";
import { PhotoGrid } from "@/components/PhotoGrid";
import { LiveSelectionSummary } from "@/components/LiveSelectionSummary";
import { AlbumPanel, FaceGroupsPanel } from "@/components/EventModules";
import {
  DangerZone,
  DownloadAllSelected,
  SettingsPanel,
  SharePanel,
} from "@/components/EventPanels";

export const metadata: Metadata = { title: "Event — PicDeck" };

// This route reads the session cookie, event params or search params on every request.
export const instant = false;

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  // The page is realtime data: session, params and the QR code all render per request.
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const [event, access] = await Promise.all([
    prisma.event.findFirst({
      where: { id, userId: user.id },
      include: {
        photos: { orderBy: { createdAt: "asc" } },
        selections: { include: { photo: true }, orderBy: { createdAt: "asc" } },
        albums: { orderBy: { createdAt: "desc" }, include: { _count: { select: { pages: true } } } },
      },
    }),
    accessFor(user.id),
  ]);
  if (!event) notFound();

  const indexedCount = await prisma.faceDescriptor.count({
    where: { photo: { eventId: event.id } },
  });

  const driveLink = await prisma.driveLink.findUnique({
    where: { userId: user.id },
    select: { status: true },
  });
  const driveReady = driveLink?.status === "CONNECTED";
  const driveRequired = process.env.STORAGE_PROVIDER === "supabase";

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const galleryUrl = `${appUrl}/g/${event.galleryCode}`;
  const qrDataUrl = await QRCode.toDataURL(galleryUrl, { margin: 1, width: 256 });

  const selectedIds = new Set(event.selections.map((selection) => selection.photoId));
  const downloads = event.selections.map((selection) => ({
    id: selection.photo.id,
    name: selection.photo.originalName,
    url: `/api/photos/${selection.photo.id}/file?kind=original&download=1`,
  }));
  const lastSelection = event.selections.at(-1)?.createdAt ?? null;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href="/dashboard" className="text-sm text-muted hover:text-ink">
            ← All events
          </Link>
          <h1 className="mt-2 truncate text-2xl font-semibold tracking-tight">{event.title}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
            <span>
              {event.eventDate
                ? event.eventDate.toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                : "Date not set"}
            </span>
            <span aria-hidden>·</span>
            <span>{event.photos.length} photos</span>
            <span aria-hidden>·</span>
            <LiveSelectionSummary eventId={event.id} initialCount={event.selections.length} />
            {event.status !== "ACTIVE" && (
              <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-muted">
                Archived
              </span>
            )}
          </p>
          {event.clientName && (
            <p className="mt-1 text-sm text-muted">
              Client: <span className="text-ink">{event.clientName}</span>
              {event.clientPhone && <span className="text-muted"> · {event.clientPhone}</span>}
            </p>
          )}
        </div>
        <a
          href={galleryUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium hover:bg-surface"
        >
          Preview client view
        </a>
      </div>

      <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <section>
            <h2 className="mb-3 font-medium">Add photos</h2>
            <UploadDropzone eventId={event.id} driveConnected={driveReady} driveRequired={driveRequired} />
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-medium">Photos</h2>
              <span className="text-xs text-muted">Picked photos are marked</span>
            </div>
            <PhotoGrid
              eventId={event.id}
              photos={event.photos.map((photo) => ({
                id: photo.id,
                originalName: photo.originalName,
                isRaw: photo.isRaw,
                hasThumb: !!photo.thumbPath || !!photo.thumbDriveFileId,
                sizeBytes: photo.sizeBytes,
                selected: selectedIds.has(photo.id),
              }))}
            />
          </section>

          <section className="rounded-xl border border-line bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-medium">Client selection</h2>
                <p className="mt-1 text-sm text-muted">
                  {event.selections.length === 0
                    ? "Nothing selected yet."
                    : `Last updated ${lastSelection?.toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "numeric",
                        minute: "2-digit",
                      })}`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={`/api/events/${event.id}/download`}
                  className="rounded-lg border border-line px-4 py-2 text-sm font-medium hover:bg-surface"
                >
                  Folder .zip
                </a>
                <DownloadAllSelected items={downloads} />
              </div>
            </div>

            {event.selections.length === 0 ? (
              <p className="mt-4 rounded-lg border border-dashed border-line bg-surface px-4 py-6 text-center text-sm text-muted">
                Share the code above. The list appears here the moment your client sends it.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-line">
                {event.selections.map((selection, index) => (
                  <li
                    key={selection.id}
                    className="flex items-center justify-between gap-3 py-2 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="w-6 shrink-0 text-right font-mono text-xs text-muted">
                        {index + 1}
                      </span>
                      <span className="truncate" title={selection.photo.originalName}>
                        {selection.photo.originalName}
                      </span>
                    </span>
                    <a
                      href={`/api/photos/${selection.photo.id}/file?kind=original&download=1`}
                      className="shrink-0 text-xs font-medium text-brand hover:underline"
                    >
                      Download
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-5">
          <SharePanel
            eventId={event.id}
            galleryUrl={galleryUrl}
            code={event.galleryCode}
            qrDataUrl={qrDataUrl}
          />
          <SettingsPanel
            eventId={event.id}
            selectionLimit={event.selectionLimit}
            downloadEnabled={event.downloadEnabled}
            originalDownloadEnabled={event.originalDownloadEnabled}
            clientEmail={event.clientEmail}
          />
          <AlbumPanel
            eventId={event.id}
            allowed={access.can("album")}
            selectedCount={event.selections.length}
            photoCount={event.photos.length}
            albums={event.albums.map((album) => ({
              id: album.id,
              slug: album.slug,
              title: album.title,
              published: album.published,
              pages: album._count.pages,
              url: `${appUrl}/album/${album.slug}`,
            }))}
          />
          <FaceGroupsPanel
            eventId={event.id}
            allowed={access.can("faces")}
            indexed={indexedCount}
            total={event.photos.length}
          />
          <DangerZone eventId={event.id} title={event.title} archived={event.status !== "ACTIVE"} />
        </aside>
      </div>
    </div>
  );
}
