import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { prisma } from "@/lib/db";
import { getUnlockedEvent } from "@/lib/gallery-session";
import { accessFor } from "@/lib/access";
import { GallerySelector } from "@/components/GallerySelector";
import { FaceSearch } from "@/components/FaceSearch";
import { faceTagsForEvent } from "@/lib/face-tags";

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

  const event = await prisma.event.findUnique({
    where: { galleryCode: clean },
    include: { user: { select: { name: true } } },
  });
  if (!event || event.status !== "ACTIVE") notFound();

  const gallery = await getUnlockedEvent(event.id);
  if (!gallery) redirect(`/g?code=${event.galleryCode}`);

  // Face search is a studio plan feature; client galleries of Basic studios skip it.
  const access = await accessFor(event.userId);
  const faceTags = access.can("faces") ? await faceTagsForEvent(event.id) : [];

  return (
    <div className="pg-shell">
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
            hasThumb: !!photo.thumbPath || !!photo.thumbDriveFileId,
            hasPreview: !!photo.previewPath || !!photo.previewDriveFileId,
          })),
          selectedIds: gallery.selections.map((selection) => selection.photoId),
          studioName: event.user.name,
          eventDate: event.eventDate ? event.eventDate.toISOString() : null,
          coverPhotoId:
            gallery.photos.find((photo) => photo.thumbPath || photo.thumbDriveFileId)?.id ?? null,
        }}
        faceSearch={
          access.can("faces") ? (
            <FaceSearch code={event.galleryCode} tags={faceTags} tone="dark" />
          ) : null
        }
      />
    </div>
  );
}
