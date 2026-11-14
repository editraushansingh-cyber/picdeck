import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { prisma } from "@/lib/db";
import { getUnlockedEvent } from "@/lib/gallery-session";
import { accessFor } from "@/lib/access";
import { GallerySelector } from "@/components/GallerySelector";
import { FaceSearch } from "@/components/FaceSearch";
import { faceTagsForEvent } from "@/lib/face-tags";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = { title: "Your gallery — PicDeck" };

// This route reads the session cookie, event params or search params on every request.
export const instant = false;

export default async function ClientGalleryPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  // Reading the unlock cookie must happen per request, not in the static shell.
  await connection();
  const { code } = await params;
  const clean = code.replace(/\D/g, "").slice(0, 6);
  if (clean.length !== 6) notFound();

  const event = await prisma.event.findUnique({ where: { galleryCode: clean } });
  if (!event || event.status !== "ACTIVE") notFound();

  const gallery = await getUnlockedEvent(event.id);
  if (!gallery) redirect(`/g?code=${event.galleryCode}`);

  // Face search is a studio plan feature; client galleries of Basic studios skip it.
  const access = await accessFor(event.userId);
  const faceTags = access.can("faces") ? await faceTagsForEvent(event.id) : [];

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-line">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
          <Logo compact />
          <span className="text-xs text-muted">Private gallery</span>
        </div>
      </div>

      {access.can("faces") && <FaceSearch code={event.galleryCode} tags={faceTags} />}

      <GallerySelector
        gallery={{
          id: gallery.id,
          title: gallery.title,
          clientName: gallery.clientName,
          note: gallery.note,
          selectionLimit: gallery.selectionLimit,
          downloadEnabled: gallery.downloadEnabled,
          originalDownloadEnabled: gallery.originalDownloadEnabled,
          photos: gallery.photos.map((photo) => ({
            id: photo.id,
            originalName: photo.originalName,
            isRaw: photo.isRaw,
            width: photo.width,
            height: photo.height,
            hasThumb: !!photo.thumbPath,
            hasPreview: !!photo.previewPath,
          })),
          selectedIds: gallery.selections.map((selection) => selection.photoId),
        }}
      />

      <footer className="mx-auto max-w-6xl px-5 py-8 text-center text-xs text-muted">
        {event.downloadEnabled && (
          <a
            href={`/api/events/${event.id}/download`}
            className="mb-3 inline-block rounded-lg border border-line px-3 py-1.5 font-medium text-ink hover:bg-surface"
          >
            Download the whole folder (.zip)
          </a>
        )}
        <p>
          Your list goes straight to your photographer.{" "}
          <Link href="/" className="underline hover:text-ink">
            About PicDeck
          </Link>
        </p>
      </footer>
    </div>
  );
}
