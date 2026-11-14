import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isGalleryUnlocked } from "@/lib/gallery-session";


/**
 * Lightweight snapshot for the client gallery: the current list of ready photo
 * ids plus the client's live selection. Used when the SSE stream reports new
 * uploads (so the grid can pull the new tiles) and as the polling fallback.
 */
export async function GET(
  _request: Request,
  context: RouteContext<"/api/events/[id]/gallery-state">,
) {
  const { id: eventId } = await context.params;
  if (!(await isGalleryUnlocked(eventId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      status: true,
      photos: {
        where: { status: "READY" },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          originalName: true,
          isRaw: true,
          width: true,
          height: true,
          thumbPath: true,
          previewPath: true,
          thumbDriveFileId: true,
          previewDriveFileId: true,
        },
      },
      selections: { select: { photoId: true } },
    },
  });
  if (!event || event.status !== "ACTIVE") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    photos: event.photos.map((photo) => ({
      id: photo.id,
      originalName: photo.originalName,
      isRaw: photo.isRaw,
      width: photo.width,
      height: photo.height,
      hasThumb: !!photo.thumbPath || !!photo.thumbDriveFileId,
      hasPreview: !!photo.previewPath || !!photo.previewDriveFileId,
    })),
    selectedIds: event.selections.map((row) => row.photoId),
  });
}